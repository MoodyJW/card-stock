-- Soft-delete card RPC (admin/owner only)
-- Enforces permission check that RLS UPDATE policy cannot (any member can update).

CREATE OR REPLACE FUNCTION public.soft_delete_card(p_inventory_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT organization_id INTO v_org_id
  FROM public.inventory
  WHERE id = p_inventory_id AND deleted_at IS NULL
  FOR UPDATE;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Card not found or already deleted';
  END IF;

  IF NOT public.is_org_admin_or_owner(v_org_id) THEN
    RAISE EXCEPTION 'Only admins and owners can delete cards';
  END IF;

  UPDATE public.inventory
  SET deleted_at = now()
  WHERE id = p_inventory_id;
END;
$$;

-- Restore a soft-deleted card (admin/owner only)
-- Used by the undo-delete feature. RLS blocks direct updates on deleted rows
-- because the UPDATE policy requires deleted_at IS NULL.

CREATE OR REPLACE FUNCTION public.restore_deleted_card(p_inventory_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT organization_id INTO v_org_id
  FROM public.inventory
  WHERE id = p_inventory_id AND deleted_at IS NOT NULL;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Card not found or not deleted';
  END IF;

  IF NOT public.is_org_admin_or_owner(v_org_id) THEN
    RAISE EXCEPTION 'Only admins and owners can restore cards';
  END IF;

  UPDATE public.inventory
  SET deleted_at = NULL
  WHERE id = p_inventory_id;
END;
$$;
