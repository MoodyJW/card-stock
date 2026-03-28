import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { InventoryService } from '../../../../core/services/inventory.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { InventoryItem } from '../../../../core/models/inventory.model';

export interface MarkSoldDialogData {
  card: InventoryItem;
}

@Component({
  selector: 'app-mark-sold-dialog',
  imports: [
    CurrencyPipe,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './mark-sold-dialog.component.html',
  styleUrl: './mark-sold-dialog.component.scss',
})
export class MarkSoldDialogComponent {
  readonly data = inject<MarkSoldDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<MarkSoldDialogComponent>);
  private readonly fb = inject(FormBuilder);
  private readonly inventoryService = inject(InventoryService);
  private readonly notify = inject(NotificationService);

  readonly loading = signal(false);
  readonly card = this.data.card;

  readonly form = this.fb.nonNullable.group({
    sold_price: [this.data.card.selling_price ?? (null as number | null), [Validators.required]],
    buyer_email: ['', [Validators.email]],
    buyer_notes: [''],
  });

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);

    const { sold_price, buyer_email, buyer_notes } = this.form.getRawValue();

    const { data, error } = await this.inventoryService.markAsSold({
      inventory_id: this.card.id,
      sold_price: sold_price!,
      buyer_email: buyer_email || undefined,
      buyer_notes: buyer_notes || undefined,
    });

    if (error) {
      this.notify.error(
        typeof error === 'object' && error !== null && 'message' in error
          ? (error as { message: string }).message
          : 'Failed to mark card as sold',
      );
      this.loading.set(false);
      return;
    }

    this.notify.success('Card marked as sold');
    this.dialogRef.close(data);
  }
}
