-- Fix security and performance warnings from Supabase Studio
-- Migration: 20260209000002_security_fixes.sql

-- =============================================================================
-- SECURITY: Add search_path to all functions
-- =============================================================================

-- Helper functions
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION audit_trigger() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_log (organization_id, table_name, record_id, action, old_data, new_data, changed_by)
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION audit_trigger_organizations() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_log (organization_id, table_name, record_id, action, old_data, new_data, changed_by)
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- RLS helper functions
CREATE OR REPLACE FUNCTION get_user_org_ids() RETURNS SETOF UUID AS $$
  SELECT organization_id FROM public.memberships 
  WHERE user_id = auth.uid()
    AND organization_id IN (SELECT id FROM public.organizations WHERE deleted_at IS NULL)
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

CREATE OR REPLACE FUNCTION get_co_member_user_ids() RETURNS SETOF UUID AS $$
  SELECT DISTINCT m2.user_id FROM public.memberships m1
  JOIN public.memberships m2 ON m1.organization_id = m2.organization_id
  JOIN public.organizations o ON o.id = m1.organization_id
  WHERE m1.user_id = auth.uid() AND o.deleted_at IS NULL
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

CREATE OR REPLACE FUNCTION is_org_owner(org_id UUID) RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships WHERE user_id = auth.uid() 
    AND organization_id = org_id AND role = 'owner')
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

CREATE OR REPLACE FUNCTION is_org_admin_or_owner(org_id UUID) RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships WHERE user_id = auth.uid() 
    AND organization_id = org_id AND role IN ('owner', 'admin'))
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

-- RPC functions
CREATE OR REPLACE FUNCTION create_organization(p_name TEXT, p_slug TEXT) 
RETURNS public.organizations AS $$
DECLARE
  v_org public.organizations;
BEGIN
  IF p_slug !~ '^[a-z0-9][a-z0-9-]{0,30}[a-z0-9]$' THEN
    RAISE EXCEPTION 'Invalid slug format';
  END IF;
  
  INSERT INTO public.organizations (name, slug) VALUES (p_name, p_slug) RETURNING * INTO v_org;
  INSERT INTO public.memberships (user_id, organization_id, role, accepted_at)
  VALUES (auth.uid(), v_org.id, 'owner', now());
  
  RETURN v_org;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION accept_invite(p_token TEXT) 
RETURNS public.memberships AS $$
DECLARE
  v_invite public.invites;
  v_membership public.memberships;
BEGIN
  SELECT * INTO v_invite FROM public.invites WHERE token = p_token FOR UPDATE;
  
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
  
  IF EXISTS (SELECT 1 FROM public.organizations WHERE id = v_invite.organization_id AND deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Organization no longer exists';
  END IF;
  
  IF LOWER((SELECT email FROM auth.users WHERE id = auth.uid())) != LOWER(v_invite.email) THEN
    RAISE EXCEPTION 'Invite is for a different email address';
  END IF;
  
  INSERT INTO public.memberships (user_id, organization_id, role, invited_by, invited_at, accepted_at)
  VALUES (auth.uid(), v_invite.organization_id, v_invite.role, v_invite.invited_by, v_invite.created_at, now())
  RETURNING * INTO v_membership;
  
  UPDATE public.invites SET accepted_at = now() WHERE id = v_invite.id;
  
  RETURN v_membership;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION mark_card_sold(
  p_inventory_id UUID, p_sold_price DECIMAL,
  p_buyer_email TEXT DEFAULT NULL, p_buyer_notes TEXT DEFAULT NULL
) RETURNS public.transactions AS $$
DECLARE
  v_org_id UUID;
  v_status public.inventory_status_enum;
  v_transaction public.transactions;
BEGIN
  SELECT organization_id, status INTO v_org_id, v_status 
  FROM public.inventory WHERE id = p_inventory_id AND deleted_at IS NULL
  FOR UPDATE;
  
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Inventory item not found'; END IF;
  IF v_status != 'available' THEN RAISE EXCEPTION 'Card is not available (status: %)', v_status; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.memberships WHERE user_id = auth.uid() AND organization_id = v_org_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  UPDATE public.inventory SET status = 'sold', updated_at = now(), updated_by = auth.uid()
  WHERE id = p_inventory_id;
  
  INSERT INTO public.transactions (organization_id, inventory_id, sold_price, sold_by, buyer_email, buyer_notes)
  VALUES (v_org_id, p_inventory_id, p_sold_price, auth.uid(), p_buyer_email, p_buyer_notes)
  RETURNING * INTO v_transaction;
  
  RETURN v_transaction;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION soft_delete_organization(p_org_id UUID) 
RETURNS public.organizations AS $$
DECLARE
  v_org public.organizations;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships 
    WHERE user_id = auth.uid() AND organization_id = p_org_id AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Only owners can delete organizations';
  END IF;
  
  UPDATE public.organizations SET deleted_at = now() WHERE id = p_org_id RETURNING * INTO v_org;
  RETURN v_org;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION leave_organization(p_org_id UUID) 
RETURNS void AS $$
DECLARE
  v_role public.role_enum;
  v_owner_count INTEGER;
BEGIN
  SELECT role INTO v_role FROM public.memberships 
  WHERE user_id = auth.uid() AND organization_id = p_org_id;
  
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;
  
  IF v_role = 'owner' THEN
    SELECT COUNT(*) INTO v_owner_count FROM public.memberships 
    WHERE organization_id = p_org_id AND role = 'owner'
    FOR UPDATE;
    
    IF v_owner_count <= 1 THEN
      RAISE EXCEPTION 'Cannot leave: you are the only owner. Transfer ownership first or delete the organization.';
    END IF;
  END IF;
  
  DELETE FROM public.memberships WHERE user_id = auth.uid() AND organization_id = p_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- =============================================================================
-- PERFORMANCE: Consolidate overlapping profiles policies
-- =============================================================================

-- Drop the overlapping policies
DROP POLICY IF EXISTS "Own profile" ON public.profiles;
DROP POLICY IF EXISTS "Co-members view" ON public.profiles;

-- Create single consolidated SELECT policy
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT 
  USING (user_id = auth.uid() OR user_id IN (SELECT get_co_member_user_ids()));

-- Create separate policy for modifications (own profile only)
CREATE POLICY "profiles_modify" ON public.profiles FOR ALL 
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
