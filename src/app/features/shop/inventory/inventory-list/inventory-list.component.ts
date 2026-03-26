import { Component, computed, inject, signal } from '@angular/core';
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
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { InventoryService } from '../../../../core/services/inventory.service';
import { InventoryFilters, InventoryItem } from '../../../../core/models/inventory.model';
import { ConditionLabelPipe } from '../../../../shared/pipes/condition-label.pipe';
import { FilterBarComponent } from '../filter-bar/filter-bar.component';
import {
  CardFormDialogComponent,
  CardFormDialogData,
} from '../card-form-dialog/card-form-dialog.component';

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
    ConditionLabelPipe,
    FilterBarComponent,
  ],
  templateUrl: './inventory-list.component.html',
  styleUrl: './inventory-list.component.scss',
})
export class InventoryListComponent {
  private readonly inventoryService = inject(InventoryService);
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly dialog = inject(MatDialog);

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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  openSellDialog(_item: InventoryItem): void {
    // Ticket 6
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  deleteCard(_item: InventoryItem): void {
    // Ticket 7
  }

  private get dialogConfig() {
    const isMobile = this.breakpointObserver.isMatched('(max-width: 599px)');
    return isMobile
      ? { width: '96vw', height: '96vh', panelClass: 'fullscreen-dialog' }
      : { width: '600px', maxHeight: '90vh' };
  }
}
