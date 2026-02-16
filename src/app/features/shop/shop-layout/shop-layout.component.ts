import { Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterOutlet, RouterLink, ActivatedRoute } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { ShopContextService } from '../../../core/services/shop-context.service';

@Component({
  selector: 'app-shop-layout',
  imports: [
    RouterOutlet,
    RouterLink,
    MatSidenavModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatDividerModule,
  ],
  templateUrl: './shop-layout.component.html',
  styleUrl: './shop-layout.component.scss',
})
export class ShopLayoutComponent {
  private readonly shopContext = inject(ShopContextService);
  private readonly route = inject(ActivatedRoute);

  readonly currentShopName = computed(() => this.shopContext.currentShop()?.name ?? '');

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const slug = params.get('slug');
      if (slug && this.shopContext.currentShopSlug() !== slug) {
        this.shopContext.selectShopBySlug(slug);
      }
    });
  }
}
