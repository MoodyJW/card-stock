import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { filter } from 'rxjs/operators';
import { SupabaseService } from '../services/supabase.service';

export const noAuthGuard: CanActivateFn = async () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  // Wait for auth initialization to finish
  if (supabase.loading()) {
    await firstValueFrom(toObservable(supabase.loading).pipe(filter(loading => !loading)));
  }

  if (supabase.isAuthenticated()) {
    return router.createUrlTree(['/']);
  }

  return true;
};
