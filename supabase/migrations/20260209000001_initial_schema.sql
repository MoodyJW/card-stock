-- CardStock Multi-Tenant SaaS Schema
-- Migration: 20260209000001_initial_schema.sql
-- Description: Creates complete schema per IMPLEMENTATION_PLAN.md

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE role_enum AS ENUM ('owner', 'admin', 'member');

CREATE TYPE condition_enum AS ENUM (
  'mint', 'near_mint', 'lightly_played', 
  'moderately_played', 'heavily_played', 'damaged'
);

CREATE TYPE grading_company_enum AS ENUM ('psa', 'cgc', 'bgs', 'sgc', 'ace');

CREATE TYPE inventory_status_enum AS ENUM ('available', 'reserved', 'sold');

-- =============================================================================
-- TABLES
-- =============================================================================

-- profiles (independent of organizations)
CREATE TABLE profiles (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE profiles IS 'User profiles independent of any store membership';

-- organizations (stores/tenants)
CREATE TABLE organizations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  deleted_at    TIMESTAMPTZ,
  
  CONSTRAINT name_valid CHECK (char_length(trim(name)) BETWEEN 1 AND 100),
  CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,30}[a-z0-9]$'),
  CONSTRAINT slug_not_reserved CHECK (slug NOT IN (
    'api', 'admin', 'www', 'app', 'auth', 'login', 'register'
  ))
);

COMMENT ON TABLE organizations IS 'Tenant accounts (stores) in the multi-tenant system';

-- memberships (links users to orgs with roles)
CREATE TABLE memberships (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role            role_enum NOT NULL DEFAULT 'member',
  invited_by      UUID REFERENCES auth.users(id),
  invited_at      TIMESTAMPTZ,
  accepted_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE (user_id, organization_id)
);

COMMENT ON TABLE memberships IS 'Links users to organizations with roles';

-- inventory (one row per physical card)
CREATE TABLE inventory (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Card identity
  card_name       TEXT NOT NULL,
  set_name        TEXT,
  set_code        TEXT,
  card_number     TEXT,
  rarity          TEXT,
  language        TEXT DEFAULT 'English',
  is_foil         BOOLEAN DEFAULT false,
  
  -- Condition & Grading
  condition       condition_enum NOT NULL DEFAULT 'near_mint',
  grading_company grading_company_enum,
  grade           DECIMAL(3,1),
  
  -- Pricing
  purchase_price  DECIMAL(10,2),
  selling_price   DECIMAL(10,2),
  
  -- Status
  status          inventory_status_enum NOT NULL DEFAULT 'available',
  
  -- Audit
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  created_by      UUID REFERENCES auth.users(id),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  updated_by      UUID REFERENCES auth.users(id),
  deleted_at      TIMESTAMPTZ
);

COMMENT ON TABLE inventory IS 'Card inventory - one row per physical card';

-- transactions (sales audit trail)
CREATE TABLE transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  inventory_id    UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  
  sold_price      DECIMAL(10,2) NOT NULL,
  sold_at         TIMESTAMPTZ DEFAULT now(),
  sold_by         UUID REFERENCES auth.users(id),
  
  buyer_email     TEXT,
  buyer_notes     TEXT,
  
  created_at      TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE transactions IS 'Sales records for sold inventory items';

-- audit_log
CREATE TABLE audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  table_name      TEXT NOT NULL,
  record_id       UUID NOT NULL,
  action          TEXT NOT NULL,
  old_data        JSONB,
  new_data        JSONB,
  changed_by      UUID REFERENCES auth.users(id),
  changed_at      TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE audit_log IS 'Audit trail for inventory, memberships, and org changes';

-- inventory_images
CREATE TABLE inventory_images (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id    UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  storage_path    TEXT NOT NULL,
  is_primary      BOOLEAN DEFAULT false,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE inventory_images IS 'Multiple images per inventory item';

-- invites
CREATE TABLE invites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  role            role_enum NOT NULL DEFAULT 'member',
  token           TEXT NOT NULL UNIQUE,
  invited_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  expires_at      TIMESTAMPTZ DEFAULT now() + interval '7 days',
  accepted_at     TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ
);

COMMENT ON TABLE invites IS 'Pending invitations to join an organization';

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX idx_inventory_org_status ON inventory(organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_inventory_org_set ON inventory(organization_id, set_name) WHERE deleted_at IS NULL;
CREATE INDEX idx_inventory_card_name_gin ON inventory USING gin(to_tsvector('english', card_name));
CREATE INDEX idx_transactions_org_date ON transactions(organization_id, sold_at DESC);
CREATE INDEX idx_transactions_inventory ON transactions(inventory_id);
-- Note: idx_memberships_user not needed; UNIQUE(user_id, organization_id) provides this coverage
CREATE INDEX idx_memberships_org ON memberships(organization_id);
CREATE INDEX idx_audit_org_table ON audit_log(organization_id, table_name, changed_at DESC);
CREATE INDEX idx_images_inventory ON inventory_images(inventory_id);
CREATE INDEX idx_images_org ON inventory_images(organization_id);
CREATE UNIQUE INDEX idx_invites_org_email_pending ON invites(organization_id, email) 
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

-- =============================================================================
-- TRIGGERS: updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON organizations 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_inventory_updated_at BEFORE UPDATE ON inventory 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- TRIGGERS: Auto-create profile on user signup
-- =============================================================================

CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================================================
-- TRIGGERS: Audit log
-- =============================================================================

-- Generic audit for tables WITH organization_id column
CREATE OR REPLACE FUNCTION audit_trigger() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (organization_id, table_name, record_id, action, old_data, new_data, changed_by)
  VALUES (
    COALESCE(NEW.organization_id, OLD.organization_id),
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END,
    auth.uid()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_inventory_audit AFTER INSERT OR UPDATE OR DELETE ON inventory
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER trg_memberships_audit AFTER INSERT OR UPDATE OR DELETE ON memberships
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- Separate audit for organizations (uses id, not organization_id)
CREATE OR REPLACE FUNCTION audit_trigger_organizations() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (organization_id, table_name, record_id, action, old_data, new_data, changed_by)
  VALUES (
    COALESCE(NEW.id, OLD.id),
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END,
    auth.uid()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_organizations_audit AFTER INSERT OR UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_organizations();

-- =============================================================================
-- RLS HELPER FUNCTIONS
-- =============================================================================

CREATE FUNCTION get_user_org_ids() RETURNS SETOF UUID AS $$
  SELECT organization_id FROM memberships 
  WHERE user_id = auth.uid()
    AND organization_id IN (SELECT id FROM organizations WHERE deleted_at IS NULL)
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE FUNCTION get_co_member_user_ids() RETURNS SETOF UUID AS $$
  SELECT DISTINCT m2.user_id FROM memberships m1
  JOIN memberships m2 ON m1.organization_id = m2.organization_id
  JOIN organizations o ON o.id = m1.organization_id
  WHERE m1.user_id = auth.uid() AND o.deleted_at IS NULL
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE FUNCTION is_org_owner(org_id UUID) RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM memberships WHERE user_id = auth.uid() 
    AND organization_id = org_id AND role = 'owner')
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE FUNCTION is_org_admin_or_owner(org_id UUID) RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM memberships WHERE user_id = auth.uid() 
    AND organization_id = org_id AND role IN ('owner', 'admin'))
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "Own profile" ON profiles FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Co-members view" ON profiles FOR SELECT USING (user_id IN (SELECT get_co_member_user_ids()));

-- organizations
CREATE POLICY "Members view" ON organizations FOR SELECT 
  USING (id IN (SELECT get_user_org_ids()) AND deleted_at IS NULL);
CREATE POLICY "Admins update settings" ON organizations FOR UPDATE 
  USING (is_org_admin_or_owner(id) AND deleted_at IS NULL)
  WITH CHECK (deleted_at IS NULL);
CREATE POLICY "No direct inserts" ON organizations FOR INSERT WITH CHECK (false);

-- memberships
CREATE POLICY "Members view" ON memberships FOR SELECT 
  USING (organization_id IN (SELECT get_user_org_ids()));
CREATE POLICY "No direct inserts" ON memberships FOR INSERT WITH CHECK (false);
CREATE POLICY "Owners update roles" ON memberships FOR UPDATE USING (is_org_owner(organization_id));
CREATE POLICY "No direct deletes" ON memberships FOR DELETE USING (false);

-- inventory
CREATE POLICY "Members view" ON inventory FOR SELECT 
  USING (organization_id IN (SELECT get_user_org_ids()) AND deleted_at IS NULL);
CREATE POLICY "Members add" ON inventory FOR INSERT 
  WITH CHECK (organization_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Members update" ON inventory FOR UPDATE 
  USING (organization_id IN (SELECT get_user_org_ids()) AND deleted_at IS NULL);
CREATE POLICY "Admins delete" ON inventory FOR DELETE 
  USING (is_org_admin_or_owner(organization_id));

-- transactions
CREATE POLICY "Members view" ON transactions FOR SELECT 
  USING (organization_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Via RPC only" ON transactions FOR INSERT WITH CHECK (false);

-- invites
CREATE POLICY "Admins manage" ON invites FOR ALL USING (is_org_admin_or_owner(organization_id));

-- inventory_images
CREATE POLICY "Members view" ON inventory_images FOR SELECT 
  USING (organization_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Members add" ON inventory_images FOR INSERT 
  WITH CHECK (organization_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Members update" ON inventory_images FOR UPDATE 
  USING (organization_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Uploader or admin delete" ON inventory_images FOR DELETE 
  USING (created_by = auth.uid() OR is_org_admin_or_owner(organization_id));

-- audit_log
CREATE POLICY "Admins view" ON audit_log FOR SELECT USING (is_org_admin_or_owner(organization_id));

-- =============================================================================
-- RPC FUNCTIONS
-- =============================================================================

-- create_organization: Atomically creates org + owner membership
CREATE OR REPLACE FUNCTION create_organization(p_name TEXT, p_slug TEXT) 
RETURNS organizations AS $$
DECLARE
  v_org organizations;
BEGIN
  IF p_slug !~ '^[a-z0-9][a-z0-9-]{0,30}[a-z0-9]$' THEN
    RAISE EXCEPTION 'Invalid slug format';
  END IF;
  
  INSERT INTO organizations (name, slug) VALUES (p_name, p_slug) RETURNING * INTO v_org;
  INSERT INTO memberships (user_id, organization_id, role, accepted_at)
  VALUES (auth.uid(), v_org.id, 'owner', now());
  
  RETURN v_org;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- accept_invite: Validates and accepts an invite
CREATE OR REPLACE FUNCTION accept_invite(p_token TEXT) 
RETURNS memberships AS $$
DECLARE
  v_invite invites;
  v_membership memberships;
BEGIN
  -- Find and validate invite (lock to prevent race condition)
  SELECT * INTO v_invite FROM invites WHERE token = p_token FOR UPDATE;
  
  IF v_invite IS NULL THEN
    RAISE EXCEPTION 'Invalid invite token';
  END IF;
  IF v_invite.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invite has been revoked';
  END IF;
  IF v_invite.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invite has already been used';
  END IF;
  IF v_invite.expires_at < now() THEN
    RAISE EXCEPTION 'Invite has expired';
  END IF;
  
  -- Check org is not soft-deleted
  IF EXISTS (SELECT 1 FROM organizations WHERE id = v_invite.organization_id AND deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Organization no longer exists';
  END IF;
  
  -- Verify current user's email matches invite (case-insensitive)
  IF LOWER((SELECT email FROM auth.users WHERE id = auth.uid())) != LOWER(v_invite.email) THEN
    RAISE EXCEPTION 'Invite is for a different email address';
  END IF;
  
  -- Create membership
  INSERT INTO memberships (user_id, organization_id, role, invited_by, invited_at, accepted_at)
  VALUES (auth.uid(), v_invite.organization_id, v_invite.role, v_invite.invited_by, v_invite.created_at, now())
  RETURNING * INTO v_membership;
  
  -- Mark invite as accepted
  UPDATE invites SET accepted_at = now() WHERE id = v_invite.id;
  
  RETURN v_membership;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- mark_card_sold: Atomically marks card as sold and creates transaction
CREATE OR REPLACE FUNCTION mark_card_sold(
  p_inventory_id UUID, p_sold_price DECIMAL,
  p_buyer_email TEXT DEFAULT NULL, p_buyer_notes TEXT DEFAULT NULL
) RETURNS transactions AS $$
DECLARE
  v_org_id UUID;
  v_status inventory_status_enum;
  v_transaction transactions;
BEGIN
  SELECT organization_id, status INTO v_org_id, v_status 
  FROM inventory WHERE id = p_inventory_id AND deleted_at IS NULL
  FOR UPDATE;
  
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Inventory item not found'; END IF;
  IF v_status != 'available' THEN RAISE EXCEPTION 'Card is not available (status: %)', v_status; END IF;
  IF NOT EXISTS (SELECT 1 FROM memberships WHERE user_id = auth.uid() AND organization_id = v_org_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  UPDATE inventory SET status = 'sold', updated_at = now(), updated_by = auth.uid()
  WHERE id = p_inventory_id;
  
  INSERT INTO transactions (organization_id, inventory_id, sold_price, sold_by, buyer_email, buyer_notes)
  VALUES (v_org_id, p_inventory_id, p_sold_price, auth.uid(), p_buyer_email, p_buyer_notes)
  RETURNING * INTO v_transaction;
  
  RETURN v_transaction;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- soft_delete_organization: Owner-only soft delete
CREATE OR REPLACE FUNCTION soft_delete_organization(p_org_id UUID) 
RETURNS organizations AS $$
DECLARE
  v_org organizations;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM memberships 
    WHERE user_id = auth.uid() AND organization_id = p_org_id AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Only owners can delete organizations';
  END IF;
  
  UPDATE organizations SET deleted_at = now() WHERE id = p_org_id RETURNING * INTO v_org;
  RETURN v_org;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- leave_organization: With orphan prevention
CREATE OR REPLACE FUNCTION leave_organization(p_org_id UUID) 
RETURNS void AS $$
DECLARE
  v_role role_enum;
  v_owner_count INTEGER;
BEGIN
  SELECT role INTO v_role FROM memberships 
  WHERE user_id = auth.uid() AND organization_id = p_org_id;
  
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;
  
  IF v_role = 'owner' THEN
    SELECT COUNT(*) INTO v_owner_count FROM memberships 
    WHERE organization_id = p_org_id AND role = 'owner'
    FOR UPDATE;
    
    IF v_owner_count <= 1 THEN
      RAISE EXCEPTION 'Cannot leave: you are the only owner. Transfer ownership first or delete the organization.';
    END IF;
  END IF;
  
  DELETE FROM memberships WHERE user_id = auth.uid() AND organization_id = p_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
