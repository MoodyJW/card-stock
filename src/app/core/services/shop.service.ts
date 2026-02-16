import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { CreateShopParams } from '../models/shop.model';

@Injectable({
  providedIn: 'root',
})
export class ShopService {
  private readonly supabase = inject(SupabaseService);

  /**
   * Creates a new shop (organization) and automatically makes the creator the owner.
   * Uses the `create_organization` RPC.
   */
  async createShop(params: CreateShopParams) {
    return this.supabase.rpc('create_organization', {
      p_name: params.name,
      p_slug: params.slug,
    });
  }

  /**
   * Fetches all organizations the current user is a member of.
   * RLS ensures we only see our own orgs.
   */
  async getMyShops() {
    return this.supabase.client
      .from('organizations')
      .select('*')
      .is('deleted_at', null)
      .order('name');
  }

  /**
   * Fetches the user's role for a specific shop.
   */
  async getMyRole(orgId: string) {
    const user = this.supabase.user();
    if (!user) return { data: null, error: 'No user' };

    return this.supabase.client
      .from('memberships')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', user.id)
      .single();
  }

  /**
   * Leaves a shop. prevents leaving if you are the last owner.
   * Uses the `leave_organization` RPC.
   */
  async leaveShop(orgId: string) {
    return this.supabase.rpc('leave_organization', {
      p_org_id: orgId,
    });
  }

  /**
   * Soft deletes a shop. Owner only.
   * Uses the `soft_delete_organization` RPC.
   */
  async deleteShop(orgId: string) {
    return this.supabase.rpc('soft_delete_organization', {
      p_org_id: orgId,
    });
  }

  /**
   * Fetches all members of a shop, including their profile data.
   */
  async getMembers(orgId: string) {
    return this.supabase.client
      .from('memberships')
      .select(
        `
                *,
                profile:profiles (
                    email,
                    display_name,
                    avatar_url
                )
            `,
      )
      .eq('organization_id', orgId)
      .order('created_at');
  }

  /**
   * Fetches pending invites for a shop.
   */
  async getInvites(orgId: string) {
    return this.supabase.client
      .from('invites')
      .select('*')
      .eq('organization_id', orgId)
      .is('revoked_at', null)
      .is('accepted_at', null)
      .order('created_at', { ascending: false });
  }

  /**
   * Sends an invite to an email address.
   */
  async sendInvite(orgId: string, email: string, role: 'admin' | 'member' = 'member') {
    const token = self.crypto.randomUUID();
    return this.supabase.client.from('invites').insert({
      organization_id: orgId,
      email,
      role,
      token,
      invited_by: this.supabase.user()?.id,
    });
  }

  /**
   * Revokes (deletes) an invite.
   */
  async revokeInvite(inviteId: string) {
    return this.supabase.client
      .from('invites')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', inviteId);
  }

  /**
   * Accepts an invite using the token.
   */
  async acceptInvite(token: string) {
    return this.supabase.rpc('accept_invite', {
      p_token: token,
    });
  }
}
