import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ShopContextService } from '../../../core/services/shop-context.service';
import { Organization } from '../../../core/models/shop.model';

@Component({
  selector: 'app-shop-selector',
  imports: [
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './shop-selector.component.html',
  styleUrl: './shop-selector.component.scss',
})
export class ShopSelectorComponent {
  private readonly shopContext = inject(ShopContextService);
  private readonly router = inject(Router);

  readonly shops = this.shopContext.shops;
  readonly loading = this.shopContext.loading;

  selectShop(shop: Organization) {
    this.shopContext.selectShop(shop.id);
    this.router.navigate(['/shop', shop.slug]);
  }
}
