-- Setup attachments storage bucket for Supabase
-- This script creates the attachments bucket and sets up appropriate policies

-- Note: This needs to be run in the Supabase dashboard or via the Supabase CLI
-- as bucket creation is not done through SQL migrations

-- Bucket creation command (run via Supabase CLI):
-- supabase storage create bucket attachments

-- Bucket policies (run via SQL after bucket creation):

-- Allow authenticated users to upload files to the attachments bucket
-- Files are organized by den_id/user_id/structure for natural isolation
CREATE POLICY "Allow authenticated users to upload attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'attachments' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = (current_setting('app.current_user_id', true))::text
);

-- Allow users to read their own uploaded files and files in their dens
CREATE POLICY "Allow users to read attachments in their dens"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'attachments'
  AND auth.role() = 'authenticated'
  AND (
    -- User can read their own files
    (storage.foldername(name))[1] = (current_setting('app.current_user_id', true))::text
    OR
    -- User can read files in dens they're members of
    EXISTS (
      SELECT 1 FROM den_members 
      WHERE den_members.den_id = (storage.foldername(name))[0]::text
      AND den_members.user_id = auth.uid()
    )
  )
);

-- Allow users to update their own files (for replacements)
CREATE POLICY "Allow users to update their own attachments"
ON storage.objects FOR UPDATE
WITH CHECK (
  bucket_id = 'attachments'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own files
CREATE POLICY "Allow users to delete their own attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'attachments'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Grant access to the storage schema
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT ALL ON storage.objects TO authenticated;
