
-- Add is_global column to updates table
ALTER TABLE updates ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT false;
