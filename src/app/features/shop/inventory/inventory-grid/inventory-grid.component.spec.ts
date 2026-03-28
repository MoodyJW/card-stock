import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi } from 'vitest';
import { InventoryGridComponent } from './inventory-grid.component';
import { InventoryItem } from '../../../../core/models/inventory.model';

const mockItems: InventoryItem[] = [
  {
    id: '1',
    organization_id: 'org-1',
    card_name: 'Charizard VMAX',
    set_name: 'Shining Fates',
    card_number: '025/072',
    language: 'English',
    is_foil: true,
    condition: 'mint',
    grading_company: 'psa',
    grade: 10,
    purchase_price: 150,
    selling_price: 300,
    status: 'available',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
  {
    id: '2',
    organization_id: 'org-1',
    card_name: 'Pikachu V',
    set_name: 'Base Set',
    card_number: '001/100',
    language: 'English',
    is_foil: false,
    condition: 'near_mint',
    purchase_price: 10,
    selling_price: 25,
    status: 'available',
    created_at: '2026-01-02',
    updated_at: '2026-01-02',
  },
  {
    id: '3',
    organization_id: 'org-1',
    card_name: 'Mew EX',
    language: 'Japanese',
    is_foil: false,
    condition: 'lightly_played',
    status: 'sold',
    created_at: '2026-01-03',
    updated_at: '2026-01-03',
  },
];

function createComponent(items: InventoryItem[] = mockItems) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [InventoryGridComponent],
  });

  const fixture = TestBed.createComponent(InventoryGridComponent);
  fixture.componentRef.setInput('items', items);
  fixture.detectChanges();

  return { fixture, component: fixture.componentInstance };
}

describe('InventoryGridComponent', () => {
  it('should render correct number of cards', () => {
    const { fixture } = createComponent();
    const cards = fixture.nativeElement.querySelectorAll('.card-tile');
    expect(cards.length).toBe(3);
  });

  it('should display card name, set, and price', () => {
    const { fixture } = createComponent();
    const firstCard = fixture.nativeElement.querySelector('.card-tile');

    expect(firstCard.querySelector('.card-name').textContent).toContain('Charizard VMAX');
    expect(firstCard.querySelector('.card-set').textContent).toContain('Shining Fates');
    expect(firstCard.querySelector('.selling-price').textContent).toContain('$300');
  });

  it('should show foil indicator when is_foil is true', () => {
    const { fixture } = createComponent();
    const cards = fixture.nativeElement.querySelectorAll('.card-tile');

    // First card is foil
    expect(cards[0].querySelector('.foil-badge')).toBeTruthy();
    // Second card is not foil
    expect(cards[1].querySelector('.foil-badge')).toBeFalsy();
  });

  it('should show grade badge for graded cards', () => {
    const { fixture } = createComponent();
    const cards = fixture.nativeElement.querySelectorAll('.card-tile');

    expect(cards[0].querySelector('.grade-badge').textContent).toContain('PSA 10');
    expect(cards[1].querySelector('.grade-badge')).toBeFalsy();
  });

  it('should emit card on click', () => {
    const { fixture, component } = createComponent();
    const spy = vi.fn();
    component.cardClicked.subscribe(spy);

    const firstCard = fixture.nativeElement.querySelector('.card-tile');
    firstCard.click();

    expect(spy).toHaveBeenCalledWith(mockItems[0]);
  });

  it('should apply is-sold class for sold cards', () => {
    const { fixture } = createComponent();
    const cards = fixture.nativeElement.querySelectorAll('.card-tile');

    expect(cards[2].classList.contains('is-sold')).toBe(true);
    expect(cards[0].classList.contains('is-sold')).toBe(false);
  });

  it('should show condition badge', () => {
    const { fixture } = createComponent();
    const firstCard = fixture.nativeElement.querySelector('.card-tile');
    const badge = firstCard.querySelector('.condition-badge');

    expect(badge).toBeTruthy();
    expect(badge.textContent.trim()).toBe('Mint');
  });

  it('should emit sellClicked on sell button click', () => {
    const { fixture, component } = createComponent();
    const spy = vi.fn();
    component.sellClicked.subscribe(spy);

    const sellBtn = fixture.nativeElement.querySelector('.sell-btn');
    sellBtn.click();

    expect(spy).toHaveBeenCalledWith(mockItems[0]);
  });

  it('should emit reserveClicked on reserve button click', () => {
    const { fixture, component } = createComponent();
    const spy = vi.fn();
    component.reserveClicked.subscribe(spy);

    const actionBtns = fixture.nativeElement.querySelectorAll('.action-btn');
    // First action-btn on first card is the reserve button
    actionBtns[0].click();

    expect(spy).toHaveBeenCalledWith(mockItems[0]);
  });

  it('should not show reserve/sell buttons for sold cards', () => {
    const { fixture } = createComponent();
    const cards = fixture.nativeElement.querySelectorAll('.card-tile');
    // Third card (index 2) is sold — should have delete but not reserve/sell
    expect(cards[2].querySelector('.action-btn')).toBeFalsy();
    expect(cards[2].querySelector('.delete-btn')).toBeTruthy();
  });

  it('should emit deleteClicked on delete button click', () => {
    const { fixture, component } = createComponent();
    const spy = vi.fn();
    component.deleteClicked.subscribe(spy);

    const deleteBtn = fixture.nativeElement.querySelector('.delete-btn');
    deleteBtn.click();

    expect(spy).toHaveBeenCalledWith(mockItems[0]);
  });
});
