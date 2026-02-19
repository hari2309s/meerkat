-- Create dens table
create table if not exists public.dens (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz default now() not null
);

-- Row Level Security
alter table public.dens enable row level security;

-- Users can only see and manage their own dens
create policy "Users can view their own dens"
  on public.dens for select
  using (auth.uid() = user_id);

create policy "Users can insert their own dens"
  on public.dens for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own dens"
  on public.dens for update
  using (auth.uid() = user_id);

create policy "Users can delete their own dens"
  on public.dens for delete
  using (auth.uid() = user_id);
