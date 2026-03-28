import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi } from 'vitest';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MarkSoldDialogComponent, MarkSoldDialogData } from './mark-sold-dialog.component';
import { InventoryService } from '../../../../core/services/inventory.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { InventoryItem } from '../../../../core/models/inventory.model';

const mockCard: InventoryItem = {
  id: 'card-1',
  organization_id: 'org-1',
  card_name: 'Charizard VMAX',
  set_name: 'Shining Fates',
  card_number: '025/072',
  language: 'English',
  is_foil: true,
  condition: 'mint',
  selling_price: 300,
  purchase_price: 150,
  status: 'available',
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

const inventoryServiceMock = {
  markAsSold: vi.fn(),
};

const notifyMock = {
  success: vi.fn(),
  error: vi.fn(),
};

const dialogRefMock = {
  close: vi.fn(),
};

function createComponent(card: InventoryItem = mockCard) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [MarkSoldDialogComponent, NoopAnimationsModule],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: { card } satisfies MarkSoldDialogData },
      { provide: MatDialogRef, useValue: dialogRefMock },
      { provide: InventoryService, useValue: inventoryServiceMock },
      { provide: NotificationService, useValue: notifyMock },
    ],
  });

  // Reset mocks
  vi.clearAllMocks();

  const fixture = TestBed.createComponent(MarkSoldDialogComponent);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance };
}

describe('MarkSoldDialogComponent', () => {
  it('should pre-fill sold_price from selling_price', () => {
    const { component } = createComponent();
    expect(component.form.controls.sold_price.value).toBe(300);
  });

  it('should leave sold_price null when card has no selling_price', () => {
    const cardNoPrice = { ...mockCard, selling_price: undefined };
    const { component } = createComponent(cardNoPrice);
    expect(component.form.controls.sold_price.value).toBeNull();
  });

  it('should require sold_price', () => {
    const { component } = createComponent();
    component.form.controls.sold_price.setValue(null);
    expect(component.form.controls.sold_price.hasError('required')).toBe(true);
    expect(component.form.invalid).toBe(true);
  });

  it('should validate buyer_email as email format', () => {
    const { component } = createComponent();
    component.form.controls.buyer_email.setValue('not-an-email');
    expect(component.form.controls.buyer_email.hasError('email')).toBe(true);

    component.form.controls.buyer_email.setValue('valid@example.com');
    expect(component.form.controls.buyer_email.valid).toBe(true);
  });

  it('should display card summary info', () => {
    const { fixture } = createComponent();
    const el = fixture.nativeElement;

    expect(el.querySelector('.card-name').textContent).toContain('Charizard VMAX');
    expect(el.querySelector('.card-set').textContent).toContain('Shining Fates');
    expect(el.querySelector('.card-price').textContent).toContain('$300');
  });

  it('should display warning text', () => {
    const { fixture } = createComponent();
    const warning = fixture.nativeElement.querySelector('.warning-text');
    expect(warning.textContent).toContain('cannot be undone');
  });

  it('should call markAsSold with correct params on submit', async () => {
    const { component } = createComponent();
    inventoryServiceMock.markAsSold.mockResolvedValue({ data: { id: 'tx-1' }, error: null });

    component.form.patchValue({
      sold_price: 275,
      buyer_email: 'buyer@example.com',
      buyer_notes: 'Great card!',
    });

    await component.onSubmit();

    expect(inventoryServiceMock.markAsSold).toHaveBeenCalledWith({
      inventory_id: 'card-1',
      sold_price: 275,
      buyer_email: 'buyer@example.com',
      buyer_notes: 'Great card!',
    });
    expect(notifyMock.success).toHaveBeenCalledWith('Card marked as sold');
    expect(dialogRefMock.close).toHaveBeenCalledWith({ id: 'tx-1' });
  });

  it('should show error toast and keep dialog open on failure', async () => {
    const { component } = createComponent();
    inventoryServiceMock.markAsSold.mockResolvedValue({
      data: null,
      error: { message: 'Card is not available' },
    });

    await component.onSubmit();

    expect(notifyMock.error).toHaveBeenCalledWith('Card is not available');
    expect(dialogRefMock.close).not.toHaveBeenCalled();
  });

  it('should not submit when form is invalid', async () => {
    const { component } = createComponent();
    component.form.controls.sold_price.setValue(null);

    await component.onSubmit();

    expect(inventoryServiceMock.markAsSold).not.toHaveBeenCalled();
  });
});
