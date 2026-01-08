-- Consolidated Repair Script
-- 1. Ensure is_global column exists on updates table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'updates' AND column_name = 'is_global') THEN
        ALTER TABLE updates ADD COLUMN is_global BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 2. Ensure read_updates table exists
CREATE TABLE IF NOT EXISTS read_updates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    update_id UUID REFERENCES updates(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, update_id)
);

-- 3. Ensure RLS on read_updates
ALTER TABLE read_updates ENABLE ROW LEVEL SECURITY;

-- 4. Re-apply policies (drop first to avoid conflicts/errors if they exist)
DROP POLICY IF EXISTS "Users can insert their own read records" ON read_updates;
CREATE POLICY "Users can insert their own read records" ON read_updates
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own read records" ON read_updates;
CREATE POLICY "Users can view their own read records" ON read_updates
    FOR SELECT USING (auth.uid() = user_id);
