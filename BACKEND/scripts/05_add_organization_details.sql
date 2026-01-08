-- Add missing columns to organizations table
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS contact_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS hp VARCHAR(50),
ADD COLUMN IF NOT EXISTS modules TEXT[];

COMMENT ON COLUMN organizations.contact_email IS 'Contact email for the organization';
COMMENT ON COLUMN organizations.contact_name IS 'Contact person name';
COMMENT ON COLUMN organizations.hp IS 'Company registration number (H.P/O.M)';
COMMENT ON COLUMN organizations.modules IS 'List of enabled modules for the organization';
