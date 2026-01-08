-- Create table for tracking read updates
CREATE TABLE IF NOT EXISTS read_updates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    update_id UUID REFERENCES updates(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, update_id)
);

-- RLS Policies
ALTER TABLE read_updates ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own read records
CREATE POLICY "Users can insert their own read records" ON read_updates
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to view their own read records
CREATE POLICY "Users can view their own read records" ON read_updates
    FOR SELECT USING (auth.uid() = user_id);
