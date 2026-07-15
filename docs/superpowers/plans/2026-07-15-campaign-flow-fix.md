# Campaign Flow Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix issue #1 so defeating a Sentinel returns the player to active farming with the chapter boss unlocked, instead of entering an inactive campaign state.

**Architecture:** Keep active combat state in `CampaignMode` and represent boss availability with a separate `bossUnlocked` boolean on `CampaignSnapshot`. The controller owns all state transitions; React chooses the appropriate farming action from that snapshot, and Phaser continues to render the controller's active farming encounter.

**Tech Stack:** TypeScript, React 19, Phaser 3, Vitest, Testing Library, Vite.

## Global Constraints

- `CampaignMode` may contain only `farming`, `breakthrough`, `boss`, and `campaign-complete`; remove `boss-ready`.
- `CampaignSnapshot` must expose `bossUnlocked: boolean` for every campaign state.
- Do not use localStorage, sessionStorage, IndexedDB, cookies, filesystem saves, or add any persistence.
- Do not add dependencies, external assets, or Milestone 3 systems.
- Every verified user-facing change must be committed and pushed to `origin/main`; leave the branch clean and tracking `origin/main`.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/game/campaign/campaignTypes.ts` | Public campaign-state contract shared by the controller, UI, and renderer. |
| `src/game/campaign/campaignController.ts` | Authoritative transition rules for breakthrough, boss, chapter progression, and completion. |
| `src/game/campaign/campaignController.test.ts` | Focused state-machine regressions for issue #1. |
| `src/game/campaign/campaignJourney.test.ts` | The deterministic 36-chapter completion journey. |
| `src/App.tsx` | Farming action and copy derived from `bossUnlocked`. |
| `src/App.test.tsx` | React-level campaign-control regression coverage. |
| `src/game/phaser/battleGame.test.ts` | Phaser scene integration and transition-animation regression coverage. |

### Task 1: Replace the inactive state with an explicit boss-unlock flag

**Files:**
- Modify: `src/game/campaign/campaignTypes.ts:3-35`
- Modify: `src/game/campaign/campaignController.ts:7-153`
- Modify: `src/game/campaign/campaignController.test.ts:18-225`
- Test: `src/game/campaign/campaignJourney.test.ts:12-32`

**Interfaces:**
- Consumes: `ChapterDefinition` encounters and `CombatEvent` death events.
- Produces: `CampaignSnapshot { mode, bossUnlocked, chapter, unlockedChapter, encounter, combat }`, plus valid commands `startBreakthrough()` and `startBoss()`.

- [ ] **Step 1: Write the failing campaign-transition tests**

  Replace each `boss-ready` expectation with farming plus `bossUnlocked: true`, and add assertions for the complete issue journey. Keep `advanceUntil` as the deterministic polling helper.

  ```ts
  it('returns a won breakthrough to farming with the boss unlocked and keeps farming active', () => {
    const campaign = createCampaignController(withEncounterBalance('breakthrough', {
      ...CHAPTERS[0].breakthrough.balance,
      player: { ...CHAPTERS[0].breakthrough.balance.player, damage: 10_000, attackIntervalMs: 100 },
    }));
    campaign.startBreakthrough();
    advanceUntil(campaign, () => campaign.getSnapshot().bossUnlocked);

    expect(campaign.getSnapshot()).toMatchObject({
      mode: 'farming', bossUnlocked: true, encounter: { kind: 'farming' }, combat: { phase: 'fighting' },
    });
    const runtimeBefore = campaign.getSnapshot().combat!.activeRuntimeMs;
    campaign.advance(100);
    expect(campaign.getSnapshot().combat!.activeRuntimeMs).toBeGreaterThan(runtimeBefore);
  });

  it('keeps the boss unlocked after a boss loss and only starts a boss from unlocked farming', () => {
    const chapters = CHAPTERS.map((chapter) => ({
      ...chapter,
      breakthrough: {
        ...chapter.breakthrough,
        balance: {
          ...chapter.breakthrough.balance,
          player: { ...chapter.breakthrough.balance.player, damage: 10_000, attackIntervalMs: 100 },
        },
      },
      boss: {
        ...chapter.boss,
        balance: {
          ...chapter.boss.balance,
          enemy: { ...chapter.boss.balance.enemy, damage: 120, attackIntervalMs: 100 },
        },
      },
    }));
    const campaign = createCampaignController(chapters);
    campaign.startBoss();
    expect(campaign.getSnapshot()).toMatchObject({ mode: 'farming', bossUnlocked: false });
    campaign.startBreakthrough();
    advanceUntil(campaign, () => campaign.getSnapshot().bossUnlocked);
    campaign.startBoss();
    advanceUntil(campaign, () => campaign.getSnapshot().mode === 'farming');
    expect(campaign.getSnapshot()).toMatchObject({ mode: 'farming', bossUnlocked: true });
  });
  ```

  Update the 36-chapter journey so it waits for `snapshot.bossUnlocked`, calls `startBoss()` while `mode === 'farming'`, and requires `bossUnlocked: false` after every chapter victory and at campaign completion.

- [ ] **Step 2: Run the focused tests to verify they fail**

  Run:

  ```powershell
  & 'C:\Users\alshiha\AppData\Local\OpenAI\Codex\runtimes\cua_node\03b1cdac8af3a530\bin\node.exe' '.\node_modules\vitest\vitest.mjs' run src/game/campaign/campaignController.test.ts src/game/campaign/campaignJourney.test.ts --configLoader runner --pool=threads --maxWorkers=1 --minWorkers=1
  ```

  Expected: FAIL because `CampaignSnapshot` has no `bossUnlocked`, the controller still emits `boss-ready`, and `startBoss()` rejects unlocked farming.

- [ ] **Step 3: Implement the smallest state-model change**

  In `campaignTypes.ts`, use the following public contract:

  ```ts
  export type CampaignMode = 'farming' | 'breakthrough' | 'boss' | 'campaign-complete';

  export interface CampaignSnapshot {
    mode: CampaignMode;
    bossUnlocked: boolean;
    chapter: ChapterDefinition;
    unlockedChapter: number;
    encounter: EncounterDefinition | null;
    combat: CombatSnapshot | null;
  }
  ```

  In `campaignController.ts`, initialize `let bossUnlocked = false;`, include it in `getSnapshot()`, and make the transition branches explicit:

  ```ts
  if (mode === 'breakthrough') {
    if (death.actor === 'enemy') bossUnlocked = true;
    else bossUnlocked = false;
    returnToFarming();
    return events;
  }

  if (death.actor === 'player') {
    returnToFarming();
    return events;
  }

  if (chapter.number === 36) {
    bossUnlocked = false;
    mode = 'campaign-complete';
    encounter = null;
    engine = null;
    return events;
  }

  unlockedChapter = chapter.number + 1;
  chapter = chapters[unlockedChapter - 1];
  bossUnlocked = false;
  returnToFarming();
  ```

  Gate commands with the new invariants:

  ```ts
  startBreakthrough: () => {
    if (mode === 'farming' && !bossUnlocked) startEncounter(chapter.breakthrough, 'breakthrough');
  },
  startBoss: () => {
    if (mode === 'farming' && bossUnlocked) startEncounter(chapter.boss, 'boss');
  },
  ```

- [ ] **Step 4: Run focused campaign tests to verify they pass**

  Run the Step 2 command again.

  Expected: PASS for all controller and 36-chapter journey tests, including Sentinel win/loss, boss win/loss, invalid commands, and final completion.

- [ ] **Step 5: Commit and push the state-model fix**

  ```powershell
  git add src/game/campaign/campaignTypes.ts src/game/campaign/campaignController.ts src/game/campaign/campaignController.test.ts src/game/campaign/campaignJourney.test.ts
  git commit -m "fix: keep farming active after breakthrough"
  git push
  git status --short --branch
  ```

  Expected: push succeeds and status reports `## main...origin/main` with no changed files.

### Task 2: Derive the UI action and Phaser transition tests from the new snapshot

**Files:**
- Modify: `src/App.tsx:7-105`
- Modify: `src/App.test.tsx:29-192`
- Modify: `src/game/phaser/battleGame.test.ts:213-445`
- Test: `src/App.test.tsx`
- Test: `src/game/phaser/battleGame.test.ts`

**Interfaces:**
- Consumes: `CampaignSnapshot.bossUnlocked` from `BattleStatus`.
- Produces: Start breakthrough only for locked farming; Challenge boss only for unlocked farming; Phaser test snapshots that never use `boss-ready`.

- [ ] **Step 1: Write the failing UI and renderer regression tests**

  Change the app fixture currently named `bossReadyStatus` into an unlocked farming fixture and give every hand-built `CampaignSnapshot` a boolean. Assert the campaign remains visibly farming while presenting the boss action:

  ```ts
  const unlockedFarmingStatus: BattleStatus = {
    ...runningStatus,
    snapshot: { ...runningStatus.snapshot, bossUnlocked: true },
  };

  it('keeps farming visible and offers the boss action after a breakthrough win', () => {
    render(<App />);
    act(() => callbacks.onStatus(unlockedFarmingStatus));

    expect(screen.getByText('Farming — boss unlocked')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Challenge boss' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Start breakthrough' })).not.toBeInTheDocument();
  });
  ```

  In `battleGame.test.ts`, replace every synthetic `boss-ready` snapshot with `{ mode: 'farming', bossUnlocked: true, encounter: sentinelEncounter }`. Update the final-boss journey helper to wait for `bossUnlocked`, and retain the assertion that an enemy visual change waits until the Sentinel death tween completes.

- [ ] **Step 2: Run UI and Phaser tests to verify they fail**

  Run:

  ```powershell
  & 'C:\Users\alshiha\AppData\Local\OpenAI\Codex\runtimes\cua_node\03b1cdac8af3a530\bin\node.exe' '.\node_modules\vitest\vitest.mjs' run src/App.test.tsx src/game/phaser/battleGame.test.ts --configLoader runner --pool=threads --maxWorkers=1 --minWorkers=1
  ```

  Expected: FAIL because the UI still selects `boss-ready`, and old synthetic snapshots violate the campaign contract.

- [ ] **Step 3: Implement the snapshot-driven farming UI**

  Keep non-farming messages in `campaignMessages`, but derive farming copy from the unlock flag:

  ```ts
  const campaignMessage = snapshot
    ? snapshot.mode === 'farming'
      ? snapshot.bossUnlocked
        ? { status: 'Farming — boss unlocked', instruction: 'Keep farming or challenge the chapter boss.' }
        : { status: 'Farming', instruction: 'Defeat enemies to prepare for a breakthrough.' }
      : campaignMessages[snapshot.mode]
    : null;
  ```

  Replace the two mode-only button branches with one farming branch:

  ```tsx
  {snapshot.mode === 'farming' ? (
    snapshot.bossUnlocked ? (
      <button type="button" onClick={() => controllerRef.current?.startBoss()}>Challenge boss</button>
    ) : (
      <button type="button" onClick={() => controllerRef.current?.startBreakthrough()}>Start breakthrough</button>
    )
  ) : null}
  ```

  No `BattleScene.ts` production change is expected: its controller snapshot already causes the farming enemy to be redrawn after Sentinel death feedback. Update only its integration fixtures and assertions when they represent the removed state.

- [ ] **Step 4: Run UI and Phaser tests to verify they pass**

  Run the Step 2 command again.

  Expected: PASS, including boss action from unlocked farming, no action during active breakthrough/boss fights, completed-campaign rendering, and deferred enemy redraw.

- [ ] **Step 5: Commit and push the interaction regression fix**

  ```powershell
  git add src/App.tsx src/App.test.tsx src/game/phaser/battleGame.test.ts
  git commit -m "fix: expose boss challenge during farming"
  git push
  git status --short --branch
  ```

  Expected: push succeeds and status reports `## main...origin/main` with no changed files.

### Task 3: Verify the complete issue fix and close the loop

**Files:**
- Verify: `src/game/campaign/campaignTypes.ts`
- Verify: `src/game/campaign/campaignController.ts`
- Verify: `src/App.tsx`
- Verify: `src/game/campaign/campaignController.test.ts`
- Verify: `src/game/campaign/campaignJourney.test.ts`
- Verify: `src/App.test.tsx`
- Verify: `src/game/phaser/battleGame.test.ts`

**Interfaces:**
- Consumes: the completed controller, UI, and Phaser test suites.
- Produces: evidence that issue #1 is resolved on `origin/main` with no local-only work.

- [ ] **Step 1: Run the full automated test suite**

  ```powershell
  & 'C:\Users\alshiha\AppData\Local\OpenAI\Codex\runtimes\cua_node\03b1cdac8af3a530\bin\node.exe' '.\node_modules\vitest\vitest.mjs' run --exclude '.superpowers/**' --configLoader runner --pool=threads --maxWorkers=1 --minWorkers=1
  ```

  Expected: all tests PASS.

- [ ] **Step 2: Run static and production-build verification**

  ```powershell
  & 'C:\Users\alshiha\AppData\Local\OpenAI\Codex\runtimes\cua_node\03b1cdac8af3a530\bin\node.exe' '.\node_modules\typescript\bin\tsc' -b --pretty false
  & 'C:\Users\alshiha\AppData\Local\OpenAI\Codex\runtimes\cua_node\03b1cdac8af3a530\bin\node.exe' '.\node_modules\vite\bin\vite.js' build --configLoader runner
  git diff --check
  rg -n "boss-ready|localStorage|sessionStorage|IndexedDB|document\\.cookie" src
  ```

  Expected: typecheck and build exit 0, `git diff --check` has no output, and the search has no source-code matches.

- [ ] **Step 3: Review the final diff and GitHub tracking state**

  ```powershell
  git status --short --branch
  git log -1 --oneline
  ```

  Expected: `## main...origin/main` with no changed files, and the latest commit is the pushed interaction fix.

- [ ] **Step 4: Close GitHub issue #1 with the verified commit reference**

  Add a concise resolution comment linking the final commit, then close issue #1 only after the preceding verification and clean tracking-state checks pass.
