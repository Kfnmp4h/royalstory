# RoyalStory Milestone 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a responsive React and Phaser combat sandbox in which Ari and Mossling fight automatically, recover safely from deaths, and pause and resume with browser visibility for at least ten simulated minutes without invalid state.

**Architecture:** A pure TypeScript combat engine owns rules and state, while a Phaser scene renders snapshots and events. React owns application lifecycle, diagnostics, and Page Visibility wiring; neither React nor Phaser calculates combat outcomes.

**Tech Stack:** Node.js 24, pnpm 11, Vite 7, React 19, TypeScript 5, Phaser 3, Vitest 3, Testing Library, jsdom.

## Global Constraints

- Implement only RoyalStory Milestone 1; do not add stages, progression, skills, equipment, persistence, backend, accounts, or offline rewards.
- Use the predefined character **Ari** and the original enemy **Mossling**.
- Draw all visuals in code; do not import MapleStory or other third-party game assets.
- Keep all combat numbers in `src/game/balance.ts`.
- Keep the combat engine independent of React, Phaser, DOM APIs, and wall-clock APIs.
- Player resurrection is exactly 3,000 ms; enemy replacement is exactly 1,200 ms.
- Hidden browser time must not advance combat.
- The scene must fit a 360 px-wide viewport without horizontal scrolling.
- Follow test-driven development: every behavioral production change begins with a test that is observed failing for the expected reason.
- Use the bundled pnpm executable at `C:\Users\alshiha\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd` when `pnpm` is not on `PATH`.

---

## Planned File Structure

```text
.
├── index.html                         # Vite HTML entry
├── package.json                       # Scripts and dependency ranges
├── pnpm-lock.yaml                     # Exact resolved dependency graph
├── tsconfig.json                      # TypeScript project references
├── tsconfig.app.json                  # Browser TypeScript settings
├── tsconfig.node.json                 # Vite config TypeScript settings
├── vite.config.ts                     # Vite and Vitest configuration
├── src/
│   ├── main.tsx                       # React entry
│   ├── App.tsx                        # Page composition and error boundary state
│   ├── App.test.tsx                   # Application lifecycle integration tests
│   ├── styles.css                     # Responsive presentation
│   ├── test/setup.ts                  # jest-dom matchers and cleanup
│   └── game/
│       ├── balance.ts                 # Immutable Milestone 1 numbers
│       ├── balance.test.ts            # Balance contract tests
│       ├── types.ts                   # Engine snapshots, events, and configs
│       ├── combatEngine.ts            # Pure deterministic state machine
│       ├── combatEngine.test.ts       # Rules, recovery, pause, and soak tests
│       ├── visibilityController.ts    # Page Visibility adapter
│       ├── visibilityController.test.ts
│       └── phaser/
│           ├── BattleScene.ts         # Drawing, animation, and engine adapter
│           ├── battleGame.ts          # Phaser.Game lifecycle facade
│           └── battleGame.test.ts     # Mount/destroy lifecycle test
└── docs/superpowers/                  # Approved design and this plan
```

## Public Interfaces

The following signatures are fixed for all tasks:

```ts
export type ActorId = 'player' | 'enemy';
export type CombatPhase = 'fighting' | 'enemy-defeated' | 'player-defeated';

export interface CombatantConfig {
  id: ActorId;
  name: string;
  maxHp: number;
  damage: number;
  attackIntervalMs: number;
}

export interface CombatBalance {
  sliceMs: number;
  maxFrameContributionMs: number;
  enemyRespawnMs: number;
  playerRespawnMs: number;
  player: CombatantConfig;
  enemy: CombatantConfig;
}

export interface CombatantSnapshot extends CombatantConfig {
  hp: number;
  alive: boolean;
}

export interface CombatSnapshot {
  phase: CombatPhase;
  paused: boolean;
  activeRuntimeMs: number;
  totalAttacks: number;
  defeatedEnemies: number;
  recoveryRemainingMs: number;
  player: CombatantSnapshot;
  enemy: CombatantSnapshot;
}

export type CombatEvent =
  | { type: 'attack'; attacker: ActorId; target: ActorId }
  | { type: 'damage'; target: ActorId; amount: number; hp: number }
  | { type: 'death'; actor: ActorId }
  | { type: 'respawn'; actor: ActorId }
  | { type: 'pause' }
  | { type: 'resume' };

export interface CombatEngine {
  advance(elapsedMs: number): CombatEvent[];
  pause(): CombatEvent[];
  resume(): CombatEvent[];
  getSnapshot(): CombatSnapshot;
}

export function createCombatEngine(
  balance?: CombatBalance,
): CombatEngine;

export interface BattleController {
  setPaused(paused: boolean): void;
  destroy(): void;
}

export interface BattleStatus {
  snapshot: CombatSnapshot;
  state: 'running' | 'paused';
}

export function createBattleGame(options: {
  parent: HTMLElement;
  onStatus: (status: BattleStatus) => void;
  onError: (error: Error) => void;
}): BattleController;
```

---

### Task 1: Bootstrap the Tested React Application

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/App.test.tsx`
- Create: `src/App.tsx`
- Create: `src/main.tsx`
- Create: `src/styles.css`

**Interfaces:**
- Produces: a renderable `App` component and working `test`, `typecheck`, and `build` scripts.

- [ ] **Step 1: Add package and tool configuration**

Create `package.json` with scripts `dev`, `test`, `test:watch`, `typecheck`, and `build`; use dependency ranges `react@^19.0.0`, `react-dom@^19.0.0`, `phaser@^3.90.0`, `vite@^7.0.0`, `vitest@^3.2.0`, `typescript@^5.8.0`, `@vitejs/plugin-react@^5.0.0`, `jsdom@^26.1.0`, Testing Library, and React type packages. Configure Vitest for `jsdom`, globals, `src/test/setup.ts`, and automatic mock restoration.

Run:

```powershell
& 'C:\Users\alshiha\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' install
```

Expected: exit code 0 and a new `pnpm-lock.yaml`.

- [ ] **Step 2: Write the first failing application test**

```tsx
// src/App.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('introduces the RoyalStory combat sandbox', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'RoyalStory' })).toBeInTheDocument();
    expect(screen.getByText('Milestone 1 · Combat Sandbox')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the test and observe the expected failure**

Run:

```powershell
& 'C:\Users\alshiha\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' test -- src/App.test.tsx
```

Expected: FAIL because `src/App.tsx` does not exist.

- [ ] **Step 4: Add the minimal React entry and shell**

```tsx
// src/App.tsx
export function App() {
  return (
    <main className="app-shell">
      <header className="hero-header">
        <p className="eyebrow">Milestone 1 · Combat Sandbox</p>
        <h1>RoyalStory</h1>
      </header>
    </main>
  );
}
```

```tsx
// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
);
```

Add a valid Vite `index.html`, TypeScript project-reference configs, the Vitest setup importing `@testing-library/jest-dom/vitest` and `cleanup`, and minimal CSS defining the page background and typography.

- [ ] **Step 5: Verify the application test, type check, and build**

Run:

```powershell
& 'C:\Users\alshiha\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' test -- src/App.test.tsx
& 'C:\Users\alshiha\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' typecheck
& 'C:\Users\alshiha\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' build
```

Expected: one passing test, clean type check, and Vite build exit code 0.

- [ ] **Step 6: Commit**

```powershell
git add package.json pnpm-lock.yaml index.html tsconfig*.json vite.config.ts src
git commit -m "chore: bootstrap RoyalStory combat sandbox"
```

If `.git` remains read-only, record the exact failure and continue without rewriting history.

---

### Task 2: Define Balance and Combat Contracts

**Files:**
- Create: `src/game/balance.test.ts`
- Create: `src/game/types.ts`
- Create: `src/game/balance.ts`

**Interfaces:**
- Produces: every interface in **Public Interfaces** through `types.ts` except `createCombatEngine` and battle-game interfaces.
- Produces: `COMBAT_BALANCE: Readonly<CombatBalance>`.

- [ ] **Step 1: Write the failing balance contract test**

```ts
import { describe, expect, it } from 'vitest';
import { COMBAT_BALANCE } from './balance';

describe('COMBAT_BALANCE', () => {
  it('keeps every Milestone 1 combat number in one immutable contract', () => {
    expect(COMBAT_BALANCE).toMatchObject({
      sliceMs: 100,
      maxFrameContributionMs: 250,
      enemyRespawnMs: 1_200,
      playerRespawnMs: 3_000,
      player: { id: 'player', name: 'Ari', maxHp: 120, damage: 18, attackIntervalMs: 900 },
      enemy: { id: 'enemy', name: 'Mossling', maxHp: 90, damage: 9, attackIntervalMs: 1_300 },
    });
    expect(Object.isFrozen(COMBAT_BALANCE)).toBe(true);
    expect(Object.isFrozen(COMBAT_BALANCE.player)).toBe(true);
    expect(Object.isFrozen(COMBAT_BALANCE.enemy)).toBe(true);
  });
});
```

- [ ] **Step 2: Verify the test fails because the balance module is absent**

Run: `pnpm test -- src/game/balance.test.ts`

Expected: FAIL resolving `./balance`.

- [ ] **Step 3: Implement the contracts and immutable balance**

Create `types.ts` with the combat types from **Public Interfaces**. Create `balance.ts`:

```ts
import type { CombatBalance } from './types';

export const COMBAT_BALANCE: Readonly<CombatBalance> = Object.freeze({
  sliceMs: 100,
  maxFrameContributionMs: 250,
  enemyRespawnMs: 1_200,
  playerRespawnMs: 3_000,
  player: Object.freeze({ id: 'player', name: 'Ari', maxHp: 120, damage: 18, attackIntervalMs: 900 }),
  enemy: Object.freeze({ id: 'enemy', name: 'Mossling', maxHp: 90, damage: 9, attackIntervalMs: 1_300 }),
});
```

- [ ] **Step 4: Verify the contract test passes**

Run: `pnpm test -- src/game/balance.test.ts`

Expected: one passing test.

- [ ] **Step 5: Commit**

```powershell
git add src/game/types.ts src/game/balance.ts src/game/balance.test.ts
git commit -m "feat: define combat balance contract"
```

---

### Task 3: Implement Automatic Attacks and Damage

**Files:**
- Create: `src/game/combatEngine.test.ts`
- Create: `src/game/combatEngine.ts`

**Interfaces:**
- Consumes: `CombatBalance`, `CombatEngine`, `CombatEvent`, and `CombatSnapshot` from `types.ts`.
- Produces: `createCombatEngine(balance?: CombatBalance): CombatEngine`.

- [ ] **Step 1: Write failing tests for interval timing and damage**

```ts
import { describe, expect, it } from 'vitest';
import { createCombatEngine } from './combatEngine';

describe('createCombatEngine', () => {
  it('waits for Ari attack interval before damaging Mossling', () => {
    const engine = createCombatEngine();
    expect(engine.advance(899)).toEqual([]);
    expect(engine.getSnapshot().enemy.hp).toBe(90);

    expect(engine.advance(1)).toEqual([
      { type: 'attack', attacker: 'player', target: 'enemy' },
      { type: 'damage', target: 'enemy', amount: 18, hp: 72 },
    ]);
    expect(engine.getSnapshot().totalAttacks).toBe(1);
  });

  it('lets Mossling attack on its independent interval', () => {
    const engine = createCombatEngine();
    engine.advance(1_300);
    expect(engine.getSnapshot().player.hp).toBe(111);
    expect(engine.getSnapshot().enemy.hp).toBe(72);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 0, -1])(
    'ignores invalid elapsed time %s',
    (elapsed) => {
      const engine = createCombatEngine();
      expect(engine.advance(elapsed)).toEqual([]);
      expect(engine.getSnapshot().activeRuntimeMs).toBe(0);
    },
  );
});
```

- [ ] **Step 2: Run the tests and observe the expected missing-module failure**

Run: `pnpm test -- src/game/combatEngine.test.ts`

Expected: FAIL resolving `./combatEngine`.

- [ ] **Step 3: Implement the fighting phase only**

Implement `createCombatEngine` as a closure that stores mutable internal combatants, two attack accumulators, counters, phase, pause state, and recovery time. `advance` must slice elapsed time by `balance.sliceMs`, resolve Ari before Mossling in each slice, emit attack then damage, clamp HP, and return copies from `getSnapshot`. Do not implement death recovery in this task; setting HP to zero is allowed but no respawn event is emitted yet.

The attack helper must be equivalent to:

```ts
const attack = (attackerId: ActorId, events: CombatEvent[]) => {
  const attacker = attackerId === 'player' ? player : enemy;
  const target = attackerId === 'player' ? enemy : player;
  if (!attacker.alive || !target.alive) return;
  totalAttacks += 1;
  events.push({ type: 'attack', attacker: attacker.id, target: target.id });
  target.hp = Math.max(0, target.hp - attacker.damage);
  events.push({ type: 'damage', target: target.id, amount: attacker.damage, hp: target.hp });
  if (target.hp === 0) target.alive = false;
};
```

- [ ] **Step 4: Verify attack tests pass and all existing tests remain green**

Run: `pnpm test`

Expected: all tests pass with no warnings.

- [ ] **Step 5: Commit**

```powershell
git add src/game/combatEngine.ts src/game/combatEngine.test.ts
git commit -m "feat: add deterministic automatic combat"
```

---

### Task 4: Add Death, Recovery, Pause, and Soak Stability

**Files:**
- Modify: `src/game/combatEngine.test.ts`
- Modify: `src/game/combatEngine.ts`

**Interfaces:**
- Extends the existing `CombatEngine`; no public signature changes.

- [ ] **Step 1: Add failing death and recovery tests**

Add a `makeBalance` test helper that clones `COMBAT_BALANCE` and accepts partial player/enemy/delay overrides. Add tests that assert:

```ts
it('emits one enemy death and replaces Mossling after 1,200 ms', () => {
  const engine = createCombatEngine(makeBalance({ player: { damage: 90 } }));
  expect(engine.advance(900)).toContainEqual({ type: 'death', actor: 'enemy' });
  expect(engine.getSnapshot()).toMatchObject({ phase: 'enemy-defeated', defeatedEnemies: 1 });
  expect(engine.advance(1_199)).not.toContainEqual({ type: 'respawn', actor: 'enemy' });
  expect(engine.advance(1)).toContainEqual({ type: 'respawn', actor: 'enemy' });
  expect(engine.getSnapshot()).toMatchObject({ phase: 'fighting', enemy: { hp: 90, alive: true } });
});

it('resurrects Ari after 3 seconds and resets Mossling health', () => {
  const engine = createCombatEngine(makeBalance({ enemy: { damage: 120, attackIntervalMs: 100 } }));
  expect(engine.advance(100)).toContainEqual({ type: 'death', actor: 'player' });
  expect(engine.advance(2_999)).not.toContainEqual({ type: 'respawn', actor: 'player' });
  expect(engine.advance(1)).toContainEqual({ type: 'respawn', actor: 'player' });
  expect(engine.getSnapshot()).toMatchObject({
    phase: 'fighting',
    player: { hp: 120, alive: true },
    enemy: { hp: 90, alive: true },
  });
});
```

- [ ] **Step 2: Run and confirm failures are caused by missing death events and recovery phases**

Run: `pnpm test -- src/game/combatEngine.test.ts`

Expected: FAIL on missing `death` and `respawn` events.

- [ ] **Step 3: Implement explicit recovery phases**

When damage reaches zero, emit exactly one death event, set `phase`, set `recoveryRemainingMs`, reset both attack accumulators, and increment `defeatedEnemies` only for enemy death. While recovering, decrement only the recovery timer. At zero, restore the dead actor and emit one respawn event. Player recovery also resets enemy HP and alive state. Carry no unused recovery time into a new fighting phase.

- [ ] **Step 4: Add failing pause, deterministic-order, and ten-minute soak tests**

```ts
it('pauses idempotently and excludes paused time', () => {
  const engine = createCombatEngine();
  expect(engine.pause()).toEqual([{ type: 'pause' }]);
  expect(engine.pause()).toEqual([]);
  engine.advance(60_000);
  expect(engine.getSnapshot().activeRuntimeMs).toBe(0);
  expect(engine.resume()).toEqual([{ type: 'resume' }]);
  expect(engine.resume()).toEqual([]);
  engine.advance(900);
  expect(engine.getSnapshot().enemy.hp).toBe(72);
});

it('resolves Ari first when both attacks are due and cancels a dead Mossling attack', () => {
  const engine = createCombatEngine(makeBalance({
    player: { damage: 90, attackIntervalMs: 100 },
    enemy: { damage: 120, attackIntervalMs: 100 },
  }));
  const events = engine.advance(100);
  expect(events).toContainEqual({ type: 'death', actor: 'enemy' });
  expect(events).not.toContainEqual({ type: 'attack', attacker: 'enemy', target: 'player' });
  expect(engine.getSnapshot().player.hp).toBe(120);
});

it('runs ten simulated minutes without invalid or locked state', () => {
  const engine = createCombatEngine();
  for (let elapsed = 0; elapsed < 600_000; elapsed += 250) {
    engine.advance(250);
    const state = engine.getSnapshot();
    for (const actor of [state.player, state.enemy]) {
      expect(Number.isFinite(actor.hp)).toBe(true);
      expect(actor.hp).toBeGreaterThanOrEqual(0);
      expect(actor.hp).toBeLessThanOrEqual(actor.maxHp);
    }
    expect(state.recoveryRemainingMs).toBeGreaterThanOrEqual(0);
  }
  const finalState = engine.getSnapshot();
  expect(finalState.activeRuntimeMs).toBe(600_000);
  expect(finalState.defeatedEnemies).toBeGreaterThan(0);
  expect(finalState.totalAttacks).toBeGreaterThan(0);
});
```

- [ ] **Step 5: Run and confirm pause/soak failures before implementation**

Run: `pnpm test -- src/game/combatEngine.test.ts`

Expected: FAIL because `pause` and `resume` are incomplete.

- [ ] **Step 6: Implement pause and resume, then verify the full engine suite**

Implement idempotent `pause` and `resume`, prevent `advance` mutations while paused, and include paused state in snapshots.

Run: `pnpm test -- src/game/combatEngine.test.ts`

Expected: all engine tests pass, including the 600,000 ms soak test.

- [ ] **Step 7: Commit**

```powershell
git add src/game/combatEngine.ts src/game/combatEngine.test.ts
git commit -m "feat: stabilize combat death and recovery loop"
```

---

### Task 5: Build the Phaser Scene and Lifecycle Facade

**Files:**
- Create: `src/game/phaser/BattleScene.ts`
- Create: `src/game/phaser/battleGame.test.ts`
- Create: `src/game/phaser/battleGame.ts`

**Interfaces:**
- Consumes: `createCombatEngine`, `COMBAT_BALANCE`, `CombatEvent`, and `CombatSnapshot`.
- Produces: `BattleController`, `BattleStatus`, and `createBattleGame` from **Public Interfaces**.

- [ ] **Step 1: Write a failing lifecycle facade test**

Use Vitest to mock only the external `phaser` constructor boundary. Return a fake scene manager whose `getScene('battle')` returns a fake battle scene with `setCombatPaused`. Assert that `createBattleGame` passes the supplied parent to exactly one `Phaser.Game`; `setPaused(true)` calls `battleScene.setCombatPaused(true)` before `scene.pause('battle')`; `setPaused(false)` calls `battleScene.setCombatPaused(false)` before `scene.resume('battle')`; and `destroy()` calls `game.destroy(true)` once.

Run: `pnpm test -- src/game/phaser/battleGame.test.ts`

Expected: FAIL resolving `./battleGame`.

- [ ] **Step 2: Implement the lifecycle facade**

```ts
export function createBattleGame({ parent, onStatus, onError }: CreateBattleGameOptions): BattleController {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 960,
    height: 540,
    transparent: true,
    render: { antialias: true },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [new BattleScene(onStatus, onError)],
  });
  let destroyed = false;
  return {
    setPaused(paused) {
      if (destroyed) return;
      const battleScene = game.scene.getScene('battle') as BattleScene;
      battleScene.setCombatPaused(paused);
      paused ? game.scene.pause('battle') : game.scene.resume('battle');
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      game.destroy(true);
    },
  };
}
```

- [ ] **Step 3: Run the lifecycle test and observe it pass**

Run: `pnpm test -- src/game/phaser/battleGame.test.ts`

Expected: lifecycle test passes.

- [ ] **Step 4: Implement `BattleScene` rendering and event animation**

Create a scene with key `battle`. In `create`, draw a sky gradient approximation with full-width rectangles, three parallax-style hill layers, trees, clouds, and a ground strip. Draw Ari and Mossling in separate containers using Phaser Graphics primitives. Add name labels and health bars. Retain references to both containers, both health-bar fill graphics, and status text.

Expose `setCombatPaused(paused: boolean)`. It must call `engine.pause()` or `engine.resume()`, publish the resulting snapshot through `onStatus`, and be idempotent through the engine contract. In `update`, pass `Math.min(delta, COMBAT_BALANCE.maxFrameContributionMs)` to the engine inside `try/catch`; redraw health widths from the returned snapshot; convert events as follows:

- `attack`: tween the attacker container 22 px toward the opponent and back.
- `damage`: show a floating `-${amount}` text at the target and tint/alpha-flash its container.
- `death`: tween the actor to alpha `0` and y `+18`.
- `respawn`: restore alpha, position, and scale with a short ease-out tween.
- `pause` and `resume`: do not animate; status is handled by React.

Throttle `onStatus` to at most four updates per second. On exception, stop further engine advancement and call `onError(error instanceof Error ? error : new Error(String(error)))` exactly once.

- [ ] **Step 5: Verify type safety and all automated tests**

Run:

```powershell
pnpm typecheck
pnpm test
```

Expected: exit code 0 for both commands.

- [ ] **Step 6: Commit**

```powershell
git add src/game/phaser
git commit -m "feat: render the RoyalStory battle scene"
```

---

### Task 6: Wire React Status and Browser Visibility

**Files:**
- Create: `src/game/visibilityController.test.ts`
- Create: `src/game/visibilityController.ts`
- Modify: `src/App.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `createBattleGame` and `BattleController`.
- Produces: `subscribeToVisibility(document, onChange): () => void`.

- [ ] **Step 1: Write the failing visibility adapter test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { subscribeToVisibility } from './visibilityController';

describe('subscribeToVisibility', () => {
  it('reports initial and changed hidden state and cleans up', () => {
    const listeners = new Set<EventListener>();
    const source = {
      hidden: false,
      addEventListener: (_: string, listener: EventListener) => listeners.add(listener),
      removeEventListener: (_: string, listener: EventListener) => listeners.delete(listener),
    } as unknown as Document;
    const onChange = vi.fn();
    const unsubscribe = subscribeToVisibility(source, onChange);
    expect(onChange).toHaveBeenLastCalledWith(false);
    Object.defineProperty(source, 'hidden', { value: true, configurable: true });
    listeners.forEach((listener) => listener(new Event('visibilitychange')));
    expect(onChange).toHaveBeenLastCalledWith(true);
    unsubscribe();
    expect(listeners.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run and confirm the missing-module failure**

Run: `pnpm test -- src/game/visibilityController.test.ts`

Expected: FAIL resolving `./visibilityController`.

- [ ] **Step 3: Implement the visibility adapter**

```ts
export function subscribeToVisibility(
  source: Document,
  onChange: (hidden: boolean) => void,
): () => void {
  const report = () => onChange(source.hidden);
  source.addEventListener('visibilitychange', report);
  report();
  return () => source.removeEventListener('visibilitychange', report);
}
```

- [ ] **Step 4: Verify the visibility adapter passes**

Run: `pnpm test -- src/game/visibilityController.test.ts`

Expected: one passing test.

- [ ] **Step 5: Add failing React lifecycle and status tests**

Mock `createBattleGame` at its module boundary with a fake controller. Assert that `App` supplies one `.battle-host` element, destroys the controller on unmount, maps a visibility callback to `setPaused`, displays `Running`, and changes to a visible error alert when `onError(new Error('engine failed'))` is invoked.

Run: `pnpm test -- src/App.test.tsx`

Expected: FAIL because `App` has no battle host or status panel.

- [ ] **Step 6: Implement the React bridge and diagnostics**

`App` must use one ref for the host, one effect to create/destroy the battle game, and one effect to subscribe/unsubscribe visibility. Store the controller in a ref. Store `BattleStatus | null` and `Error | null` in React state. Render:

- `.battle-host` with accessible label `RoyalStory automatic battle`.
- A status chip showing `Starting`, `Running`, `Paused`, or `Error`.
- Active runtime formatted as `mm:ss`.
- Total attacks and defeated Mosslings.
- `role="alert"` containing the error message when present.

On visibility change, call both `controller.setPaused(hidden)` and update the displayed status immediately. Do not recreate the Phaser game on status changes.

- [ ] **Step 7: Verify React, visibility, and full suites**

Run:

```powershell
pnpm test -- src/App.test.tsx src/game/visibilityController.test.ts
pnpm test
pnpm typecheck
```

Expected: all tests pass and the type checker exits 0.

- [ ] **Step 8: Commit**

```powershell
git add src/App.tsx src/App.test.tsx src/game/visibilityController*
git commit -m "feat: connect combat lifecycle to browser visibility"
```

---

### Task 7: Complete Responsive Styling and Browser Verification

**Files:**
- Modify: `src/styles.css`
- Modify: `src/App.test.tsx`
- Modify: `README.md` if created during Task 1; otherwise create it.

**Interfaces:**
- Consumes: existing semantic markup and class names.
- Produces: documented run and verification workflow.

- [ ] **Step 1: Add a failing semantic presentation test**

Extend `App.test.tsx` to assert that the battle area is inside a region named `Automatic battle` and the diagnostic values are inside a region named `Combat diagnostics`.

Run: `pnpm test -- src/App.test.tsx`

Expected: FAIL until the two regions have accessible names.

- [ ] **Step 2: Add semantic regions and final responsive CSS**

Apply these layout rules:

- `html`, `body`, and `#root` have `min-width: 320px`, full-height support, and no horizontal overflow.
- `.app-shell` uses a centered max width of `1180px` with `16px` mobile padding and `28px` desktop padding.
- `.battle-card` has a `16 / 9` aspect ratio, `overflow: hidden`, rounded corners, and a minimum usable height without exceeding the viewport.
- `.battle-host` and its canvas fill the card; canvas uses `display: block`.
- `.diagnostics` is a four-column grid on wide screens and a two-column grid below `640px`.
- Text meets readable contrast; focus outlines are visible; animation is disabled under `prefers-reduced-motion` where CSS controls it.
- No element is wider than the viewport at 360 px.

Add `aria-label="Automatic battle"` and `aria-label="Combat diagnostics"` to the two regions.

- [ ] **Step 3: Verify tests and production build**

Run:

```powershell
pnpm test
pnpm typecheck
pnpm build
```

Expected: all tests pass, type check exits 0, and `dist/` is generated.

- [ ] **Step 4: Start the local app and verify mobile presentation**

Run `pnpm dev -- --host 127.0.0.1`, open the reported localhost URL, and inspect at a 360 × 800 viewport. Confirm:

- Entire battle scene visible.
- No horizontal scrollbar.
- Ari left and Mossling right.
- HP bars and names readable.
- Automatic attacks, damage numbers, death, and replacement visible.
- Diagnostic counters update.

- [ ] **Step 5: Verify desktop and visibility behavior**

Inspect at 1440 × 900. Confirm centered layout, crisp scene scaling, and readable diagnostics. Hide the tab long enough that an attack would normally occur, then return. Confirm `Paused` was shown, HP and counters did not advance during hidden time, and combat resumes cleanly.

- [ ] **Step 6: Document usage and Milestone 1 boundaries**

Create `README.md` with:

- Project purpose.
- Requirements: Node 24 and pnpm 11.
- Commands: `pnpm install`, `pnpm dev`, `pnpm test`, `pnpm typecheck`, `pnpm build`.
- Milestone 1 features.
- Explicit exclusions matching **Global Constraints**.
- A note that all current visuals are original code-drawn placeholders.

- [ ] **Step 7: Run the final verification gate from a clean process**

Stop the dev server, then run:

```powershell
pnpm test
pnpm typecheck
pnpm build
git diff --check
```

Expected: zero failing tests, zero TypeScript errors, build exit code 0, and no whitespace errors.

- [ ] **Step 8: Re-read the design acceptance criteria**

Compare every acceptance criterion in `docs/superpowers/specs/2026-07-14-royalstory-milestone-1-design.md` against test output and the browser checks. Record any unmet criterion as incomplete; do not start Milestone 2.

- [ ] **Step 9: Commit**

```powershell
git add src/styles.css src/App.tsx src/App.test.tsx README.md
git commit -m "feat: complete RoyalStory milestone 1"
```

---

## Completion Evidence to Report

The implementation handoff must include:

- Test command and exact passing-test count.
- Type-check command and exit status.
- Production-build command and exit status.
- Ten-minute simulation result, including final defeated-enemy and attack counts.
- Mobile and desktop viewport results.
- Page-visibility pause/resume result.
- Any Git commit failure caused by the workspace `.git` permission lock.
- A statement that Milestone 2 was not started.
