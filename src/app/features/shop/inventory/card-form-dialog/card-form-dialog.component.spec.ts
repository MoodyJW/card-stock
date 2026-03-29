import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi } from 'vitest';
import { signal } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CardFormDialogComponent, CardFormDialogData } from './card-form-dialog.component';
import { InventoryService } from '../../../../core/services/inventory.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { InventoryItem } from '../../../../core/models/inventory.model';
import { ImageService } from '../../../../core/services/image.service';
import { InventoryImage } from '../../../../core/models/image.model';

const mockCard: InventoryItem = {
  id: '1',
  organization_id: 'org-1',
  card_name: 'Charizard VMAX',
  set_name: 'Shining Fates',
  set_code: 'SHF',
  card_number: '025/072',
  rarity: 'Ultra Rare',
  language: 'Japanese',
  is_foil: true,
  condition: 'mint',
  grading_company: 'psa',
  grade: 10,
  purchase_price: 150,
  selling_price: 300,
  status: 'available',
  notes: 'Pristine condition',
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

function createComponent(dialogData: CardFormDialogData) {
  const inventoryServiceMock = {
    addCard: vi.fn().mockResolvedValue({ data: { ...mockCard }, error: null }),
    updateCard: vi.fn().mockResolvedValue({ data: { ...mockCard }, error: null }),
    distinctSetNames: signal<string[]>(['Base Set', 'Shining Fates']),
  };
  const notifyMock = { error: vi.fn(), success: vi.fn(), info: vi.fn() };
  const dialogRefMock = { close: vi.fn() };
  const imageServiceMock = {
    getImages: vi.fn().mockResolvedValue([]),
    uploadImage: vi.fn().mockResolvedValue({ id: 'img-1', storage_path: 'foo', is_primary: true }),
    deleteImage: vi.fn().mockResolvedValue(true),
    setAsPrimary: vi.fn().mockResolvedValue(true),
  };

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [CardFormDialogComponent],
    providers: [
      provideNoopAnimations(),
      { provide: MAT_DIALOG_DATA, useValue: dialogData },
      { provide: MatDialogRef, useValue: dialogRefMock },
      { provide: InventoryService, useValue: inventoryServiceMock },
      { provide: NotificationService, useValue: notifyMock },
      { provide: ImageService, useValue: imageServiceMock },
    ],
  });

  const fixture = TestBed.createComponent(CardFormDialogComponent);
  fixture.detectChanges();

  return {
    fixture,
    component: fixture.componentInstance,
    inventoryServiceMock,
    notifyMock,
    dialogRefMock,
    imageServiceMock,
  };
}

describe('CardFormDialogComponent', () => {
  it('should render add mode with empty form and defaults', () => {
    const { component } = createComponent({ mode: 'add' });

    expect(component.form.controls.card_name.value).toBe('');
    expect(component.form.controls.condition.value).toBe('near_mint');
    expect(component.form.controls.language.value).toBe('English');
    expect(component.form.controls.is_foil.value).toBe(false);
    expect(component.form.controls.grading_company.value).toBe('');
    expect(component.title).toBe('Add Card');
    expect(component.submitLabel).toBe('Add Card');
  });

  it('should pre-fill form in edit mode', () => {
    const { component } = createComponent({ mode: 'edit', card: mockCard });

    expect(component.form.controls.card_name.value).toBe('Charizard VMAX');
    expect(component.form.controls.set_name.value).toBe('Shining Fates');
    expect(component.form.controls.set_code.value).toBe('SHF');
    expect(component.form.controls.card_number.value).toBe('025/072');
    expect(component.form.controls.rarity.value).toBe('Ultra Rare');
    expect(component.form.controls.language.value).toBe('Japanese');
    expect(component.form.controls.is_foil.value).toBe(true);
    expect(component.form.controls.condition.value).toBe('mint');
    expect(component.form.controls.grading_company.value).toBe('psa');
    expect(component.form.controls.grade.value).toBe(10);
    expect(component.form.controls.purchase_price.value).toBe(150);
    expect(component.form.controls.selling_price.value).toBe(300);
    expect(component.form.controls.notes.value).toBe('Pristine condition');
    expect(component.title).toBe('Edit Card');
    expect(component.submitLabel).toBe('Save Changes');
  });

  it('should hide grade field when no grading company selected', () => {
    const { component, fixture } = createComponent({ mode: 'add' });

    expect(component.form.controls.grade.disabled).toBe(true);
    const gradeInput = fixture.nativeElement.querySelector('input[formcontrolname="grade"]');
    expect(gradeInput).toBeFalsy();
  });

  it('should show grade field when grading company is selected', () => {
    const { component, fixture } = createComponent({ mode: 'add' });

    component.form.controls.grading_company.setValue('psa');
    fixture.detectChanges();

    expect(component.form.controls.grade.enabled).toBe(true);
    const gradeInput = fixture.nativeElement.querySelector('input[formcontrolname="grade"]');
    expect(gradeInput).toBeTruthy();
  });

  it('should require card_name', () => {
    const { component } = createComponent({ mode: 'add' });

    expect(component.form.valid).toBe(false);
    expect(component.form.controls.card_name.hasError('required')).toBe(true);

    component.form.controls.card_name.setValue('Pikachu');
    expect(component.form.controls.card_name.valid).toBe(true);
    expect(component.form.valid).toBe(true);
  });

  it('should call addCard on submit in add mode', async () => {
    const { component, inventoryServiceMock, dialogRefMock, notifyMock } = createComponent({
      mode: 'add',
    });

    component.form.controls.card_name.setValue('Pikachu');
    await component.onSubmit();

    expect(inventoryServiceMock.addCard).toHaveBeenCalled();
    expect(notifyMock.success).toHaveBeenCalledWith('Card added successfully');
    expect(dialogRefMock.close).toHaveBeenCalled();
  });

  it('should call updateCard on submit in edit mode', async () => {
    const { component, inventoryServiceMock, dialogRefMock, notifyMock } = createComponent({
      mode: 'edit',
      card: mockCard,
    });

    component.form.controls.card_name.setValue('Charizard VMAX Alt');
    await component.onSubmit();

    expect(inventoryServiceMock.updateCard).toHaveBeenCalledWith(mockCard.id, expect.any(Object));
    expect(notifyMock.success).toHaveBeenCalledWith('Card updated successfully');
    expect(dialogRefMock.close).toHaveBeenCalled();
  });

  describe('Image Operations', () => {
    it('should initialize with empty image slots in add mode', () => {
      const { component } = createComponent({ mode: 'add' });
      expect(component.newFrontImage()).toBeNull();
      expect(component.newBackImage()).toBeNull();
      expect(component.existingImages().length).toBe(0);
    });

    it('should sequentially append newly attached images locally on submit', async () => {
      const { component, inventoryServiceMock, imageServiceMock, notifyMock, dialogRefMock } =
        createComponent({ mode: 'add' });
      component.form.controls.card_name.setValue('Venusaur');

      const frontFile = new File([''], 'front.webp', { type: 'image/webp' });
      const backFile = new File([''], 'back.webp', { type: 'image/webp' });

      component.onAddFrontImage(frontFile);
      component.onAddBackImage(backFile);

      await component.onSubmit();

      expect(inventoryServiceMock.addCard).toHaveBeenCalled();
      expect(imageServiceMock.uploadImage).toHaveBeenCalledWith('1', frontFile, true);
      expect(imageServiceMock.uploadImage).toHaveBeenCalledWith('1', backFile, false);
      expect(notifyMock.success).toHaveBeenCalledWith('Card added successfully');
      expect(dialogRefMock.close).toHaveBeenCalled();
    });

    it('should correctly capture image omission errors indicating partial creation', async () => {
      const { component, inventoryServiceMock, imageServiceMock, notifyMock, dialogRefMock } =
        createComponent({ mode: 'add' });
      component.form.controls.card_name.setValue('BadCard');
      const frontFile = new File([''], 'front.webp', { type: 'image/webp' });
      component.onAddFrontImage(frontFile);

      // Force failure
      imageServiceMock.uploadImage.mockResolvedValueOnce(null);

      await component.onSubmit();

      expect(inventoryServiceMock.addCard).toHaveBeenCalled();
      expect(imageServiceMock.uploadImage).toHaveBeenCalledWith('1', frontFile, true);
      expect(notifyMock.info).toHaveBeenCalledWith(
        'Card created but some images failed to upload. You can add them later.',
      );
      expect(dialogRefMock.close).toHaveBeenCalled();
    });

    it('should pre-fetch mapped remote images sequentially on edit mode load', async () => {
      const { fixture, imageServiceMock } = createComponent({ mode: 'edit', card: mockCard });
      const serverImages = [{ id: 'img-100', storage_path: 'path/to.webp', is_primary: true }];
      imageServiceMock.getImages.mockResolvedValueOnce(serverImages);

      // Trigger ngOnInit equivalent
      await fixture.whenStable();

      expect(imageServiceMock.getImages).toHaveBeenCalledWith('1');
    });

    it('should trigger deletion modal when user issues a delete request in Edit mode', async () => {
      const { component, imageServiceMock, notifyMock } = createComponent({
        mode: 'edit',
        card: mockCard,
      });
      // Stub window.confirm to bypass blocking natively
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

      const dummyImage = {
        id: 'img-100',
        storage_path: 'foo',
        is_primary: true,
      } as unknown as InventoryImage;
      await component.onEditDeleteImage(dummyImage);

      expect(confirmSpy).toHaveBeenCalled();
      expect(imageServiceMock.deleteImage).toHaveBeenCalledWith(dummyImage);
      expect(notifyMock.info).toHaveBeenCalledWith('Image removed');
      confirmSpy.mockRestore();
    });
  });
});
