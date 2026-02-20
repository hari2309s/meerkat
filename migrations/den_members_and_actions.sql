-- ─── Den Members ─────────────────────────────────────────────────────────────
-- Tracks who belongs to each den and their role

create table if not exists den_members (
  den_id    uuid not null references dens(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (den_id, user_id)
);

-- ─── Den Invites ──────────────────────────────────────────────────────────────
-- One-time tokens that let people join a den

create table if not exists den_invites (
  id           uuid primary key default gen_random_uuid(),
  den_id       uuid not null references dens(id) on delete cascade,
  invited_by   uuid not null references auth.users(id) on delete cascade,
  email        text,                          -- optional: who was invited
  token        text not null unique default encode(gen_random_bytes(24), 'hex'),
  expires_at   timestamptz not null default now() + interval '7 days',
  accepted_at  timestamptz,
  accepted_by  uuid references auth.users(id)
);

-- ─── Seed: make every den owner a member with role 'owner' ───────────────────
-- Run once to backfill existing dens

insert into den_members (den_id, user_id, role)
select id, user_id, 'owner'
from   dens
on conflict (den_id, user_id) do nothing;

-- ─── Trigger: auto-insert owner into den_members on den creation ──────────────

create or replace function handle_new_den()
returns trigger language plpgsql security definer as $$
begin
  insert into den_members (den_id, user_id, role)
  values (new.id, new.user_id, 'owner')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_den_created on dens;
create trigger on_den_created
  after insert on dens
  for each row execute procedure handle_new_den();

-- ─── RLS: den_members ─────────────────────────────────────────────────────────

alter table den_members enable row level security;

-- Members can see all members of dens they belong to
create policy "members can view den_members"
  on den_members for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from dens d
      where d.id = den_members.den_id
        and d.user_id = auth.uid()
    )
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

-- ─── RLS: den_invites ─────────────────────────────────────────────────────────

alter table den_invites enable row level security;

-- Members can create invites for dens they belong to
create policy "members can create invites"
  on den_invites for insert
  with check (
    exists (
      select 1 from dens d
      where d.id = den_invites.den_id
        and d.user_id = auth.uid()
    )
    or exists (
      select 1 from den_members dm
      where dm.den_id = den_invites.den_id
        and dm.user_id = auth.uid()
    )
  );

-- Anyone authenticated can read an invite by token (for acceptance flow)
create policy "anyone can read invite by token"
  on den_invites for select
  using (auth.uid() is not null);

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

-- ─── RLS: dens (update to allow all members to read) ─────────────────────────
-- Drop old owner-only read policy if it exists, add member-based one

drop policy if exists "Users can view their own dens" on dens;

create policy "members can view dens"
  on dens for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from den_members dm
      where dm.den_id = dens.id
        and dm.user_id = auth.uid()
    )
  );

-- Only owners can update
drop policy if exists "Users can update their own dens" on dens;

create policy "owner can update den"
  on dens for update
  using (user_id = auth.uid());

-- Only owners can delete
drop policy if exists "Users can delete their own dens" on dens;

create policy "owner can delete den"
  on dens for delete
  using (user_id = auth.uid());

-- ─── Enable Realtime on relevant tables ──────────────────────────────────────

alter publication supabase_realtime add table dens;
alter publication supabase_realtime add table den_members;
