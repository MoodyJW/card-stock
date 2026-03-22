import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { BreakpointObserver } from '@angular/cdk/layout';
import { map } from 'rxjs/operators';
import { ShopContextService } from '../../core/services/shop-context.service';
import { BottomNavComponent } from '../../features/shop/bottom-nav/bottom-nav.component';
import { UserMenuComponent } from '../../shared/components/user-menu/user-menu.component';

@Component({
  selector: 'app-layout',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatDividerModule,
    MatMenuModule,
    BottomNavComponent,
    UserMenuComponent,
  ],
  templateUrl: './app-layout.component.html',
  styleUrl: './app-layout.component.scss',
})
export class AppLayoutComponent {
  private readonly shopContext = inject(ShopContextService);
  private readonly breakpointObserver = inject(BreakpointObserver);

  readonly isMobile = toSignal(
    this.breakpointObserver.observe('(max-width: 767px)').pipe(map(result => result.matches)),
    { initialValue: false },
  );

  readonly currentShop = this.shopContext.currentShop;
  readonly currentShopSlug = this.shopContext.currentShopSlug;
  readonly currentShopName = computed(() => this.shopContext.currentShop()?.name ?? 'CardStock');

  readonly shopBasePath = computed(() => {
    const slug = this.currentShopSlug();
    return slug ? `/shop/${slug}` : null;
  });
}
