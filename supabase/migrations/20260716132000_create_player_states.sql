create table if not exists public.player_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  schema_version integer not null check (schema_version > 0),
  save_version bigint not null default 0 check (save_version >= 0),
  state jsonb not null,
  last_activity_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.player_states enable row level security;

create policy "players_read_own_state"
on public.player_states
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "players_insert_own_state"
on public.player_states
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "players_update_own_state"
on public.player_states
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create or replace function public.save_player_state(
  player_user_id uuid,
  expected_version bigint,
  next_state jsonb,
  activity_at timestamptz
)
returns setof public.player_states
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.player_states
  set state = next_state,
      save_version = save_version + 1,
      last_activity_at = activity_at,
      updated_at = now()
  where user_id = player_user_id
    and save_version = expected_version
  returning *;
end;
$$;

revoke execute on function public.save_player_state(uuid, bigint, jsonb, timestamptz) from public;
revoke execute on function public.save_player_state(uuid, bigint, jsonb, timestamptz) from anon;
revoke execute on function public.save_player_state(uuid, bigint, jsonb, timestamptz) from authenticated;
grant execute on function public.save_player_state(uuid, bigint, jsonb, timestamptz) to service_role;
