# Character Creation Name Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require every authenticated account to claim a globally unique 3–16 character name before entering RoyalStory.

**Architecture:** Store profile data in a separate Supabase `player_profiles` table. Add a focused repository/service/API boundary, a browser `profileApi`, and an isolated React form. `AuthRoot` remains the coordinator and must preserve the already loaded gameplay save while profile creation blocks access to the game.

**Tech Stack:** TypeScript 5.8, React 19, Vitest, Testing Library, Supabase Postgres/RLS, Vercel Functions.

## Global Constraints

- Follow strict RED → GREEN → verification with small commits.
- Names are 3–16 ASCII letters or digits.
- Names are globally unique case-insensitively.
- Preserve chosen capitalization for display.
- Existing accounts without profiles must create a name; existing progression remains unchanged.
- Do not modify gameplay, combat timing, campaign progression, equipment behavior, save versions, or existing progression.
- Do not add class, appearance, profanity filtering, temporary names, or name changing.
- Do not put profile fields inside `PlayerSaveState`.
- Database constraints are the final authority.

---

### Task 1: Add database profile invariants

**Files:**
- Create: `supabase/migrations/20260720130000_create_player_profiles.sql`
- Create: `supabase/migrations/createPlayerProfilesMigration.test.ts`

**Interfaces:**
- Produces `public.player_profiles`.
- Produces service-role RPC `public.create_player_profile(uuid, text)`.

- [ ] **Step 1: Write the failing migration test**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  new URL('./20260720130000_create_player_profiles.sql', import.meta.url),
  'utf8',
);

describe('player_profiles migration', () => {
  it('enforces profile ownership, name validation, and normalized uniqueness', () => {
    expect(sql).toContain('create table if not exists public.player_profiles');
    expect(sql).toContain('user_id uuid primary key references auth.users(id) on delete cascade');
    expect(sql).toContain("character_name text not null check (character_name ~ '^[A-Za-z0-9]{3,16}$')");
    expect(sql).toContain('normalized_name text not null unique');
    expect(sql).toContain('normalized_name = lower(character_name)');
    expect(sql).toContain('alter table public.player_profiles enable row level security');
    expect(sql).toContain('auth.uid() = user_id');
    expect(sql).toContain('create or replace function public.create_player_profile');
    expect(sql).toContain('lower(requested_name)');
    expect(sql).toContain('grant execute on function public.create_player_profile(uuid, text) to service_role');
  });
});
```

- [ ] **Step 2: Verify RED**

```bash
npm test -- supabase/migrations/createPlayerProfilesMigration.test.ts
```

Expected: FAIL because the SQL file does not exist.

- [ ] **Step 3: Add the migration**

```sql
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
using (auth.uid() = user_id);

create or replace function public.create_player_profile(
  profile_user_id uuid,
  requested_name text
)
returns setof public.player_profiles
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  insert into public.player_profiles (user_id, character_name, normalized_name)
  values (profile_user_id, requested_name, lower(requested_name))
  returning *;
end;
$$;

revoke execute on function public.create_player_profile(uuid, text) from public;
revoke execute on function public.create_player_profile(uuid, text) from anon;
revoke execute on function public.create_player_profile(uuid, text) from authenticated;
grant execute on function public.create_player_profile(uuid, text) to service_role;
```

- [ ] **Step 4: Verify GREEN**

```bash
npm test -- supabase/migrations/createPlayerProfilesMigration.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260720130000_create_player_profiles.sql supabase/migrations/createPlayerProfilesMigration.test.ts
git commit -m "db: add player profile storage"
```

---

### Task 2: Add profile service contracts

**Files:**
- Create: `api/_lib/profileTypes.ts`
- Create: `api/_lib/profileRepository.ts`
- Create: `api/_lib/profileService.ts`
- Create: `api/_lib/profileService.test.ts`

**Interfaces:**

```ts
export interface PlayerProfile {
  readonly characterName: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type ProfileLoadResult =
  | { readonly kind: 'loaded'; readonly profile: PlayerProfile }
  | { readonly kind: 'missing' }
  | { readonly kind: 'unavailable'; readonly message: string };

export type ProfileCreateResult =
  | { readonly kind: 'created'; readonly profile: PlayerProfile }
  | { readonly kind: 'name_taken' }
  | { readonly kind: 'invalid'; readonly message: string }
  | { readonly kind: 'unavailable'; readonly message: string };
```

- [ ] **Step 1: Write failing service tests**

Test exact cases: invalid length, invalid characters, preserved display capitalization, lowercase normalization, missing profile, duplicate-name mapping, and unexpected failure mapping.

- [ ] **Step 2: Verify RED**

```bash
npm test -- api/_lib/profileService.test.ts
```

- [ ] **Step 3: Implement the repository and service**

```ts
export interface ProfileRepository {
  load(userId: string): Promise<PlayerProfile | null>;
  create(
    userId: string,
    characterName: string,
    normalizedName: string,
  ): Promise<
    | { readonly kind: 'created'; readonly profile: PlayerProfile }
    | { readonly kind: 'name_taken' }
  >;
}
```

```ts
const CHARACTER_NAME_PATTERN = /^[A-Za-z0-9]{3,16}$/;

export const createProfileService = (repository: ProfileRepository) => ({
  async load(userId: string): Promise<ProfileLoadResult> {
    try {
      const profile = await repository.load(userId);
      return profile ? { kind: 'loaded', profile } : { kind: 'missing' };
    } catch {
      return { kind: 'unavailable', message: 'The profile service is unavailable.' };
    }
  },

  async create(userId: string, requestedName: string): Promise<ProfileCreateResult> {
    if (!CHARACTER_NAME_PATTERN.test(requestedName)) {
      return { kind: 'invalid', message: 'Use 3–16 letters or digits.' };
    }
    try {
      return await repository.create(userId, requestedName, requestedName.toLowerCase());
    } catch {
      return { kind: 'unavailable', message: 'The profile service is unavailable.' };
    }
  },
});
```

- [ ] **Step 4: Verify GREEN**

```bash
npm test -- api/_lib/profileService.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add api/_lib/profileTypes.ts api/_lib/profileRepository.ts api/_lib/profileService.ts api/_lib/profileService.test.ts
git commit -m "feat: add character profile service"
```

---

### Task 3: Add authenticated profile endpoint

**Files:**
- Create: `api/profile.ts`
- Create: `api/profile.test.ts`
- Modify: `api/_lib/supabaseServer.ts`

**Interfaces:**
- `GET /api/profile`
- `POST /api/profile` with `{ characterName: string }`

- [ ] **Step 1: Write failing endpoint tests**

Cover unauthorized GET/POST, missing profile, loaded profile, successful creation with status 201, invalid name with status 400, duplicate name with status 409, unavailable service with status 503, and unsupported methods with status 405.

- [ ] **Step 2: Verify RED**

```bash
npm test -- api/profile.test.ts
```

- [ ] **Step 3: Implement the route**

```ts
export async function GET(request: Request): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET', 'POST']);
  const auth = createRequestSupabase(request);
  try {
    const user = await requireUser(auth.client);
    if (!user) return auth.applyCookies(jsonResponse({ kind: 'unauthorized' }, 401));
    return auth.applyCookies(jsonResponse(await profileService.load(user.id)));
  } catch (error) {
    return auth.applyCookies(handleApiError(error));
  }
}

export async function POST(request: Request): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['GET', 'POST']);
  const auth = createRequestSupabase(request);
  try {
    const user = await requireUser(auth.client);
    if (!user) return auth.applyCookies(jsonResponse({ kind: 'unauthorized' }, 401));
    const body = await request.json() as { characterName?: unknown };
    const result = await profileService.create(
      user.id,
      typeof body.characterName === 'string' ? body.characterName : '',
    );
    const status = result.kind === 'created'
      ? 201
      : result.kind === 'name_taken'
        ? 409
        : result.kind === 'invalid'
          ? 400
          : 503;
    return auth.applyCookies(jsonResponse(result, status));
  } catch (error) {
    return auth.applyCookies(handleApiError(error));
  }
}
```

Use the same service-role database pattern already used by `api/player.ts`. Map Postgres code `23505` to `{ kind: 'name_taken' }`.

- [ ] **Step 4: Verify GREEN**

```bash
npm test -- api/profile.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add api/profile.ts api/profile.test.ts api/_lib/supabaseServer.ts
git commit -m "feat: add character profile api"
```

---

### Task 4: Add browser profile API and validation

**Files:**
- Create: `src/game/profile/profileTypes.ts`
- Create: `src/game/profile/profileValidation.ts`
- Create: `src/game/profile/profileValidation.test.ts`
- Create: `src/game/api/profileApi.ts`
- Create: `src/game/api/profileApi.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
expect(validateCharacterName('ab').kind).toBe('invalid_length');
expect(validateCharacterName('abcdefghijklmnopq').kind).toBe('invalid_length');
expect(validateCharacterName('Hero One').kind).toBe('invalid_characters');
expect(validateCharacterName(' Hero01 ')).toEqual({ kind: 'valid', characterName: 'Hero01' });
```

Assert `profileApi.load()` sends `GET /api/profile` and `profileApi.create('Hero01')` sends `POST /api/profile` with credentials and JSON.

- [ ] **Step 2: Verify RED**

```bash
npm test -- src/game/profile/profileValidation.test.ts src/game/api/profileApi.test.ts
```

- [ ] **Step 3: Implement validation and fetch wrapper**

```ts
export type CharacterNameValidation =
  | { readonly kind: 'valid'; readonly characterName: string }
  | { readonly kind: 'invalid_length' }
  | { readonly kind: 'invalid_characters' };

export const validateCharacterName = (input: string): CharacterNameValidation => {
  const characterName = input.trim();
  if (characterName.length < 3 || characterName.length > 16) return { kind: 'invalid_length' };
  if (!/^[A-Za-z0-9]+$/.test(characterName)) return { kind: 'invalid_characters' };
  return { kind: 'valid', characterName };
};
```

Follow the request/error shape already used by `src/game/api/playerApi.ts`.

- [ ] **Step 4: Verify GREEN**

```bash
npm test -- src/game/profile/profileValidation.test.ts src/game/api/profileApi.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/game/profile/profileTypes.ts src/game/profile/profileValidation.ts src/game/profile/profileValidation.test.ts src/game/api/profileApi.ts src/game/api/profileApi.test.ts
git commit -m "feat: add browser character profile api"
```

---

### Task 5: Add character creation UI

**Files:**
- Create: `src/components/CharacterCreation.tsx`
- Create: `src/components/CharacterCreation.test.tsx`
- Modify: `src/live-login.css`

**Interfaces:**

```ts
export interface CharacterCreationProps {
  readonly busy: boolean;
  readonly serverError: string | null;
  readonly onCreate: (characterName: string) => Promise<void> | void;
  readonly onSignOut: () => Promise<void> | void;
}
```

- [ ] **Step 1: Write failing component tests**

Cover rendering, local length validation, local character validation, trimmed valid submission, preserving input after `name_taken`, disabling repeated submission while busy, and sign out.

- [ ] **Step 2: Verify RED**

```bash
npm test -- src/components/CharacterCreation.test.tsx
```

- [ ] **Step 3: Implement the minimal form**

The form must use `maxLength={16}`, `autoComplete="off"`, an accessible label, `role="alert"` for validation, one primary submit button, and one secondary sign-out button. It must call `validateCharacterName` before invoking `onCreate`.

- [ ] **Step 4: Verify GREEN**

```bash
npm test -- src/components/CharacterCreation.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add src/components/CharacterCreation.tsx src/components/CharacterCreation.test.tsx src/live-login.css
git commit -m "feat: add character creation screen"
```

---

### Task 6: Gate the game in AuthRoot

**Files:**
- Modify: `src/AuthRoot.tsx`
- Create: `src/AuthRoot.characterCreation.test.tsx`

**Interfaces:**

```ts
type ProfileState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'missing' }
  | { readonly kind: 'loaded'; readonly profile: PlayerProfile }
  | { readonly kind: 'error'; readonly message: string };
```

- [ ] **Step 1: Write failing integration tests**

Cover:

1. Signed-out auth remains unchanged.
2. Loaded save + missing profile shows character creation and not the game.
3. Loaded save + loaded profile enters the game directly.
4. Profile load failure shows retryable loading error, not character creation.
5. Existing loaded progression remains unchanged while the form is open.
6. Successful creation enters the game immediately.
7. Taken name keeps the form open.
8. Unauthorized creation returns to sign-in.
9. Player sync is not repeated after successful creation.

- [ ] **Step 2: Verify RED**

```bash
npm test -- src/AuthRoot.characterCreation.test.tsx
```

- [ ] **Step 3: Implement minimal orchestration**

Load the player save and profile once for the authenticated session. Keep the synchronized `record` in memory. Render `CharacterCreation` only when `record !== null && profileState.kind === 'missing'`. After successful creation, set `profileState` to `loaded` directly; do not call `loadSession()` again. On sign out, clear both record and profile state.

- [ ] **Step 4: Verify GREEN**

```bash
npm test -- src/AuthRoot.characterCreation.test.tsx
```

- [ ] **Step 5: Run complete verification**

```bash
npm test
npm run typecheck
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/AuthRoot.tsx src/AuthRoot.characterCreation.test.tsx
git commit -m "feat: require character name after login"
```

---

### Task 7: Verify Supabase and Vercel production behavior

**Files:**
- No product-code changes expected.

- [ ] **Step 1: Re-run local verification**

```bash
npm test
npm run typecheck
npm run build
```

- [ ] **Step 2: Verify the target Supabase project**

Confirm the migration created `public.player_profiles`, enabled RLS, added the ownership policy, added the normalized unique constraint, and restricted the creation RPC to `service_role`.

- [ ] **Step 3: Verify production flows**

Check an existing account without a profile, a successful unique name, a case-insensitive duplicate, an invalid name, an existing account with a profile, sign out from character creation, and refresh behavior without repeated offline rewards.

- [ ] **Step 4: Record completion**

Commit only documentation changes needed to mark the plan complete after all local and production checks pass.
