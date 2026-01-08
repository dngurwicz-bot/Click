-- ============================================
-- Fix Permissions & Data Integrity
-- ============================================

-- 1. Ensure at least one Organization exists
INSERT INTO public.organizations (name, status)
SELECT 'Click HR Demo Org', 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.organizations);

-- 2. Ensure Employees exist for all Auth Users
-- This maps every authenticated user to the first available organization as an Admin
INSERT INTO public.employees (
    id, 
    organization_id, 
    first_name, 
    last_name, 
    email, 
    job_title, 
    is_active, 
    is_admin, 
    is_super_admin,
    created_at,
    updated_at
)
SELECT 
    au.id, 
    (SELECT id FROM public.organizations LIMIT 1), -- Assign to first org
    COALESCE(au.raw_user_meta_data->>'first_name', 'System'),
    COALESCE(au.raw_user_meta_data->>'last_name', 'Admin'),
    au.email,
    'System Administrator',
    true, -- Active
    true, -- Org Admin
    true, -- Super Admin to allow everything
    NOW(),
    NOW()
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.employees e WHERE e.id = au.id);

-- 3. Update existing employees to be admins (for dev environment only)
-- This ensures that if the user already existed but wasn't admin, they become one.
UPDATE public.employees
SET 
    is_admin = true,
    is_super_admin = true,
    organization_id = (SELECT id FROM public.organizations LIMIT 1) -- Ensure they are attached to a valid org
WHERE organization_id IS NULL OR is_admin = false;

-- 4. Make get_org_settings SECURITY DEFINER to fix "First Load" issue
-- This allows the function to bypass RLS when originally fetching/creating settings
CREATE OR REPLACE FUNCTION get_org_settings(org_id UUID)
RETURNS organization_settings AS $$
DECLARE
    settings organization_settings;
BEGIN
    SELECT * INTO settings FROM organization_settings WHERE organization_id = org_id;
    IF NOT FOUND THEN
        INSERT INTO organization_settings (organization_id) VALUES (org_id) RETURNING * INTO settings;
    END IF;
    RETURN settings;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
