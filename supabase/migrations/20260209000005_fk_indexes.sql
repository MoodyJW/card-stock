-- Add indexes for unindexed foreign keys
-- Migration: 20260209000005_fk_indexes.sql
-- 
-- These improve JOIN performance and CASCADE operations

-- audit_log: changed_by FK
CREATE INDEX IF NOT EXISTS idx_audit_changed_by ON public.audit_log(changed_by);

-- inventory: created_by and updated_by FKs
CREATE INDEX IF NOT EXISTS idx_inventory_created_by ON public.inventory(created_by);
CREATE INDEX IF NOT EXISTS idx_inventory_updated_by ON public.inventory(updated_by);

-- inventory_images: created_by FK  
CREATE INDEX IF NOT EXISTS idx_inventory_images_created_by ON public.inventory_images(created_by);

-- invites: invited_by FK
CREATE INDEX IF NOT EXISTS idx_invites_invited_by ON public.invites(invited_by);

-- memberships: invited_by FK
CREATE INDEX IF NOT EXISTS idx_memberships_invited_by ON public.memberships(invited_by);

-- transactions: sold_by FK
CREATE INDEX IF NOT EXISTS idx_transactions_sold_by ON public.transactions(sold_by);
