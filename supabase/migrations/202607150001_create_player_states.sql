create table if not exists public.player_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  schema_version integer not null default 1 check (schema_version > 0),
  save_version bigint not null default 0 check (save_version >= 0),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists player_states_updated_at_idx
  on public.player_states (updated_at);
