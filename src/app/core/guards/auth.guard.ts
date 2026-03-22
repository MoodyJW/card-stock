import { inject } from '@angular/core';
import {
  CanActivateFn,
  Router,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
} from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { filter } from 'rxjs/operators';
import { SupabaseService } from '../services/supabase.service';

export const authGuard: CanActivateFn = async (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
) => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  // Wait for auth initialization to finish
  if (supabase.loading()) {
    await firstValueFrom(toObservable(supabase.loading).pipe(filter(loading => !loading)));
  }

  if (supabase.isAuthenticated()) {
    return true;
  }

  // Preserve invite links across login/register/email-confirmation flow
  if (state.url.includes('/shop/invite/')) {
    localStorage.setItem('pending_invite_url', state.url);
  }

  return router.createUrlTree(['/auth/login']);
};
