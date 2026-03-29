import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { describe, it, expect, vi } from 'vitest';
import { CardDetailComponent } from './card-detail.component';
import { InventoryService } from '../../../../core/services/inventory.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { InventoryItem } from '../../../../core/models/inventory.model';
import { ImageService } from '../../../../core/services/image.service';

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

async function setup(cardId: string | null = 'card-1', cardData: InventoryItem | null = mockCard) {
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
    getImages: vi.fn().mockResolvedValue([]),
    getPublicUrl: vi.fn().mockReturnValue(''),
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
  };
}

describe('CardDetailComponent', () => {
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

    // Spy on goBack to prevent actual navigation
    const goBackSpy = vi.spyOn(component, 'goBack').mockImplementation(() => undefined);

    await component.deleteCard();

    expect(inventoryServiceMock.softDeleteCard).toHaveBeenCalledWith('card-1');
    expect(goBackSpy).toHaveBeenCalled();
    expect(notifyMock.showWithAction).toHaveBeenCalledWith('Card deleted', 'Undo', 5000);
  });
});
