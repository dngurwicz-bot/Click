-- Add INSERT policy for organizations table

CREATE POLICY "Enable insert for authenticated users only"
ON organizations
FOR INSERT 
TO authenticated
WITH CHECK (true);
-- Note: 'true' means any authenticated user can insert. 
-- In a real production app you might restrict this further, 
-- but for creating a new org (signup flow), this is standard.
