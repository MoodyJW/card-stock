-- Fix leave_organization FOR UPDATE bug
-- Migration: 20260209000003_fix_leave_org.sql
-- 
-- Issue: FOR UPDATE cannot be used with aggregate functions (COUNT).
-- Solution: Lock a specific row instead of using FOR UPDATE on aggregate.

CREATE OR REPLACE FUNCTION leave_organization(p_org_id UUID) 
RETURNS void AS $$
DECLARE
  v_role public.role_enum;
  v_owner_count INTEGER;
  v_my_membership_id UUID;
BEGIN
  -- Get current user's membership (and lock it)
  SELECT id, role INTO v_my_membership_id, v_role 
  FROM public.memberships 
  WHERE user_id = auth.uid() AND organization_id = p_org_id
  FOR UPDATE;
  
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;
  
  IF v_role = 'owner' THEN
    -- Count owners separately (no FOR UPDATE on aggregate)
    SELECT COUNT(*) INTO v_owner_count 
    FROM public.memberships 
    WHERE organization_id = p_org_id AND role = 'owner';
    
    IF v_owner_count <= 1 THEN
      RAISE EXCEPTION 'Cannot leave: you are the only owner. Transfer ownership first or delete the organization.';
    END IF;
  END IF;
  
  DELETE FROM public.memberships WHERE id = v_my_membership_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
