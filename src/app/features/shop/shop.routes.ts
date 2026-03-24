import { Routes } from '@angular/router';
import { shopGuard } from '../../core/guards/shop.guard';

export default [
  {
    path: 'select',
    loadComponent: () =>
      import('./shop-selector/shop-selector.component').then(m => m.ShopSelectorComponent),
    title: 'Select Store | CardStock',
  },
  {
    path: 'create',
    loadComponent: () =>
      import('./create-shop/create-shop.component').then(m => m.CreateShopComponent),
    title: 'New Store | CardStock',
  },
  {
    path: 'invite/:token',
    loadComponent: () =>
      import('./accept-invite/accept-invite.component').then(m => m.AcceptInviteComponent),
    title: 'Join Store | CardStock',
  },
  {
    path: ':slug',
    canActivate: [shopGuard],
    loadComponent: () =>
      import('./shop-layout/shop-layout.component').then(m => m.ShopLayoutComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'inventory',
        loadComponent: () =>
          import('./inventory/inventory-list/inventory-list.component').then(
            m => m.InventoryListComponent,
          ),
      },
      {
        path: 'team',
        loadComponent: () => import('./team/team.component').then(m => m.TeamComponent),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./shop-settings/shop-settings.component').then(m => m.ShopSettingsComponent),
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: '',
    redirectTo: 'select',
    pathMatch: 'full',
  },
] as Routes;
