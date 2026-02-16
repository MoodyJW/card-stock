import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { signal, WritableSignal } from '@angular/core';
import { shopGuard } from './shop.guard';
import { ShopContextService } from '../services/shop-context.service';
import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';
import { firstValueFrom, isObservable } from 'rxjs';

describe('shopGuard', () => {
  let router: { createUrlTree: Mock };
  let shopContext: {
    loading: WritableSignal<boolean>;
    currentShopSlug: WritableSignal<string | null>;
    selectShopBySlug: Mock;
  };

  const executeGuard: CanActivateFn = (...guardArgs) =>
    TestBed.runInInjectionContext(() => shopGuard(...guardArgs));

  beforeEach(() => {
    router = { createUrlTree: vi.fn().mockReturnValue('select-shop-url-tree') };
    shopContext = {
      loading: signal(false),
      currentShopSlug: signal(null),
      selectShopBySlug: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: ShopContextService, useValue: shopContext },
      ],
    });
  });

  const getRoute = (slug: string | null) =>
    ({
      paramMap: {
        get: (key: string) => (key === 'slug' ? slug : null),
      },
    }) as unknown as ActivatedRouteSnapshot;

  it('should redirect to select if no slug param', async () => {
    const result = await executeGuard(
      getRoute(null) as ActivatedRouteSnapshot,
      {} as RouterStateSnapshot,
    );
    expect(result).toBe('select-shop-url-tree');
    expect(router.createUrlTree).toHaveBeenCalledWith(['/shop/select']);
  });

  it('should allow access if shop is already selected and matches slug', async () => {
    shopContext.currentShopSlug.set('my-shop');
    const result = await executeGuard(
      getRoute('my-shop') as ActivatedRouteSnapshot,
      {} as RouterStateSnapshot,
    );
    expect(result).toBe(true);
  });

  it('should attempt to select shop if not currently selected', async () => {
    shopContext.currentShopSlug.set(null);
    shopContext.selectShopBySlug.mockImplementation(() => {
      shopContext.currentShopSlug.set('my-shop'); // Simulate success
    });

    const result = await executeGuard(
      getRoute('my-shop') as ActivatedRouteSnapshot,
      {} as RouterStateSnapshot,
    );

    expect(shopContext.selectShopBySlug).toHaveBeenCalledWith('my-shop');
    expect(result).toBe(true);
  });

  it('should redirect if selection fails (shop not found)', async () => {
    shopContext.currentShopSlug.set(null);
    // selectShopBySlug does nothing (simulating not found)

    const result = await executeGuard(
      getRoute('invalid-slug') as ActivatedRouteSnapshot,
      {} as RouterStateSnapshot,
    );

    expect(shopContext.selectShopBySlug).toHaveBeenCalledWith('invalid-slug');
    expect(result).toBe('select-shop-url-tree');
  });

  it('should wait for loading to complete', async () => {
    shopContext.loading.set(true);
    shopContext.currentShopSlug.set('my-shop');

    const resultOrObservable = executeGuard(
      getRoute('my-shop') as ActivatedRouteSnapshot,
      {} as RouterStateSnapshot,
    );

    // Verify it's an observable
    expect(isObservable(resultOrObservable)).toBe(true);

    // Finish loading
    shopContext.loading.set(false);
    TestBed.flushEffects();

    if (isObservable(resultOrObservable)) {
      const result = await firstValueFrom(resultOrObservable);
      expect(result).toBe(true);
    }
  });
});
