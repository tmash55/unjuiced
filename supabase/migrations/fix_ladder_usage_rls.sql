-- Fix RLS policies for ladder_usage table
-- Simplified policies: allow anyone to insert (no sensitive data, just analytics)

-- Drop existing insert policies
DROP POLICY IF EXISTS "Users can insert their own ladder usage" ON ladder_usage;
DROP POLICY IF EXISTS "Anonymous users can insert ladder usage" ON ladder_usage;
DROP POLICY IF EXISTS "Anyone can insert ladder usage" ON ladder_usage;

-- Policy: Anyone can insert ladder usage (no sensitive data, just analytics)
CREATE POLICY "Anyone can insert ladder usage"
  ON ladder_usage FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Policy: Anonymous users can view aggregate stats (read-only analytics)
DROP POLICY IF EXISTS "Anonymous users can view aggregate ladder usage" ON ladder_usage;
CREATE POLICY "Anonymous users can view aggregate ladder usage"
  ON ladder_usage FOR SELECT
  TO anon
  USING (true);

