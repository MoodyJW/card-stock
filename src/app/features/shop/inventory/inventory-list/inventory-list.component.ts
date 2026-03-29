import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CurrencyPipe, TitleCasePipe } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { InventoryService } from '../../../../core/services/inventory.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { InventoryFilters, InventoryItem } from '../../../../core/models/inventory.model';
import { ConditionLabelPipe } from '../../../../shared/pipes/condition-label.pipe';
import { ExportService } from '../../../../core/services/export.service';
import { ShopContextService } from '../../../../core/services/shop-context.service';
import { FilterBarComponent } from '../filter-bar/filter-bar.component';
import {
  CardFormDialogComponent,
  CardFormDialogData,
} from '../card-form-dialog/card-form-dialog.component';
import { InventoryGridComponent } from '../inventory-grid/inventory-grid.component';
import {
  MarkSoldDialogComponent,
  MarkSoldDialogData,
} from '../mark-sold-dialog/mark-sold-dialog.component';

@Component({
  selector: 'app-inventory-list',
  imports: [
    CurrencyPipe,
    TitleCasePipe,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatChipsModule,
    MatIconModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    ConditionLabelPipe,
    FilterBarComponent,
    InventoryGridComponent,
  ],
  templateUrl: './inventory-list.component.html',
  styleUrl: './inventory-list.component.scss',
})
export class InventoryListComponent {
  private readonly inventoryService = inject(InventoryService);
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly dialog = inject(MatDialog);
  private readonly notify = inject(NotificationService);
  private readonly exportService = inject(ExportService);
  private readonly shopContext = inject(ShopContextService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  constructor() {
    this.inventoryService.getDistinctSetNames();
  }

  readonly items = this.inventoryService.items;
  readonly loading = this.inventoryService.loading;
  readonly totalCount = this.inventoryService.totalCount;
  readonly page = this.inventoryService.page;
  readonly pageSize = this.inventoryService.pageSize;
  readonly sortColumn = this.inventoryService.sortColumn;
  readonly sortDirection = this.inventoryService.sortDirection;
  readonly distinctSetNames = this.inventoryService.distinctSetNames;

  readonly isMobile = toSignal(this.breakpointObserver.observe('(max-width: 767px)'), {
    initialValue: { matches: false, breakpoints: {} },
  });

  readonly isExporting = signal(false);

  readonly userDisplayMode = signal<'table' | 'grid'>('table');
  readonly displayMode = computed(() =>
    this.isMobile().matches ? 'grid' : this.userDisplayMode(),
  );

  readonly displayedColumns = [
    'card_name',
    'set_name',
    'card_number',
    'condition',
    'grade',
    'purchase_price',
    'selling_price',
    'status',
    'actions',
  ];

  readonly pageSizeOptions = [10, 25, 50, 100];

  navigateToCard(item: InventoryItem): void {
    this.router.navigate(['inventory', item.id], { relativeTo: this.route.parent });
  }

  onSortChange(sort: Sort): void {
    if (sort.direction) {
      this.inventoryService.setSort(sort.active, sort.direction);
    } else {
      this.inventoryService.setSort('created_at', 'desc');
    }
  }

  onPageChange(event: PageEvent): void {
    this.inventoryService.setPagination(event.pageIndex, event.pageSize);
  }

  onFiltersChange(filters: InventoryFilters): void {
    this.inventoryService.setFilters(filters);
  }

  async exportData(format: 'csv' | 'excel'): Promise<void> {
    this.isExporting.set(true);

    try {
      const { data, isCapped, error } = await this.inventoryService.fetchAllFiltered();

      if (error) {
        this.notify.error('Failed to prepare export data');
        return;
      }

      if (isCapped) {
        this.notify.error('Export capped at 10,000 items');
      }

      if (data.length === 0) {
        this.notify.error('No items to export');
        return;
      }

      const shopSlug = this.shopContext.currentShopSlug() || 'unknown-shop';

      if (format === 'csv') {
        await this.exportService.exportCsv(data, shopSlug);
      } else {
        await this.exportService.exportExcel(data, shopSlug);
      }
    } finally {
      this.isExporting.set(false);
    }
  }

  formatGrade(item: InventoryItem): string {
    if (!item.grading_company || item.grade == null) return '—';
    return `${item.grading_company.toUpperCase()} ${item.grade}`;
  }

  openAddDialog(): void {
    this.dialog.open(CardFormDialogComponent, {
      data: { mode: 'add' } satisfies CardFormDialogData,
      ...this.dialogConfig,
    });
  }

  openEditDialog(item: InventoryItem): void {
    this.dialog.open(CardFormDialogComponent, {
      data: { mode: 'edit', card: item } satisfies CardFormDialogData,
      ...this.dialogConfig,
    });
  }

  openSellDialog(item: InventoryItem): void {
    this.dialog.open(MarkSoldDialogComponent, {
      data: { card: item } satisfies MarkSoldDialogData,
      ...this.dialogConfig,
    });
  }

  async toggleReserved(item: InventoryItem): Promise<void> {
    const { error } = await this.inventoryService.toggleReserved(item);
    if (error) {
      this.notify.error('Failed to update status');
    } else {
      const label = item.status === 'reserved' ? 'available' : 'reserved';
      this.notify.success(`Card marked as ${label}`);
    }
  }

  async deleteCard(item: InventoryItem): Promise<void> {
    const { error } = await this.inventoryService.softDeleteCard(item.id);
    if (error) {
      this.notify.error('Failed to delete card');
      return;
    }

    const snackRef = this.notify.showWithAction('Card deleted', 'Undo', 5000);
    snackRef.onAction().subscribe(async () => {
      const { error: restoreError } = await this.inventoryService.restoreDeletedCard(item.id);
      if (restoreError) {
        this.notify.error('Failed to restore card');
      } else {
        this.notify.info('Card restored');
      }
    });
  }

  private get dialogConfig() {
    const isMobile = this.breakpointObserver.isMatched('(max-width: 599px)');
    return isMobile
      ? { width: '96vw', height: '96vh', panelClass: 'fullscreen-dialog' }
      : { width: '600px', maxHeight: '90vh' };
  }
}
