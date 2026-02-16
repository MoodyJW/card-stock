import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'auth',
    loadComponent: () =>
      import('./layouts/auth-layout/auth-layout.component').then(m => m.AuthLayoutComponent),
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.authRoutes),
  },
  {
    path: 'shop',
    canActivate: [authGuard],
    loadChildren: () => import('./features/shop/shop.routes'),
  },
  {
    path: '',
    redirectTo: 'shop',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
