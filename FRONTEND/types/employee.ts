export interface Employee {
    id: string;
    organization_id: string;
    first_name: string;
    last_name: string;
    email: string;
    job_title?: string;
    is_active: boolean;
    is_admin: boolean;
    is_super_admin: boolean;
    created_at: string;
    updated_at: string;
}
