# Native Player Attack Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Animate Ari's player attacks from the supplied 25-frame spritesheet on the existing native Canvas overlay while preserving combat behavior and every non-character presentation path.

**Architecture:** Add a focused metadata parser for the supplied JSON, then extend the existing native renderer with one independently failing player-animation runtime. Route only player `attack_started` events through the presentation port; hide only Ari's generated Phaser figure while Canvas owns the character image, leaving the shadow, name, and health visible.

**Tech Stack:** TypeScript, Vitest, JSDOM, HTML Canvas 2D, Phaser 3, Vite

## Global Constraints

- Animate only Ari; the enemy presentation remains unchanged.
- Use the same character animation for normal hits, critical hits, and misses.
- Read frames `0` through `24` in numeric order from the supplied JSON.
- Scale the complete sequence to exactly 550 ms without changing combat timing.
- Preserve slash/impact effects, damage text, health, flashes, shake, death, input, persistence, and battle lifecycle.
- Asset or metadata failure must retain the Phaser fallback and must not block combat.
- Follow strict RED-GREEN-REFACTOR and commit each independently verified behavior.

## File Structure

- Create `public/assets/characters/base-male-attack.png`: supplied spritesheet.
- Create `public/assets/characters/base-male-attack.json`: supplied metadata.
- Create `src/game/rendering/playerAttackSprite.ts`: metadata types, validation, ordering, and frame selection.
- Create `src/game/rendering/playerAttackSprite.test.ts`: parser and proportional timing tests.
- Modify `src/game/rendering/nativeCombatSpriteRenderer.ts`: player asset loading, playback, drawing, completion, fallback, and teardown.
- Modify `src/game/rendering/nativeCombatSpriteRenderer.test.ts`: renderer integration and failure tests.
- Modify `src/game/phaser/combatPresentation/CombatPresentationController.ts`: route `attack_started` to a narrow port method.
- Modify `src/game/phaser/combatPresentation/CombatPresentationController.test.ts`: player-only routing and shared outcome behavior.
- Modify `src/game/phaser/CombatBattleScene.ts`: bridge native playback and Phaser figure visibility.
- Modify `src/game/phaser/CombatBattleScene.test.ts`: scene routing, figure visibility, completion, and enemy fallback.
- Modify `src/game/phaser/BattleScene.ts`: retain a private reference to Ari's generated figure for scoped visibility changes.
- Modify `src/game/phaser/battleGame.test.ts`: update the native renderer fake interface if required.

---

### Task 1: Validate and Select Supplied Attack Frames

**Files:**
- Create: `public/assets/characters/base-male-attack.png`
- Create: `public/assets/characters/base-male-attack.json`
- Create: `src/game/rendering/playerAttackSprite.ts`
- Create: `src/game/rendering/playerAttackSprite.test.ts`

**Interfaces:**
- Consumes: JSON with `frames` keyed by numeric strings and `meta.size` / `meta.frame_size`.
- Produces: `parsePlayerAttackMetadata(value: unknown): PlayerAttackMetadata` and `selectPlayerAttackFrame(metadata, elapsedMs): PlayerAttackFrame | undefined`.

- [ ] **Step 1: Copy the supplied assets without transforming them**

```powershell
New-Item -ItemType Directory -Force public/assets/characters
Copy-Item -LiteralPath 'C:/Users/alshiha/Downloads/Base Male-attack.png' -Destination 'public/assets/characters/base-male-attack.png'
Copy-Item -LiteralPath 'C:/Users/alshiha/Downloads/Base Male-attack-v1.json' -Destination 'public/assets/characters/base-male-attack.json'
```

Verify the PNG is 1280×1280 and the JSON declares 25 frames of 256×256.

- [ ] **Step 2: Write failing parser and timing tests**

```ts
import { describe, expect, it } from 'vitest';
import { parsePlayerAttackMetadata, selectPlayerAttackFrame } from './playerAttackSprite';

const source = {
  frames: Object.fromEntries(Array.from({ length: 25 }, (_, index) => [String(index), {
    x: (index % 5) * 256,
    y: Math.floor(index / 5) * 256,
    w: 256,
    h: 256,
    duration: 1,
  }])),
  meta: { size: { w: 1280, h: 1280 }, frame_size: { w: 256, h: 256 } },
};

describe('playerAttackSprite', () => {
  it('orders all 25 numeric frames across the five-by-five grid', () => {
    const metadata = parsePlayerAttackMetadata(source);
    expect(metadata.frames).toHaveLength(25);
    expect(metadata.frames[0]).toMatchObject({ x: 0, y: 0, width: 256, height: 256 });
    expect(metadata.frames[5]).toMatchObject({ x: 0, y: 256, width: 256, height: 256 });
    expect(metadata.frames[24]).toMatchObject({ x: 1024, y: 1024, width: 256, height: 256 });
  });

  it('selects frame zero initially, the final frame before 550 ms, then completes', () => {
    const metadata = parsePlayerAttackMetadata(source);
    expect(selectPlayerAttackFrame(metadata, 0)).toBe(metadata.frames[0]);
    expect(selectPlayerAttackFrame(metadata, 549)).toBe(metadata.frames[24]);
    expect(selectPlayerAttackFrame(metadata, 550)).toBeUndefined();
  });

  it('rejects missing, non-contiguous, or non-256-square frames', () => {
    expect(() => parsePlayerAttackMetadata({ frames: {}, meta: {} }))
      .toThrow('Invalid player attack metadata');
  });
});
```

- [ ] **Step 3: Run RED and confirm the module is missing**

Run:

```powershell
.\node_modules\.bin\vitest.CMD run src/game/rendering/playerAttackSprite.test.ts --pool=threads --maxWorkers=1 --minWorkers=1
```

Expected: FAIL because `playerAttackSprite` cannot be resolved.

- [ ] **Step 4: Implement the smallest parser and selector**

```ts
export const PLAYER_ATTACK_DURATION_MS = 550;

export interface PlayerAttackFrame {
  readonly x: number;
  readonly y: number;
  readonly width: 256;
  readonly height: 256;
}

export interface PlayerAttackMetadata {
  readonly frames: readonly PlayerAttackFrame[];
}

export function parsePlayerAttackMetadata(value: unknown): PlayerAttackMetadata {
  const source = value as { frames?: Record<string, { x?: unknown; y?: unknown; w?: unknown; h?: unknown }> };
  const frames = Array.from({ length: 25 }, (_, index) => source.frames?.[String(index)]);
  if (frames.some((frame) => !frame
    || !Number.isFinite(frame.x) || !Number.isFinite(frame.y)
    || frame.w !== 256 || frame.h !== 256)) {
    throw new Error('Invalid player attack metadata');
  }
  return {
    frames: frames.map((frame) => ({
      x: frame!.x as number,
      y: frame!.y as number,
      width: 256,
      height: 256,
    })),
  };
}

export function selectPlayerAttackFrame(
  metadata: PlayerAttackMetadata,
  elapsedMs: number,
): PlayerAttackFrame | undefined {
  if (elapsedMs < 0 || elapsedMs >= PLAYER_ATTACK_DURATION_MS) return undefined;
  const index = Math.min(
    metadata.frames.length - 1,
    Math.floor((elapsedMs / PLAYER_ATTACK_DURATION_MS) * metadata.frames.length),
  );
  return metadata.frames[index];
}
```

- [ ] **Step 5: Run GREEN and commit**

Expected: 3 tests PASS.

```powershell
git add public/assets/characters src/game/rendering/playerAttackSprite.ts src/game/rendering/playerAttackSprite.test.ts
git commit -m "feat: define native player attack frames"
```

### Task 2: Render the Player Animation with Safe Fallback

**Files:**
- Modify: `src/game/rendering/nativeCombatSpriteRenderer.ts`
- Modify: `src/game/rendering/nativeCombatSpriteRenderer.test.ts`

**Interfaces:**
- Consumes: `parsePlayerAttackMetadata`, `selectPlayerAttackFrame`, PNG URL, JSON URL.
- Produces: `playPlayerAttack(x: number, y: number, onComplete: () => void): boolean` on `NativeCombatSpriteRenderer`.

- [ ] **Step 1: Extend the test harness and write failing geometry/lifetime tests**

Inject metadata loading so tests do not use the network:

```ts
loadPlayerAttackMetadata: vi.fn(async () => validMetadataSource),
```

After resolving the metadata promise and firing the fourth image's `onload`, assert:

```ts
const complete = vi.fn();
expect(renderer.playPlayerAttack(270, 414, complete)).toBe(true);
expect(drawImage).toHaveBeenLastCalledWith(
  playerImage, 0, 0, 256, 256, 142, 158, 256, 256,
);

renderer.advance(549);
expect(drawImage).toHaveBeenLastCalledWith(
  playerImage, 1024, 1024, 256, 256, 142, 158, 256, 256,
);
expect(complete).not.toHaveBeenCalled();

renderer.advance(1);
expect(complete).toHaveBeenCalledOnce();
```

The destination uses center-x and bottom-y anchoring (`x - 128`, `y - 256`) and does not alter effect coordinates.

- [ ] **Step 2: Run RED**

Expected: TypeScript/test failure because `loadPlayerAttackMetadata` and `playPlayerAttack` do not exist.

- [ ] **Step 3: Implement independent loading and playback**

Add dependency and API signatures:

```ts
loadPlayerAttackMetadata(): Promise<unknown>;
playPlayerAttack(x: number, y: number, onComplete: () => void): boolean;
```

Default loading:

```ts
loadPlayerAttackMetadata: async () => {
  const response = await fetch('assets/characters/base-male-attack.json');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
},
```

Create a fourth image with `src = 'assets/characters/base-male-attack.png'`. Keep `{ imageLoaded, metadata, failed, active }` separate from effect runtimes. `playPlayerAttack` returns `false` until both assets are ready or after failure. Otherwise it replaces the current active animation, calls the replaced completion callback once, starts at elapsed zero, renders, and returns `true`.

Draw the character before `NATIVE_COMBAT_EFFECT_KEYS`, using:

```ts
context.drawImage(image, frame.x, frame.y, 256, 256, x - 128, y - 256, 256, 256);
```

At 550 ms, clear the active runtime and call `onComplete` exactly once.

- [ ] **Step 4: Add failure, restart, stable-layer, and teardown tests**

Assert all of the following:

```ts
expect(renderer.playPlayerAttack(270, 414, complete)).toBe(false); // not ready
expect(onError).toHaveBeenCalledWith(new Error(
  'Failed to load native player attack metadata: Invalid player attack metadata',
));
```

- PNG and JSON failures each report once and do not stop slash playback.
- Re-trigger completes the replaced callback once and restarts at frame zero.
- Character draws before simultaneously active slash and impact frames.
- `destroy()` completes an active callback once, detaches the fourth image, and remains idempotent.

- [ ] **Step 5: Run GREEN and commit**

Run both renderer test files; expected: PASS.

```powershell
git add src/game/rendering/nativeCombatSpriteRenderer.ts src/game/rendering/nativeCombatSpriteRenderer.test.ts
git commit -m "feat: render native player attack animation"
```

### Task 3: Route Player Attack Starts and Hide Only Ari's Figure

**Files:**
- Modify: `src/game/phaser/combatPresentation/CombatPresentationController.ts`
- Modify: `src/game/phaser/combatPresentation/CombatPresentationController.test.ts`
- Modify: `src/game/phaser/CombatBattleScene.ts`
- Modify: `src/game/phaser/CombatBattleScene.test.ts`
- Modify: `src/game/phaser/BattleScene.ts`
- Modify: `src/game/phaser/battleGame.test.ts`

**Interfaces:**
- Consumes: `NativeCombatSpriteRenderer.playPlayerAttack(x, y, onComplete): boolean`.
- Produces: `CombatPresentationPort.playPlayerAttack(actorId: ActorId): void` and scene-owned fallback visibility.

- [ ] **Step 1: Write a failing controller routing test**

Extend the fake port with `playerAttacks: ActorId[]` and:

```ts
playPlayerAttack: (actorId) => playerAttacks.push(actorId),
```

Then assert:

```ts
controller.present([
  { type: 'attack_started', actorId: 'player', targetId: 'enemy', timestampMs: 100 },
  { type: 'attack_started', actorId: 'enemy', targetId: 'player', timestampMs: 200 },
]);
expect(fake.playerAttacks).toEqual(['player']);
```

Also present `attack_started` followed separately by normal-hit, critical-hit, and miss outcomes; assert one identical animation trigger per start and no additional trigger from the outcome event.

- [ ] **Step 2: Run RED, then implement minimal controller routing**

Add to `CombatPresentationPort`:

```ts
playPlayerAttack(actorId: ActorId): void;
```

Handle the event:

```ts
case 'attack_started':
  if (event.actorId === 'player') port.playPlayerAttack(event.actorId);
  break;
```

Run the controller test; expected: PASS. Commit:

```powershell
git add src/game/phaser/combatPresentation/CombatPresentationController.ts src/game/phaser/combatPresentation/CombatPresentationController.test.ts
git commit -m "feat: route player attack presentation"
```

- [ ] **Step 3: Write failing scene visibility and fallback tests**

Update native renderer fakes with `playPlayerAttack: vi.fn(() => true)`. Assert the scene option:

```ts
expect(options.playPlayerAttack('player')).toBeUndefined();
expect(nativeRenderer.playPlayerAttack).toHaveBeenCalledWith(270, 414, expect.any(Function));
expect(playerFigure.setVisible).toHaveBeenCalledWith(false);
```

Invoke the captured completion and expect `playerFigure.setVisible(true)`. When native playback returns `false`, expect no hide. An enemy call must neither invoke native playback nor change visibility.

- [ ] **Step 4: Expose only Ari's figure internally and implement the bridge**

In `BattleScene`, retain the generated `figure`:

```ts
private playerFigure?: Phaser.GameObjects.Graphics;
// after drawAri()
this.playerFigure = player.figure;
```

Change `drawAri` to return `{ container, healthFill, figure }`. Add `playerFigure` to `BattleSceneInternals`.

Add `playPlayerAttack(actorId)` to `PhaserCombatPresentationPortOptions` and pass it through unchanged from the port. In `CombatBattleScene`:

```ts
playPlayerAttack: (actorId) => {
  if (actorId !== 'player' || !this.nativeRenderer) return;
  const internals = this.getInternals();
  const figure = internals.playerFigure;
  const position = this.getActorContainer('player') ?? PLAYER_POSITION;
  const started = this.nativeRenderer.playPlayerAttack(position.x, position.y, () => {
    figure?.setVisible(true);
  });
  if (started) figure?.setVisible(false);
},
```

Use `{ x: container.x, y: container.y }` rather than the container object if TypeScript requires the narrow coordinate type.

- [ ] **Step 5: Run focused scene/controller/game tests and commit**

```powershell
.\node_modules\.bin\vitest.CMD run src/game/phaser/combatPresentation/CombatPresentationController.test.ts src/game/phaser/combatPresentation/PhaserCombatPresentationPort.test.ts src/game/phaser/CombatBattleScene.test.ts src/game/phaser/battleGame.test.ts --pool=threads --maxWorkers=1 --minWorkers=1
```

Expected: PASS with player-only routing, Ari visibility restoration, and unchanged enemy behavior.

```powershell
git add src/game/phaser/BattleScene.ts src/game/phaser/CombatBattleScene.ts src/game/phaser/CombatBattleScene.test.ts src/game/phaser/battleGame.test.ts src/game/phaser/combatPresentation/CombatPresentationController.ts src/game/phaser/combatPresentation/CombatPresentationController.test.ts src/game/phaser/combatPresentation/PhaserCombatPresentationPort.ts src/game/phaser/combatPresentation/PhaserCombatPresentationPort.test.ts
git commit -m "feat: present Ari attacks on native canvas"
```

### Task 4: Verify and Deliver the Slice

**Files:**
- Verify all files changed in Tasks 1–3.

**Interfaces:**
- Consumes: completed slice.
- Produces: verified GitHub `main` commit and successful Vercel production deployment.

- [ ] **Step 1: Run focused regression tests**

```powershell
.\node_modules\.bin\vitest.CMD run src/game/rendering/playerAttackSprite.test.ts src/game/rendering/nativeCombatSpriteRenderer.test.ts src/game/phaser/combatPresentation/CombatPresentationController.test.ts src/game/phaser/combatPresentation/PhaserCombatPresentationPort.test.ts src/game/phaser/CombatBattleScene.test.ts src/game/phaser/battleGame.test.ts --pool=threads --maxWorkers=1 --minWorkers=1
```

Expected: all focused tests PASS.

- [ ] **Step 2: Run static verification and production build**

```powershell
.\node_modules\.bin\tsc.CMD -b
.\node_modules\.bin\vite.CMD build
```

Expected: both exit 0; only the existing Vite large-chunk warning is allowed.

- [ ] **Step 3: Run the full suite and compare with the documented baseline**

```powershell
.\node_modules\.bin\vitest.CMD run --pool=threads --maxWorkers=1 --minWorkers=1
```

Expected: no new failures. The previously documented App timeout, DismantleConfirmDialog assertion, and two `phaser3spectorjs` loading failures may remain and must be reported rather than concealed.

- [ ] **Step 4: Review the exact scope**

```powershell
git diff origin/main...HEAD --check
git status --short --branch
git log --oneline origin/main..HEAD
```

Expected: only planned assets, parser, renderer, and presentation files; no diff errors.

- [ ] **Step 5: Fast-forward `main`, push, and verify production**

Fast-forward the verified branch into `main`, push to GitHub, wait for the matching Vercel commit to become `READY`, and confirm no new runtime error cluster for the deployment. Verify local `main` is clean and equals `origin/main` before reporting delivery.
