-- ============================================
-- Part 1: Create Tables WITHOUT Foreign Keys
-- ============================================
-- Run this FIRST

CREATE TABLE IF NOT EXISTS organization_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    use_divisions BOOLEAN DEFAULT false,
    use_departments BOOLEAN DEFAULT true,
    departments_under_divisions BOOLEAN DEFAULT false,
    positions_are_org_wide BOOLEAN DEFAULT true,
    allow_multiple_positions BOOLEAN DEFAULT false,
    use_position_levels BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id)
);

CREATE TABLE IF NOT EXISTS divisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    manager_id UUID,
    parent_division_id UUID,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, name),
    CHECK (id != parent_division_id)
);

CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    division_id UUID,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    manager_id UUID,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, name)
);

CREATE TABLE IF NOT EXISTS positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    division_id UUID,
    department_id UUID,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS position_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    position_id UUID NOT NULL,
    level_name VARCHAR(100) NOT NULL,
    level_order INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(position_id, level_name),
    UNIQUE(position_id, level_order),
    CHECK (level_order > 0)
);

CREATE TABLE IF NOT EXISTS employee_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL,
    organization_id UUID NOT NULL,
    division_id UUID,
    department_id UUID,
    position_id UUID,
    position_level_id UUID,
    is_primary BOOLEAN DEFAULT true,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (end_date IS NULL OR end_date >= start_date)
);

-- Create Indexes
CREATE INDEX IF NOT EXISTS idx_org_settings_org_id ON organization_settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_divisions_org_id ON divisions(organization_id);
CREATE INDEX IF NOT EXISTS idx_divisions_manager_id ON divisions(manager_id);
CREATE INDEX IF NOT EXISTS idx_divisions_parent_id ON divisions(parent_division_id);
CREATE INDEX IF NOT EXISTS idx_divisions_active ON divisions(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_departments_org_id ON departments(organization_id);
CREATE INDEX IF NOT EXISTS idx_departments_division_id ON departments(division_id);
CREATE INDEX IF NOT EXISTS idx_departments_manager_id ON departments(manager_id);
CREATE INDEX IF NOT EXISTS idx_departments_active ON departments(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_positions_org_id ON positions(organization_id);
CREATE INDEX IF NOT EXISTS idx_positions_division_id ON positions(division_id);
CREATE INDEX IF NOT EXISTS idx_positions_department_id ON positions(department_id);
CREATE INDEX IF NOT EXISTS idx_positions_active ON positions(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_position_levels_org_id ON position_levels(organization_id);
CREATE INDEX IF NOT EXISTS idx_position_levels_position_id ON position_levels(position_id);
CREATE INDEX IF NOT EXISTS idx_employee_assignments_employee_id ON employee_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_assignments_org_id ON employee_assignments(organization_id);
CREATE INDEX IF NOT EXISTS idx_employee_assignments_division_id ON employee_assignments(division_id);
CREATE INDEX IF NOT EXISTS idx_employee_assignments_department_id ON employee_assignments(department_id);
CREATE INDEX IF NOT EXISTS idx_employee_assignments_position_id ON employee_assignments(position_id);
CREATE INDEX IF NOT EXISTS idx_employee_assignments_active ON employee_assignments(employee_id) WHERE end_date IS NULL;
CREATE INDEX IF NOT EXISTS idx_employee_assignments_primary ON employee_assignments(employee_id, is_primary) WHERE is_primary = true AND end_date IS NULL;

-- Create Triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organization_settings_updated_at BEFORE UPDATE ON organization_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_divisions_updated_at BEFORE UPDATE ON divisions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_positions_updated_at BEFORE UPDATE ON positions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_position_levels_updated_at BEFORE UPDATE ON position_levels FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_employee_assignments_updated_at BEFORE UPDATE ON employee_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Helper Functions
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
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_active_employee_assignment(emp_id UUID)
RETURNS employee_assignments AS $$
DECLARE
    assignment employee_assignments;
BEGIN
    SELECT * INTO assignment FROM employee_assignments WHERE employee_id = emp_id AND is_primary = true AND end_date IS NULL LIMIT 1;
    RETURN assignment;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE organization_settings IS 'Configuration settings for organizational structure per organization';
COMMENT ON TABLE divisions IS 'Organizational divisions (אגפים) with hierarchical support';
COMMENT ON TABLE departments IS 'Organizational departments (מחלקות) that can be under divisions or standalone';
COMMENT ON TABLE positions IS 'Job positions that can be org-wide or specific to division/department';
COMMENT ON TABLE position_levels IS 'Levels for each position (e.g., Junior, Mid, Senior)';
COMMENT ON TABLE employee_assignments IS 'Assignment of employees to organizational structure with history tracking';
