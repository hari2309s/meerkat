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
