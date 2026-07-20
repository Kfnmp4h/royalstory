# Phaser State Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the existing Phaser game mounted when a server save changes and replace its campaign state in place.

**Architecture:** Add `replaceState(state)` to `BattleController`. The method swaps the scene's campaign controller for one restored from the canonical server state, then redraws and publishes the new snapshot. `App` creates Phaser only once and uses a second effect to call `replaceState` whenever `record.state.campaign` changes.

**Tech Stack:** React 19, TypeScript, Phaser 3, Vitest, Testing Library, Vite.

## Global Constraints

- Do not change combat balance, equipment rewards, or persistence semantics.
- Do not recreate the Phaser game when `saveVersion` changes.
- Apply every canonical server campaign state through the same `replaceState` path.
- Destroy the Phaser game exactly once on real React unmount.

---

### Task 1: Add the battle-controller replacement port

**Files:**
- Modify: `src/game/phaser/battleGame.ts`
- Test: `src/game/phaser/battleGame.test.ts`

**Interfaces:**
- Consumes: `CampaignPersistentState`, `createCampaignController(undefined, { initialState })`
- Produces: `BattleController.replaceState(state: CampaignPersistentState): void`

- [ ] **Step 1: Write the failing test**

Add a test that creates the game, calls `replaceState(nextState)`, and asserts the scene receives a new campaign controller and publishes the restored snapshot without calling `game.destroy`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm vitest run src/game/phaser/battleGame.test.ts`
Expected: FAIL because `replaceState` does not exist.

- [ ] **Step 3: Implement the minimal replacement method**

Extend `BattleController` with:

```ts
replaceState(state: CampaignPersistentState): void;
```

Inside `createBattleGame`, replace the scene campaign with `createCampaignController(undefined, { initialState: state })`, then render and publish its current snapshot. Ignore the call after destruction.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `pnpm vitest run src/game/phaser/battleGame.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/phaser/battleGame.ts src/game/phaser/battleGame.test.ts
git commit -m "feat: replace battle state without remount"
```

### Task 2: Stop App from recreating Phaser on saves

**Files:**
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: `BattleController.replaceState(state)`
- Produces: one Phaser instance per `App` mount and in-place canonical state updates

- [ ] **Step 1: Write the failing rerender test**

Render `App` with one record, rerender it with a higher `saveVersion` and changed campaign state, then assert:

```ts
expect(createBattleGame).toHaveBeenCalledTimes(1);
expect(controller.replaceState).toHaveBeenCalledWith(nextRecord.state.campaign);
expect(controller.destroy).not.toHaveBeenCalled();
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm vitest run src/App.test.tsx`
Expected: FAIL because the mounting effect recreates Phaser.

- [ ] **Step 3: Split mount and state-replacement effects**

The mount effect must use `[]`, create the controller once, and destroy it only during unmount. Add a separate effect:

```ts
useEffect(() => {
  controllerRef.current?.replaceState(record.state.campaign);
}, [record.state.campaign]);
```

Avoid applying the same initial state twice by tracking the campaign object used during creation.

- [ ] **Step 4: Run focused and full verification**

Run:

```bash
pnpm vitest run src/App.test.tsx src/game/phaser/battleGame.test.ts
pnpm run build
```

Expected: all tests pass and production build completes.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "fix: preserve battle canvas across saves"
```

### Task 3: Production verification

**Files:**
- No code changes expected.

- [ ] **Step 1: Verify Vercel deployment**

Confirm the final commit reaches `READY` and the GitHub Vercel status is `success`.

- [ ] **Step 2: Smoke-test the deployed page**

Confirm the production page returns HTTP 200 and dismantling updates inventory and Armor Stones without the battle canvas disappearing or the active tab resetting.
