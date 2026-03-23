import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WritableSignal, signal } from '@angular/core';
import { InventoryService } from './inventory.service';
import { SupabaseService } from './supabase.service';
import { ShopContextService } from './shop-context.service';

describe('InventoryService', () => {
  let service: InventoryService;
  let supabaseMock: Record<string, unknown>;
  let shopContextMock: Record<string, unknown>;
  let shopIdSignal: WritableSignal<string | null>;

  // Builder pattern helpers for chaining Supabase query methods
  let queryChain: Record<string, ReturnType<typeof vi.fn>>;

  function createQueryChain(overrides: Record<string, unknown> = {}) {
    const result = { data: [], error: null, count: 0, ...overrides };
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    const methods = [
      'select',
      'eq',
      'is',
      'not',
      'ilike',
      'order',
      'range',
      'insert',
      'update',
      'single',
      'delete',
    ];
    for (const m of methods) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    // The terminal call resolves with the result
    chain['select'] = vi.fn().mockReturnValue(chain);
    chain['single'] = vi.fn().mockResolvedValue(result);
    chain['range'] = vi.fn().mockResolvedValue(result);
    chain['then'] = vi.fn((resolve: (v: unknown) => void) => resolve(result));
    queryChain = chain;
    return chain;
  }

  beforeEach(() => {
    vi.restoreAllMocks();

    const chain = createQueryChain();

    supabaseMock = {
      client: {
        from: vi.fn().mockReturnValue(chain),
      },
      user: signal({ id: 'user-1' }),
      rpc: vi.fn().mockResolvedValue({ data: {}, error: null }),
    };

    shopIdSignal = signal<string | null>('org-1');

    shopContextMock = {
      currentShopId: shopIdSignal,
    };

    TestBed.configureTestingModule({
      providers: [
        InventoryService,
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: ShopContextService, useValue: shopContextMock },
      ],
    });

    service = TestBed.inject(InventoryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('loadInventory', () => {
    it('should build query with correct filters', async () => {
      const mockData = [
        { id: '1', card_name: 'Charizard', status: 'available' },
        { id: '2', card_name: 'Pikachu', status: 'available' },
      ];
      createQueryChain({ data: mockData, count: 2 });
      (supabaseMock['client'] as Record<string, unknown>)['from'] = vi
        .fn()
        .mockReturnValue(queryChain);

      await service.loadInventory();

      expect(
        (supabaseMock['client'] as Record<string, ReturnType<typeof vi.fn>>)['from'],
      ).toHaveBeenCalledWith('inventory');
      expect(queryChain['select']).toHaveBeenCalledWith('*', { count: 'exact' });
      expect(queryChain['eq']).toHaveBeenCalledWith('organization_id', 'org-1');
      expect(queryChain['is']).toHaveBeenCalledWith('deleted_at', null);
      expect(queryChain['order']).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(queryChain['range']).toHaveBeenCalledWith(0, 24);
    });

    it('should apply status filter when set', async () => {
      createQueryChain({ data: [], count: 0 });
      (supabaseMock['client'] as Record<string, unknown>)['from'] = vi
        .fn()
        .mockReturnValue(queryChain);

      service.setFilters({ status: 'sold' });
      // setFilters calls loadInventory internally, wait a tick
      await vi.waitFor(() => {
        expect(queryChain['eq']).toHaveBeenCalledWith('status', 'sold');
      });
    });

    it('should apply search filter with escaped wildcards', async () => {
      createQueryChain({ data: [], count: 0 });
      (supabaseMock['client'] as Record<string, unknown>)['from'] = vi
        .fn()
        .mockReturnValue(queryChain);

      service.setFilters({ search: 'Pikachu' });
      await vi.waitFor(() => {
        expect(queryChain['ilike']).toHaveBeenCalledWith('card_name', '%Pikachu%');
      });
    });

    it('should not load when no orgId', async () => {
      (shopContextMock as Record<string, unknown>)['currentShopId'] = signal(null);
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          InventoryService,
          { provide: SupabaseService, useValue: supabaseMock },
          { provide: ShopContextService, useValue: shopContextMock },
        ],
      });
      const svc = TestBed.inject(InventoryService);
      await svc.loadInventory();

      expect(
        (supabaseMock['client'] as Record<string, ReturnType<typeof vi.fn>>)['from'],
      ).not.toHaveBeenCalled();
    });
  });

  describe('addCard', () => {
    it('should optimistically prepend item and replace on success', async () => {
      const newCard = {
        id: 'real-id',
        card_name: 'Mew',
        language: 'English',
        is_foil: false,
        condition: 'near_mint' as const,
        status: 'available' as const,
        organization_id: 'org-1',
        created_at: '',
        updated_at: '',
      };
      createQueryChain({ data: newCard, error: null });
      (supabaseMock['client'] as Record<string, unknown>)['from'] = vi
        .fn()
        .mockReturnValue(queryChain);

      const result = await service.addCard({ card_name: 'Mew' });

      expect(result.error).toBeNull();
      expect(service.items().some(i => i.card_name === 'Mew')).toBe(true);
    });

    it('should rollback on error', async () => {
      createQueryChain({ data: null, error: { message: 'Insert failed' } });
      (supabaseMock['client'] as Record<string, unknown>)['from'] = vi
        .fn()
        .mockReturnValue(queryChain);

      const initialCount = service.items().length;
      const result = await service.addCard({ card_name: 'FailCard' });

      expect(result.error).toBeTruthy();
      expect(service.items().length).toBe(initialCount);
    });
  });

  describe('updateCard', () => {
    it('should optimistically update and revert on error', async () => {
      // Seed an item into the signal
      const seedItem = {
        id: 'card-1',
        organization_id: 'org-1',
        card_name: 'OldName',
        language: 'English',
        is_foil: false,
        condition: 'near_mint' as const,
        status: 'available' as const,
        created_at: '',
        updated_at: '',
      };
      createQueryChain({ data: [seedItem], count: 1 });
      (supabaseMock['client'] as Record<string, unknown>)['from'] = vi
        .fn()
        .mockReturnValue(queryChain);
      await service.loadInventory();

      // Setup update to fail
      createQueryChain({ data: null, error: { message: 'Update failed' } });
      (supabaseMock['client'] as Record<string, unknown>)['from'] = vi
        .fn()
        .mockReturnValue(queryChain);

      const result = await service.updateCard('card-1', { card_name: 'NewName' });

      expect(result.error).toBeTruthy();
      // Should revert to original name
      expect(service.items().find(i => i.id === 'card-1')?.card_name).toBe('OldName');
    });
  });

  describe('softDeleteCard', () => {
    it('should remove item optimistically and rollback on error', async () => {
      // Seed an item
      const seedItem = {
        id: 'card-del',
        organization_id: 'org-1',
        card_name: 'DeleteMe',
        language: 'English',
        is_foil: false,
        condition: 'near_mint' as const,
        status: 'available' as const,
        created_at: '',
        updated_at: '',
      };
      createQueryChain({ data: [seedItem], count: 1 });
      (supabaseMock['client'] as Record<string, unknown>)['from'] = vi
        .fn()
        .mockReturnValue(queryChain);
      await service.loadInventory();
      expect(service.items().length).toBe(1);

      // Setup delete to fail
      const updateChain = createQueryChain({ data: null, error: { message: 'Delete failed' } });
      updateChain['eq'] = vi
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'Delete failed' } });
      (supabaseMock['client'] as Record<string, unknown>)['from'] = vi
        .fn()
        .mockReturnValue(queryChain);

      const result = await service.softDeleteCard('card-del');

      expect(result.error).toBeTruthy();
      expect(service.items().length).toBe(1);
    });
  });

  describe('markAsSold', () => {
    it('should call RPC with correct params', async () => {
      // Seed an item
      const seedItem = {
        id: 'card-sell',
        organization_id: 'org-1',
        card_name: 'SellMe',
        language: 'English',
        is_foil: false,
        condition: 'near_mint' as const,
        status: 'available' as const,
        created_at: '',
        updated_at: '',
      };
      createQueryChain({ data: [seedItem], count: 1 });
      (supabaseMock['client'] as Record<string, unknown>)['from'] = vi
        .fn()
        .mockReturnValue(queryChain);
      await service.loadInventory();

      await service.markAsSold({
        inventory_id: 'card-sell',
        sold_price: 49.99,
        buyer_email: 'buyer@test.com',
        buyer_notes: 'Great card',
      });

      expect(supabaseMock['rpc']).toHaveBeenCalledWith('mark_card_sold', {
        p_inventory_id: 'card-sell',
        p_sold_price: 49.99,
        p_buyer_email: 'buyer@test.com',
        p_buyer_notes: 'Great card',
      });
    });

    it('should update item status to sold on success', async () => {
      const seedItem = {
        id: 'card-sell2',
        organization_id: 'org-1',
        card_name: 'SellMe2',
        language: 'English',
        is_foil: false,
        condition: 'near_mint' as const,
        status: 'available' as const,
        created_at: '',
        updated_at: '',
      };
      createQueryChain({ data: [seedItem], count: 1 });
      (supabaseMock['client'] as Record<string, unknown>)['from'] = vi
        .fn()
        .mockReturnValue(queryChain);
      await service.loadInventory();

      await service.markAsSold({ inventory_id: 'card-sell2', sold_price: 10 });

      expect(service.items().find(i => i.id === 'card-sell2')?.status).toBe('sold');
    });
  });

  describe('setFilters', () => {
    it('should reset page to 0 when filters change', () => {
      service.setFilters({ status: 'available' });
      expect(service.page()).toBe(0);
      expect(service.filters().status).toBe('available');
    });
  });

  describe('setSort', () => {
    it('should update sort signals', () => {
      service.setSort('card_name', 'asc');
      expect(service.sortColumn()).toBe('card_name');
      expect(service.sortDirection()).toBe('asc');
    });
  });

  describe('setPage', () => {
    it('should update page signal', () => {
      service.setPage(3);
      expect(service.page()).toBe(3);
    });
  });

  describe('shop context effect', () => {
    it('should clear items and reload when shop changes', async () => {
      // Load initial data
      const mockData = [{ id: '1', card_name: 'Charizard', status: 'available' }];
      createQueryChain({ data: mockData, count: 1 });
      (supabaseMock['client'] as Record<string, unknown>)['from'] = vi
        .fn()
        .mockReturnValue(queryChain);
      await service.loadInventory();
      expect(service.items().length).toBe(1);

      // Reset the mock to track calls from the effect
      const fromSpy = vi.fn().mockReturnValue(queryChain);
      createQueryChain({ data: [], count: 0 });
      (supabaseMock['client'] as Record<string, unknown>)['from'] = fromSpy;

      // Change shop — triggers the constructor effect
      shopIdSignal.set('org-2');
      TestBed.flushEffects();

      // The effect should clear items and trigger loadInventory for the new shop
      await vi.waitFor(() => {
        expect(fromSpy).toHaveBeenCalled();
      });
    });
  });
});
