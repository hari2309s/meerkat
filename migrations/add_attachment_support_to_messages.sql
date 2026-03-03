-- Add attachment support to messages table
-- This migration adds support for image and document messages

-- Add attachment columns to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS attachment_url TEXT,
ADD COLUMN IF NOT EXISTS attachment_name TEXT,
ADD COLUMN IF NOT EXISTS attachment_mime TEXT,
ADD COLUMN IF NOT EXISTS attachment_size BIGINT;

-- Update the type check constraint to include image and document types
DROP CONSTRAINT IF EXISTS messages_type_check ON messages;
ALTER TABLE messages 
ADD CONSTRAINT messages_type_check 
CHECK (type IN ('text', 'voice', 'image', 'document'));

-- Create indexes for attachment-related queries
CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(type);
CREATE INDEX IF NOT EXISTS idx_messages_attachment_url ON messages(attachment_url) WHERE attachment_url IS NOT NULL;

-- Update the public users view to include preferred_name for better sender info
DROP VIEW IF EXISTS public.users;
CREATE OR REPLACE VIEW public.users AS
SELECT
  u.id,
  u.email,
  u.raw_user_meta_data->>'full_name' AS full_name,
  u.raw_user_meta_data->>'preferred_name' AS preferred_name
FROM auth.users u
WHERE EXISTS (
  -- The logged-in user and the queried user share at least one den
  SELECT 1 
  FROM den_members dm1
  JOIN den_members dm2 ON dm1.den_id = dm2.den_id
  WHERE dm1.user_id = auth.uid() 
    AND dm2.user_id = u.id
);

-- Ensure the view permissions are set
GRANT SELECT ON public.users TO authenticated;
