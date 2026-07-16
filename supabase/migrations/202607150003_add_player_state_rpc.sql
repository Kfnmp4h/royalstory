create or replace function public.save_player_state(
  expected_version bigint,
  next_state jsonb,
  activity_at timestamptz
)
returns table (
  user_id uuid,
  schema_version integer,
  save_version bigint,
  state jsonb,
  last_activity_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if jsonb_typeof(next_state) <> 'object' then
    raise exception 'State must be a JSON object' using errcode = '22023';
  end if;

  return query
  update public.player_states as player_state
  set
    schema_version = coalesce((next_state ->> 'schemaVersion')::integer, player_state.schema_version),
    save_version = player_state.save_version + 1,
    state = next_state,
    last_activity_at = activity_at,
    updated_at = now()
  where player_state.user_id = current_user_id
    and player_state.save_version = expected_version
  returning
    player_state.user_id,
    player_state.schema_version,
    player_state.save_version,
    player_state.state,
    player_state.last_activity_at,
    player_state.created_at,
    player_state.updated_at;
end;
$$;

revoke all on function public.save_player_state(bigint, jsonb, timestamptz) from public;
revoke all on function public.save_player_state(bigint, jsonb, timestamptz) from anon;
grant execute on function public.save_player_state(bigint, jsonb, timestamptz) to service_role;
