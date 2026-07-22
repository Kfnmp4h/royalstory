# Native Impact Sprites Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render `impact-basic` and `impact-critical` through the existing native Canvas overlay while preserving all non-sprite combat presentation.

**Architecture:** Expand the existing native-effect routing allowlist, then generalize `nativeCombatSpriteRenderer` from one slash image and animation to exactly three manifest-backed effect keys. Keep one Canvas, one explicit scene-delta clock, stable draw order, isolated per-key loading failures, and the existing battle lifecycle.

**Tech Stack:** TypeScript 5.8, DOM Canvas 2D, Phaser 3.90 presentation adapter, Vitest 3.2, jsdom, Vite 7.

## Global Constraints

- Follow strict RED-GREEN-REFACTOR; observe every new test fail for the intended missing behavior before editing production code.
- Preserve gameplay, event order, critical feedback, damage text, actor flash, HP interpolation, camera shake, enemy death, persistence, React input, and battle lifecycle.
- Native keys are exactly `slash-basic`, `impact-basic`, and `impact-critical`.
- `enemy-death` and `death-particles` remain Phaser-backed.
- Reuse `COMBAT_EFFECT_MANIFEST` values unchanged.
- Use only the existing clamped explicit scene delta; add no timers or animation loop.
- Push verified commits directly to GitHub `main` and verify the resulting Vercel production deployment.
- Compare full-suite results with the documented baseline failures: the App background-sync timeout, Dismantle dialog cancel count, and two suites missing `phaser3spectorjs`.

## File Structure

- Modify `src/game/phaser/combatPresentation/PhaserCombatPresentationPort.test.ts` for native impact routing coverage.
- Modify `src/game/phaser/combatPresentation/PhaserCombatPresentationPort.ts` to recognize the exact native-key allowlist.
- Modify `src/game/phaser/CombatBattleScene.test.ts` to lock scene routing for all three native keys and Phaser fallback for death effects.
- Modify `src/game/phaser/CombatBattleScene.ts` to call the generalized native renderer method.
- Modify `src/game/rendering/nativeCombatSpriteRenderer.test.ts` for multi-effect timing, geometry, concurrency, failure isolation, replacement, and teardown.
- Modify `src/game/rendering/nativeCombatSpriteRenderer.ts` to load and render exactly three manifest-backed effects.

---

### Task 1: Route Both Impact Sprites to the Native Renderer

**Files:**
- Modify: `src/game/phaser/combatPresentation/PhaserCombatPresentationPort.test.ts`
- Modify: `src/game/phaser/combatPresentation/PhaserCombatPresentationPort.ts`
- Modify: `src/game/phaser/CombatBattleScene.test.ts`
- Modify: `src/game/phaser/CombatBattleScene.ts`

**Interfaces:**
- Consumes: `CombatEffectKey`, actor positions, and the existing `playNativeEffect` hook.
- Produces: exported `NATIVE_COMBAT_EFFECT_KEYS` and `NativeCombatEffectKey`; native renderer method `playEffect(key, x, y)`.

- [ ] **Step 1: Write failing port routing tests**

Replace the slash-only test with a table-driven assertion:

```ts
it.each(['slash-basic', 'impact-basic', 'impact-critical'] as const)(
  'routes %s to the native renderer without creating a Phaser sprite',
  (key) => {
    const options = createOptions();
    options.playNativeEffect.mockImplementation((candidate) => candidate === key);
    const port = createPhaserCombatPresentationPort(options);

    expect(port.hasEffect(key)).toBe(true);
    port.playEffect(key, key === 'slash-basic' ? 'player' : 'enemy');

    expect(options.playNativeEffect).toHaveBeenCalledWith(key, 690, 282);
    expect(options.createSprite).not.toHaveBeenCalled();
  },
);
```

Add a separate assertion that `enemy-death` still uses `animationExists` and `createSprite` when registered.

- [ ] **Step 2: Write the failing scene routing test**

Update the fake native renderer to expose `playEffect`. Assert:

```ts
expect(options.playNativeEffect('slash-basic', 270, 414)).toBe(true);
expect(options.playNativeEffect('impact-basic', 690, 414)).toBe(true);
expect(options.playNativeEffect('impact-critical', 690, 414)).toBe(true);
expect(options.playNativeEffect('enemy-death', 690, 414)).toBe(false);
expect(options.playNativeEffect('death-particles', 690, 414)).toBe(false);
expect(nativeRenderer.playEffect.mock.calls).toEqual([
  ['slash-basic', 270, 414],
  ['impact-basic', 690, 414],
  ['impact-critical', 690, 414],
]);
```

- [ ] **Step 3: Run focused tests and verify RED**

```powershell
.\node_modules\.bin\vitest.CMD run src/game/phaser/combatPresentation/PhaserCombatPresentationPort.test.ts src/game/phaser/CombatBattleScene.test.ts --pool=threads --maxWorkers=1 --minWorkers=1
```

Expected: impact routing assertions fail because only slash is currently native and the renderer exposes only `playSlash`.

- [ ] **Step 4: Commit the verified RED tests**

```powershell
git add src/game/phaser/combatPresentation/PhaserCombatPresentationPort.test.ts src/game/phaser/CombatBattleScene.test.ts
git commit -m "test: require native impact sprite routing"
```

- [ ] **Step 5: Implement the exact native-key contract**

In `nativeCombatSpriteRenderer.ts`, export:

```ts
export const NATIVE_COMBAT_EFFECT_KEYS = [
  'slash-basic',
  'impact-basic',
  'impact-critical',
] as const;

export type NativeCombatEffectKey = typeof NATIVE_COMBAT_EFFECT_KEYS[number];

export const isNativeCombatEffectKey = (key: CombatEffectKey): key is NativeCombatEffectKey => (
  NATIVE_COMBAT_EFFECT_KEYS.includes(key as NativeCombatEffectKey)
);
```

Change the renderer interface from `playSlash(x, y)` to:

```ts
playEffect(key: NativeCombatEffectKey, x: number, y: number): void;
```

In `PhaserCombatPresentationPort.hasEffect`, replace the slash literal with `isNativeCombatEffectKey(key)`. In `CombatBattleScene`, call `nativeRenderer.playEffect(key, x, y)` only after the same guard returns true.

- [ ] **Step 6: Verify GREEN**

Run the Step 3 command. Expected: all port and scene tests pass, including Phaser fallback for death effects.

- [ ] **Step 7: Commit minimal routing**

```powershell
git add src/game/rendering/nativeCombatSpriteRenderer.ts src/game/phaser/combatPresentation/PhaserCombatPresentationPort.ts src/game/phaser/CombatBattleScene.ts src/game/phaser/CombatBattleScene.test.ts src/game/phaser/combatPresentation/PhaserCombatPresentationPort.test.ts
git commit -m "feat: route impact sprites to native renderer"
```

---

### Task 2: Generalize Native Sprite Loading and Drawing

**Files:**
- Modify: `src/game/rendering/nativeCombatSpriteRenderer.test.ts`
- Modify: `src/game/rendering/nativeCombatSpriteRenderer.ts`

**Interfaces:**
- Consumes: `NATIVE_COMBAT_EFFECT_KEYS`, manifest definitions, existing Canvas and Image dependency factories.
- Produces: independent load and animation state per native effect key with stable multi-effect drawing.

- [ ] **Step 1: Generalize the test harness without changing production behavior**

Make `createImage` return a new fake image per call and store them by creation order matching `NATIVE_COMBAT_EFFECT_KEYS`. Expose:

```ts
const images = {
  'slash-basic': createdImages[0],
  'impact-basic': createdImages[1],
  'impact-critical': createdImages[2],
};
```

Update existing slash tests to call `renderer.playEffect('slash-basic', 270, 414)`.

- [ ] **Step 2: Add failing basic-impact geometry and timing test**

```ts
renderer.playEffect('impact-basic', 690, 414);
images['impact-basic'].onload?.(new Event('load'));
expect(drawImage).toHaveBeenLastCalledWith(
  images['impact-basic'], 0, 0, 32, 32, 658, 312, 64, 64,
);

renderer.advance(1_000 / 24);
expect(drawImage).toHaveBeenLastCalledWith(
  images['impact-basic'], 32, 0, 32, 32, 658, 312, 64, 64,
);
```

- [ ] **Step 3: Add failing critical-impact geometry and lifetime test**

Assert frame zero draws to `636, 290` with destination size `108 by 108`, frame one uses source x `48`, and the effect is absent after `4 * (1_000 / 24)` milliseconds.

- [ ] **Step 4: Add failing concurrency, replacement, and failure-isolation tests**

Cover separately:

```ts
it('draws slash and impact simultaneously in stable key order');
it('replaces only an animation with the same effect key');
it('keeps other native effects running when one asset fails');
it('detaches all three image callback pairs on destroy');
```

For stable order, load slash and basic impact, start both, clear the spy, advance once, and assert slash `drawImage` precedes basic impact. For replacement, start basic impact twice at different positions and assert only the second position draws. For failure isolation, fail basic impact, then load and play slash and assert slash still draws while `onError` receives exactly one basic-impact URL error.

- [ ] **Step 5: Run renderer tests and verify RED**

```powershell
.\node_modules\.bin\vitest.CMD run src/game/rendering/nativeCombatSpriteRenderer.test.ts --pool=threads --maxWorkers=1 --minWorkers=1
```

Expected: FAIL because the renderer still owns one slash image and one active slash.

- [ ] **Step 6: Commit the verified RED tests**

```powershell
git add src/game/rendering/nativeCombatSpriteRenderer.test.ts
git commit -m "test: define native impact sprite animation"
```

- [ ] **Step 7: Implement minimal per-key renderer state**

Create one runtime entry per native key:

```ts
interface NativeEffectRuntime {
  readonly image: HTMLImageElement;
  loaded: boolean;
  failed: boolean;
  active?: ActiveEffect;
}

const runtimes = new Map<NativeCombatEffectKey, NativeEffectRuntime>();
```

Create and load images in `NATIVE_COMBAT_EFFECT_KEYS` order. Each `onload` marks only that runtime loaded and redraws. Each `onerror` reports once for only that key and removes only that key's active animation.

`playEffect` replaces `runtime.active` for the requested key. `advance` increments all active non-failed runtimes by `Math.max(0, deltaMs)`, removes completed animations, then calls `render()` once. `render` clears once and iterates `NATIVE_COMBAT_EFFECT_KEYS`, drawing each loaded active runtime with its own manifest geometry.

`destroy` clears the map's active state, detaches every image callback, removes the Canvas once, and keeps later calls harmless.

- [ ] **Step 8: Verify GREEN**

Run the Step 5 command. Expected: all slash and impact renderer tests pass.

- [ ] **Step 9: Commit generalized renderer**

```powershell
git add src/game/rendering/nativeCombatSpriteRenderer.ts src/game/rendering/nativeCombatSpriteRenderer.test.ts
git commit -m "feat: render impact sprites on native canvas"
```

---

### Task 3: Regression Verification and Direct Delivery

**Files:**
- Verify only: all changed source and test files.

**Interfaces:**
- Consumes: completed Tasks 1-2.
- Produces: verified GitHub `main` and terminal Vercel production deployment.

- [ ] **Step 1: Run focused migration and presentation tests**

```powershell
.\node_modules\.bin\vitest.CMD run src/game/rendering/nativeCombatSpriteRenderer.test.ts src/game/phaser/combatPresentation/PhaserCombatPresentationPort.test.ts src/game/phaser/CombatBattleScene.test.ts src/game/phaser/battleGame.test.ts src/game/phaser/combatPresentation/CombatPresentationController.test.ts --pool=threads --maxWorkers=1 --minWorkers=1
```

Expected: PASS, including unchanged critical damage, health, death, and lifecycle assertions.

- [ ] **Step 2: Run TypeScript verification**

```powershell
.\node_modules\.bin\tsc.CMD -b --pretty false
```

Expected: exit code 0 with no diagnostics.

- [ ] **Step 3: Run production build**

```powershell
.\node_modules\.bin\vite.CMD build
```

Expected: exit code 0 and successful Vite output.

- [ ] **Step 4: Run the full suite for baseline comparison**

```powershell
.\node_modules\.bin\vitest.CMD run --pool=threads --maxWorkers=1 --minWorkers=1
```

Expected: no new failures beyond the four documented baseline failures named in Global Constraints.

- [ ] **Step 5: Inspect scope and commit sequence**

```powershell
git diff origin/main...HEAD --check
git status --short --branch
git log --oneline origin/main..HEAD
```

Expected: only the six planned source/test files differ and RED/GREEN commits remain separate.

- [ ] **Step 6: Fast-forward and push `main`**

From the main checkout, fast-forward to the verified feature branch and push:

```powershell
git merge --ff-only feat/native-impact-sprites
git push origin main
```

- [ ] **Step 7: Verify Vercel production**

Find the Vercel production deployment whose Git SHA matches the pushed HEAD. Wait until `READY` or `ERROR`. On `READY`, scan runtime error clusters for the last hour and report the production aliases. On `ERROR`, inspect build logs and report the blocker without claiming delivery.

## Plan Self-Review

- Spec coverage: both impact effects, unchanged metadata, concurrency, same-key replacement, isolated failure, routing fallback, timing, teardown, and deployment have explicit tasks.
- Scope: no gameplay, death, text, health, camera, input, or lifecycle migration is included.
- Type consistency: `NativeCombatEffectKey`, `NATIVE_COMBAT_EFFECT_KEYS`, `isNativeCombatEffectKey`, and `playEffect` match across tasks.
- Placeholder scan: no deferred implementation or unspecified validation remains.
