import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ShopContextService } from '../../../core/services/shop-context.service';

@Component({
  selector: 'app-bottom-nav',
  imports: [RouterLink, RouterLinkActive, MatIconModule, MatButtonModule],
  template: `
    <nav>
      <a [routerLink]="basePath() + '/dashboard'" routerLinkActive="active" class="nav-item">
        <mat-icon>dashboard</mat-icon>
        <span>Home</span>
      </a>

      <a [routerLink]="basePath() + '/inventory'" routerLinkActive="active" class="nav-item">
        <mat-icon>inventory_2</mat-icon>
        <span>Inventory</span>
      </a>

      <a [routerLink]="basePath() + '/team'" routerLinkActive="active" class="nav-item">
        <mat-icon>group</mat-icon>
        <span>Team</span>
      </a>

      <a [routerLink]="basePath() + '/settings'" routerLinkActive="active" class="nav-item">
        <mat-icon>settings</mat-icon>
        <span>Settings</span>
      </a>
    </nav>
  `,
  styleUrl: './bottom-nav.component.scss',
})
export class BottomNavComponent {
  private readonly shopContext = inject(ShopContextService);

  readonly basePath = computed(() => `/shop/${this.shopContext.currentShopSlug()}`);
}
