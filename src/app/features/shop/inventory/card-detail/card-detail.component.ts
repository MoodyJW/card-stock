import { Component, inject, signal, OnInit } from '@angular/core';
import { CurrencyPipe, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { BreakpointObserver } from '@angular/cdk/layout';
import { InventoryService } from '../../../../core/services/inventory.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { InventoryItem } from '../../../../core/models/inventory.model';
import { ConditionLabelPipe } from '../../../../shared/pipes/condition-label.pipe';
import {
  CardFormDialogComponent,
  CardFormDialogData,
} from '../card-form-dialog/card-form-dialog.component';
import {
  MarkSoldDialogComponent,
  MarkSoldDialogData,
} from '../mark-sold-dialog/mark-sold-dialog.component';

@Component({
  selector: 'app-card-detail',
  imports: [
    CurrencyPipe,
    TitleCasePipe,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    ConditionLabelPipe,
  ],
  templateUrl: './card-detail.component.html',
  styleUrl: './card-detail.component.scss',
})
export class CardDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly inventoryService = inject(InventoryService);
  private readonly notify = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly breakpointObserver = inject(BreakpointObserver);

  readonly card = signal<InventoryItem | null>(null);
  readonly loading = signal(true);
  readonly notFound = signal(false);

  async ngOnInit(): Promise<void> {
    const cardId = this.route.snapshot.paramMap.get('cardId');
    if (!cardId) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }
    await this.loadCard(cardId);
  }

  private async loadCard(cardId: string): Promise<void> {
    this.loading.set(true);
    const { data, error } = await this.inventoryService.getCardById(cardId);

    if (error || !data) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }

    this.card.set(data);
    this.loading.set(false);
  }

  formatGrade(item: InventoryItem): string {
    if (!item.grading_company || item.grade == null) return '—';
    return `${item.grading_company.toUpperCase()} ${item.grade}`;
  }

  goBack(): void {
    this.router.navigate(['../'], { relativeTo: this.route });
  }

  openEdit(): void {
    const card = this.card();
    if (!card) return;

    const isMobile = this.breakpointObserver.isMatched('(max-width: 599px)');
    const dialogConfig = isMobile
      ? { width: '96vw', height: '96vh', panelClass: 'fullscreen-dialog' }
      : { width: '600px', maxHeight: '90vh' };

    const dialogRef = this.dialog.open(CardFormDialogComponent, {
      data: { mode: 'edit', card } satisfies CardFormDialogData,
      ...dialogConfig,
    });

    dialogRef.afterClosed().subscribe(async (result: InventoryItem | undefined) => {
      if (result) {
        await this.loadCard(card.id);
      }
    });
  }

  openSell(): void {
    const card = this.card();
    if (!card) return;

    const isMobile = this.breakpointObserver.isMatched('(max-width: 599px)');
    const dialogConfig = isMobile
      ? { width: '96vw', height: '96vh', panelClass: 'fullscreen-dialog' }
      : { width: '600px', maxHeight: '90vh' };

    const dialogRef = this.dialog.open(MarkSoldDialogComponent, {
      data: { card } satisfies MarkSoldDialogData,
      ...dialogConfig,
    });

    dialogRef.afterClosed().subscribe(async (result: unknown) => {
      if (result) {
        await this.loadCard(card.id);
      }
    });
  }

  async deleteCard(): Promise<void> {
    const card = this.card();
    if (!card) return;

    const { error } = await this.inventoryService.softDeleteCard(card.id);
    if (error) {
      this.notify.error('Failed to delete card');
      return;
    }

    this.goBack();

    const snackRef = this.notify.showWithAction('Card deleted', 'Undo', 5000);
    snackRef.onAction().subscribe(async () => {
      const { error: restoreError } = await this.inventoryService.restoreDeletedCard(card.id);
      if (restoreError) {
        this.notify.error('Failed to restore card');
      } else {
        this.notify.info('Card restored');
      }
    });
  }
}
