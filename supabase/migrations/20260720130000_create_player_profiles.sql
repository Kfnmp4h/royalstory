create table if not exists public.player_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  character_name text not null check (character_name ~ '^[A-Za-z0-9]{3,16}$'),
  normalized_name text not null unique check (normalized_name = lower(character_name)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.player_profiles enable row level security;

create policy "players_read_own_profile"
on public.player_profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.create_player_profile(
  profile_user_id uuid,
  requested_name text
)
returns setof public.player_profiles
language sql
security invoker
set search_path = public
as $$
  insert into public.player_profiles (user_id, character_name, normalized_name)
  values (profile_user_id, requested_name, lower(requested_name))
  returning *;
$$;

revoke execute on function public.create_player_profile(uuid, text) from public;
revoke execute on function public.create_player_profile(uuid, text) from anon;
revoke execute on function public.create_player_profile(uuid, text) from authenticated;
grant execute on function public.create_player_profile(uuid, text) to service_role;
