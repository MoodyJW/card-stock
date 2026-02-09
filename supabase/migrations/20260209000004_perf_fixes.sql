-- Fix Performance Advisor Warnings
-- Migration: 20260209000004_perf_fixes.sql

-- =============================================================================
-- FIX 1: Consolidate profiles policies into single restrictive policy approach
-- =============================================================================

-- Drop existing overlapping policies
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_modify" ON public.profiles;

-- Create single policy for viewing (own profile OR co-members)
CREATE POLICY "profiles_view" ON public.profiles FOR SELECT 
  USING (user_id = auth.uid() OR user_id IN (SELECT get_co_member_user_ids()));

-- Separate policies for each modification action (INSERT, UPDATE, DELETE) - own profile only
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT 
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE 
  USING (user_id = auth.uid()) 
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE 
  USING (user_id = auth.uid());

-- =============================================================================
-- FIX 2: Optimize inventory_images policies - reduce function calls
-- =============================================================================

-- Drop and recreate with simpler approach
DROP POLICY IF EXISTS "Members view" ON public.inventory_images;
DROP POLICY IF EXISTS "Members add" ON public.inventory_images;
DROP POLICY IF EXISTS "Members update" ON public.inventory_images;
DROP POLICY IF EXISTS "Uploader or admin delete" ON public.inventory_images;

-- Use subqueries instead of function calls where possible
CREATE POLICY "inventory_images_select" ON public.inventory_images FOR SELECT 
  USING (organization_id IN (
    SELECT organization_id FROM public.memberships WHERE user_id = auth.uid()
  ));

CREATE POLICY "inventory_images_insert" ON public.inventory_images FOR INSERT 
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.memberships WHERE user_id = auth.uid()
  ));

CREATE POLICY "inventory_images_update" ON public.inventory_images FOR UPDATE 
  USING (organization_id IN (
    SELECT organization_id FROM public.memberships WHERE user_id = auth.uid()
  ));

CREATE POLICY "inventory_images_delete" ON public.inventory_images FOR DELETE 
  USING (
    created_by = auth.uid() 
    OR organization_id IN (
      SELECT organization_id FROM public.memberships 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );
