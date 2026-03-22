import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterOutlet, ActivatedRoute } from '@angular/router';
import { ShopContextService } from '../../../core/services/shop-context.service';

@Component({
  selector: 'app-shop-layout',
  imports: [RouterOutlet],
  template: '<router-outlet></router-outlet>',
})
export class ShopLayoutComponent {
  private readonly shopContext = inject(ShopContextService);
  private readonly route = inject(ActivatedRoute);

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const slug = params.get('slug');
      if (slug && this.shopContext.currentShopSlug() !== slug) {
        this.shopContext.selectShopBySlug(slug);
      }
    });
  }
}
