export interface OrganizationSettings {
    id: string;
    organization_id: string;
    use_divisions: boolean;
    use_departments: boolean;
    departments_under_divisions: boolean;
    positions_are_org_wide: boolean;
    allow_multiple_positions: boolean;
    use_position_levels: boolean;
    created_at: string;
    updated_at: string;
}

export interface Division {
    id: string;
    organization_id: string;
    name: string;
    description: string | null;
    manager_id: string | null;
    parent_division_id: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;

    // Joins
    manager?: {
        first_name: string;
        last_name: string;
    };
    parent_division?: Division;
    sub_divisions?: Division[];
    departments?: Department[];
}

export interface Department {
    id: string;
    organization_id: string;
    division_id: string | null;
    name: string;
    description: string | null;
    manager_id: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;

    // Joins
    manager?: {
        first_name: string;
        last_name: string;
    };
    division?: Division;
}

export interface Position {
    id: string;
    organization_id: string;
    division_id: string | null;
    department_id: string | null;
    name: string;
    description: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;

    // Joins
    division?: Division;
    department?: Department;
    levels?: PositionLevel[];
}

export interface PositionLevel {
    id: string;
    organization_id: string;
    position_id: string;
    level_name: string;
    level_order: number;
    description: string | null;
    created_at: string;
    updated_at: string;
}

export interface EmployeeAssignment {
    id: string;
    employee_id: string;
    organization_id: string;
    division_id: string | null;
    department_id: string | null;
    position_id: string | null;
    position_level_id: string | null;
    is_primary: boolean;
    start_date: string;
    end_date: string | null;
    created_at: string;
    updated_at: string;

    // Joins
    division?: Division;
    department?: Department;
    position?: Position;
    position_level?: PositionLevel;
}
