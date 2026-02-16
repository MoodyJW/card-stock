export type Role = 'owner' | 'admin' | 'member';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface Membership {
  id: string;
  user_id: string;
  organization_id: string;
  role: Role;
  invited_by?: string;
  invited_at?: string;
  accepted_at?: string;
  created_at: string;
}

export interface Invite {
  id: string;
  organization_id: string;
  email: string;
  role: Role;
  token: string;
  invited_by: string;
  created_at: string;
  expires_at: string;
  accepted_at?: string;
  revoked_at?: string;
}

export interface MemberProfile extends Membership {
  profile: {
    email: string;
    display_name?: string;
    avatar_url?: string;
  };
}

export interface CreateShopParams {
  name: string;
  slug: string;
}
