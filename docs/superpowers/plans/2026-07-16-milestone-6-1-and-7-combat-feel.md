# RoyalStory Milestone 6.1 Cleanup and Milestone 7 Combat Feel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Deliver the Milestone 6.1 cleanup release, then original pixel-art combat feedback whose transient presentation events cannot alter combat results, progression, APIs, or saved state.

**Architecture:** Milestone 6.1 changes only temporary diagnostics, a source/config contract, an already-failing React test harness, and stale documentation. Milestone 7 keeps CombatEvent[] compatible for campaign and server callers, adds CombatEngine.advanceWithPresentation() for a Phaser-free event batch, and has BattleScene forward that batch to a dedicated Phaser presentation controller. Presentation state is short-lived and is never stored in CombatSnapshot, CampaignPersistentState, API records, or Supabase.

**Tech Stack:** TypeScript 5.8, React 19, Phaser 3, Vite 7, Vitest 3, Vercel Functions, Supabase server clients, hand-authored RoyalStory SVG pixel sprite sheets.

## Global Constraints

- Work from the clean linked worktree on main and keep origin/main canonical.
- Finish and verify Milestone 6.1 before any Milestone 7 code.
- Keep the permanent vercel.json rewrite from /reset-password to /index.html.
- Do not change working Supabase, Resend, Vercel-domain, session, or cloud-save behavior.
- Retain localhost references that are explicit local-development or production-safety documentation; do not add a production localhost fallback.
- Do not add inventory/equipment UI, backend endpoints, Supabase migrations/schema work, secrets, browser game persistence, or direct browser Supabase access.
- Use only newly authored RoyalStory artwork in public/assets/combat. Do not copy, trace, name, or import MapleStory assets.
- Presentation code may consume results but must never change damage, combat timing, drops, progression, campaign transitions, save data, or API responses.
- Use pools for short-lived display objects, clamp all displayed HP ratios to 0..1, and honor reduced motion.
- Run the full suite, typecheck, build, and diff check after every task.
- Match CI's deterministic Vitest worker configuration.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| api/auth/request-password-reset.ts | Retain request-origin reset flow while deleting its temporary diagnostic. |
| api/productionContract.test.ts | Assert the diagnostic is absent and the reset SPA rewrite remains exact. |
| src/App.test.tsx | Flush the existing native visibility event in React test code. |
| README.md | Accurate Milestone 6 and 7 overview and release-version decision. |
| src/game/presentation/combatPresentationEvents.ts | Phaser-free presentation event union and advance result. |
| src/game/presentation/combatPresentationEvents.test.ts | Normal, critical, miss, health, and enemy-death event tests. |
| src/game/types.ts | Add advanceWithPresentation without changing legacy advance. |
| src/game/combatEngine.ts | Emit transient presentation events after authoritative outcomes resolve. |
| src/game/combatEngine.test.ts | Preserve deterministic legacy results while testing event output. |
| src/game/campaign/campaignTypes.ts | Optional transient event drain type for the renderer boundary. |
| src/game/campaign/campaignController.ts | Move only the latest presentation batch from engine to renderer. |
| src/game/campaign/campaignController.test.ts | Prove rewards and persistent state do not change. |
| public/assets/combat/*.svg | Five local, transparent, original pixel-art sprite sheets. |
| src/game/phaser/combatPresentation/effectManifest.ts | One typed effect asset manifest. |
| src/game/phaser/combatPresentation/effectManifest.test.ts | Asset family, metadata, and local-origin contract. |
| src/game/phaser/combatPresentation/objectPool.ts | Generic bounded reusable-object pool. |
| src/game/phaser/combatPresentation/objectPool.test.ts | Reuse and duplicate-release coverage. |
| src/game/phaser/combatPresentation/healthInterpolation.ts | Pure immediate/delayed HP bar model. |
| src/game/phaser/combatPresentation/healthInterpolation.test.ts | Clamp, monotonic, and no-overshoot coverage. |
| src/game/phaser/combatPresentation/presentationConstants.ts | Central timings, scales, and shake limits. |
| src/game/phaser/combatPresentation/CombatPresentationController.ts | Presentation-only coordination of effects, text, HP, shake, fallback, and death. |
| src/game/phaser/combatPresentation/CombatPresentationController.test.ts | Fake-port behavior, pooling, fallback, reduced-motion, and duplicate-death tests. |
| src/game/phaser/BattleScene.ts | Phaser loading/animations, controller port, dual bars, and event forwarding. |
| src/game/phaser/battleGame.test.ts | Phaser-boundary integration and regression tests. |

## Shared Verification Commands

Run from the repository root after each task, following that task's focused RED or GREEN command:

~~~
pnpm test -- --pool=threads --maxWorkers=1 --minWorkers=1
pnpm typecheck
pnpm build
git diff --check
~~~

Expected: zero failed Vitest tests, zero TypeScript diagnostics, a successful Vite production bundle, and no whitespace errors. tsconfig.api.json includes api/**/*.ts, so typecheck and build compile all auth routes: confirm, recover, request-password-reset, sign-in, sign-out, sign-up, and update-password.

### Task 0: Save and self-review the plan

**Files:**
- Create: docs/superpowers/plans/2026-07-16-milestone-6-1-and-7-combat-feel.md

**Interfaces:**
- Produces the exact task, test, and commit contract used below.
- Consumes the 2026-07-16 design, Milestone 6 production plan, production setup guide, and current main architecture.

- [ ] **Step 1: Write this plan before production code**

Save this document at the requested path. Preserve task order: Milestone 6.1, event contract, assets, pure primitives, controller, scene integration, release QA.

- [ ] **Step 2: Scan for placeholders and invalid whitespace**

Run:

~~~
rg -n "TB[D]|T[O]DO|implement[ ]later|fill[ ]in[ ]details" docs/superpowers/plans/2026-07-16-milestone-6-1-and-7-combat-feel.md
git diff --check -- docs/superpowers/plans/2026-07-16-milestone-6-1-and-7-combat-feel.md
~~~

Expected: no rg matches and no diff-check output.

- [ ] **Step 3: Commit and push the reviewed plan**

~~~
git add docs/superpowers/plans/2026-07-16-milestone-6-1-and-7-combat-feel.md
git commit -m "docs: plan milestone 6.1 and 7 combat feel"
git push origin main
git status --short --branch
~~~

Expected: main tracks origin/main with no changed files.

### Task 1: Lock reset routing, remove the temporary diagnostic, and repair baseline test harness (Milestone 6.1)

**Files:**
- Modify: api/productionContract.test.ts
- Modify: api/auth/request-password-reset.ts
- Modify: src/App.test.tsx

**Interfaces:**
- Consumes POST(request: Request): Promise<Response> from the reset-request endpoint.
- Produces a narrow source/config contract, retaining the current request-origin redirect behavior.
- Does not alter App, visibilityController, auth service, recover route, or vercel.json.

- [ ] **Step 1: Write the failing reset contract**

Append this test inside the existing production source contract describe block:

~~~ts
it("keeps reset-password SPA routing while excluding the temporary reset diagnostic", async () => {
  const [resetRoute, vercelConfig] = await Promise.all([
    readFile(join(root, "api", "auth", "request-password-reset.ts"), "utf8"),
    readFile(join(root, "vercel.json"), "utf8"),
  ]);

  expect(resetRoute).not.toContain("password-reset redirect diagnostic");
  expect(JSON.parse(vercelConfig)).toMatchObject({
    rewrites: [{ source: "/reset-password", destination: "/index.html" }],
  });
});
~~~

- [ ] **Step 2: Run RED**

~~~
pnpm exec vitest run api/productionContract.test.ts --pool=threads --maxWorkers=1 --minWorkers=1
~~~

Expected: FAIL only because the reset route contains password-reset redirect diagnostic. The rewrite assertion passes.

- [ ] **Step 3: Make the smallest cleanup**

Replace the current email/origin/diagnostic block with this exact behavior:

~~~ts
const email = typeof body.email === "string" ? body.email : "";
const appOrigin = new URL(request.url).origin;
const result = await createAuthService(auth.client, appOrigin).requestPasswordReset(email);
return auth.applyCookies(jsonResponse(result, result.ok ? 200 : 503));
~~~

Delete recoveryRedirect and the console.info call. Keep appOrigin, api/auth/recover.ts, vercel.json, and api/_lib/http.ts console.error unchanged.

- [ ] **Step 4: Correct the pre-existing React test-harness failure**

The visibility test already fails because a native event causing React state change runs outside act. Change only the test body to:

~~~tsx
act(() => {
  Object.defineProperty(document, "hidden", { value: true, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
});

expect(battleGame.setPaused).toHaveBeenLastCalledWith(true);
expect(screen.getByText("Paused")).toBeInTheDocument();
~~~

Do not change source product behavior.

- [ ] **Step 5: Run focused GREEN and reference audits**

~~~
pnpm exec vitest run api/productionContract.test.ts src/App.test.tsx src/game/api/authApi.test.ts --pool=threads --maxWorkers=1 --minWorkers=1
rg -n "password-reset redirect diagnostic|console\.(debug|info)" api/auth api/_lib --glob "!*.test.ts"
rg -n "localhost|127\.0\.0\.1" api src docs/production-setup.md
~~~

Expected: focused tests pass; no temporary auth diagnostic is found; localhost results are only intentional documentation safety/local-development references.

- [ ] **Step 6: Run shared verification**

Run the four Shared Verification Commands.

Expected: all pass and all auth API routes compile.

### Task 2: Update documentation and commit Milestone 6.1 separately

**Files:**
- Modify: README.md
- Modify: api/productionContract.test.ts
- Modify: api/auth/request-password-reset.ts
- Modify: src/App.test.tsx

**Interfaces:**
- Produces the only Milestone 6.1 cleanup commit.
- Consumes the verified cleanup from Task 1 and the detailed docs/production-setup.md guide.

- [ ] **Step 1: Replace obsolete Milestone 5 and session-only claims**

Replace those two README sections with:

~~~md
## Milestone 6 production behavior

- Email/password accounts use server-managed Supabase sessions; unauthenticated visitors cannot access the game UI.
- Vercel API routes validate the authenticated user and persist canonical game state in Supabase with optimistic save versions.
- The browser uses same-origin /api/* calls only. It does not keep game data in localStorage, sessionStorage, IndexedDB, cookies, or the filesystem.
- Offline farming is bounded by the server and the returned summary is presentation-only.
- Password recovery exchanges its one-time code through /api/auth/recover and then serves the client reset screen at /reset-password.

## Operations and versioning

Follow [the production setup guide](docs/production-setup.md) for Supabase, Vercel, SMTP, redirect, and smoke-test configuration. package.json remains 0.0.0 because the repository has no established release-tag, changelog, or package-version convention; Milestone 6.1 therefore does not invent a v0.6.1 marker.
~~~

Keep local run and verification commands. Do not put values, credentials, user data, or production reset links in README.

- [ ] **Step 2: Verify documentation and safety policy**

~~~
rg -n "Milestone 5|Session-only|reset on reload|v0\.6\.1" README.md
rg -n "localStorage|sessionStorage|indexedDB|document\.cookie" README.md src api --glob "!*.test.*"
pnpm exec vitest run api/productionContract.test.ts --pool=threads --maxWorkers=1 --minWorkers=1
~~~

Expected: no stale claims/invented version marker; no production browser persistence; contract tests pass.

- [ ] **Step 3: Run shared verification**

Run the four Shared Verification Commands.

Expected: all pass.

- [ ] **Step 4: Commit and push the separate 6.1 release**

~~~
git add README.md api/productionContract.test.ts api/auth/request-password-reset.ts src/App.test.tsx
git commit -m "chore: complete milestone 6.1 cleanup"
git push origin main
git status --short --branch
~~~

Expected: one distinct Milestone 6.1 commit on origin/main and a clean worktree.

### Task 3: Define the Phaser-free combat presentation contract

**Files:**
- Create: src/game/presentation/combatPresentationEvents.ts
- Create: src/game/presentation/combatPresentationEvents.test.ts
- Modify: src/game/types.ts
- Modify: src/game/combatEngine.ts
- Modify: src/game/combatEngine.test.ts
- Modify: src/game/campaign/campaignTypes.ts
- Modify: src/game/campaign/campaignController.ts
- Modify: src/game/campaign/campaignController.test.ts

**Interfaces:**
- Produces CombatPresentationEvent, CombatAdvanceResult, and CombatEngine.advanceWithPresentation(elapsedMs).
- Produces optional CampaignController.consumePresentationEvents(): readonly CombatPresentationEvent[] for renderer compatibility.
- Keeps CombatEngine.advance(elapsedMs): CombatEvent[], CampaignController.advance(elapsedMs): CombatEvent[], save types, API records, and server command behavior unchanged.

- [ ] **Step 1: Write failing normal/critical/miss/death event tests**

Create combatPresentationEvents.test.ts. Start with this normal-hit specification, then add isolated critical, miss, and enemy-death cases:

~~~ts
const result = engine.advanceWithPresentation(100);

expect(result.events).toEqual([
  { type: "attack", attacker: "player", target: "enemy" },
  { type: "damage", target: "enemy", amount: 20, hp: 80 },
]);
expect(result.presentationEvents).toEqual([
  expect.objectContaining({ type: "attack_started", actorId: "player", targetId: "enemy" }),
  expect.objectContaining({
    type: "hit_landed", actorId: "player", targetId: "enemy",
    damage: 20, critical: false, resultingHealth: 80,
  }),
  expect.objectContaining({ type: "health_changed", actorId: "player", targetId: "enemy", resultingHealth: 80 }),
]);
~~~

Each presentation event must have finite timestampMs. Require enemy_defeated only for enemy health zero. Add campaign test assertions that the drained batch is emitted and JSON.stringify(campaign.getPersistentState()) lacks presentationEvents.

- [ ] **Step 2: Run RED**

~~~
pnpm exec vitest run src/game/presentation/combatPresentationEvents.test.ts src/game/combatEngine.test.ts --pool=threads --maxWorkers=1 --minWorkers=1
~~~

Expected: FAIL because advanceWithPresentation and CombatPresentationEvent do not exist; legacy combat tests pass.

- [ ] **Step 3: Implement one shared contract and internal advance result**

Create this union and result in the new presentation module:

~~~ts
export type CombatPresentationEvent =
  | { readonly type: "attack_started"; readonly actorId: ActorId; readonly targetId: ActorId; readonly timestampMs: number }
  | { readonly type: "hit_landed"; readonly actorId: ActorId; readonly targetId: ActorId; readonly damage: number; readonly critical: false; readonly resultingHealth: number; readonly timestampMs: number }
  | { readonly type: "critical_hit_landed"; readonly actorId: "player"; readonly targetId: "enemy"; readonly damage: number; readonly critical: true; readonly resultingHealth: number; readonly timestampMs: number }
  | { readonly type: "attack_missed"; readonly actorId: ActorId; readonly targetId: ActorId; readonly damage: 0; readonly critical: false; readonly resultingHealth: number; readonly timestampMs: number }
  | { readonly type: "health_changed"; readonly actorId: ActorId; readonly targetId: ActorId; readonly resultingHealth: number; readonly timestampMs: number }
  | { readonly type: "enemy_defeated"; readonly actorId: "player"; readonly targetId: "enemy"; readonly damage: number; readonly critical: boolean; readonly resultingHealth: 0; readonly timestampMs: number };

export interface CombatAdvanceResult {
  readonly events: readonly CombatEvent[];
  readonly presentationEvents: readonly CombatPresentationEvent[];
}
~~~

Implement one internal advance routine. advance returns its events unchanged; advanceWithPresentation returns both arrays. Create presentation events only after attack, miss, critical/damage, health change, and enemy death resolve, using activeRuntimeMs for timestampMs. Campaign stores only the latest batch, drain returns it then clears it, and pause/resume clear it. Do not queue unbounded data and do not serialize it.

- [ ] **Step 4: Run GREEN**

~~~
pnpm exec vitest run src/game/presentation/combatPresentationEvents.test.ts src/game/combatEngine.test.ts src/game/campaign/campaignController.test.ts src/game/save/saveCodec.test.ts --pool=threads --maxWorkers=1 --minWorkers=1
~~~

Expected: normal, critical, miss, and enemy-death sequences pass while campaign/save tests preserve outcomes.

- [ ] **Step 5: Run shared verification, commit, and push**

~~~
git add src/game/presentation src/game/types.ts src/game/combatEngine.ts src/game/combatEngine.test.ts src/game/campaign/campaignTypes.ts src/game/campaign/campaignController.ts src/game/campaign/campaignController.test.ts
git commit -m "feat: emit combat presentation events"
git push origin main
~~~

Run Shared Verification Commands before the commit. Expected: clean branch, unchanged saved-state shape and gameplay results.

### Task 4: Add original assets and a typed effect manifest

**Files:**
- Create: public/assets/combat/slash-basic.svg
- Create: public/assets/combat/impact-basic.svg
- Create: public/assets/combat/impact-critical.svg
- Create: public/assets/combat/enemy-death.svg
- Create: public/assets/combat/death-particles.svg
- Create: src/game/phaser/combatPresentation/effectManifest.ts
- Create: src/game/phaser/combatPresentation/effectManifest.test.ts

**Interfaces:**
- Produces CombatEffectKey, CombatEffectDefinition, and COMBAT_EFFECT_MANIFEST.
- Uses no combat simulation, save, API, backend, or external asset URL.

- [ ] **Step 1: Write failing manifest/asset test**

~~~ts
const requiredKeys = [
  "slash-basic", "impact-basic", "impact-critical", "enemy-death", "death-particles",
] as const;

expect(Object.keys(COMBAT_EFFECT_MANIFEST).sort()).toEqual([...requiredKeys].sort());
for (const key of requiredKeys) {
  const definition = COMBAT_EFFECT_MANIFEST[key];
  expect(definition).toMatchObject({ key, origin: { x: 0.5, y: 0.5 } });
  expect(definition.frameWidth).toBeGreaterThan(0);
  expect(definition.frameHeight).toBeGreaterThan(0);
  expect(definition.frameCount).toBeGreaterThan(1);
  expect(definition.frameRate).toBeGreaterThan(0);
  expect(await readFile(join(root, "public", definition.url), "utf8"))
    .toContain("RoyalStory original pixel-art asset");
}
~~~

- [ ] **Step 2: Run RED**

~~~
pnpm exec vitest run src/game/phaser/combatPresentation/effectManifest.test.ts --pool=threads --maxWorkers=1 --minWorkers=1
~~~

Expected: FAIL because neither manifest nor local assets exist.

- [ ] **Step 3: Author the local sprite sheets and one manifest**

Every SVG uses transparent background, shape-rendering="crispEdges", a comment saying RoyalStory original pixel-art asset; no third-party game art, and horizontal frames made from new rectangle/polygon art.

| Key | URL | Frame size/count/FPS | Scale | Visual |
| --- | --- | --- | --- | --- |
| slash-basic | assets/combat/slash-basic.svg | 48x48, 3, 20 | 2 | ivory/gold crescent sweep |
| impact-basic | assets/combat/impact-basic.svg | 32x32, 3, 24 | 2 | amber expanding starburst |
| impact-critical | assets/combat/impact-critical.svg | 48x48, 4, 24 | 2.25 | white/gold/red crossburst |
| enemy-death | assets/combat/enemy-death.svg | 48x48, 4, 18 | 2 | moss-green silhouette shards |
| death-particles | assets/combat/death-particles.svg | 32x32, 4, 20 | 1.75 | leaf/gold particle burst |

Use this exact central type shape:

~~~ts
export type CombatEffectKey =
  | "slash-basic" | "impact-basic" | "impact-critical" | "enemy-death" | "death-particles";

export interface CombatEffectDefinition {
  readonly key: CombatEffectKey;
  readonly url: string;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly frameCount: number;
  readonly frameRate: number;
  readonly origin: Readonly<{ x: 0.5; y: 0.5 }>;
  readonly scale: number;
  readonly animationKey: string;
}
~~~

Make the manifest satisfy Record<CombatEffectKey, CombatEffectDefinition>. It is the only location containing URL/frame/FPS/origin/scale/animation metadata.

- [ ] **Step 4: Run GREEN and source audit**

~~~
pnpm exec vitest run src/game/phaser/combatPresentation/effectManifest.test.ts --pool=threads --maxWorkers=1 --minWorkers=1
rg -n "MapleStory|https?://" public/assets/combat src/game/phaser/combatPresentation/effectManifest.ts
~~~

Expected: manifest test passes; no MapleStory or remote URL match.

- [ ] **Step 5: Run shared verification, commit, and push**

~~~
git add public/assets/combat src/game/phaser/combatPresentation/effectManifest.ts src/game/phaser/combatPresentation/effectManifest.test.ts
git commit -m "feat: add original combat effect assets"
git push origin main
~~~

Run Shared Verification Commands before the commit. Expected: all tracked assets are local and the branch is clean.

### Task 5: Build pure pooling, HP interpolation, and timing primitives

**Files:**
- Create: src/game/phaser/combatPresentation/objectPool.ts
- Create: src/game/phaser/combatPresentation/objectPool.test.ts
- Create: src/game/phaser/combatPresentation/healthInterpolation.ts
- Create: src/game/phaser/combatPresentation/healthInterpolation.test.ts
- Create: src/game/phaser/combatPresentation/presentationConstants.ts

**Interfaces:**
- Produces createObjectPool(factory, reset), createHealthInterpolation(initialRatio), and COMBAT_PRESENTATION.
- Imports no Phaser, campaign, save, API, React, or Supabase code.

- [ ] **Step 1: Write failing reuse and no-overshoot tests**

~~~ts
const first = pool.acquire();
pool.release(first);
const second = pool.acquire();
expect(second).toBe(first);
expect(pool.activeCount()).toBe(1);
pool.release(second);
expect(pool.activeCount()).toBe(0);

const bar = createHealthInterpolation(1);
bar.setTarget(0.25);
expect(bar.getState()).toEqual({ immediateRatio: 0.25, delayedRatio: 1 });
expect(bar.advance(100, 1)).toEqual({ immediateRatio: 0.25, delayedRatio: 0.9 });
expect(bar.advance(10_000, 1)).toEqual({ immediateRatio: 0.25, delayedRatio: 0.25 });
~~~

Add 100 acquire/release iterations, duplicate-release rejection, target clamp below zero/above one, healing, and large-delta no-overshoot tests.

- [ ] **Step 2: Run RED**

~~~
pnpm exec vitest run src/game/phaser/combatPresentation/objectPool.test.ts src/game/phaser/combatPresentation/healthInterpolation.test.ts --pool=threads --maxWorkers=1 --minWorkers=1
~~~

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement the smallest pure primitives**

Use a Set for active items, a LIFO inactive array, and throw on release of an inactive item. Clamp health ratios to 0..1 and move delayedRatio toward immediateRatio by no more than elapsedMs / 1000 * unitsPerSecond.

Create this constant:

~~~ts
export const COMBAT_PRESENTATION = Object.freeze({
  normalDamageLifetimeMs: 560,
  criticalDamageLifetimeMs: 620,
  missLifetimeMs: 460,
  healthDelayedUnitsPerSecond: 1,
  criticalShakeDurationMs: 110,
  criticalShakeIntensity: 0.0035,
  strongHitDamageThreshold: 40,
  strongHitShakeDurationMs: 80,
  strongHitShakeIntensity: 0.002,
});
~~~

- [ ] **Step 4: Run GREEN, shared verification, commit, and push**

Run the focused command, then Shared Verification Commands, then:

~~~
git add src/game/phaser/combatPresentation/objectPool.ts src/game/phaser/combatPresentation/objectPool.test.ts src/game/phaser/combatPresentation/healthInterpolation.ts src/game/phaser/combatPresentation/healthInterpolation.test.ts src/game/phaser/combatPresentation/presentationConstants.ts
git commit -m "feat: add pooled combat feedback primitives"
git push origin main
~~~

Expected: zero active items after release, bounded health ratios, all verification green, and clean main.

### Task 6: Implement the isolated combat presentation controller

**Files:**
- Create: src/game/phaser/combatPresentation/CombatPresentationController.ts
- Create: src/game/phaser/combatPresentation/CombatPresentationController.test.ts
- Modify: src/game/phaser/combatPresentation/presentationConstants.ts only for test-proven controller needs

**Interfaces:**
- Consumes readonly CombatPresentationEvent[], CombatEffectKey, pooling, interpolation, constants, and a narrow port.
- Produces present(events), advance(deltaMs), renderHealth(actorId, ratio), isEnemyDeathActive(), and completeEnemyDeath().
- Imports no CombatEngine, CampaignController, save/API, React, or Supabase module.

- [ ] **Step 1: Write failing fake-port behavior tests**

A fake port records effect, text, health, shake, warning, and completion calls. Add independent tests that prove:
1. normal hit uses slash-basic + impact-basic + pooled -damage and no shake below threshold;
2. critical uses impact-critical + critical number + one restrained shake;
3. miss shows MISS without impact/shake;
4. strong normal hit shakes once;
5. repeated enemy_defeated starts one enemy-death/death-particles sequence until completion;
6. missing asset warns once then uses flash plus readable number;
7. reduced motion blocks every shake/movement but preserves text and immediate HP;
8. 100 completion callbacks return every pooled number/effect.

Begin the normal-hit test with:

~~~ts
controller.present([{
  type: "hit_landed", actorId: "player", targetId: "enemy",
  damage: 18, critical: false, resultingHealth: 82, timestampMs: 100,
}]);
expect(port.effects).toContainEqual({ key: "slash-basic", actorId: "player" });
expect(port.effects).toContainEqual({ key: "impact-basic", actorId: "enemy" });
expect(port.damageNumbers).toContainEqual(expect.objectContaining({ text: "-18", critical: false }));
expect(port.shakes).toEqual([]);
~~~

- [ ] **Step 2: Run RED**

~~~
pnpm exec vitest run src/game/phaser/combatPresentation/CombatPresentationController.test.ts --pool=threads --maxWorkers=1 --minWorkers=1
~~~

Expected: FAIL because the controller and port do not exist.

- [ ] **Step 3: Implement the controller and explicit port**

~~~ts
export interface CombatPresentationPort {
  hasEffect(key: CombatEffectKey): boolean;
  playEffect(key: CombatEffectKey, actorId: ActorId): void;
  flash(actorId: ActorId, critical: boolean): void;
  showDamageNumber(handle: DamageNumberHandle, actorId: ActorId, text: string, critical: boolean, onComplete: () => void): void;
  showMiss(handle: DamageNumberHandle, actorId: ActorId, onComplete: () => void): void;
  setHealth(actorId: ActorId, immediateRatio: number, delayedRatio: number): void;
  shake(durationMs: number, intensity: number): void;
  playEnemyDeath(onComplete: () => void): void;
  warnMissingEffect(key: CombatEffectKey): void;
}
~~~

Map normal hit to slash-basic/impact-basic, critical to slash-basic/impact-critical, miss to MISS, and enemy death to enemy-death/death-particles/playEnemyDeath. Keep missing keys in a Set so warning is once only. Keep enemy death in one boolean and ignore duplicate death until completeEnemyDeath. Release each acquired handle from the exact completion callback given to the port. Reduced motion skips shake and movement-specific behavior.

- [ ] **Step 4: Run GREEN, shared verification, commit, and push**

Run the focused test, then Shared Verification Commands, then:

~~~
git add src/game/phaser/combatPresentation/CombatPresentationController.ts src/game/phaser/combatPresentation/CombatPresentationController.test.ts src/game/phaser/combatPresentation/presentationConstants.ts
git commit -m "feat: coordinate combat presentation effects"
git push origin main
~~~

Expected: all port behaviors are proven without Phaser and no pooled objects leak.

### Task 7: Integrate the controller into BattleScene without changing gameplay

**Files:**
- Modify: src/game/phaser/BattleScene.ts
- Modify: src/game/phaser/battleGame.test.ts
- Modify: src/game/phaser/combatPresentation/CombatPresentationController.ts only if a failing integration test proves a missing port operation

**Interfaces:**
- Consumes CampaignController.advance and its transient consumePresentationEvents batch.
- Produces manifest loading/animation registration, pooled pixel effects/text, dual HP layers, reduced motion, and existing enemy redraw deferral.
- Keeps BattleController, campaign command, server-state, and saved-state interfaces unchanged.

- [ ] **Step 1: Write failing Phaser-boundary tests**

Mock Phaser loader/anims and assert:

~~~ts
expect(load.spritesheet).toHaveBeenCalledWith(
  "slash-basic",
  "assets/combat/slash-basic.svg",
  expect.objectContaining({ frameWidth: 48, frameHeight: 48 }),
);
expect(animations.create).toHaveBeenCalledWith(expect.objectContaining({
  key: "royalstory-slash-basic",
}));
~~~

Add fake-campaign tests that prove normal hit causes no camera shake, critical/strong hit uses controller shake only, miss has no impact/shake, enemy death preserves pendingEnemyVisual and delays redraw until completion, and renderSnapshot draws immediate plus delayed HP layers. Add a reduced-motion matchMedia test.

- [ ] **Step 2: Run RED**

~~~
pnpm exec vitest run src/game/phaser/battleGame.test.ts src/game/phaser/combatPresentation/CombatPresentationController.test.ts --pool=threads --maxWorkers=1 --minWorkers=1
~~~

Expected: FAIL because the scene does not load manifest sheets, delegate event batches, or draw two HP layers.

- [ ] **Step 3: Implement loading and animation registration**

In preload, loop COMBAT_EFFECT_MANIFEST and call:

~~~ts
this.load.spritesheet(definition.key, definition.url, {
  frameWidth: definition.frameWidth,
  frameHeight: definition.frameHeight,
});
~~~

In create, if the animation key is absent, call:

~~~ts
this.anims.create({
  key: definition.animationKey,
  frames: this.anims.generateFrameNumbers(definition.key, {
    start: 0, end: definition.frameCount - 1,
  }),
  frameRate: definition.frameRate,
  repeat: 0,
  hideOnComplete: true,
});
~~~

Report loader failures once by matching their manifest key; hasEffect must check both texture and animation.

- [ ] **Step 4: Replace direct hit/miss/critical display with the controller**

Build a Phaser port inside BattleScene. It acquires/reuses sprites/text, resets alpha/position/scale, plays the manifest animation, returns display items to their pools on animation/tween complete, flashes only as fallback, draws delayed then immediate bars, and calls cameras.main.shake only when requested.

In update, retain campaign.advance(contributionMs) for authoritative rewards and transition behavior, then call:

~~~ts
this.presentation.present(this.campaign.consumePresentationEvents?.() ?? []);
~~~

Remove nextPlayerDamageCritical and direct damage/miss/critical animation branches. Keep player respawn handling. Route enemy death completion through existing enemyDeathFeedbackActive, pendingEnemyVisual, redrawEnemy, and renderSnapshot logic. Never call campaign code from a presentation completion callback.

- [ ] **Step 5: Run GREEN**

~~~
pnpm exec vitest run src/game/phaser/battleGame.test.ts src/game/campaign/campaignController.test.ts src/game/campaign/campaignJourney.test.ts src/game/save/saveCodec.test.ts src/game/combatEngine.test.ts --pool=threads --maxWorkers=1 --minWorkers=1
~~~

Expected: death deferral, player recovery, campaign transition, and save validation remain green; normal hits do not shake; correct presentation is selected for critical, miss, and death.

- [ ] **Step 6: Run shared verification, commit, and push**

~~~
git add src/game/phaser/BattleScene.ts src/game/phaser/battleGame.test.ts src/game/phaser/combatPresentation
git commit -m "feat: render pixel-art combat feedback"
git push origin main
~~~

Run Shared Verification Commands before the commit. Expected: clean main, with no backend/schema/save files staged.

### Task 8: Release regression checks, documentation, and manual QA

**Files:**
- Modify: README.md
- Modify: src/game/phaser/battleGame.test.ts only if the final rapid-attack regression needs an additional assertion

**Interfaces:**
- Produces release documentation and evidence that visual state cannot leak into persistence.
- Does not add new production behavior unless a failing regression test proves a minimal scene/controller correction is needed.

- [ ] **Step 1: Add the Milestone 7 README section**

Append:

~~~md
## Milestone 7 combat presentation

- Deterministic combat emits transient presentation events for attacks, normal hits, critical hits, misses, health changes, and enemy defeats.
- RoyalStory-owned pixel sprite sheets provide slash, impact, critical, enemy-death, and death-particle feedback through one typed manifest.
- Floating damage numbers and effects are pooled; HP bars render immediate and delayed layers; reduced motion disables shake and lowers movement intensity.
- Presentation never changes combat damage, rewards, progression, campaign results, API responses, or saved state.
~~~

- [ ] **Step 2: Test rapid attacks and save invariance**

Send 100 hit presentation batches through the fake port, invoke all completion callbacks, and assert zero active pooled text/effect handles. Pair it with:

~~~ts
expect(JSON.stringify(campaign.getPersistentState())).not.toContain("presentation");
expect(campaign.getSnapshot().gold).toBe(expectedGold);
~~~

Run:

~~~
pnpm exec vitest run src/game/phaser/battleGame.test.ts src/game/phaser/combatPresentation/CombatPresentationController.test.ts src/game/campaign/campaignController.test.ts src/game/save/saveCodec.test.ts --pool=threads --maxWorkers=1 --minWorkers=1
~~~

Expected: no visual object remains active and save/campaign results are unchanged.

- [ ] **Step 3: Run final shared verification and scope audit**

~~~
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
rg -n "MapleStory|localStorage|sessionStorage|indexedDB|SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*['\"]" src api public README.md --glob "!*.test.*"
~~~

Expected: changed files are limited to the plan, 6.1 cleanup/docs/tests, M7 events/assets/presentation/tests, and no prohibited production-source pattern appears.

- [ ] **Step 4: Commit and push release documentation**

~~~
git add README.md src/game/phaser/battleGame.test.ts
git commit -m "docs: record milestone 7 combat presentation"
git push origin main
git status --short --branch
~~~

Expected: main tracks origin/main with no local changes.

- [ ] **Step 5: Complete manual browser QA without changing external configuration**

Record pass/fail only, never credentials:
1. normal hit: slash, impact, normal number, immediate/delayed HP, no noticeable shake;
2. critical: critical effect/number, one short comfortable shake;
3. miss: MISS only, no impact/shake;
4. enemy death: final impact, death, particles, then campaign continues without visual blocking;
5. five minutes of farming: no growing visual-object count;
6. reduced motion: numbers/HP still clear, no shake/large movement;
7. reset email route: api/auth/recover reaches reset-password and direct reset-password serves the app;
8. existing production guide's sign-in/out, save/load, offline reward, and unauthenticated API smoke checks.

Expected: automated checks are green; credentialed production checks are reported as owner-run manual QA rather than simulated.

## Self-Review Before Implementation

### Spec coverage

| Requirement | Task(s) |
| --- | --- |
| Remove reset diagnostic, retain SPA rewrite/auth behavior | 1, 2 |
| Audit temporary debug and localhost/test references | 1, 2 |
| Full tests, typecheck, build, auth-route compilation | Shared commands after every task |
| Documentation and conditional v0.6.1 decision | 2 |
| Separate 6.1 commit | 2 |
| Original slash/impact/critical/death/particle art, no MapleStory | 4 |
| Presentation isolated from Phaser-dependent simulation | 3, 5, 6 |
| Event contract for normal/critical/miss/enemy death | 3 |
| Damage numbers, dual HP bars, limited shake | 5, 6, 7 |
| Pooling, fallback, reduced motion, no duplicate death | 5, 6, 8 |
| Gameplay/save invariance | 3, 7, 8 |
| No inventory/backend/schema/secrets | Global constraints, Tasks 7 and 8 scope audits |
| Manual QA and risks | 8 |

### Placeholder scan

Task 0 Step 2 is the required scan. This plan specifies exact file paths, APIs, test commands, expected results, geometry, timings, asset families, and commit messages.

### Type consistency check

- CombatPresentationEvent is defined once in src/game/presentation/combatPresentationEvents.ts.
- CombatAdvanceResult is returned only by advanceWithPresentation; legacy advance still returns CombatEvent[].
- CampaignController.consumePresentationEvents returns readonly CombatPresentationEvent[] and remains optional solely for existing fake campaign test doubles; the real persistent controller implements it.
- CombatEffectKey is used by the manifest, controller, and Phaser port.
- HealthInterpolationState is the only HP display ratio state and is clamped before drawing.

## Execution Handoff

The user explicitly chose Subagent-Driven execution. Use superpowers:subagent-driven-development in this isolated main worktree, dispatch a fresh subagent for each numbered task, review code and test evidence before the next task, and preserve the Milestone 6.1-first order and commits above.
