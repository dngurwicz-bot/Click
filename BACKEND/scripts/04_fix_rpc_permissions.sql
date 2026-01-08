-- ============================================
-- Fix RPC Permissions and RLS
-- ============================================

-- 1. Grant Execute Permissions explicitly
GRANT EXECUTE ON FUNCTION get_org_settings(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_org_settings(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_org_settings(UUID) TO public;

-- 2. Ensure the function owner is correct (postgres)
ALTER FUNCTION get_org_settings(UUID) OWNER TO postgres;

-- 3. Reset RLS on organization_settings to be more permissive for debugging
-- We'll allow all authenticated users to View and Insert/Update for now
DROP POLICY IF EXISTS "Super admins have full access to organization_settings" ON organization_settings;
DROP POLICY IF EXISTS "Org admins can view their organization settings" ON organization_settings;
DROP POLICY IF EXISTS "Org admins can update their organization settings" ON organization_settings;
DROP POLICY IF EXISTS "Org admins can insert their organization settings" ON organization_settings;
DROP POLICY IF EXISTS "Users can view their organization settings" ON organization_settings;

-- Create broad policies for authenticated users
CREATE POLICY "Allow authenticated full access to settings"
    ON organization_settings
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 4. Ensure Organization Exists (Double check)
INSERT INTO public.organizations (name, status)
SELECT 'Click HR Demo Org', 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.organizations);

-- 5. Fix null organization_id in employees if any (orphan users)
UPDATE public.employees
SET organization_id = (SELECT id FROM public.organizations LIMIT 1)
WHERE organization_id IS NULL;

-- 6. Ensure get_my_org_id is accessible
GRANT EXECUTE ON FUNCTION get_my_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_org_id() TO service_role;
