-- Drop existing messages table if it exists (since the previous execution created it with auth.users)
DROP TABLE IF EXISTS messages;

-- Create messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    den_id UUID NOT NULL REFERENCES dens(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('text', 'voice')),
    content TEXT,
    voice_url TEXT,
    voice_duration INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add RLS policies for messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Allow users who are members of a den to view messages
CREATE POLICY "Users can view messages in their dens"
    ON messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM den_members
            WHERE den_members.den_id = messages.den_id
            AND den_members.user_id = auth.uid()
        )
    );

-- Allow users who are members of a den to insert messages
CREATE POLICY "Users can insert messages in their dens"
    ON messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM den_members
            WHERE den_members.den_id = messages.den_id
            AND den_members.user_id = auth.uid()
        )
        AND user_id = auth.uid()
    );

-- Allow users to delete their own messages
CREATE POLICY "Users can delete their own messages"
    ON messages FOR DELETE
    USING (user_id = auth.uid());

-- Allow users to update their own text messages (optional, if you want editing in the future)
CREATE POLICY "Users can update their own text messages"
    ON messages FOR UPDATE
    USING (user_id = auth.uid() AND type = 'text')
    WITH CHECK (user_id = auth.uid() AND type = 'text');

-- Create an index for faster queries on den messages
CREATE INDEX idx_messages_den_id ON messages(den_id);

-- Create an index for faster ordering by created_at
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- --------------------------------------------------------------------------
-- Create a public view of users so PostgREST can query sender details 
-- This view runs as security definer (since we removed security_invoker=true)
-- but restricts the returned users to only those who share a den with the 
-- currently authenticated user.
-- --------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.users AS
SELECT
  u.id,
  u.email,
  u.raw_user_meta_data->>'full_name' AS full_name
FROM auth.users u
WHERE EXISTS (
  -- The logged-in user and the queried user share at least one den
  SELECT 1 
  FROM den_members dm1
  JOIN den_members dm2 ON dm1.den_id = dm2.den_id
  WHERE dm1.user_id = auth.uid() 
    AND dm2.user_id = u.id
);

-- Allow the API the ability to query the view securely.
GRANT SELECT ON public.users TO authenticated;
