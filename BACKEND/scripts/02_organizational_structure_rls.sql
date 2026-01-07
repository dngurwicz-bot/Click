-- ============================================
-- Click HR - Row Level Security (RLS) Policies
-- ============================================
-- Security policies for organizational structure tables

-- ============================================
-- Enable RLS on all tables
-- ============================================

ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE position_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_assignments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Helper Functions for RLS
-- ============================================

-- Check if user is super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM employees
        WHERE id = auth.uid()
        AND is_super_admin = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's organization ID
CREATE OR REPLACE FUNCTION get_my_org_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT organization_id FROM employees
        WHERE id = auth.uid()
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is org admin
CREATE OR REPLACE FUNCTION is_org_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM employees
        WHERE id = auth.uid()
        AND is_admin = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RLS Policies for organization_settings
-- ============================================

-- Super admins can do everything
CREATE POLICY "Super admins have full access to organization_settings"
    ON organization_settings
    FOR ALL
    USING (is_super_admin());

-- Org admins can view and update their own org settings
CREATE POLICY "Org admins can view their organization settings"
    ON organization_settings
    FOR SELECT
    USING (organization_id = get_my_org_id());

CREATE POLICY "Org admins can update their organization settings"
    ON organization_settings
    FOR UPDATE
    USING (organization_id = get_my_org_id() AND is_org_admin());

CREATE POLICY "Org admins can insert their organization settings"
    ON organization_settings
    FOR INSERT
    WITH CHECK (organization_id = get_my_org_id() AND is_org_admin());

-- All authenticated users can view their org settings (read-only)
CREATE POLICY "Users can view their organization settings"
    ON organization_settings
    FOR SELECT
    USING (organization_id = get_my_org_id());

-- ============================================
-- RLS Policies for divisions
-- ============================================

-- Super admins can do everything
CREATE POLICY "Super admins have full access to divisions"
    ON divisions
    FOR ALL
    USING (is_super_admin());

-- Org admins can manage divisions in their org
CREATE POLICY "Org admins can manage divisions"
    ON divisions
    FOR ALL
    USING (organization_id = get_my_org_id() AND is_org_admin());

-- All users can view divisions in their org
CREATE POLICY "Users can view divisions in their organization"
    ON divisions
    FOR SELECT
    USING (organization_id = get_my_org_id());

-- ============================================
-- RLS Policies for departments
-- ============================================

-- Super admins can do everything
CREATE POLICY "Super admins have full access to departments"
    ON departments
    FOR ALL
    USING (is_super_admin());

-- Org admins can manage departments in their org
CREATE POLICY "Org admins can manage departments"
    ON departments
    FOR ALL
    USING (organization_id = get_my_org_id() AND is_org_admin());

-- All users can view departments in their org
CREATE POLICY "Users can view departments in their organization"
    ON departments
    FOR SELECT
    USING (organization_id = get_my_org_id());

-- ============================================
-- RLS Policies for positions
-- ============================================

-- Super admins can do everything
CREATE POLICY "Super admins have full access to positions"
    ON positions
    FOR ALL
    USING (is_super_admin());

-- Org admins can manage positions in their org
CREATE POLICY "Org admins can manage positions"
    ON positions
    FOR ALL
    USING (organization_id = get_my_org_id() AND is_org_admin());

-- All users can view positions in their org
CREATE POLICY "Users can view positions in their organization"
    ON positions
    FOR SELECT
    USING (organization_id = get_my_org_id());

-- ============================================
-- RLS Policies for position_levels
-- ============================================

-- Super admins can do everything
CREATE POLICY "Super admins have full access to position_levels"
    ON position_levels
    FOR ALL
    USING (is_super_admin());

-- Org admins can manage position levels in their org
CREATE POLICY "Org admins can manage position_levels"
    ON position_levels
    FOR ALL
    USING (organization_id = get_my_org_id() AND is_org_admin());

-- All users can view position levels in their org
CREATE POLICY "Users can view position_levels in their organization"
    ON position_levels
    FOR SELECT
    USING (organization_id = get_my_org_id());

-- ============================================
-- RLS Policies for employee_assignments
-- ============================================

-- Super admins can do everything
CREATE POLICY "Super admins have full access to employee_assignments"
    ON employee_assignments
    FOR ALL
    USING (is_super_admin());

-- Org admins can manage assignments in their org
CREATE POLICY "Org admins can manage employee_assignments"
    ON employee_assignments
    FOR ALL
    USING (organization_id = get_my_org_id() AND is_org_admin());

-- All users can view assignments in their org
CREATE POLICY "Users can view employee_assignments in their organization"
    ON employee_assignments
    FOR SELECT
    USING (organization_id = get_my_org_id());

-- Users can view their own assignments
CREATE POLICY "Users can view their own assignments"
    ON employee_assignments
    FOR SELECT
    USING (employee_id = auth.uid());

-- ============================================
-- Grant permissions
-- ============================================

-- Grant usage on tables to authenticated users
GRANT SELECT ON organization_settings TO authenticated;
GRANT SELECT ON divisions TO authenticated;
GRANT SELECT ON departments TO authenticated;
GRANT SELECT ON positions TO authenticated;
GRANT SELECT ON position_levels TO authenticated;
GRANT SELECT ON employee_assignments TO authenticated;

-- Grant full access to service role
GRANT ALL ON organization_settings TO service_role;
GRANT ALL ON divisions TO service_role;
GRANT ALL ON departments TO service_role;
GRANT ALL ON positions TO service_role;
GRANT ALL ON position_levels TO service_role;
GRANT ALL ON employee_assignments TO service_role;
