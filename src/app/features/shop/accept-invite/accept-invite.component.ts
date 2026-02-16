import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { ShopService } from '../../../core/services/shop.service';
import { ShopContextService } from '../../../core/services/shop-context.service';

@Component({
  selector: 'app-accept-invite',
  imports: [MatCardModule, MatButtonModule, MatProgressSpinnerModule, MatIconModule, RouterLink],
  templateUrl: './accept-invite.component.html',
  styleUrl: './accept-invite.component.scss',
})
export class AcceptInviteComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly shopService = inject(ShopService);
  private readonly shopContext = inject(ShopContextService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal(false);

  private token: string | null = null;

  constructor() {
    this.token = this.route.snapshot.paramMap.get('token');
    if (!this.token) {
      this.error.set('Invalid invite link.');
    }
  }

  async accept() {
    if (!this.token) return;

    this.loading.set(true);
    this.error.set(null);

    const { error } = await this.shopService.acceptInvite(this.token);

    this.loading.set(false);

    if (error) {
      this.error.set(error.message || 'Failed to accept invite.');
    } else {
      this.success.set(true);
    }
  }

  async goToShop() {
    await this.shopContext.loadShops();
    this.router.navigate(['/shop/select']);
  }
}
