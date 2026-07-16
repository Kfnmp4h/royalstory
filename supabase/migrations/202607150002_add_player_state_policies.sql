alter table public.player_states enable row level security;

revoke all on table public.player_states from anon;

grant select, insert, update on table public.player_states to authenticated;

create policy "Players can read their own state"
  on public.player_states
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Players can create their own state"
  on public.player_states
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Players can update their own state"
  on public.player_states
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
