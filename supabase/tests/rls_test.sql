-- CardStock RLS Tests
-- Run with: supabase test db
-- Requires pgTAP extension

BEGIN;

-- Plan the tests
SELECT plan(14);

-- =============================================================================
-- SETUP: Create test users and data
-- =============================================================================

-- Create test users (simulating auth.users)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner@test.com', 'password', now(), now(), now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'member@test.com', 'password', now(), now(), now()),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'outsider@test.com', 'password', now(), now(), now());

-- Create test org (bypass RLS via inserting before enabling role)
INSERT INTO public.organizations (id, name, slug) VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Test Store', 'test-store');

-- Create memberships directly (bypass RLS for setup)
INSERT INTO public.memberships (user_id, organization_id, role, accepted_at) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000001', 'owner', now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000001', 'member', now());

-- Create test inventory item
INSERT INTO public.inventory (id, organization_id, card_name, condition, status) VALUES
  ('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Test Card', 'near_mint', 'available');

-- =============================================================================
-- TEST: Organization RLS
-- =============================================================================

-- Test as owner
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

SELECT ok(
  (SELECT COUNT(*) FROM public.organizations WHERE id = '00000000-0000-0000-0000-000000000001') = 1,
  'Owner can view their organization'
);

-- Test as outsider
SET LOCAL "request.jwt.claims" = '{"sub": "cccccccc-cccc-cccc-cccc-cccccccccccc"}';

SELECT ok(
  (SELECT COUNT(*) FROM public.organizations WHERE id = '00000000-0000-0000-0000-000000000001') = 0,
  'Outsider cannot view organization'
);

-- =============================================================================
-- TEST: Inventory RLS
-- =============================================================================

-- Test as member
SET LOCAL "request.jwt.claims" = '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"}';

SELECT ok(
  (SELECT COUNT(*) FROM public.inventory WHERE organization_id = '00000000-0000-0000-0000-000000000001') = 1,
  'Member can view inventory'
);

-- Test as outsider
SET LOCAL "request.jwt.claims" = '{"sub": "cccccccc-cccc-cccc-cccc-cccccccccccc"}';

SELECT ok(
  (SELECT COUNT(*) FROM public.inventory WHERE organization_id = '00000000-0000-0000-0000-000000000001') = 0,
  'Outsider cannot view inventory'
);

-- =============================================================================
-- TEST: Membership RLS
-- =============================================================================

-- Test as owner
SET LOCAL "request.jwt.claims" = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

SELECT ok(
  (SELECT COUNT(*) FROM public.memberships WHERE organization_id = '00000000-0000-0000-0000-000000000001') = 2,
  'Owner can view all memberships'
);

-- Test as outsider
SET LOCAL "request.jwt.claims" = '{"sub": "cccccccc-cccc-cccc-cccc-cccccccccccc"}';

SELECT ok(
  (SELECT COUNT(*) FROM public.memberships WHERE organization_id = '00000000-0000-0000-0000-000000000001') = 0,
  'Outsider cannot view memberships'
);

-- =============================================================================
-- TEST: leave_organization RPC
-- =============================================================================

-- Member can leave
SET LOCAL "request.jwt.claims" = '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"}';

SELECT lives_ok(
  $$ SELECT leave_organization('00000000-0000-0000-0000-000000000001') $$,
  'Member can leave organization'
);

-- Only owner cannot leave
SET LOCAL "request.jwt.claims" = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

SELECT throws_ok(
  $$ SELECT leave_organization('00000000-0000-0000-0000-000000000001') $$,
  'P0001',
  'Cannot leave: you are the only owner. Transfer ownership first or delete the organization.',
  'Only owner cannot leave'
);

-- =============================================================================
-- TEST: Audit log RLS
-- =============================================================================

SET LOCAL "request.jwt.claims" = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

SELECT ok(
  (SELECT COUNT(*) FROM public.audit_log WHERE organization_id = '00000000-0000-0000-0000-000000000001') > 0,
  'Owner can view audit log'
);

-- Test as outsider
SET LOCAL "request.jwt.claims" = '{"sub": "cccccccc-cccc-cccc-cccc-cccccccccccc"}';

SELECT ok(
  (SELECT COUNT(*) FROM public.audit_log WHERE organization_id = '00000000-0000-0000-0000-000000000001') = 0,
  'Outsider cannot view audit log'
);

-- =============================================================================
-- TEST: Soft delete behavior
-- =============================================================================

-- Soft delete the org (as superuser)
RESET ROLE;
UPDATE public.organizations SET deleted_at = now() WHERE id = '00000000-0000-0000-0000-000000000001';

-- Now owner shouldn't see it
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

SELECT ok(
  (SELECT COUNT(*) FROM public.organizations WHERE id = '00000000-0000-0000-0000-000000000001') = 0,
  'Soft-deleted org is hidden from owner'
);

-- =============================================================================
-- TEST: RPC functions work (basic validation)
-- Note: Full RPC testing requires more complex setup with service role
-- =============================================================================

-- Reset for RPC testing
RESET ROLE;
UPDATE public.organizations SET deleted_at = NULL WHERE id = '00000000-0000-0000-0000-000000000001';
UPDATE public.inventory SET status = 'available' WHERE id = '11111111-0000-0000-0000-000000000001';
-- Restore member
INSERT INTO public.memberships (user_id, organization_id, role, accepted_at) 
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000001', 'member', now())
ON CONFLICT (user_id, organization_id) DO NOTHING;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

-- Test mark_card_sold function exists and is callable
SELECT ok(
  (SELECT proname FROM pg_proc WHERE proname = 'mark_card_sold') IS NOT NULL,
  'mark_card_sold function exists'
);

-- Test create_organization function exists
SELECT ok(
  (SELECT proname FROM pg_proc WHERE proname = 'create_organization') IS NOT NULL,
  'create_organization function exists'
);

-- Test accept_invite function exists
SELECT ok(
  (SELECT proname FROM pg_proc WHERE proname = 'accept_invite') IS NOT NULL,
  'accept_invite function exists'
);

-- Finish tests
SELECT * FROM finish();

ROLLBACK;
