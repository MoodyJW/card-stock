import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { describe, it, expect, vi } from 'vitest';
import { CardDetailComponent } from './card-detail.component';
import { InventoryService } from '../../../../core/services/inventory.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ImageService } from '../../../../core/services/image.service';
import { InventoryItem } from '../../../../core/models/inventory.model';
import { InventoryImage } from '../../../../core/models/image.model';

const mockCard: InventoryItem = {
  id: 'card-1',
  organization_id: 'org-1',
  card_name: 'Charizard VMAX',
  set_name: 'Shining Fates',
  set_code: 'SHF',
  card_number: '025/072',
  rarity: 'Ultra Rare',
  language: 'English',
  is_foil: true,
  condition: 'near_mint',
  grading_company: 'psa',
  grade: 9.5,
  purchase_price: 150,
  selling_price: 300,
  status: 'available',
  notes: 'Pristine condition',
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

const mockImages: InventoryImage[] = [
  {
    id: 'img-1',
    inventory_id: 'card-1',
    organization_id: 'org-1',
    storage_path: 'org-1/card-1/front.webp',
    is_primary: true,
    created_at: '2026-01-01',
  },
  {
    id: 'img-2',
    inventory_id: 'card-1',
    organization_id: 'org-1',
    storage_path: 'org-1/card-1/back.webp',
    is_primary: false,
    created_at: '2026-01-02',
  },
];

async function setup(
  cardId: string | null = 'card-1',
  cardData: InventoryItem | null = mockCard,
  imageData: InventoryImage[] = [],
) {
  const inventoryServiceMock = {
    getCardById: vi
      .fn()
      .mockResolvedValue({ data: cardData, error: cardData ? null : 'not found' }),
    softDeleteCard: vi.fn().mockResolvedValue({ error: null }),
    restoreDeletedCard: vi.fn().mockResolvedValue({ error: null }),
    items: signal([]),
    loading: signal(false),
    totalCount: signal(0),
    page: signal(0),
    pageSize: signal(25),
    sortColumn: signal('created_at'),
    sortDirection: signal('desc'),
    distinctSetNames: signal<string[]>([]),
  };

  const notifyMock = {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    showWithAction: vi.fn().mockReturnValue({ onAction: () => ({ subscribe: vi.fn() }) }),
  };

  const imageServiceMock = {
    getImages: vi.fn().mockResolvedValue(imageData),
    getPublicUrl: vi.fn((path: string) => `https://cdn.test/${path}`),
    uploadImage: vi.fn().mockResolvedValue({ id: 'img-new', storage_path: 'new.webp' }),
    deleteImage: vi.fn().mockResolvedValue(true),
    setAsPrimary: vi.fn().mockResolvedValue(true),
  };

  const dialogMock = {
    open: vi.fn().mockReturnValue({
      afterClosed: () => ({ subscribe: vi.fn() }),
    }),
  };

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [CardDetailComponent],
    providers: [
      provideNoopAnimations(),
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            paramMap: {
              get: (key: string) => (key === 'cardId' ? cardId : null),
            },
          },
        },
      },
      { provide: InventoryService, useValue: inventoryServiceMock },
      { provide: NotificationService, useValue: notifyMock },
      { provide: ImageService, useValue: imageServiceMock },
      { provide: MatDialog, useValue: dialogMock },
    ],
  });

  const fixture = TestBed.createComponent(CardDetailComponent);
  await fixture.componentInstance.ngOnInit();
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  return {
    fixture,
    component: fixture.componentInstance,
    inventoryServiceMock,
    notifyMock,
    imageServiceMock,
    dialogMock,
  };
}

describe('CardDetailComponent', () => {
  // --- Existing card detail tests ---

  it('should create', async () => {
    const { component } = await setup();
    expect(component).toBeTruthy();
  });

  it('should fetch card data on init', async () => {
    const { component, inventoryServiceMock } = await setup();
    expect(inventoryServiceMock.getCardById).toHaveBeenCalledWith('card-1');
    expect(component.card()).toEqual(mockCard);
    expect(component.loading()).toBe(false);
  });

  it('should display all card fields', async () => {
    const { fixture } = await setup();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.textContent).toContain('Charizard VMAX');
    expect(el.textContent).toContain('Shining Fates');
    expect(el.textContent).toContain('SHF');
    expect(el.textContent).toContain('025/072');
    expect(el.textContent).toContain('Ultra Rare');
    expect(el.textContent).toContain('English');
    expect(el.textContent).toContain('Near Mint');
    expect(el.textContent).toContain('PSA 9.5');
  });

  it('should show edit button', async () => {
    const { fixture } = await setup();
    const buttons = fixture.nativeElement.querySelectorAll('button');
    const editBtn = Array.from(buttons as NodeListOf<HTMLButtonElement>).find(
      (b: HTMLButtonElement) => b.textContent?.includes('Edit'),
    );
    expect(editBtn).toBeTruthy();
  });

  it('should show sell button only for available cards', async () => {
    const { fixture } = await setup();
    const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('button');
    const sellBtn = Array.from(buttons).find(b => b.textContent?.includes('Sell'));
    expect(sellBtn).toBeTruthy();
  });

  it('should hide sell button for sold cards', async () => {
    const soldCard = { ...mockCard, status: 'sold' as const };
    const { fixture } = await setup('card-1', soldCard);
    const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('button');
    const sellBtn = Array.from(buttons).find(b => b.textContent?.includes('Sell'));
    expect(sellBtn).toBeFalsy();
  });

  it('should show not-found state when card does not exist', async () => {
    const { fixture, component } = await setup('nonexistent', null);
    expect(component.notFound()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Card Not Found');
  });

  it('should show not-found state when no cardId in route', async () => {
    const { component } = await setup(null);
    expect(component.notFound()).toBe(true);
  });

  it('should call deleteCard and navigate back', async () => {
    const { component, inventoryServiceMock, notifyMock } = await setup();
    const goBackSpy = vi.spyOn(component, 'goBack').mockImplementation(() => undefined);

    await component.deleteCard();

    expect(inventoryServiceMock.softDeleteCard).toHaveBeenCalledWith('card-1');
    expect(goBackSpy).toHaveBeenCalled();
    expect(notifyMock.showWithAction).toHaveBeenCalledWith('Card deleted', 'Undo', 5000);
  });

  // --- Image gallery tests (Ticket 3b) ---

  describe('Image Gallery', () => {
    it('should render image thumbnails when images exist', async () => {
      const { fixture } = await setup('card-1', mockCard, mockImages);
      const thumbs = fixture.nativeElement.querySelectorAll('.gallery-thumb');
      expect(thumbs.length).toBe(2);
    });

    it('should show primary badge on primary image', async () => {
      const { fixture } = await setup('card-1', mockCard, mockImages);
      const badges = fixture.nativeElement.querySelectorAll('.primary-badge');
      expect(badges.length).toBe(1);
    });

    it('should show add-image slot when under 2 images', async () => {
      const { fixture } = await setup('card-1', mockCard, [mockImages[0]]);
      const addSlot = fixture.nativeElement.querySelector('app-image-upload-slot');
      expect(addSlot).toBeTruthy();
    });

    it('should hide add-image slot when at 2-image limit', async () => {
      const { fixture } = await setup('card-1', mockCard, mockImages);
      const addSlot = fixture.nativeElement.querySelector('app-image-upload-slot');
      expect(addSlot).toBeFalsy();
    });

    it('should show add-image slot when no images exist', async () => {
      const { fixture } = await setup('card-1', mockCard, []);
      const addSlot = fixture.nativeElement.querySelector('app-image-upload-slot');
      expect(addSlot).toBeTruthy();
      expect(fixture.nativeElement.textContent).toContain('No images yet');
    });

    it('should open lightbox dialog on thumbnail click', async () => {
      const { component, dialogMock, imageServiceMock } = await setup(
        'card-1',
        mockCard,
        mockImages,
      );

      component.openLightbox(0);

      expect(dialogMock.open).toHaveBeenCalled();
      const callArgs = dialogMock.open.mock.calls[0];
      expect(callArgs[1].panelClass).toBe('lightbox-dialog');
      expect(callArgs[1].data.images.length).toBe(2);
      expect(callArgs[1].data.startIndex).toBe(0);
      expect(imageServiceMock.getPublicUrl).toHaveBeenCalled();
    });

    it('should call deleteImage and refresh gallery', async () => {
      const { component, imageServiceMock, notifyMock } = await setup(
        'card-1',
        mockCard,
        mockImages,
      );
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      await component.onGalleryDelete(mockImages[1]);

      expect(imageServiceMock.deleteImage).toHaveBeenCalledWith(mockImages[1]);
      expect(notifyMock.info).toHaveBeenCalledWith('Image removed');
      // getImages called again after delete
      const callCount = imageServiceMock.getImages.mock.calls.length;
      expect(callCount).toBeGreaterThanOrEqual(2);

      vi.restoreAllMocks();
    });

    it('should call setAsPrimary and refresh gallery', async () => {
      const { component, imageServiceMock, notifyMock } = await setup(
        'card-1',
        mockCard,
        mockImages,
      );

      await component.onGallerySetPrimary(mockImages[1]);

      expect(imageServiceMock.setAsPrimary).toHaveBeenCalledWith('img-2', 'card-1');
      expect(notifyMock.success).toHaveBeenCalledWith('Primary image updated');
      const callCount = imageServiceMock.getImages.mock.calls.length;
      expect(callCount).toBeGreaterThanOrEqual(2);
    });

    it('should upload image and refresh gallery', async () => {
      const { component, imageServiceMock, notifyMock } = await setup('card-1', mockCard, []);

      const file = new File([''], 'test.webp', { type: 'image/webp' });
      await component.onGalleryUpload(file);

      expect(imageServiceMock.uploadImage).toHaveBeenCalledWith('card-1', file, true);
      expect(notifyMock.success).toHaveBeenCalledWith('Image uploaded');
      const callCount = imageServiceMock.getImages.mock.calls.length;
      expect(callCount).toBeGreaterThanOrEqual(2);
    });

    it('should not set primary on already-primary image', async () => {
      const { component, imageServiceMock } = await setup('card-1', mockCard, mockImages);

      await component.onGallerySetPrimary(mockImages[0]); // already primary

      expect(imageServiceMock.setAsPrimary).not.toHaveBeenCalled();
    });
  });
});
