-- Fix: Allow reuse of organization slugs after soft delete.
-- The original schema uses a plain UNIQUE constraint on slug, which blocks
-- reuse even for soft-deleted rows. Replace with a partial unique index
-- that only enforces uniqueness among active (non-deleted) organizations.

-- Drop the existing unique constraint
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_slug_key;

-- Create a partial unique index (only for active orgs)
CREATE UNIQUE INDEX organizations_slug_active_key ON organizations (slug) WHERE deleted_at IS NULL;
