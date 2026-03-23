import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { InventoryListComponent } from './inventory-list.component';
import { InventoryService } from '../../../../core/services/inventory.service';
import { InventoryItem } from '../../../../core/models/inventory.model';

const mockItems: InventoryItem[] = [
  {
    id: '1',
    organization_id: 'org-1',
    card_name: 'Charizard',
    set_name: 'Base Set',
    set_code: 'BS',
    card_number: '4/102',
    rarity: 'Rare Holo',
    language: 'English',
    is_foil: true,
    condition: 'near_mint',
    grading_company: 'psa',
    grade: 9.5,
    purchase_price: 100,
    selling_price: 250,
    status: 'available',
    notes: '',
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
  {
    id: '2',
    organization_id: 'org-1',
    card_name: 'Pikachu',
    language: 'English',
    is_foil: false,
    condition: 'lightly_played',
    status: 'sold',
    created_at: '2026-01-02',
    updated_at: '2026-01-02',
  },
];

describe('InventoryListComponent', () => {
  let component: InventoryListComponent;
  let fixture: ComponentFixture<InventoryListComponent>;
  let inventoryServiceMock: Record<string, unknown>;

  beforeEach(async () => {
    inventoryServiceMock = {
      items: signal<InventoryItem[]>([]),
      loading: signal(false),
      totalCount: signal(0),
      page: signal(0),
      pageSize: signal(25),
      filters: signal({}),
      sortColumn: signal('created_at'),
      sortDirection: signal('desc'),
      distinctSetNames: signal([]),
      setSort: vi.fn(),
      setPage: vi.fn(),
      setFilters: vi.fn(),
      loadInventory: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [InventoryListComponent, NoopAnimationsModule],
      providers: [{ provide: InventoryService, useValue: inventoryServiceMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(InventoryListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show empty state when no items and not loading', () => {
    const emptyCard = fixture.nativeElement.querySelector('.empty-state-card');
    expect(emptyCard).toBeTruthy();
    expect(emptyCard.textContent).toContain('No cards in inventory yet');
  });

  it('should show loading spinner when loading', () => {
    (inventoryServiceMock['loading'] as ReturnType<typeof signal<boolean>>).set(true);
    fixture.detectChanges();
    const spinner = fixture.nativeElement.querySelector('mat-spinner');
    expect(spinner).toBeTruthy();
  });

  it('should render table with mock data', () => {
    (inventoryServiceMock['items'] as ReturnType<typeof signal<InventoryItem[]>>).set(mockItems);
    (inventoryServiceMock['totalCount'] as ReturnType<typeof signal<number>>).set(2);
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('tr.mat-mdc-row');
    expect(rows.length).toBe(2);
  });

  it('should display card name in bold', () => {
    (inventoryServiceMock['items'] as ReturnType<typeof signal<InventoryItem[]>>).set(mockItems);
    (inventoryServiceMock['totalCount'] as ReturnType<typeof signal<number>>).set(2);
    fixture.detectChanges();

    const nameCell = fixture.nativeElement.querySelector('.cell-card-name');
    expect(nameCell.textContent).toContain('Charizard');
  });

  it('should call setSort when sort changes', () => {
    component.onSortChange({ active: 'card_name', direction: 'asc' });
    expect(inventoryServiceMock['setSort']).toHaveBeenCalledWith('card_name', 'asc');
  });

  it('should reset sort when direction is empty', () => {
    component.onSortChange({ active: 'card_name', direction: '' });
    expect(inventoryServiceMock['setSort']).toHaveBeenCalledWith('created_at', 'desc');
  });

  it('should call setPage on paginator change', () => {
    component.onPageChange({ pageIndex: 2, pageSize: 25, length: 100 });
    expect(inventoryServiceMock['setPage']).toHaveBeenCalledWith(2);
  });

  it('should format grade correctly', () => {
    expect(component.formatGrade(mockItems[0])).toBe('PSA 9.5');
    expect(component.formatGrade(mockItems[1])).toBe('—');
  });

  it('should show paginator when items exist', () => {
    (inventoryServiceMock['items'] as ReturnType<typeof signal<InventoryItem[]>>).set(mockItems);
    (inventoryServiceMock['totalCount'] as ReturnType<typeof signal<number>>).set(2);
    fixture.detectChanges();

    const paginator = fixture.nativeElement.querySelector('mat-paginator');
    expect(paginator).toBeTruthy();
  });
});
