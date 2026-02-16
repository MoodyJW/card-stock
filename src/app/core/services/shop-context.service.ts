import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Organization } from '../models/shop.model';
import { ShopService } from './shop.service';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root',
})
export class ShopContextService {
  private readonly shopService = inject(ShopService);
  private readonly supabase = inject(SupabaseService);

  // State
  private readonly _shops = signal<Organization[]>([]);
  private readonly _currentShop = signal<Organization | null>(null);
  private readonly _loading = signal<boolean>(true);

  // Readonly signals
  readonly shops = this._shops.asReadonly();
  readonly currentShop = this._currentShop.asReadonly();
  readonly loading = this._loading.asReadonly();

  readonly currentShopId = computed(() => this._currentShop()?.id ?? null);
  readonly currentShopSlug = computed(() => this._currentShop()?.slug ?? null);

  constructor() {
    // Effect to reload shops when auth state changes (e.g. login)
    effect(() => {
      const user = this.supabase.user();
      if (user) {
        // Untrack this async call to prevent recursive signal updates
        untracked(() => this.loadShops());
      } else {
        this._shops.set([]);
        this._currentShop.set(null);
      }
    });
  }

  async loadShops() {
    this._loading.set(true);
    const { data, error } = await this.shopService.getMyShops();

    if (error) {
      console.error('Failed to load shops:', error);
      this._loading.set(false);
      return;
    }

    this._shops.set(data || []);

    // Auto-select shop logic
    this.handleAutoSelection(data || []);

    this._loading.set(false);
  }

  /**
   * Switches the current shop context and persists selection to localStorage.
   */
  selectShop(shopId: string) {
    const shop = this._shops().find(s => s.id === shopId);
    if (shop) {
      this._currentShop.set(shop);
      localStorage.setItem('last_active_shop', shop.id);
    }
  }

  selectShopBySlug(slug: string) {
    const shop = this._shops().find(s => s.slug === slug);
    if (shop) {
      this._currentShop.set(shop);
      localStorage.setItem('last_active_shop', shop.id);
    }
  }

  private handleAutoSelection(shops: Organization[]) {
    // If only 1 shop, auto-select it
    if (shops.length === 1) {
      this._currentShop.set(shops[0]);
    }
    // If >1 shops, check localStorage
    else if (shops.length > 1) {
      const lastShopId = localStorage.getItem('last_active_shop');
      if (lastShopId) {
        const match = shops.find(s => s.id === lastShopId);
        if (match) {
          this._currentShop.set(match);
        }
      }
    }
  }
}
