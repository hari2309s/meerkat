-- Add update policy for den_invites so users can mark invites as accepted
create policy "anyone authenticated can update invite"
  on den_invites for update
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
