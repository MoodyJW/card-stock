import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { signal, WritableSignal } from '@angular/core';
import { noAuthGuard } from './no-auth.guard';
import { SupabaseService } from '../services/supabase.service';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Mock } from 'vitest';

describe('noAuthGuard', () => {
  let router: { createUrlTree: Mock };
  let supabase: { loading: WritableSignal<boolean>; isAuthenticated: WritableSignal<boolean> };

  const executeGuard: CanActivateFn = (...guardArgs) =>
    TestBed.runInInjectionContext(() => noAuthGuard(...guardArgs));

  beforeEach(() => {
    router = { createUrlTree: vi.fn().mockReturnValue('home-url-tree') };
    supabase = {
      loading: signal(false),
      isAuthenticated: signal(false),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: SupabaseService, useValue: supabase },
      ],
    });
  });

  it('should allow access when NOT authenticated', async () => {
    supabase.loading.set(false);
    supabase.isAuthenticated.set(false);

    const result = await executeGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot);

    expect(result).toBe(true);
    expect(router.createUrlTree).not.toHaveBeenCalled();
  });

  it('should redirect to home when authenticated', async () => {
    supabase.loading.set(false);
    supabase.isAuthenticated.set(true);

    const result = await executeGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot);

    expect(result).toBe('home-url-tree');
    expect(router.createUrlTree).toHaveBeenCalledWith(['/']);
  });

  it('should wait for loading to finish before checking auth', async () => {
    supabase.loading.set(true);
    supabase.isAuthenticated.set(false);

    const resultPromise = executeGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot);

    supabase.loading.set(false);
    TestBed.flushEffects();

    const result = await resultPromise;
    expect(result).toBe(true);
  });
});
