import { TestBed } from '@angular/core/testing';
import { SupabaseService } from './supabase.service';
import { SupabaseClient } from '@supabase/supabase-js';
import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';

describe('SupabaseService', () => {
  let service: SupabaseService;
  let authSpy: Record<string, Mock>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SupabaseService],
    });
    service = TestBed.inject(SupabaseService);

    // Access private supabase client — cast through unknown to access private field
    const client = (service as unknown as { supabase: SupabaseClient }).supabase;
    authSpy = {
      getSession: vi
        .spyOn(client.auth, 'getSession')
        .mockResolvedValue({ data: { session: null }, error: null } as ReturnType<
          typeof client.auth.getSession
        > extends Promise<infer R>
          ? R
          : never),
      signInWithPassword: vi
        .spyOn(client.auth, 'signInWithPassword')
        .mockResolvedValue({ data: {}, error: null } as Awaited<
          ReturnType<typeof client.auth.signInWithPassword>
        >),
      signUp: vi
        .spyOn(client.auth, 'signUp')
        .mockResolvedValue({ data: {}, error: null } as Awaited<
          ReturnType<typeof client.auth.signUp>
        >),
      signOut: vi
        .spyOn(client.auth, 'signOut')
        .mockResolvedValue({ error: null } as Awaited<ReturnType<typeof client.auth.signOut>>),
      resetPasswordForEmail: vi
        .spyOn(client.auth, 'resetPasswordForEmail')
        .mockResolvedValue({ data: {}, error: null } as Awaited<
          ReturnType<typeof client.auth.resetPasswordForEmail>
        >),
    };
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('signInWithEmail should call supabase.auth.signInWithPassword', async () => {
    await service.signInWithEmail('test@test.com', 'pass');
    expect(authSpy['signInWithPassword']).toHaveBeenCalledWith({
      email: 'test@test.com',
      password: 'pass',
    });
  });

  it('signUp should call supabase.auth.signUp with emailRedirectTo option', async () => {
    await service.signUp('test@test.com', 'pass');
    expect(authSpy['signUp']).toHaveBeenCalledWith({
      email: 'test@test.com',
      password: 'pass',
      options: { emailRedirectTo: expect.stringContaining('/auth/confirm') },
    });
  });

  it('signOut should clear session and user signals', async () => {
    await service.signOut();
    expect(authSpy['signOut']).toHaveBeenCalled();
  });
});
