# Character Creation Name Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require every authenticated account to claim a globally unique 3–16 character name before entering RoyalStory.

**Architecture:** Store profile data in a separate Supabase `player_profiles` table. Add a focused server repository/service/API boundary and a browser `profileApi`; let `AuthRoot` coordinate save loading, profile loading, character creation, and transition into the existing game without changing gameplay state.

**Tech Stack:** TypeScript 5.8, React 19, Vitest, Testing Library, Supabase Postgres/RLS, Vercel Functions.

## Global Constraints

- Follow strict RED → GREEN → verification with small commits.
- Names are 3–16 ASCII letters or digits and are globally unique case-insensitively.
- Preserve chosen capitalization for display.
- Existing accounts without profiles must create a name; existing progression remains unchanged.
- Do not modify gameplay rules, combat timing, campaign progression, equipment behavior, save versions, or existing player progression.
- Do not put profile fields inside `PlayerSaveState`.
- Do not add class, appearance, profanity filtering, temporary names, or name changing.
- Database constraints are the final authority for ownership, validation, and uniqueness.

---

## File Structure

- Create `supabase/migrations/20260720130000_create_player_profiles.sql` — profile table, checks, RLS, and one-time creation RPC.
- Create `api/_lib/profileTypes.ts` — server-side profile contracts.
- Create `api/_lib/profileRepository.ts` — persistence interface and Supabase adapter boundary.
- Create `api/_lib/profileService.ts` — normalization, validation, and result mapping.
- Create `api/profile.ts` — GET current profile and POST one-time creation.
- Create `src/game/profile/profileTypes.ts` — browser-facing profile contracts.
- Create `src/game/profile/profileValidation.ts` — shared client validation helper.
- Create `src/game/api/profileApi.ts` — browser fetch wrapper.
- Create `src/components/CharacterCreation.tsx` — isolated form UI.
- Modify `src/AuthRoot.tsx` — coordinate save/profile loading and gated rendering.
- Modify `src/live-login.css` — focused character-creation styling only.
- Add focused tests beside the existing API, React, and migration test suites following current repository conventions.

---

### Task 1: Database profile invariants

**Files:**
- Create: `supabase/migrations/20260720130000_create_player_profiles.sql`
- Test: existing migration/schema test file that currently asserts `player_states` SQL invariants

**Interfaces:**
- Produces table `public.player_profiles(user_id, character_name, normalized_name, created_at, updated_at)`.
- Produces RPC `public.create_player_profile(profile_user_id uuid, requested_name text)` callable only by `service_role`.

- [ ] **Step 1: Write failing migration assertions**

Add exact assertions that the migration contains:

```ts
expect(sql).toContain('create table if not exists public.player_profiles');
expect(sql).toContain('user_id uuid primary key references auth.users(id) on delete cascade');
expect(sql).toContain("check (character_name ~ '^[A-Za-z0-9]{3,16}$')");
expect(sql).toContain('normalized_name text not null unique');
expect(sql).toContain('alter table public.player_profiles enable row level security');
expect(sql).toContain('auth.uid() = user_id');
expect(sql).toContain('create or replace function public.create_player_profile');
expect(sql).toContain('lower(requested_name)');
expect(sql).toContain('grant execute on function public.create_player_profile(uuid, text) to service_role');
```

- [ ] **Step 2: Run the focused test and verify RED**

Run the existing migration test command targeting that file.

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Create the minimal migration**

Use this structure:

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
on public.player_profiles for select to authenticated
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

revoke execute on function public.create_player_profile(uuid, text) from public, anon, authenticated;
grant execute on function public.create_player_profile(uuid, text) to service_role;
```

- [ ] **Step 4: Run the focused migration test and verify GREEN**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260720130000_create_player_profiles.sql <migration-test-file>
git commit -m "db: add player profile storage"
```

---

### Task 2: Profile domain and service boundary

**Files:**
- Create: `api/_lib/profileTypes.ts`
- Create: `api/_lib/profileRepository.ts`
- Create: `api/_lib/profileService.ts`
- Test: `api/_lib/profileService.test.ts`

**Interfaces:**
- Produces `PlayerProfile`, `ProfileLoadResult`, and `ProfileCreateResult`.
- Produces `createProfileService(repository)` with `load(userId)` and `create(userId, requestedName)`.

- [ ] **Step 1: Write failing service tests**

Cover these exact cases:

```ts
it('rejects names outside 3-16 characters');
it('rejects unsupported characters');
it('passes preserved and normalized names to the repository');
it('maps repository duplicate-name failures to name_taken');
it('returns missing when no profile exists');
it('returns unavailable for unexpected repository failures');
```

Use repository fakes that record arguments and return typed outcomes.

- [ ] **Step 2: Run the focused test and verify RED**

```bash
npm test -- api/_lib/profileService.test.ts
```

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Add exact contracts**

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

Repository contract:

```ts
export interface ProfileRepository {
  load(userId: string): Promise<PlayerProfile | null>;
  create(userId: string, characterName: string, normalizedName: string): Promise<
    | { readonly kind: 'created'; readonly profile: PlayerProfile }
    | { readonly kind: 'name_taken' }
  >;
}
```

Service validation:

```ts
const CHARACTER_NAME_PATTERN = /^[A-Za-z0-9]{3,16}$/;
const normalizeName = (name: string) => name.toLowerCase();
```

- [ ] **Step 4: Run the focused test and verify GREEN**

```bash
npm test -- api/_lib/profileService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/profileTypes.ts api/_lib/profileRepository.ts api/_lib/profileService.ts api/_lib/profileService.test.ts
git commit -m "feat: add character profile service"
```

---

### Task 3: Authenticated profile API

**Files:**
- Create: `api/profile.ts`
- Modify: `api/_lib/supabaseServer.ts`
- Test: `api/profile.test.ts`

**Interfaces:**
- Consumes `requireUser`, Supabase service-role access, and `createProfileService`.
- Produces `GET /api/profile` and `POST /api/profile`.

- [ ] **Step 1: Write failing endpoint tests**

Assert:

```ts
it('returns 401 when GET has no authenticated user');
it('returns missing for an authenticated user without a profile');
it('returns the loaded profile for an authenticated user');
it('returns 201 after successful POST creation');
it('returns 409 for a taken name');
it('returns 400 for an invalid name');
it('returns 405 for unsupported methods');
```

- [ ] **Step 2: Run the focused endpoint test and verify RED**

```bash
npm test -- api/profile.test.ts
```

Expected: FAIL because `api/profile.ts` does not exist.

- [ ] **Step 3: Implement the route**

```ts
export async function GET(request: Request): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET', 'POST']);
  const auth = createRequestSupabase(request);
  try {
    const user = await requireUser(auth.client);
    if (!user) return auth.applyCookies(jsonResponse({ kind: 'unauthorized' }, 401));
    return auth.applyCookies(jsonResponse(await service.load(user.id)));
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
    const result = await service.create(user.id, typeof body.characterName === 'string' ? body.characterName : '');
    const status = result.kind === 'created' ? 201 : result.kind === 'name_taken' ? 409 : result.kind === 'invalid' ? 400 : 503;
    return auth.applyCookies(jsonResponse(result, status));
  } catch (error) {
    return auth.applyCookies(handleApiError(error));
  }
}
```

Wire the Supabase repository using the same service-role pattern as `api/player.ts`; map Postgres unique-constraint code `23505` to `name_taken`.

- [ ] **Step 4: Run the focused endpoint test and verify GREEN**

```bash
npm test -- api/profile.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/profile.ts api/_lib/supabaseServer.ts api/profile.test.ts
git commit -m "feat: add character profile api"
```

---

### Task 4: Browser profile API and validation

**Files:**
- Create: `src/game/profile/profileTypes.ts`
- Create: `src/game/profile/profileValidation.ts`
- Create: `src/game/api/profileApi.ts`
- Test: `src/game/api/profileApi.test.ts`
- Test: `src/game/profile/profileValidation.test.ts`

**Interfaces:**
- Produces `validateCharacterName(input): CharacterNameValidation`.
- Produces `profileApi.load()` and `profileApi.create(characterName)`.

- [ ] **Step 1: Write failing validation and fetch tests**

```ts
expect(validateCharacterName('ab').kind).toBe('invalid_length');
expect(validateCharacterName('abcdefghijklmnopq').kind).toBe('invalid_length');
expect(validateCharacterName('Hero One').kind).toBe('invalid_characters');
expect(validateCharacterName('Hero01')).toEqual({ kind: 'valid', characterName: 'Hero01' });
```

Fetch assertions:

```ts
expect(fetch).toHaveBeenCalledWith('/api/profile', expect.objectContaining({ method: 'GET', credentials: 'include' }));
expect(fetch).toHaveBeenCalledWith('/api/profile', expect.objectContaining({ method: 'POST', body: JSON.stringify({ characterName: 'Hero01' }) }));
```

- [ ] **Step 2: Run focused tests and verify RED**

```bash
npm test -- src/game/profile/profileValidation.test.ts src/game/api/profileApi.test.ts
```

- [ ] **Step 3: Implement minimal browser contracts**

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

Follow the existing `playerApi.ts` request/read/unavailable pattern for `profileApi.ts`.

- [ ] **Step 4: Run focused tests and verify GREEN**

```bash
npm test -- src/game/profile/profileValidation.test.ts src/game/api/profileApi.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/game/profile src/game/api/profileApi.ts src/game/api/profileApi.test.ts
git commit -m "feat: add browser character profile api"
```

---

### Task 5: Character creation component

**Files:**
- Create: `src/components/CharacterCreation.tsx`
- Test: `src/components/CharacterCreation.test.tsx`
- Modify: `src/live-login.css`

**Interfaces:**
- Consumes `busy`, `serverError`, `onCreate(characterName)`, and `onSignOut()` props.
- Produces a validated, accessible, isolated character-name form.

- [ ] **Step 1: Write failing component tests**

Cover:

```ts
it('renders one character name input and create button');
it('shows length validation without submitting');
it('shows unsupported-character validation without submitting');
it('submits a trimmed valid name');
it('keeps the entered name when the server reports name_taken');
it('disables repeat submission while busy');
it('offers sign out');
```

- [ ] **Step 2: Run focused component tests and verify RED**

```bash
npm test -- src/components/CharacterCreation.test.tsx
```

- [ ] **Step 3: Implement the component**

Use this public shape:

```ts
interface CharacterCreationProps {
  readonly busy: boolean;
  readonly serverError: string | null;
  readonly onCreate: (characterName: string) => Promise<void> | void;
  readonly onSignOut: () => Promise<void> | void;
}
```

The form must include `maxLength={16}`, `autoComplete="off"`, an accessible label, a primary submit button, inline `role="alert"` validation, and a secondary sign-out button.

- [ ] **Step 4: Run focused component tests and verify GREEN**

```bash
npm test -- src/components/CharacterCreation.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add src/components/CharacterCreation.tsx src/components/CharacterCreation.test.tsx src/live-login.css
git commit -m "feat: add character creation screen"
```

---

### Task 6: Integrate profile gating into AuthRoot

**Files:**
- Modify: `src/AuthRoot.tsx`
- Test: existing `AuthRoot` React test file

**Interfaces:**
- Consumes `profileApi` and `CharacterCreation`.
- Produces the final state machine: signed out, loading, load error, character creation, or game.

- [ ] **Step 1: Write failing integration tests**

Add exact cases:

```ts
it('shows character creation when save loads and profile is missing');
it('enters the game directly when save and profile both load');
it('does not render the game while profile loading is unavailable');
it('preserves the loaded save while character creation is shown');
it('enters the game immediately after successful profile creation');
it('shows name taken and keeps character creation open');
it('returns to sign in when profile creation is unauthorized');
it('does not repeat player sync after profile creation');
```

- [ ] **Step 2: Run the focused AuthRoot test and verify RED**

Run the repository's existing AuthRoot test file directly.

Expected: FAIL because profile gating is absent.

- [ ] **Step 3: Add minimal AuthRoot state**

```ts
type ProfileState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'missing' }
  | { readonly kind: 'loaded'; readonly profile: PlayerProfile }
  | { readonly kind: 'error'; readonly message: string };
```

Load save and profile once per authenticated session. Preserve the already synchronized `record`. Render `CharacterCreation` only when `record !== null && profileState.kind === 'missing'`. On successful creation set `profileState` to `loaded` without calling `loadSession()` again.

- [ ] **Step 4: Run the focused AuthRoot test and verify GREEN**

Expected: PASS.

- [ ] **Step 5: Run regression verification**

```bash
npm test
npm run typecheck
npm run build
```

Expected: all tests pass, TypeScript exits 0, and Vite production build completes.

- [ ] **Step 6: Commit**

```bash
git add src/AuthRoot.tsx <auth-root-test-file>
git commit -m "feat: require character name after login"
```

---

### Task 7: Production migration and deployment verification

**Files:**
- No product-code changes expected unless verification reveals a defect.

**Interfaces:**
- Confirms Supabase migration and Vercel production behavior match the tested implementation.

- [ ] **Step 1: Re-run complete local verification**

```bash
npm test
npm run typecheck
npm run build
```

Expected: zero failures.

- [ ] **Step 2: Apply or verify the Supabase migration through the established project deployment workflow**

Confirm `public.player_profiles`, RLS policy, unique normalized-name constraint, and service-role-only RPC exist in the target project.

- [ ] **Step 3: Verify production flows**

Check:

1. Existing account without profile reaches character creation and retains progression.
2. Valid unique name enters the game directly.
3. Same name with different capitalization is rejected.
4. Invalid names never reach the server.
5. Existing account with profile enters the game directly.
6. Sign out works from character creation.
7. Refresh does not recreate the profile or repeat offline reward presentation.

- [ ] **Step 4: Record completion**

Update the plan status only after all local and production checks pass, then commit any documentation-only completion update separately.
