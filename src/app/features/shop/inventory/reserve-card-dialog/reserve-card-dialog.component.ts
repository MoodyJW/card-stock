import { Component, inject, signal } from '@angular/core';
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

export interface ReserveCardDialogData {
  card: InventoryItem;
}

@Component({
  selector: 'app-reserve-card-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './reserve-card-dialog.component.html',
  styleUrl: './reserve-card-dialog.component.scss',
})
export class ReserveCardDialogComponent {
  readonly data = inject<ReserveCardDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ReserveCardDialogComponent>);
  private readonly fb = inject(FormBuilder);
  private readonly inventoryService = inject(InventoryService);
  private readonly notify = inject(NotificationService);

  readonly loading = signal(false);
  readonly card = this.data.card;
  readonly isReserved = this.card.status === 'reserved';

  readonly form = this.fb.nonNullable.group({
    reserved_by_name: [this.card.reserved_by_name ?? '', [Validators.required]],
    reserved_by_email: [this.card.reserved_by_email ?? '', [Validators.email]],
    reserved_by_phone: [this.card.reserved_by_phone ?? ''],
    reservation_notes: [this.card.reservation_notes ?? ''],
  });

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);

    const { reserved_by_name, reserved_by_email, reserved_by_phone, reservation_notes } =
      this.form.getRawValue();

    const { error } = await this.inventoryService.reserveCard({
      inventory_id: this.card.id,
      reserved_by_name,
      reserved_by_email: reserved_by_email || undefined,
      reserved_by_phone: reserved_by_phone || undefined,
      reservation_notes: reservation_notes || undefined,
    });

    if (error) {
      this.notify.error('Failed to reserve card');
      this.loading.set(false);
      return;
    }

    this.notify.success('Card reserved');
    this.dialogRef.close(true);
  }

  async onUnreserve(): Promise<void> {
    this.loading.set(true);

    const { error } = await this.inventoryService.unreserveCard(this.card.id);

    if (error) {
      this.notify.error('Failed to unreserve card');
      this.loading.set(false);
      return;
    }

    this.notify.success('Card unreserved');
    this.dialogRef.close(true);
  }
}
