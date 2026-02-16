import { Component, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ShopService } from '../../../core/services/shop.service';
import { ShopContextService } from '../../../core/services/shop-context.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-shop-settings',
  imports: [MatButtonModule, MatCardModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './shop-settings.component.html',
  styleUrl: './shop-settings.component.scss',
})
export class ShopSettingsComponent {
  private readonly shopService = inject(ShopService);
  private readonly shopContext = inject(ShopContextService);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);

  readonly loading = signal(false);
  readonly role = signal<string | null>(null);

  constructor() {
    effect(() => {
      const shopId = this.shopContext.currentShopId();
      if (shopId) {
        untracked(() => this.getMyRole(shopId));
      }
    });
  }

  private async getMyRole(shopId: string) {
    const { data, error } = await this.shopService.getMyRole(shopId);
    if (error) {
      this.notify.error('Failed to load role');
    } else if (data) {
      this.role.set(data.role);
    }
  }

  async leaveShop() {
    if (!confirm('Are you sure you want to leave this shop?')) return;
    this.loading.set(true);
    const shopId = this.shopContext.currentShopId();

    if (shopId) {
      const { error } = await this.shopService.leaveShop(shopId);
      if (error) {
        this.notify.error(error.message);
        this.loading.set(false);
      } else {
        await this.handleExit();
      }
    }
  }

  async deleteShop() {
    const confirmation = prompt(
      'Type "DELETE" to confirm deletion of this shop. This action cannot be undone.',
    );
    if (confirmation !== 'DELETE') return;
    this.loading.set(true);
    const shopId = this.shopContext.currentShopId();

    if (shopId) {
      const { error } = await this.shopService.deleteShop(shopId);
      if (error) {
        this.notify.error(error.message);
        this.loading.set(false);
      } else {
        await this.handleExit();
      }
    }
  }

  private async handleExit() {
    await this.shopContext.loadShops();
    this.router.navigate(['/shop/select']);
  }
}
