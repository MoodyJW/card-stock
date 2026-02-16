import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ShopContextService } from '../services/shop-context.service';
import { filter, take, map } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';

export const shopGuard: CanActivateFn = route => {
  const shopContext = inject(ShopContextService);
  const router = inject(Router);
  const slug = route.paramMap.get('slug');

  // Verify slug exists
  if (!slug) {
    return router.createUrlTree(['/shop/select']);
  }

  // Helper to check/set shop
  const checkShop = () => {
    // If shop is already selected and matches slug, allow
    if (shopContext.currentShopSlug() === slug) {
      return true;
    }

    // Try to select by slug
    shopContext.selectShopBySlug(slug);

    // Check if selection was successful
    if (shopContext.currentShopSlug() === slug) {
      return true;
    }

    // Failed to find shop with this slug -> redirect
    return router.createUrlTree(['/shop/select']);
  };

  // If already loaded, check immediately
  if (!shopContext.loading()) {
    return checkShop();
  }

  // Wait for loading to complete
  return toObservable(shopContext.loading).pipe(
    filter(loading => !loading),
    take(1),
    map(() => checkShop()),
  );
};
