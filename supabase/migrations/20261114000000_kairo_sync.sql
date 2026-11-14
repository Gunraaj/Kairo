-- Kairo cloud sync. Run in the Supabase SQL editor (or `supabase db push`).
-- Two modes, both private to the signed-in user through row level security.

-- 1) Private mode: end-to-end encrypted. The server stores only ciphertext it cannot read.
create table if not exists public.kairo_vault (
  user_id uuid primary key references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  envelope jsonb not null check (octet_length(envelope::text) < 5000000)
);

-- 2) Connected mode: readable copy so an AI connector (MCP) can work. Opt-in per user.
create table if not exists public.kairo_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now(),
  projects jsonb not null default '[]'::jsonb check (octet_length(projects::text) < 3000000),
  sessions jsonb not null default '[]'::jsonb check (octet_length(sessions::text) < 3000000)
);

alter table public.kairo_vault enable row level security;
alter table public.kairo_state enable row level security;

drop policy if exists "own vault" on public.kairo_vault;
create policy "own vault" on public.kairo_vault
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "own state" on public.kairo_state;
create policy "own state" on public.kairo_state
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Nothing is readable without a signed-in user.
revoke all on public.kairo_vault from anon;
revoke all on public.kairo_state from anon;
