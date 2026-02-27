-- flower_pots table
CREATE TABLE flower_pots (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token            TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  den_id           TEXT NOT NULL,
  encrypted_bundle TEXT NOT NULL,
  expires_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  created_by       UUID REFERENCES auth.users(id)
);
CREATE INDEX idx_flower_pots_token      ON flower_pots(token);
CREATE INDEX idx_flower_pots_expires_at ON flower_pots(expires_at);

ALTER TABLE flower_pots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read non-expired flower pots"
  ON flower_pots FOR SELECT
  USING (expires_at IS NULL OR expires_at > NOW());
CREATE POLICY "Authenticated users can create flower pots"
  ON flower_pots FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creator can delete flower pots"
  ON flower_pots FOR DELETE USING (auth.uid() = created_by);

-- Add flower_pot_token to den_invites
ALTER TABLE den_invites ADD COLUMN IF NOT EXISTS flower_pot_token TEXT;
