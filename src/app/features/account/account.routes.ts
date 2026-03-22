import { Routes } from '@angular/router';

export default [
  {
    path: '',
    loadComponent: () =>
      import('./account-layout/account-layout.component').then(m => m.AccountLayoutComponent),
    children: [
      {
        path: 'profile',
        loadComponent: () => import('./profile/profile.component').then(m => m.ProfileComponent),
      },
      {
        path: '',
        redirectTo: 'profile',
        pathMatch: 'full',
      },
    ],
  },
] as Routes;
