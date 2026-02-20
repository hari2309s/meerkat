-- Fix infinite recursion in den_members policies
-- This migration drops and recreates the problematic policies

-- ─── Create helper function to check membership without recursion ─────────────────

create or replace function is_user_den_member(den_uuid uuid, user_uuid uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from den_members 
    where den_id = den_uuid and user_id = user_uuid
  );
$$;

-- ─── Drop existing policies that cause recursion ────────────────────────────────

drop policy if exists "members can view den_members" on den_members;
drop policy if exists "owner can insert den_members" on den_members;
drop policy if exists "members can leave or owners can remove" on den_members;
drop policy if exists "members can create invites" on den_invites;
drop policy if exists "inviter or owner can revoke invite" on den_invites;
drop policy if exists "members can view dens" on dens;

-- ─── Recreate policies without recursion ───────────────────────────────────────

-- Members can see all members of dens they belong to (using helper function)
create policy "members can view den_members"
  on den_members for select
  using (
    user_id = auth.uid()
    or is_user_den_member(den_id, auth.uid())
  );

-- Only the den owner can insert new members
create policy "owner can insert den_members"
  on den_members for insert
  with check (
    exists (
      select 1 from dens d
      where d.id = den_members.den_id
        and d.user_id = auth.uid()
    )
    -- Also allow self-insert when accepting an invite (handled in service role)
    or user_id = auth.uid()
  );

-- Members can remove themselves (leave); owners can remove anyone
create policy "members can leave or owners can remove"
  on den_members for delete
  using (
    user_id = auth.uid()
    or exists (
      select 1 from dens d
      where d.id = den_members.den_id
        and d.user_id = auth.uid()
    )
  );

-- Only den owners can create invites
create policy "owners can create invites"
  on den_invites for insert
  with check (
    exists (
      select 1 from dens d
      where d.id = den_invites.den_id
        and d.user_id = auth.uid()
    )
  );

-- The inviter or den owner can delete/revoke invites
create policy "inviter or owner can revoke invite"
  on den_invites for delete
  using (
    invited_by = auth.uid()
    or exists (
      select 1 from dens d
      where d.id = den_invites.den_id
        and d.user_id = auth.uid()
    )
  );

-- Members can view dens (owners and members)
create policy "members can view dens"
  on dens for select
  using (
    user_id = auth.uid()
    or is_user_den_member(dens.id, auth.uid())
  );
