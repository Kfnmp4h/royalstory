# Royal Story Milestone 6 Production Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a production-deployable Royal Story with Supabase accounts, server-authoritative saves, safe offline rewards, cross-device conflict protection, and guarded account reset.

**Architecture:** Vercel API functions own authentication cookies and all game commands. They validate the authenticated Supabase user, calculate progress using server time, and persist a versioned canonical state in Supabase Postgres. React and Phaser render only the canonical state returned by the API; browser persistence contains the authentication session only and never game data.

**Tech Stack:** React 19, Phaser 3, TypeScript 5.8, Vite 7, Vitest 3, Vercel Functions, Supabase Auth/Postgres, `@supabase/ssr`, `@supabase/supabase-js`.

## Global Constraints

- Keep `origin/main` as the canonical delivery branch; every independently verified task commits and pushes to it.
- Persist game data only in Supabase. The one allowed browser cookie is an HttpOnly, Secure, SameSite auth-session cookie; it contains no game state.
- Never commit keys, credentials, account data, production URLs, or `.env.local`. `.env.example` lists variable names only.
- The client never writes a Supabase table or sends a full save snapshot; it sends typed commands with an expected save version.
- The server rejects stale writes, verifies session ownership, derives elapsed time from its own clock, and returns canonical state for every successful mutation.
- Offline settlement is limited to 8 hours and 20 equipment drops. It applies only the player’s saved farming chapter and never advances campaign bosses or breakthroughs.
- Production email verification and password reset require custom SMTP configured in Supabase before inviting real users.
- Do not add purchases, analytics, social features, admin tooling, or any client-side game save.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| `src/game/save/saveTypes.ts` | JSON-safe canonical state, commands, API response, and offline-result types shared by browser and server. |
| `src/game/save/saveCodec.ts` | Strict state validation, initial-state creation, snapshot restoration, and persistence conversion. |
| `src/game/save/offlineRewards.ts` | Bounded, deterministic server-side farming calculation and reward summary. |
| `src/game/gold/goldBalance.ts` | Central gold formulas for normal and offline farming. |
| `src/game/campaign/campaignController.ts` | Hydrates/persists campaign state without exposing mutable controller internals. |
| `src/game/progression/progressionController.ts` and `src/game/equipment/equipmentController.ts` | Hydrate validated saved progression/equipment and export their persistable forms. |
| `api/_lib/*` | Vercel-only environment parsing, Supabase session clients, command service, and HTTP helpers. |
| `api/auth/*.ts`, `api/player*.ts` | Small HTTP endpoints; each delegates policy to the server modules. |
| `supabase/migrations/*.sql` | Versioned player-state table, RLS policies, and compare-and-swap persistence RPC. |
| `src/game/api/playerApi.ts` | Browser fetch wrapper that sends credentials, parses canonical responses, and distinguishes stale state. |
| `src/game/runtime/serverBattleRuntime.ts` | Phaser-facing runtime: holds only in-memory canonical state and requests server commands. |
| `src/App.tsx` and `src/styles.css` | Auth-first, gold, syncing, offline-return, stale-state, and two-step reset experience. |

## Task 1: Add server dependencies, type coverage, and secret-safe configuration

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `tsconfig.json`
- Create: `tsconfig.api.json`
- Create: `.env.example`
- Modify: `.gitignore`
- Create: `api/_lib/env.ts`
- Create: `api/_lib/env.test.ts`

**Interfaces:**
- Produces `getServerEnv(): ServerEnv` and a separate `tsconfig.api.json` project for Vercel API source.
- Consumes no production credential from source control.

- [ ] **Step 1: Write the failing environment tests**

```ts
import { describe, expect, it } from 'vitest';
import { getServerEnv } from './env';

it('returns only complete server configuration', () => {
  expect(() => getServerEnv({ SUPABASE_URL: 'https://db.example', SUPABASE_PUBLISHABLE_KEY: 'pk' }))
    .toThrow('SUPABASE_SERVICE_ROLE_KEY');
});

it('rejects malformed Supabase URLs', () => {
  expect(() => getServerEnv({
    SUPABASE_URL: 'not-a-url', SUPABASE_PUBLISHABLE_KEY: 'pk', SUPABASE_SERVICE_ROLE_KEY: 'sk',
  })).toThrow('SUPABASE_URL');
});
```

- [ ] **Step 2: Run the test to verify RED**

Run: `pnpm exec vitest run api/_lib/env.test.ts --pool=threads --maxWorkers=1 --minWorkers=1`

Expected: FAIL because the environment module does not exist.

- [ ] **Step 3: Add the server toolchain and explicit configuration boundary**

Add `@supabase/ssr` and `@supabase/supabase-js` to `dependencies`, plus `@types/node` to `devDependencies`. Add `tsconfig.api.json` with `include: ["api/**/*.ts", "src/game/**/*.ts"]`, ES2022, `types: ["node"]`, strict/no-emit settings matching the existing app project; add it to `tsconfig.json` references.

Implement the exact contract:

```ts
export interface ServerEnv {
  readonly supabaseUrl: string;
  readonly supabasePublishableKey: string;
  readonly supabaseServiceRoleKey: string;
  readonly appOrigin: string;
}

export function getServerEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  const required = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'APP_ORIGIN'] as const;
  for (const name of required) if (!source[name]?.trim()) throw new Error(`${name} is required`);
  const url = new URL(source.SUPABASE_URL!);
  if (url.protocol !== 'https:') throw new Error('SUPABASE_URL must use HTTPS');
  return { supabaseUrl: url.toString().replace(/\/$/, ''), supabasePublishableKey: source.SUPABASE_PUBLISHABLE_KEY!, supabaseServiceRoleKey: source.SUPABASE_SERVICE_ROLE_KEY!, appOrigin: new URL(source.APP_ORIGIN!).origin };
}
```

Create `.env.example` containing only `SUPABASE_URL=`, `SUPABASE_PUBLISHABLE_KEY=`, `SUPABASE_SERVICE_ROLE_KEY=`, and `APP_ORIGIN=`. Add `.env`, `.env.*`, and `!.env.example` to `.gitignore`.

- [ ] **Step 4: Run GREEN and source-policy checks**

Run: `pnpm exec vitest run api/_lib/env.test.ts --pool=threads --maxWorkers=1 --minWorkers=1 && pnpm typecheck`

Expected: the environment tests pass and both TypeScript projects report zero diagnostics.

Run: `rg -n "SUPABASE_(URL|PUBLISHABLE_KEY|SERVICE_ROLE_KEY)=[^[:space:]]+" --glob '!*.example' --glob '!node_modules/**' .`

Expected: no output.

- [ ] **Step 5: Commit and push Task 1**

```bash
git add package.json pnpm-lock.yaml tsconfig.json tsconfig.api.json .gitignore .env.example api/_lib/env.ts api/_lib/env.test.ts
git commit -m "chore: add production server configuration"
git push origin main
```

Expected: `git status --short --branch` reports `## main...origin/main` with no changed files.

## Task 2: Make progression, equipment, combat, and campaign state restorable

**Files:**
- Modify: `src/game/types.ts`
- Modify: `src/game/combatEngine.ts`
- Modify: `src/game/combatEngine.test.ts`
- Modify: `src/game/progression/progressionTypes.ts`
- Modify: `src/game/progression/progressionController.ts`
- Modify: `src/game/progression/progressionController.test.ts`
- Modify: `src/game/equipment/equipmentTypes.ts`
- Modify: `src/game/equipment/equipmentController.ts`
- Modify: `src/game/equipment/equipmentController.test.ts`
- Modify: `src/game/campaign/campaignTypes.ts`
- Modify: `src/game/campaign/campaignController.ts`
- Modify: `src/game/campaign/campaignController.test.ts`
- Create: `src/game/save/saveTypes.ts`
- Create: `src/game/save/saveCodec.ts`
- Create: `src/game/save/saveCodec.test.ts`

**Interfaces:**
- Produces `CampaignPersistentState`, `PlayerSaveState`, `createInitialPlayerSaveState`, `parsePlayerSaveState`, `createCampaignController({ initialState })`, and `campaign.getPersistentState()`.
- Consumes existing snapshots but never serializes derived chapter definitions or mutable controller references.

- [ ] **Step 1: Write codec and round-trip RED tests**

```ts
const initial = createInitialPlayerSaveState('player-id', '2026-07-15T10:00:00.000Z');
const parsed = parsePlayerSaveState(JSON.parse(JSON.stringify(initial)));
expect(parsed.gold).toBe(0);
expect(parsed.campaign.chapterNumber).toBe(1);

const original = createCampaignController(undefined, { initialState: initial.campaign });
original.advance(1_000);
const restored = createCampaignController(undefined, { initialState: original.getPersistentState() });
expect(restored.getSnapshot()).toEqual(original.getSnapshot());
```

Add rejection tests for unknown schema versions, duplicate equipment IDs, invalid slot keys, invalid XP/level pairs, negative gold, impossible combat HP, and chapter numbers outside 1–36.

- [ ] **Step 2: Run RED**

Run: `pnpm exec vitest run src/game/save/saveCodec.test.ts src/game/campaign/campaignController.test.ts --pool=threads --maxWorkers=1 --minWorkers=1`

Expected: FAIL because no persistent-state API exists.

- [ ] **Step 3: Add validated state contracts and hydration**

Use only JSON-safe values:

```ts
export interface PlayerSaveState {
  readonly schemaVersion: 1;
  readonly gold: number;
  readonly campaign: CampaignPersistentState;
}

export interface CampaignPersistentState {
  readonly chapterNumber: number;
  readonly unlockedChapter: number;
  readonly mode: CampaignMode;
  readonly bossUnlocked: boolean;
  readonly progression: { readonly level: number; readonly xp: number; readonly totalXp: number };
  readonly equipment: { readonly inventory: readonly EquipmentItem[]; readonly equipped: EquippedItems; readonly latestDropId: string | null; readonly nextItemNumber: number };
  readonly combat: CombatPersistentState | null;
}
```

Add constructor options to progression, equipment, and combat controllers that restore only validated values. `getPersistentState()` returns frozen copies; `getSnapshot()` continues to derive chapter definitions, totals, effective stats, and `latestDrop`. Combat restoration preserves phase, timers, accumulators, HP, alive flags, counters, and paused state. Campaign restoration maps `chapterNumber` through `getChapter()` and rejects a mode/encounter combination that cannot exist.

- [ ] **Step 4: Preserve campaign behavior while making all enemy deaths count**

Refactor campaign advancement so it handles every farming enemy-death event in chronological order: award XP, roll equipment with the post-award level, and award gold. For breakthrough and boss modes, stop the current advancement batch when the first death resolves the mode transition. This prevents a long server batch from applying later events to a replaced encounter.

Add `gold` to `CampaignSnapshot` and `CampaignPersistentState`, and expose `awardGold(amount)` only inside the campaign controller. Reject non-positive or non-integer awards. Existing UI callers remain snapshot consumers.

- [ ] **Step 5: Run GREEN and full domain regressions**

Run: `pnpm exec vitest run src/game/save/saveCodec.test.ts src/game/combatEngine.test.ts src/game/progression src/game/equipment src/game/campaign --pool=threads --maxWorkers=1 --minWorkers=1`

Expected: all state round-trips, rejection cases, combat continuity, drops, and campaign journeys pass.

- [ ] **Step 6: Commit and push Task 2**

```bash
git add src/game/types.ts src/game/combatEngine.ts src/game/combatEngine.test.ts src/game/progression src/game/equipment src/game/campaign src/game/save
git commit -m "feat: restore canonical game state"
git push origin main
```

Expected: the pushed branch is clean and tracks `origin/main`.

## Task 3: Define gold and bounded offline farming rewards

**Files:**
- Create: `src/game/gold/goldBalance.ts`
- Create: `src/game/gold/goldBalance.test.ts`
- Create: `src/game/save/offlineRewards.ts`
- Create: `src/game/save/offlineRewards.test.ts`
- Modify: `src/game/balance.ts`
- Modify: `src/game/campaign/campaignController.ts`
- Modify: `src/game/campaign/campaignController.test.ts`

**Interfaces:**
- Produces `getEnemyGold(chapter, kind)`, `settleOfflineRewards(save, elapsedMs, random)`, and `OfflineRewardResult`.
- Consumes a validated farming state and never changes chapter, boss status, combat timers, or equipped items during offline settlement.

- [ ] **Step 1: Write failing balance and idempotency tests**

```ts
expect(getEnemyGold(1, 'farming')).toBe(10);
expect(getEnemyGold(36, 'boss')).toBe(370);

const result = settleOfflineRewards(initialState, 9 * 60 * 60 * 1_000, () => 0);
expect(result.elapsedMs).toBe(8 * 60 * 60 * 1_000);
expect(result.drops).toHaveLength(20);
expect(result.nextState.gold).toBeGreaterThan(initialState.gold);
expect(result.nextState.campaign.chapterNumber).toBe(initialState.campaign.chapterNumber);
```

Add tests for zero/negative elapsed time, a non-farming campaign mode, 5,999ms rounding to no kill, 6,000ms yielding exactly one kill, level capping, and no duplicate equipment IDs.

- [ ] **Step 2: Run RED**

Run: `pnpm exec vitest run src/game/gold/goldBalance.test.ts src/game/save/offlineRewards.test.ts --pool=threads --maxWorkers=1 --minWorkers=1`

Expected: FAIL because gold and offline modules do not exist.

- [ ] **Step 3: Implement fixed, reviewable reward rules**

Use these central values exactly:

```ts
export const OFFLINE_REWARD_BALANCE = Object.freeze({
  maximumElapsedMs: 8 * 60 * 60 * 1_000,
  killIntervalMs: 6_000,
  maximumEquipmentDrops: 20,
});

export function getEnemyGold(chapter: number, kind: EncounterKind): number {
  const base = 10 + (chapter - 1) * 2;
  return kind === 'farming' ? base : kind === 'breakthrough' ? base * 4 : base * 10;
}
```

`settleOfflineRewards` clamps elapsed time, returns an unchanged state for non-farming modes, and calculates `floor(clampedElapsedMs / 6_000)` farming kills. Each kill awards current farming XP and farming gold; the equipment generator receives a cryptographically secure server random source and stops after 20 generated drops. The result contains `{ elapsedMs, kills, gold, xp, drops, nextState }`, allowing the client to show exactly what was already persisted.

- [ ] **Step 4: Run GREEN and campaign integration tests**

Run: `pnpm exec vitest run src/game/gold/goldBalance.test.ts src/game/save/offlineRewards.test.ts src/game/campaign/campaignController.test.ts --pool=threads --maxWorkers=1 --minWorkers=1`

Expected: all reward caps, summary values, item limits, and normal campaign gold tests pass.

- [ ] **Step 5: Commit and push Task 3**

```bash
git add src/game/gold src/game/save/offlineRewards.ts src/game/save/offlineRewards.test.ts src/game/balance.ts src/game/campaign
git commit -m "feat: add bounded offline rewards"
git push origin main
```

Expected: clean `main...origin/main` after push.

## Task 4: Create the Supabase schema and guarded compare-and-swap persistence

**Files:**
- Create: `supabase/migrations/202607150001_create_player_states.sql`
- Create: `supabase/migrations/202607150002_add_player_state_policies.sql`
- Create: `supabase/migrations/202607150003_add_player_state_rpc.sql`
- Create: `api/_lib/playerRepository.ts`
- Create: `api/_lib/playerRepository.test.ts`

**Interfaces:**
- Produces `loadOrCreatePlayerState(userId, now)` and `savePlayerState(userId, expectedVersion, state, now)`.
- Returns `{ kind: 'saved'; record: PlayerRecord } | { kind: 'stale'; record: PlayerRecord }`; never accepts a user id supplied by the browser.

- [ ] **Step 1: Write repository contract tests using a fake database port**

```ts
const stale = await repository.savePlayerState('user-a', 4, nextState, now);
expect(stale).toEqual({ kind: 'stale', record: expect.objectContaining({ saveVersion: 5 }) });

const saved = await repository.savePlayerState('user-a', 5, nextState, now);
expect(saved).toEqual({ kind: 'saved', record: expect.objectContaining({ saveVersion: 6, state: nextState }) });
```

Assert that first load creates exactly one level-one state, owner lookup never reads another user, and a malformed JSON state fails before a database call.

- [ ] **Step 2: Run RED**

Run: `pnpm exec vitest run api/_lib/playerRepository.test.ts --pool=threads --maxWorkers=1 --minWorkers=1`

Expected: FAIL because the repository and migration contract are absent.

- [ ] **Step 3: Add schema, RLS, and one atomic save path**

Create `public.player_states` with `user_id uuid primary key references auth.users(id) on delete cascade`, `schema_version integer`, `save_version bigint`, `state jsonb`, `last_activity_at timestamptz`, `created_at timestamptz`, and `updated_at timestamptz`. Add a `state` object check, non-negative version check, and index on `updated_at`.

Enable RLS. Add owner-only select, insert, and update policies using `(select auth.uid()) = user_id`. Revoke table privileges from `anon`; the browser is never given a data client. The Vercel server verifies the user session itself and uses the service-role database client only after that verification.

Create `public.save_player_state(expected_version bigint, next_state jsonb, activity_at timestamptz)` as a `security definer` function with a fixed `search_path`, ownership check, expected-version update predicate, incremented version, and no dynamic SQL. Revoke `execute` from `public`, grant it only to `service_role`, and make the repository translate an empty guarded update into the `stale` result. The repository validates `PlayerSaveState` both before write and after read.

- [ ] **Step 4: Run GREEN**

Run: `pnpm exec vitest run api/_lib/playerRepository.test.ts --pool=threads --maxWorkers=1 --minWorkers=1 && pnpm typecheck`

Expected: all repository tests and TypeScript checks pass.

Run: `rg -n "service_role|security definer|enable row level security|save_player_state" supabase/migrations`

Expected: each security mechanism appears only in the migration that defines it and has no unqualified dynamic SQL.

- [ ] **Step 5: Commit and push Task 4**

```bash
git add supabase/migrations api/_lib/playerRepository.ts api/_lib/playerRepository.test.ts
git commit -m "feat: add versioned player state storage"
git push origin main
```

Expected: migration source is versioned and no live project data is staged.

## Task 5: Implement server-side authentication and command execution

**Files:**
- Create: `api/_lib/supabaseServer.ts`
- Create: `api/_lib/http.ts`
- Create: `api/_lib/authService.ts`
- Create: `api/_lib/authService.test.ts`
- Create: `api/_lib/playerService.ts`
- Create: `api/_lib/playerService.test.ts`
- Create: `api/auth/sign-up.ts`
- Create: `api/auth/sign-in.ts`
- Create: `api/auth/sign-out.ts`
- Create: `api/auth/request-password-reset.ts`
- Create: `api/auth/reset-password.ts`
- Create: `api/player.ts`
- Create: `api/player/commands.ts`
- Create: `api/player/reset.ts`

**Interfaces:**
- Produces secure cookie-aware Supabase clients, `requireUser(request)`, `executePlayerCommand(user, command, now)`, and standard JSON errors.
- Consumes `PlayerSaveState`, `PlayerRepository`, and server timestamps. All public command inputs have an `expectedVersion` and a discriminated `type`.

- [ ] **Step 1: Write failing authentication and command tests**

```ts
await expect(authService.signIn({ email: 'not-an-email', password: 'x' }))
  .resolves.toEqual({ ok: false, code: 'invalid_credentials' });

const response = await playerService.execute(user, { type: 'equipBest', expectedVersion: 3 }, now);
expect(response.kind).toBe('saved');
expect(response.record.saveVersion).toBe(4);

const stale = await playerService.execute(user, { type: 'startBoss', expectedVersion: 2 }, now);
expect(stale.kind).toBe('stale');
```

Add endpoint tests proving 401 without a verified session, 400 for unknown command or invalid body, 409 with canonical state on a version conflict, generic auth errors that do not reveal account existence, and `Set-Cookie` changes only from the Supabase SSR adapter.

- [ ] **Step 2: Run RED**

Run: `pnpm exec vitest run api/_lib/authService.test.ts api/_lib/playerService.test.ts --pool=threads --maxWorkers=1 --minWorkers=1`

Expected: FAIL because the server services and endpoints are missing.

- [ ] **Step 3: Implement cookie-authenticated Supabase clients**

Use `createServerClient` from `@supabase/ssr` with `auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true }` and a request/response cookie adapter. Cookies must be `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, and have no game-state fields. `requireUser` calls `auth.getUser()` on the server for every protected request; it never trusts a decoded client claim alone.

Implement sign-up with `emailRedirectTo: new URL('/auth/confirm', appOrigin).toString()`, sign-in with password, sign-out, `resetPasswordForEmail` with `redirectTo: new URL('/reset-password', appOrigin).toString()`, and password update only after `requireUser`. Return a fixed `invalid_credentials` response for sign-in and reset-request attempts regardless of whether an email is registered.

- [ ] **Step 4: Implement authoritative commands and server-time settlement**

Use this command union:

```ts
export type PlayerCommand =
  | { readonly type: 'sync'; readonly expectedVersion: number }
  | { readonly type: 'startBreakthrough'; readonly expectedVersion: number }
  | { readonly type: 'startBoss'; readonly expectedVersion: number }
  | { readonly type: 'equip'; readonly expectedVersion: number; readonly itemId: string }
  | { readonly type: 'equipBest'; readonly expectedVersion: number };
```

For `sync`, calculate `elapsedMs = max(0, now - record.lastActivityAt)` on the server. For up to 60 seconds, advance the hydrated campaign in 100ms slices and save its canonical result. Above 60 seconds, use `settleOfflineRewards`; include its already-saved summary in the response. The request carries no elapsed-time field. All other commands apply exactly one validated controller operation, update `lastActivityAt`, and compare-and-swap using `expectedVersion`.

`POST /api/player/reset` accepts `{ expectedVersion, acknowledgement, finalConfirmation }`. It proceeds only when `acknowledgement === 'RESET'` and `finalConfirmation === true`, then saves a fresh initial state for the same verified user. No endpoint deletes the Auth user.

- [ ] **Step 5: Run GREEN across API units**

Run: `pnpm exec vitest run api/_lib api/auth api/player --pool=threads --maxWorkers=1 --minWorkers=1`

Expected: authentication, cookies, session rejection, reset guard, server time, offline idempotency, command validation, stale reload response, and atomic version increments pass.

- [ ] **Step 6: Commit and push Task 5**

```bash
git add api
git commit -m "feat: add authenticated game command API"
git push origin main
```

Expected: no API response exposes service credentials, a raw saved-state write, or an account-existence oracle.

## Task 6: Replace client-owned progression with an API-backed in-memory runtime

**Files:**
- Create: `src/game/api/playerApi.ts`
- Create: `src/game/api/playerApi.test.ts`
- Create: `src/game/runtime/serverBattleRuntime.ts`
- Create: `src/game/runtime/serverBattleRuntime.test.ts`
- Modify: `src/game/phaser/battleGame.ts`
- Modify: `src/game/phaser/BattleScene.ts`
- Modify: `src/game/phaser/battleGame.test.ts`
- Modify: `src/game/visibilityController.ts`

**Interfaces:**
- Produces `PlayerApi`, `ServerBattleRuntime`, and `BattleController` methods `replaceState`, `sync`, `startBreakthrough`, `startBoss`, `equip`, and `equipBest`.
- Consumes only canonical `PlayerApiResponse` objects; no browser-side controller save is authoritative.

- [ ] **Step 1: Write client API and stale-state RED tests**

```ts
fetchMock.mockResolvedValue(jsonResponse({ kind: 'stale', record: newerRecord }));
await expect(api.command({ type: 'equipBest', expectedVersion: 2 })).resolves.toEqual({ kind: 'stale', record: newerRecord });
expect(fetchMock).toHaveBeenCalledWith('/api/player/commands', expect.objectContaining({ credentials: 'include' }));

await runtime.equipBest();
expect(runtime.getState().saveVersion).toBe(9);
expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ syncState: 'stale-reloaded' }));
```

Assert that the API wrapper does not use Supabase, localStorage, sessionStorage, IndexedDB, or direct cookies.

- [ ] **Step 2: Run RED**

Run: `pnpm exec vitest run src/game/api/playerApi.test.ts src/game/runtime/serverBattleRuntime.test.ts src/game/phaser/battleGame.test.ts --pool=threads --maxWorkers=1 --minWorkers=1`

Expected: FAIL because there is no API-backed runtime.

- [ ] **Step 3: Implement the browser API boundary**

`playerApi.ts` uses `fetch` only against same-origin `/api/*`, always includes `credentials: 'include'`, sets `Content-Type: application/json`, and parses a discriminated JSON body. It maps network failures to `{ kind: 'unavailable' }`, 401 to `{ kind: 'unauthenticated' }`, and 409 to `{ kind: 'stale'; record }`. It stores neither records nor tokens.

`ServerBattleRuntime` holds the latest canonical record and a subscription set in memory. It serializes one outstanding command at a time, disables interaction while pending, replaces state on every saved or stale response, and emits one offline result only when received from `GET /api/player`. Its timer calls `{ type: 'sync', expectedVersion }` every 15 seconds while visible; visibility restore immediately calls `load()` rather than replaying a local elapsed duration.

- [ ] **Step 4: Rewire Phaser as a renderer of canonical state**

Change `createBattleGame` to receive a `ServerBattleRuntime`. BattleScene subscribes to runtime snapshots and draws/updates from the most recent canonical `CampaignSnapshot`. Its controls invoke runtime commands, not `CampaignController` methods. Phaser may animate between canonical updates but must discard its preview on the next server response; only the runtime snapshot is published to React and only the API can advance rewards.

Preserve one Phaser instance, pause its animations when hidden, and destroy runtime subscriptions with the scene. On any command failure, report a recoverable error without changing rendered canonical state.

- [ ] **Step 5: Run GREEN and persistence-policy scan**

Run: `pnpm exec vitest run src/game/api/playerApi.test.ts src/game/runtime/serverBattleRuntime.test.ts src/game/phaser/battleGame.test.ts --pool=threads --maxWorkers=1 --minWorkers=1`

Expected: canonical replacement, stale recovery, visibility reload, one Phaser lifetime, and command forwarding pass.

Run: `rg -n "localStorage|sessionStorage|indexedDB|document\\.cookie|createClient\\(" src api`

Expected: no game persistence or direct browser Supabase client; cookie mention is permitted only in server-side tests or the SSR adapter.

- [ ] **Step 6: Commit and push Task 6**

```bash
git add src/game/api src/game/runtime src/game/phaser src/game/visibilityController.ts
git commit -m "feat: sync battle state through the server"
git push origin main
```

Expected: the UI no longer treats a browser-created campaign controller as saved progress.

## Task 7: Build the authenticated production experience

**Files:**
- Create: `src/components/AuthScreen.tsx`
- Create: `src/components/AuthScreen.test.tsx`
- Create: `src/components/OfflineReturnDialog.tsx`
- Create: `src/components/OfflineReturnDialog.test.tsx`
- Create: `src/components/ResetProgressDialog.tsx`
- Create: `src/components/ResetProgressDialog.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Produces an auth-first App state machine: `loading`, `unauthenticated`, `authenticated`, `syncing`, and `error`.
- Consumes `PlayerApi` and `ServerBattleRuntime`; components receive callbacks and do not make direct network/database calls.

- [ ] **Step 1: Write failing UI behavior tests**

```tsx
render(<App api={fakeApi} />);
expect(await screen.findByRole('heading', { name: 'Create your RoyalStory account' })).toBeInTheDocument();
expect(screen.queryByLabelText('RoyalStory automatic battle')).not.toBeInTheDocument();

await user.type(screen.getByLabelText('Confirm reset text'), 'RESET');
expect(screen.getByRole('button', { name: 'Continue to final confirmation' })).toBeEnabled();
await user.click(screen.getByRole('button', { name: 'Reset all progress permanently' }));
expect(fakeApi.reset).toHaveBeenCalledWith(expect.objectContaining({ acknowledgement: 'RESET', finalConfirmation: true }));
```

Add tests for sign-up/sign-in field errors, password-reset confirmation, authenticated reload, authoritative gold display, disabled controls during sync, offline summary with 20 items, stale-state notice, error retry, and cancellation of reset before the final action.

- [ ] **Step 2: Run RED**

Run: `pnpm exec vitest run src/components/AuthScreen.test.tsx src/components/OfflineReturnDialog.test.tsx src/components/ResetProgressDialog.test.tsx src/App.test.tsx --pool=threads --maxWorkers=1 --minWorkers=1`

Expected: FAIL because authentication, offline return, and reset components do not exist.

- [ ] **Step 3: Implement AuthScreen and session startup**

Render registration and sign-in immediately for an unauthenticated visitor. Include email, password, clear success/error messages, password reset request, and a new-password screen reached from the verified Supabase redirect. Never render a demo game behind this screen. After sign-in or reload, call `GET /api/player`, create the runtime from that response, and render gameplay only after canonical state is available.

- [ ] **Step 4: Implement gold, synchronization, offline return, and reset safeguards**

Display `snapshot.gold` in the persistent header and label it `Gold`. During a runtime command, disable mutating buttons and show `Saving progress…`; on a stale result display `Progress updated from another device` after replacing state. `OfflineReturnDialog` lists elapsed time, XP, Gold, and all awarded equipment, and closing it affects only local presentation state.

`ResetProgressDialog` has two distinct panels. The first requires exact uppercase `RESET` and enables only `Continue to final confirmation`. The second repeats the consequence and calls the API only from a button named `Reset all progress permanently`; Escape, backdrop clicks, and cancel dismiss without a request.

- [ ] **Step 5: Add responsive, accessible production styling**

Keep the accepted RoyalStory visual direction. Add accessible error/status color contrast, visible focus indicators, 44px minimum controls, a compact gold header, scroll-safe offline item list, and a destructive reset area visually separate from normal controls. At 320px all dialogs, auth fields, and header controls fit without horizontal scrolling. Respect `prefers-reduced-motion` for dialog transitions.

- [ ] **Step 6: Run GREEN**

Run: `pnpm exec vitest run src/components src/App.test.tsx --pool=threads --maxWorkers=1 --minWorkers=1`

Expected: all auth-first, gold, offline, stale-state, reset-confirmation, and existing equipment UI tests pass.

- [ ] **Step 7: Commit and push Task 7**

```bash
git add src/components src/App.tsx src/App.test.tsx src/styles.css
git commit -m "feat: add production account experience"
git push origin main
```

Expected: no unauthenticated route can reach the game UI.

## Task 8: Document operations, deploy safely, and verify production behavior

**Files:**
- Modify: `README.md`
- Create: `docs/production-setup.md`
- Modify: `vercel.json` only if Vercel routing requires an explicit route configuration
- Modify: `src/App.test.tsx`
- Create: `api/productionContract.test.ts`

**Interfaces:**
- Produces a repeatable operator checklist without secrets and an explicit production acceptance record.
- Consumes the existing Vercel project and user-controlled Supabase/Vercel dashboard configuration.

- [ ] **Step 1: Write the production contract test**

```ts
it('keeps credentials and browser game persistence out of tracked production source', async () => {
  expect(await readTrackedFiles()).not.toContain('.env.local');
  expect(await readSource()).not.toMatch(/localStorage|sessionStorage|indexedDB/);
  expect(await readSource()).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*['"][^'"]+/);
});
```

Keep assertions scoped to production source, not documentation that names required variables.

- [ ] **Step 2: Run RED**

Run: `pnpm exec vitest run api/productionContract.test.ts --pool=threads --maxWorkers=1 --minWorkers=1`

Expected: FAIL until the tracked-file and source inspection helpers exist.

- [ ] **Step 3: Write the operator guide with exact dashboard actions**

Document these actions without values:

1. In Supabase, enable Email/password and confirm-email verification; configure a custom SMTP sender and production rate limits.
2. In Supabase Auth URL configuration, add the final Vercel production origin plus `/auth/confirm` and `/reset-password` redirects.
3. Run the committed SQL migrations against the intended Supabase project using an authenticated Supabase CLI session or the SQL editor, in migration order.
4. In Vercel Production environment variables, add the four names from `.env.example`; never paste them into GitHub, browser JavaScript, or this chat.
5. Deploy the existing Vercel project from `main`, then set `APP_ORIGIN` to its final HTTPS origin and redeploy.
6. Smoke-test a new email, confirmation link, sign-in, page reload, password reset, 8-hour capped offline return, two-device stale update, and typed-plus-final reset confirmation.

Explain that Vercel environment changes apply to a new deployment and that Supabase’s default email service is not production-ready.

- [ ] **Step 4: Run GREEN and all automated verification**

Run: `pnpm exec vitest run api/productionContract.test.ts --pool=threads --maxWorkers=1 --minWorkers=1`

Expected: PASS.

Run: `pnpm test`

Expected: every test passes.

Run: `pnpm typecheck && pnpm build && git diff --check`

Expected: zero TypeScript diagnostics, a successful production bundle, and no whitespace errors.

Run: `rg -n "localStorage|sessionStorage|indexedDB|document\\.cookie|SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*['\"]" src api --glob '!*.test.*'`

Expected: no match; server cookie adapter configuration may mention cookie options but must not serialize game state.

- [ ] **Step 5: Perform the real production deployment after external configuration**

With the user’s authenticated Vercel/Supabase access and dashboard configuration complete, run the migration command selected in `docs/production-setup.md`, deploy from `main` to the existing Vercel project, and execute the smoke-test sequence against the production URL. Do not request, display, log, or commit any credential. Record only pass/fail outcomes and the public deployment URL in the final delivery message.

- [ ] **Step 6: Commit, push, and prove canonical delivery**

```bash
git add README.md docs/production-setup.md vercel.json src/App.test.tsx api/productionContract.test.ts
git commit -m "docs: add production deployment guide"
git push origin main
git status --short --branch
git rev-parse HEAD
git rev-parse origin/main
```

Expected: `## main...origin/main`, no changed files, and identical HEAD/origin-main hashes.

## Self-Review Coverage Map

- Real email/password accounts, verification, reset, custom SMTP requirement, and secure reload session: Tasks 1, 5, and 7.
- Server-only authority, no browser game persistence, no direct database writes, and server-time calculation: Tasks 1, 5, and 6.
- Versioned schema, migration, canonical state, stale-client recovery, and multi-device latest-server-wins behavior: Tasks 2, 4, 5, and 6.
- Offline XP, gold, equipment, eight-hour cap, 20-drop cap, direct inventory insertion, and return screen: Tasks 3, 5, and 7.
- Visible saved gold and guarded account-retaining reset: Tasks 2, 5, and 7.
- Environment secrecy, Supabase RLS, Vercel deployment, and production validation: Tasks 1, 4, and 8.
