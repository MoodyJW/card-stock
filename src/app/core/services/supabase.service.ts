import { Injectable, signal, computed } from '@angular/core';
import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  organization_id: string;
  display_name: string | null;
  role: 'owner' | 'admin' | 'member';
  created_at: string;
  updated_at: string;
}

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private supabase: SupabaseClient;

  // Auth state signals
  private readonly _session = signal<Session | null>(null);
  private readonly _user = signal<User | null>(null);
  private readonly _profile = signal<Profile | null>(null);
  private readonly _organization = signal<Organization | null>(null);
  private readonly _loading = signal(true);

  // Public readonly signals
  readonly session = this._session.asReadonly();
  readonly user = this._user.asReadonly();
  readonly profile = this._profile.asReadonly();
  readonly organization = this._organization.asReadonly();
  readonly loading = this._loading.asReadonly();

  // Computed state
  readonly isAuthenticated = computed(() => !!this._session());
  readonly organizationId = computed(() => this._organization()?.id ?? null);

  constructor() {
    this.supabase = createClient(environment.supabase.url, environment.supabase.anonKey);

    this.initializeAuth();
  }

  private async initializeAuth(): Promise<void> {
    try {
      // Get initial session
      const {
        data: { session },
      } = await this.supabase.auth.getSession();
      this._session.set(session);
      this._user.set(session?.user ?? null);

      if (session?.user) {
        await this.loadUserProfile(session.user.id);
      }

      // Listen for auth changes
      this.supabase.auth.onAuthStateChange(async (event, session) => {
        this._session.set(session);
        this._user.set(session?.user ?? null);

        if (session?.user) {
          await this.loadUserProfile(session.user.id);
        } else {
          this._profile.set(null);
          this._organization.set(null);
        }
      });
    } finally {
      this._loading.set(false);
    }
  }

  private async loadUserProfile(userId: string): Promise<void> {
    // Load profile with organization
    const { data: profile } = await this.supabase
      .from('profiles')
      .select(
        `
        *,
        organizations (*)
      `,
      )
      .eq('user_id', userId)
      .single();

    if (profile) {
      this._profile.set(profile as Profile);
      this._organization.set((profile as Profile & { organizations: Organization }).organizations);
    }
  }

  // Auth methods
  async signInWithEmail(email: string, password: string) {
    return this.supabase.auth.signInWithPassword({ email, password });
  }

  async signUp(email: string, password: string) {
    return this.supabase.auth.signUp({ email, password });
  }

  async signOut() {
    const { error } = await this.supabase.auth.signOut();
    if (!error) {
      this._session.set(null);
      this._user.set(null);
      this._profile.set(null);
      this._organization.set(null);
    }
    return { error };
  }

  // Get typed client for direct queries
  get client(): SupabaseClient {
    return this.supabase;
  }
}
