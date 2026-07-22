# Native Slash Sprite Migration Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render `slash-basic` through a project-owned Canvas sprite renderer while preserving the current Phaser scene, gameplay loop, and all other combat presentation.

**Architecture:** Add a narrow native-effect hook to the existing Phaser presentation port, then implement one Canvas renderer with explicit delta-driven spritesheet timing. `createBattleGame` owns the overlay lifecycle and injects the renderer into `CombatBattleScene`; Phaser remains responsible for the game loop, scene, other effects, text, health, tweens, scaling, and camera shake.

**Tech Stack:** TypeScript 5.8, DOM Canvas 2D, React 19 host lifecycle, Phaser 3.90, Vitest 3.2, jsdom, Vite 7.

## Global Constraints

- Follow strict RED-GREEN-REFACTOR: no production code before observing the corresponding test fail for the intended missing behavior.
- Preserve campaign, combat, progression, equipment, reward, persistence, and presentation-event behavior.
- Do not rewrite `BattleScene`, replace `Phaser.Game`, or remove the Phaser dependency.
- Route only `slash-basic` through native Canvas; every other effect remains Phaser-backed.
- Reuse `COMBAT_EFFECT_MANIFEST['slash-basic']` without changing its URL, frame size, frame count, frame rate, origin, scale, or animation key.
- Use only explicit clamped scene delta for native animation time; do not add `requestAnimationFrame`, timers, or wall-clock reads.
- Keep the overlay decorative and non-interactive with `aria-hidden="true"` and `pointer-events: none`.
- Keep commits small and push every verified user-facing change according to `AGENTS.md`.

## File Structure

- Modify `src/game/phaser/combatPresentation/PhaserCombatPresentationPort.ts` only to add the native effect routing seam.
- Modify `src/game/phaser/combatPresentation/PhaserCombatPresentationPort.test.ts` to lock native slash routing and Phaser fallback behavior.
- Create `src/game/rendering/nativeCombatSpriteRenderer.ts` for Canvas mounting, image loading, sprite state, deterministic frame advancement, drawing, failure reporting, and teardown.
- Create `src/game/rendering/nativeCombatSpriteRenderer.test.ts` for renderer behavior with fake canvas and image dependencies.
- Modify `src/game/phaser/CombatBattleScene.ts` to inject, route, and advance the native renderer.
- Modify `src/game/phaser/CombatBattleScene.test.ts` to prove scene-level routing and explicit delta forwarding.
- Modify `src/game/phaser/battleGame.ts` to create and destroy one native renderer with the battle controller.
- Modify `src/game/phaser/battleGame.test.ts` to prove overlay lifecycle remains single-instance and idempotent.
- Modify `src/styles.css` to stack the transparent overlay over the Phaser canvas without changing battle-host sizing.

---

### Task 1: Add a Native Effect Routing Seam

**Files:**
- Modify: `src/game/phaser/combatPresentation/PhaserCombatPresentationPort.test.ts`
- Modify: `src/game/phaser/combatPresentation/PhaserCombatPresentationPort.ts`

**Interfaces:**
- Consumes: existing `CombatEffectKey`, actor positions, and Phaser sprite factory.
- Produces: `playNativeEffect(key: CombatEffectKey, x: number, y: number): boolean` in `PhaserCombatPresentationPortOptions`; `true` means the native renderer accepted the effect and Phaser must not create a duplicate sprite.

- [ ] **Step 1: Write the failing native-routing test**

Add `playNativeEffect: vi.fn(() => false)` to `createOptions`, then add:

```ts
it('routes slash-basic to the native effect renderer without creating a Phaser sprite', () => {
  const options = createOptions();
  options.playNativeEffect.mockReturnValue(true);
  const port = createPhaserCombatPresentationPort(options);

  expect(port.hasEffect('slash-basic')).toBe(true);
  port.playEffect('slash-basic', 'player');

  expect(options.getActorPosition).toHaveBeenCalledWith('player');
  expect(options.playNativeEffect).toHaveBeenCalledWith('slash-basic', 690, 282);
  expect(options.createSprite).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
pnpm exec vitest run src/game/phaser/combatPresentation/PhaserCombatPresentationPort.test.ts --pool=threads --maxWorkers=1 --minWorkers=1
```

Expected: FAIL because `playNativeEffect` is not part of the options and `hasEffect('slash-basic')` still depends on Phaser's animation registry.

- [ ] **Step 3: Commit the verified RED test**

```powershell
git add src/game/phaser/combatPresentation/PhaserCombatPresentationPort.test.ts
git commit -m "test: require native slash effect routing"
```

- [ ] **Step 4: Implement the minimum routing seam**

Add to `PhaserCombatPresentationPortOptions`:

```ts
playNativeEffect(key: CombatEffectKey, x: number, y: number): boolean;
```

Change the two effect methods to:

```ts
hasEffect(key): boolean {
  return key === 'slash-basic'
    || options.animationExists(COMBAT_EFFECT_MANIFEST[key].animationKey);
},

playEffect(key, actorId): void {
  const definition = COMBAT_EFFECT_MANIFEST[key];
  const position = options.getActorPosition(actorId);
  if (options.playNativeEffect(key, position.x, position.y)) return;
  if (!options.animationExists(definition.animationKey)) return;

  const sprite = options.createSprite(position.x, position.y, definition.key);
  sprite.setOrigin(definition.origin.x, definition.origin.y);
  sprite.setScale(definition.scale);
  sprite.setDepth(EFFECT_DEPTH);
  sprite.play(definition.animationKey);
  sprite.once('animationcomplete', () => sprite.destroy());
},
```

Update existing test option factories in `PhaserCombatPresentationPort.test.ts` and `CombatBattleScene.test.ts` with `playNativeEffect: vi.fn(() => false)` so non-slash effects retain their Phaser path.

- [ ] **Step 5: Verify GREEN and unchanged Phaser fallback**

Run:

```powershell
pnpm exec vitest run src/game/phaser/combatPresentation/PhaserCombatPresentationPort.test.ts src/game/phaser/CombatBattleScene.test.ts --pool=threads --maxWorkers=1 --minWorkers=1
```

Expected: PASS; the new slash test does not call `createSprite`, while the existing `impact-basic` test still creates and animates its Phaser sprite.

- [ ] **Step 6: Commit the minimal routing implementation**

```powershell
git add src/game/phaser/combatPresentation/PhaserCombatPresentationPort.ts src/game/phaser/combatPresentation/PhaserCombatPresentationPort.test.ts src/game/phaser/CombatBattleScene.test.ts
git commit -m "feat: route slash effect to native renderer"
```

---

### Task 2: Build the Deterministic Native Canvas Sprite Renderer

**Files:**
- Create: `src/game/rendering/nativeCombatSpriteRenderer.test.ts`
- Create: `src/game/rendering/nativeCombatSpriteRenderer.ts`

**Interfaces:**
- Consumes: a host `HTMLElement`, `COMBAT_EFFECT_MANIFEST['slash-basic']`, a Canvas factory, an Image factory, and an error callback.
- Produces:

```ts
export interface NativeCombatSpriteRenderer {
  playSlash(x: number, y: number): void;
  advance(deltaMs: number): void;
  destroy(): void;
}

export interface NativeCombatSpriteRendererDependencies {
  createCanvas(): HTMLCanvasElement;
  createImage(): HTMLImageElement;
}

export function createNativeCombatSpriteRenderer(options: {
  parent: HTMLElement;
  onError: (error: Error) => void;
  dependencies?: NativeCombatSpriteRendererDependencies;
}): NativeCombatSpriteRenderer;
```

- [ ] **Step 1: Write failing renderer timing and teardown tests**

Create fakes for `CanvasRenderingContext2D.drawImage`, `clearRect`, a canvas whose `getContext('2d')` returns the fake context, and an image whose `src`, `onload`, and `onerror` are controllable. Cover these behaviors in separate tests:

```ts
it('draws slash frame zero immediately and advances frames from explicit delta');
it('removes slash after the final frame duration');
it('queues at most one slash until the image loads');
it('reports image failure once without throwing from advance');
it('removes its canvas and ignores calls after destroy');
```

For the first test, assert the initial and advanced source rectangles exactly:

```ts
renderer.playSlash(270, 414);
image.onload?.(new Event('load'));
expect(drawImage).toHaveBeenLastCalledWith(image, 0, 0, 48, 48, 222, 296, 96, 96);

renderer.advance(50);
expect(drawImage).toHaveBeenLastCalledWith(image, 48, 0, 48, 48, 222, 296, 96, 96);
```

The destination uses the existing 70-pixel effect offset plus centered 96-by-96 scaled output: `x - 48`, `y - 70 - 48`.

- [ ] **Step 2: Run the renderer test and verify RED**

Run:

```powershell
pnpm exec vitest run src/game/rendering/nativeCombatSpriteRenderer.test.ts --pool=threads --maxWorkers=1 --minWorkers=1
```

Expected: FAIL with an unresolved `./nativeCombatSpriteRenderer` module.

- [ ] **Step 3: Commit the verified RED tests**

```powershell
git add src/game/rendering/nativeCombatSpriteRenderer.test.ts
git commit -m "test: define native slash sprite timing"
```

- [ ] **Step 4: Implement the minimum Canvas renderer**

Implement one active-or-pending slash. Use `frameDurationMs = 1_000 / definition.frameRate`, set `canvas.width = 960`, `canvas.height = 540`, `canvas.className = 'native-combat-overlay'`, and `canvas.setAttribute('aria-hidden', 'true')`. Load `definition.url` once.

`playSlash` replaces the current slash with `{ x, y, elapsedMs: 0 }`. `advance` adds `Math.max(0, deltaMs)`. Rendering must clear the full canvas, calculate `frameIndex = Math.floor(elapsedMs / frameDurationMs)`, remove the slash when `frameIndex >= definition.frameCount`, and otherwise call:

```ts
context.drawImage(
  image,
  frameIndex * definition.frameWidth,
  0,
  definition.frameWidth,
  definition.frameHeight,
  x - (definition.frameWidth * definition.scale * definition.origin.x),
  y - 70 - (definition.frameHeight * definition.scale * definition.origin.y),
  definition.frameWidth * definition.scale,
  definition.frameHeight * definition.scale,
);
```

If image loading fails, report `new Error('Failed to load native combat sprite: assets/combat/slash-basic.png')` once, discard pending state, and keep later methods harmless. `destroy` is idempotent, removes the canvas, clears sprite state, and detaches image callbacks.

- [ ] **Step 5: Verify GREEN**

Run:

```powershell
pnpm exec vitest run src/game/rendering/nativeCombatSpriteRenderer.test.ts --pool=threads --maxWorkers=1 --minWorkers=1
```

Expected: PASS with deterministic frame-source and destination assertions.

- [ ] **Step 6: Commit the renderer implementation**

```powershell
git add src/game/rendering/nativeCombatSpriteRenderer.ts src/game/rendering/nativeCombatSpriteRenderer.test.ts
git commit -m "feat: add native canvas slash renderer"
```

---

### Task 3: Integrate the Overlay Without Changing Battle Behavior

**Files:**
- Modify: `src/game/phaser/CombatBattleScene.test.ts`
- Modify: `src/game/phaser/CombatBattleScene.ts`
- Modify: `src/game/phaser/battleGame.test.ts`
- Modify: `src/game/phaser/battleGame.ts`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `NativeCombatSpriteRenderer` from Task 2 and the native hook from Task 1.
- Produces: one overlay per `createBattleGame`, native slash routing at the current actor position, clamped delta advancement, and exactly-once teardown.

- [ ] **Step 1: Write failing scene integration tests**

In `CombatBattleScene.test.ts`, provide a fake native renderer:

```ts
const nativeRenderer = {
  playSlash: vi.fn(),
  advance: vi.fn(),
  destroy: vi.fn(),
};
```

Construct `new CombatBattleScene(onStatus, onError, nativeRenderer)`. Add tests proving:

```ts
it('routes only slash-basic to the native renderer at the current player position');
it('advances the native renderer with the clamped presentation delta');
```

For routing, obtain the scene's presentation port options after `create`, request a slash through the presentation controller, and assert `playSlash(270, 414)` while the Phaser sprite factory is untouched. For timing, call `scene.update(0, COMBAT_BALANCE.maxFrameContributionMs + 500)` and assert `nativeRenderer.advance(COMBAT_BALANCE.maxFrameContributionMs)`.

- [ ] **Step 2: Write the failing battle lifecycle test**

Mock `createNativeCombatSpriteRenderer` in `battleGame.test.ts`. Extend the existing lifecycle test to assert:

```ts
expect(createNativeCombatSpriteRenderer).toHaveBeenCalledOnce();
expect(createNativeCombatSpriteRenderer).toHaveBeenCalledWith({ parent, onError });
controller.destroy();
controller.destroy();
expect(nativeRenderer.destroy).toHaveBeenCalledOnce();
```

Also assert the `CombatBattleScene` registered with Phaser received the same renderer instance.

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```powershell
pnpm exec vitest run src/game/phaser/CombatBattleScene.test.ts src/game/phaser/battleGame.test.ts --pool=threads --maxWorkers=1 --minWorkers=1
```

Expected: FAIL because `CombatBattleScene` does not accept or advance a native renderer and `createBattleGame` does not create one.

- [ ] **Step 4: Commit the verified RED integration tests**

```powershell
git add src/game/phaser/CombatBattleScene.test.ts src/game/phaser/battleGame.test.ts
git commit -m "test: require native slash overlay lifecycle"
```

- [ ] **Step 5: Implement the minimum scene integration**

Add an optional third constructor parameter to `CombatBattleScene`:

```ts
constructor(
  onStatus: (status: BattleStatus) => void,
  onError: (error: Error) => void,
  private readonly nativeRenderer?: NativeCombatSpriteRenderer,
) {
  super(onStatus, onError);
}
```

In `createPresentationPortOptions`, add:

```ts
playNativeEffect: (key, x, y) => {
  if (key !== 'slash-basic' || !this.nativeRenderer) return false;
  this.nativeRenderer.playSlash(x, y);
  return true;
},
```

At the end of `update`, use the already calculated clamped delta for both presentation systems:

```ts
const presentationDelta = Math.min(delta, COMBAT_BALANCE.maxFrameContributionMs);
this.presentation.advance(presentationDelta);
this.nativeRenderer?.advance(presentationDelta);
```

- [ ] **Step 6: Implement battle ownership and overlay stacking**

In `battleGame.ts`, create the renderer before the scene, pass it into `CombatBattleScene`, and destroy it exactly once before `game.destroy(true)`:

```ts
const nativeRenderer = createNativeCombatSpriteRenderer({ parent, onError });
const battleScene = new CombatBattleScene(onStatus, onError, nativeRenderer);
```

```ts
nativeRenderer.destroy();
game.destroy(true);
```

Add these focused rules to `src/styles.css` near the existing battle host styles:

```css
.battle-host {
  position: relative;
}

.native-combat-overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
```

- [ ] **Step 7: Verify focused GREEN**

Run:

```powershell
pnpm exec vitest run src/game/rendering/nativeCombatSpriteRenderer.test.ts src/game/phaser/combatPresentation/PhaserCombatPresentationPort.test.ts src/game/phaser/CombatBattleScene.test.ts src/game/phaser/battleGame.test.ts --pool=threads --maxWorkers=1 --minWorkers=1
```

Expected: PASS. Existing impact, critical, miss, health, enemy-death, state-replacement, pause, resume, and destruction assertions remain green.

- [ ] **Step 8: Commit the minimal integration**

```powershell
git add src/game/phaser/CombatBattleScene.ts src/game/phaser/CombatBattleScene.test.ts src/game/phaser/battleGame.ts src/game/phaser/battleGame.test.ts src/styles.css
git commit -m "feat: render slash on native canvas overlay"
```

---

### Task 4: Full Verification and Delivery

**Files:**
- Verify only: all changed source and test files.

**Interfaces:**
- Consumes: completed Tasks 1-3.
- Produces: evidence that the migration slice preserves the whole application contract.

- [ ] **Step 1: Run the complete test suite**

```powershell
pnpm test
```

Expected: every Vitest file passes with no unhandled errors or warnings introduced by the native renderer.

- [ ] **Step 2: Run static type verification**

```powershell
pnpm typecheck
```

Expected: exit code 0 with no TypeScript diagnostics.

- [ ] **Step 3: Run the production build**

```powershell
pnpm build
```

Expected: exit code 0 and a successful Vite production bundle.

- [ ] **Step 4: Inspect the final diff and repository state**

```powershell
git diff origin/main...HEAD --check
git status --short --branch
git log --oneline origin/main..HEAD
```

Expected: no whitespace errors, only planned files changed, and the RED/GREEN commit sequence is visible.

- [ ] **Step 5: Push the verified commits**

```powershell
git push origin main
git status --short --branch
```

Expected: `main` tracks `origin/main` with a clean working tree.

## Plan Self-Review

- Spec coverage: native slash routing, unchanged metadata, explicit timing, overlay lifecycle, failure reporting, teardown, and Phaser preservation are each assigned to a test-first task.
- Scope: only one effect migrates; Phaser boot, scene ownership, gameplay, input, other effects, camera, and health remain unchanged.
- Type consistency: `NativeCombatSpriteRenderer`, `playNativeEffect`, and constructor signatures match across producing and consuming tasks.
- Placeholder scan: the plan contains no deferred implementation or unspecified error handling.
