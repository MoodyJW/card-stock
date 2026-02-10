import { Injectable, signal, computed } from '@angular/core';
import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private readonly supabase: SupabaseClient;

  // Auth state signals
  private readonly _session = signal<Session | null>(null);
  private readonly _user = signal<User | null>(null);
  private readonly _loading = signal(true);

  // Public readonly signals
  readonly session = this._session.asReadonly();
  readonly user = this._user.asReadonly();
  readonly loading = this._loading.asReadonly();

  // Computed state
  readonly isAuthenticated = computed(() => !!this._session());

  constructor() {
    this.supabase = createClient(environment.supabase.url, environment.supabase.anonKey);
    this.initializeAuth();
  }

  private async initializeAuth(): Promise<void> {
    try {
      const {
        data: { session },
      } = await this.supabase.auth.getSession();
      this._session.set(session);
      this._user.set(session?.user ?? null);

      // Listen for auth changes
      this.supabase.auth.onAuthStateChange((_event, session) => {
        this._session.set(session);
        this._user.set(session?.user ?? null);
      });
    } finally {
      this._loading.set(false);
    }
  }

  // Auth methods
  async signInWithEmail(email: string, password: string) {
    return this.supabase.auth.signInWithPassword({ email, password });
  }

  async signUp(email: string, password: string) {
    return this.supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });
  }

  async signOut() {
    const { error } = await this.supabase.auth.signOut();
    if (!error) {
      this._session.set(null);
      this._user.set(null);
    }
    return { error };
  }

  async resetPassword(email: string) {
    return this.supabase.auth.resetPasswordForEmail(email);
  }

  // Get typed client for direct queries
  get client(): SupabaseClient {
    return this.supabase;
  }
}
