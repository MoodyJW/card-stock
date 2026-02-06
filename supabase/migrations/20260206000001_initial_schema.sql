-- CardStock Multi-Tenant SaaS Schema
-- Migration: 20260206000001_initial_schema.sql
-- Description: Creates core tables for multi-tenant inventory management

-- =============================================================================
-- ORGANIZATIONS (Tenants)
-- =============================================================================
-- Each organization represents a store/tenant in the system
CREATE TABLE public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9-]+$')
);

COMMENT ON TABLE public.organizations IS 'Tenant accounts (stores) in the multi-tenant system';
COMMENT ON COLUMN public.organizations.slug IS 'URL-safe identifier for public storefront (cardstock.app/:slug)';

-- =============================================================================
-- PROFILES (Users linked to Organizations)
-- =============================================================================
-- Links Supabase Auth users to organizations with roles
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    display_name TEXT,
    role TEXT NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT valid_role CHECK (role IN ('owner', 'admin', 'member')),
    UNIQUE (user_id, organization_id)
);

COMMENT ON TABLE public.profiles IS 'User profiles linking auth.users to organizations';
COMMENT ON COLUMN public.profiles.role IS 'User role within organization: owner, admin, or member';

-- Index for fast lookups by user_id
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_organization_id ON public.profiles(organization_id);

-- =============================================================================
-- INVENTORY (Cards)
-- =============================================================================
-- Card inventory with multi-tenant isolation
CREATE TABLE public.inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    card_name TEXT NOT NULL,
    set_name TEXT,
    set_code TEXT,
    card_number TEXT,
    condition TEXT NOT NULL DEFAULT 'Near Mint',
    price DECIMAL(10, 2),
    quantity INTEGER NOT NULL DEFAULT 1,
    language TEXT DEFAULT 'English',
    is_foil BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT valid_condition CHECK (condition IN (
        'Mint', 'Near Mint', 'Lightly Played', 
        'Moderately Played', 'Heavily Played', 'Damaged'
    )),
    CONSTRAINT positive_quantity CHECK (quantity >= 0),
    CONSTRAINT positive_price CHECK (price IS NULL OR price >= 0)
);

COMMENT ON TABLE public.inventory IS 'Card inventory with multi-tenant isolation';

-- Indexes for common queries
CREATE INDEX idx_inventory_organization_id ON public.inventory(organization_id);
CREATE INDEX idx_inventory_card_name ON public.inventory(card_name);
CREATE INDEX idx_inventory_set_name ON public.inventory(set_name);

-- =============================================================================
-- BOUNTIES (Want to Buy - Phase 4 Prep)
-- =============================================================================
-- Items that stores want to purchase from customers
CREATE TABLE public.bounties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    card_name TEXT NOT NULL,
    set_name TEXT,
    condition_minimum TEXT DEFAULT 'Lightly Played',
    max_price DECIMAL(10, 2),
    quantity_wanted INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT valid_condition_minimum CHECK (condition_minimum IN (
        'Mint', 'Near Mint', 'Lightly Played', 
        'Moderately Played', 'Heavily Played', 'Damaged'
    ))
);

COMMENT ON TABLE public.bounties IS 'Want-to-buy board for items stores wish to purchase';

CREATE INDEX idx_bounties_organization_id ON public.bounties(organization_id);

-- =============================================================================
-- USAGE METRICS (Billing Prep - Phase 4)
-- =============================================================================
-- Track API calls and scans for usage-based billing
CREATE TABLE public.usage_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    metric_type TEXT NOT NULL,
    metric_value INTEGER NOT NULL DEFAULT 1,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata JSONB,
    
    CONSTRAINT valid_metric_type CHECK (metric_type IN (
        'api_call', 'card_scan', 'excel_import', 'qr_generation'
    ))
);

COMMENT ON TABLE public.usage_metrics IS 'Usage tracking for billing and analytics';

CREATE INDEX idx_usage_metrics_organization_id ON public.usage_metrics(organization_id);
CREATE INDEX idx_usage_metrics_recorded_at ON public.usage_metrics(recorded_at);
CREATE INDEX idx_usage_metrics_type ON public.usage_metrics(metric_type);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bounties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_metrics ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Helper function: Get user's organization IDs
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_organization_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT organization_id 
    FROM public.profiles 
    WHERE user_id = auth.uid()
$$;

-- -----------------------------------------------------------------------------
-- ORGANIZATIONS Policies
-- -----------------------------------------------------------------------------
-- Users can view organizations they belong to
CREATE POLICY "Users can view their organizations"
    ON public.organizations
    FOR SELECT
    USING (id IN (SELECT public.get_user_organization_ids()));

-- Only owners can update their organization
CREATE POLICY "Owners can update their organization"
    ON public.organizations
    FOR UPDATE
    USING (
        id IN (
            SELECT organization_id 
            FROM public.profiles 
            WHERE user_id = auth.uid() AND role = 'owner'
        )
    );

-- Anyone can create an organization (for signup flow)
CREATE POLICY "Authenticated users can create organizations"
    ON public.organizations
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- -----------------------------------------------------------------------------
-- PROFILES Policies
-- -----------------------------------------------------------------------------
-- Users can view profiles in their organizations
CREATE POLICY "Users can view profiles in their org"
    ON public.profiles
    FOR SELECT
    USING (organization_id IN (SELECT public.get_user_organization_ids()));

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
    ON public.profiles
    FOR UPDATE
    USING (user_id = auth.uid());

-- Users can create their own profile
CREATE POLICY "Users can create their own profile"
    ON public.profiles
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- INVENTORY Policies
-- -----------------------------------------------------------------------------
-- Users can view inventory in their organizations
CREATE POLICY "Users can view their org inventory"
    ON public.inventory
    FOR SELECT
    USING (organization_id IN (SELECT public.get_user_organization_ids()));

-- Users can insert inventory in their organizations
CREATE POLICY "Users can add to their org inventory"
    ON public.inventory
    FOR INSERT
    WITH CHECK (organization_id IN (SELECT public.get_user_organization_ids()));

-- Users can update inventory in their organizations
CREATE POLICY "Users can update their org inventory"
    ON public.inventory
    FOR UPDATE
    USING (organization_id IN (SELECT public.get_user_organization_ids()));

-- Users can delete inventory in their organizations
CREATE POLICY "Users can delete their org inventory"
    ON public.inventory
    FOR DELETE
    USING (organization_id IN (SELECT public.get_user_organization_ids()));

-- Public read access for storefronts (Phase 3)
CREATE POLICY "Public can view inventory via org slug"
    ON public.inventory
    FOR SELECT
    USING (
        organization_id IN (
            SELECT id FROM public.organizations WHERE slug IS NOT NULL
        )
    );

-- -----------------------------------------------------------------------------
-- BOUNTIES Policies
-- -----------------------------------------------------------------------------
-- Users can view bounties in their organizations
CREATE POLICY "Users can view their org bounties"
    ON public.bounties
    FOR SELECT
    USING (organization_id IN (SELECT public.get_user_organization_ids()));

-- Users can manage bounties in their organizations
CREATE POLICY "Users can manage their org bounties"
    ON public.bounties
    FOR ALL
    USING (organization_id IN (SELECT public.get_user_organization_ids()));

-- -----------------------------------------------------------------------------
-- USAGE_METRICS Policies
-- -----------------------------------------------------------------------------
-- Only admins/owners can view usage metrics
CREATE POLICY "Admins can view usage metrics"
    ON public.usage_metrics
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id 
            FROM public.profiles 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- System can insert usage metrics (via service role)
CREATE POLICY "System can insert usage metrics"
    ON public.usage_metrics
    FOR INSERT
    WITH CHECK (organization_id IN (SELECT public.get_user_organization_ids()));

-- =============================================================================
-- TRIGGERS: Auto-update updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at_organizations
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_profiles
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_inventory
    BEFORE UPDATE ON public.inventory
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_bounties
    BEFORE UPDATE ON public.bounties
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
