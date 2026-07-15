# RoyalStory Milestone 3 Progression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic XP, level 1–200, ATK/DEF/max-HP scaling, live combat stat updates, and a compact Hero progress panel to the existing campaign.

**Architecture:** A pure progression controller owns level and XP while frozen balance modules define all formulas and metadata. The campaign controller awards XP and applies current player stats to the combat engine; React and Phaser consume the resulting campaign snapshot without owning progression state.

**Tech Stack:** TypeScript 5.8, React 19, Phaser 3.90, Vitest 3.2, Testing Library, Vite 7.

## Global Constraints

- Level is an integer from `1` through `200`; XP overflows across levels and stops changing at level `200`.
- Level 1 stats are `18 ATK`, `2 DEF`, and `120 max-HP`; each level adds `2 ATK`, `1 DEF`, and `8 max-HP`.
- XP formulas are exactly `50 + (level - 1) × 25`, farming `10 + (chapter - 1) × 2`, breakthrough `40 + (chapter - 1) × 8`, and boss `100 + (chapter - 1) × 20`.
- Damage is exactly `max(1, attacker.attack - defender.defense)` and enemies have `0 DEF` in this milestone.
- Live max-HP increases add only the max-HP delta to current HP; they do not fully heal or reset combat timers, enemy HP, pause state, or counters.
- The central balance entrypoint must expose combat, progression, and equipment metadata: `14` equipment slots, item levels `1–200`, and rarities Normal, Rare, Epic, Unique, Legendary.
- Do not add skills, item generation, inventory, currencies, accounts, servers, offline progress, dependencies, or external assets.
- Do not use `localStorage`, `sessionStorage`, IndexedDB, cookies, or filesystem saves.
- After every verified user-facing change, commit and push to `origin/main`; leave `main` clean and exactly tracking `origin/main`.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/game/balance.ts` | Stable central re-export used by existing imports. |
| `src/game/balance/combatBalance.ts` | Current combat timing and combatant defaults. |
| `src/game/balance/progressionBalance.ts` | Level stats, XP requirements, encounter XP, and caps. |
| `src/game/balance/equipmentBalance.ts` | Decided equipment metadata only; no item mechanics. |
| `src/game/progression/progressionTypes.ts` | Progression snapshots and controller interface. |
| `src/game/progression/progressionController.ts` | Pure validated XP and level state machine. |
| `src/game/types.ts` | Shared player-stat and combat contracts. |
| `src/game/combatEngine.ts` | DEF-aware damage and live player-stat application. |
| `src/game/campaign/campaignController.ts` | XP awards and progression/combat coordination. |
| `src/game/campaign/campaignTypes.ts` | Campaign snapshot including progression. |
| `src/App.tsx` | Hero panel, accessible XP display, and transient level-up message. |
| `src/styles.css` | Responsive Hero-panel presentation. |
| `src/game/phaser/BattleScene.ts` | Continues rendering/publishing snapshots without owning progression. |
| `README.md` | Milestone 3 features and memory-only boundary. |

### Task 1: Centralize balance and publish progression contracts

**Files:**
- Create: `src/game/balance/combatBalance.ts`
- Create: `src/game/balance/progressionBalance.ts`
- Create: `src/game/balance/equipmentBalance.ts`
- Create: `src/game/progression/progressionTypes.ts`
- Modify: `src/game/balance.ts`
- Modify: `src/game/types.ts`
- Modify: `src/game/balance.test.ts`

**Interfaces:**
- Consumes: existing `CombatBalance` and the approved Milestone 3 formulas.
- Produces: `PlayerStats`, `ProgressionSnapshot`, `ProgressionController`, `PROGRESSION_BALANCE`, `getStatsForLevel`, `getXpToNextLevel`, `getEncounterXp`, `MAX_TOTAL_XP`, and `EQUIPMENT_BALANCE`.

- [ ] **Step 1: Write failing balance-contract tests**

  Replace `src/game/balance.test.ts` with tests that import every public balance export and assert the exact boundaries:

  ```ts
  import { describe, expect, it } from 'vitest';
  import {
    COMBAT_BALANCE,
    EQUIPMENT_BALANCE,
    MAX_TOTAL_XP,
    PROGRESSION_BALANCE,
    getEncounterXp,
    getStatsForLevel,
    getXpToNextLevel,
  } from './balance';

  describe('central balance', () => {
    it('keeps combat and equipment metadata frozen', () => {
      expect(COMBAT_BALANCE.player).toMatchObject({ name: 'Ari', maxHp: 120 });
      expect(EQUIPMENT_BALANCE).toEqual({
        slotCount: 14,
        minItemLevel: 1,
        maxItemLevel: 200,
        rarities: ['Normal', 'Rare', 'Epic', 'Unique', 'Legendary'],
      });
      expect(Object.isFrozen(COMBAT_BALANCE)).toBe(true);
      expect(Object.isFrozen(EQUIPMENT_BALANCE.rarities)).toBe(true);
    });

    it('exposes exact level, stat, and encounter formulas', () => {
      expect(PROGRESSION_BALANCE.maxLevel).toBe(200);
      expect(getStatsForLevel(1)).toEqual({ attack: 18, defense: 2, maxHp: 120 });
      expect(getStatsForLevel(200)).toEqual({ attack: 416, defense: 201, maxHp: 1_712 });
      expect(getXpToNextLevel(1)).toBe(50);
      expect(getXpToNextLevel(199)).toBe(5_000);
      expect(getXpToNextLevel(200)).toBe(0);
      expect(MAX_TOTAL_XP).toBe(502_475);
      expect(getEncounterXp(1, 'farming')).toBe(10);
      expect(getEncounterXp(36, 'breakthrough')).toBe(320);
      expect(getEncounterXp(36, 'boss')).toBe(800);
    });

    it('rejects values outside the designed level and chapter ranges', () => {
      expect(() => getStatsForLevel(0)).toThrow('Level must be an integer from 1 to 200');
      expect(() => getXpToNextLevel(201)).toThrow('Level must be an integer from 1 to 200');
      expect(() => getEncounterXp(0, 'farming')).toThrow('Chapter must be an integer from 1 to 36');
      expect(() => getEncounterXp(37, 'boss')).toThrow('Chapter must be an integer from 1 to 36');
    });
  });
  ```

- [ ] **Step 2: Run the balance test and capture RED**

  ```powershell
  & 'C:\Users\alshiha\AppData\Local\OpenAI\Codex\runtimes\cua_node\03b1cdac8af3a530\bin\node.exe' '.\node_modules\vitest\vitest.mjs' run src/game/balance.test.ts --configLoader runner --pool=threads --maxWorkers=1 --minWorkers=1
  ```

  Expected: FAIL because the domain balance exports and progression contracts do not exist.

- [ ] **Step 3: Add shared stat and progression types**

  Add to `src/game/types.ts`:

  ```ts
  export interface PlayerStats {
    attack: number;
    defense: number;
    maxHp: number;
  }
  ```

  Create `src/game/progression/progressionTypes.ts`:

  ```ts
  import type { PlayerStats } from '../types';

  export interface ProgressionSnapshot {
    level: number;
    xp: number;
    xpToNextLevel: number;
    totalXp: number;
    stats: Readonly<PlayerStats>;
  }

  export interface ProgressionController {
    awardXp(amount: number): ProgressionSnapshot;
    getSnapshot(): ProgressionSnapshot;
  }
  ```

- [ ] **Step 4: Split and implement frozen balance modules**

  Move the unchanged combat constant into `src/game/balance/combatBalance.ts`:

  ```ts
  import type { CombatBalance } from '../types';

  export const COMBAT_BALANCE: Readonly<CombatBalance> = Object.freeze({
    sliceMs: 100,
    maxFrameContributionMs: 250,
    enemyRespawnMs: 1_200,
    playerRespawnMs: 3_000,
    player: Object.freeze({ id: 'player', name: 'Ari', maxHp: 120, damage: 18, attackIntervalMs: 900 }),
    enemy: Object.freeze({ id: 'enemy', name: 'Mossling', maxHp: 90, damage: 9, attackIntervalMs: 1_300 }),
  });
  ```

  Create `progressionBalance.ts` with this public behavior:

  ```ts
  import type { PlayerStats } from '../types';

  export type EncounterRewardKind = 'farming' | 'breakthrough' | 'boss';

  export const PROGRESSION_BALANCE = Object.freeze({
    maxLevel: 200,
    maxChapter: 36,
    baseStats: Object.freeze({ attack: 18, defense: 2, maxHp: 120 }),
    growthPerLevel: Object.freeze({ attack: 2, defense: 1, maxHp: 8 }),
  });

  function assertLevel(level: number): void {
    if (!Number.isInteger(level) || level < 1 || level > 200) {
      throw new RangeError('Level must be an integer from 1 to 200');
    }
  }

  export function getStatsForLevel(level: number): Readonly<PlayerStats> {
    assertLevel(level);
    const gainedLevels = level - 1;
    return Object.freeze({
      attack: 18 + gainedLevels * 2,
      defense: 2 + gainedLevels,
      maxHp: 120 + gainedLevels * 8,
    });
  }

  export function getXpToNextLevel(level: number): number {
    assertLevel(level);
    return level === 200 ? 0 : 50 + (level - 1) * 25;
  }

  export function getEncounterXp(chapter: number, kind: EncounterRewardKind): number {
    if (!Number.isInteger(chapter) || chapter < 1 || chapter > 36) {
      throw new RangeError('Chapter must be an integer from 1 to 36');
    }
    const offset = chapter - 1;
    if (kind === 'farming') return 10 + offset * 2;
    if (kind === 'breakthrough') return 40 + offset * 8;
    return 100 + offset * 20;
  }

  export const MAX_TOTAL_XP = Array.from(
    { length: 199 },
    (_, index) => getXpToNextLevel(index + 1),
  ).reduce((total, requirement) => total + requirement, 0);
  ```

  Create `equipmentBalance.ts`:

  ```ts
  export const EQUIPMENT_BALANCE = Object.freeze({
    slotCount: 14,
    minItemLevel: 1,
    maxItemLevel: 200,
    rarities: Object.freeze(['Normal', 'Rare', 'Epic', 'Unique', 'Legendary'] as const),
  });
  ```

  Replace `src/game/balance.ts` with the stable central entrypoint:

  ```ts
  export * from './balance/combatBalance';
  export * from './balance/equipmentBalance';
  export * from './balance/progressionBalance';
  ```

- [ ] **Step 5: Run balance tests and verify GREEN**

  Run the Step 2 command again.

  Expected: 1 test file passes with the exact formulas, frozen metadata, and boundary errors.

- [ ] **Step 6: Commit and push the central balance foundation**

  ```powershell
  git add src/game/types.ts src/game/balance.ts src/game/balance src/game/progression/progressionTypes.ts src/game/balance.test.ts
  git commit -m "feat: centralize milestone three balance"
  git push
  git status --short --branch
  ```

  Expected: `main` is clean and exactly tracking `origin/main`.

### Task 2: Implement the pure progression state machine

**Files:**
- Create: `src/game/progression/progressionController.ts`
- Create: `src/game/progression/progressionController.test.ts`

**Interfaces:**
- Consumes: `ProgressionController`, `ProgressionSnapshot`, `getStatsForLevel`, `getXpToNextLevel`, and `PROGRESSION_BALANCE`.
- Produces: `createProgressionController(): ProgressionController` with validated automatic multi-level XP handling.

- [ ] **Step 1: Write progression-controller tests first**

  Create tests for initialization, overflow, multi-level awards, invalid awards, immutable snapshots, and the cap:

  ```ts
  import { describe, expect, it } from 'vitest';
  import { MAX_TOTAL_XP } from '../balance';
  import { createProgressionController } from './progressionController';

  describe('createProgressionController', () => {
    it('starts at level one with derived stats', () => {
      expect(createProgressionController().getSnapshot()).toEqual({
        level: 1,
        xp: 0,
        xpToNextLevel: 50,
        totalXp: 0,
        stats: { attack: 18, defense: 2, maxHp: 120 },
      });
    });

    it('keeps overflow and can gain several levels in one award', () => {
      const progression = createProgressionController();
      expect(progression.awardXp(140)).toMatchObject({
        level: 3,
        xp: 15,
        xpToNextLevel: 100,
        totalXp: 140,
        stats: { attack: 22, defense: 4, maxHp: 136 },
      });
    });

    it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
      'rejects invalid XP %s without mutation',
      (amount) => {
        const progression = createProgressionController();
        const before = progression.getSnapshot();
        expect(() => progression.awardXp(amount)).toThrow('XP must be a positive finite integer');
        expect(progression.getSnapshot()).toEqual(before);
      },
    );

    it('caps exactly at level 200 and ignores further valid XP', () => {
      const progression = createProgressionController();
      progression.awardXp(MAX_TOTAL_XP + 10_000);
      const capped = progression.getSnapshot();
      expect(capped).toMatchObject({ level: 200, xp: 0, xpToNextLevel: 0, totalXp: MAX_TOTAL_XP });
      expect(progression.awardXp(1_000)).toEqual(capped);
    });

    it('returns immutable nested snapshots and fresh outer objects', () => {
      const progression = createProgressionController();
      const first = progression.getSnapshot();
      const second = progression.getSnapshot();
      expect(first).toEqual(second);
      expect(first).not.toBe(second);
      expect(Object.isFrozen(first)).toBe(true);
      expect(Object.isFrozen(first.stats)).toBe(true);
    });
  });
  ```

- [ ] **Step 2: Run progression tests and capture RED**

  ```powershell
  & 'C:\Users\alshiha\AppData\Local\OpenAI\Codex\runtimes\cua_node\03b1cdac8af3a530\bin\node.exe' '.\node_modules\vitest\vitest.mjs' run src/game/progression/progressionController.test.ts --configLoader runner --pool=threads --maxWorkers=1 --minWorkers=1
  ```

  Expected: FAIL because `createProgressionController` does not exist.

- [ ] **Step 3: Implement the XP state machine**

  Create `progressionController.ts`:

  ```ts
  import { PROGRESSION_BALANCE, getStatsForLevel, getXpToNextLevel } from '../balance';
  import type { ProgressionController, ProgressionSnapshot } from './progressionTypes';

  export function createProgressionController(): ProgressionController {
    let level = 1;
    let xp = 0;
    let totalXp = 0;

    const getSnapshot = (): ProgressionSnapshot => Object.freeze({
      level,
      xp,
      xpToNextLevel: getXpToNextLevel(level),
      totalXp,
      stats: getStatsForLevel(level),
    });

    const awardXp = (amount: number): ProgressionSnapshot => {
      if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) {
        throw new RangeError('XP must be a positive finite integer');
      }
      let remaining = level === PROGRESSION_BALANCE.maxLevel ? 0 : amount;
      while (remaining > 0 && level < PROGRESSION_BALANCE.maxLevel) {
        const needed = getXpToNextLevel(level) - xp;
        const applied = Math.min(remaining, needed);
        xp += applied;
        totalXp += applied;
        remaining -= applied;
        if (xp === getXpToNextLevel(level)) {
          level += 1;
          xp = 0;
        }
      }
      return getSnapshot();
    };

    return { awardXp, getSnapshot };
  }
  ```

- [ ] **Step 4: Run progression and balance tests**

  ```powershell
  & 'C:\Users\alshiha\AppData\Local\OpenAI\Codex\runtimes\cua_node\03b1cdac8af3a530\bin\node.exe' '.\node_modules\vitest\vitest.mjs' run src/game/balance.test.ts src/game/progression/progressionController.test.ts --configLoader runner --pool=threads --maxWorkers=1 --minWorkers=1
  ```

  Expected: both test files pass and invalid XP never mutates state.

- [ ] **Step 5: Commit and push the progression state machine**

  ```powershell
  git add src/game/progression/progressionController.ts src/game/progression/progressionController.test.ts
  git commit -m "feat: add deterministic level progression"
  git push
  git status --short --branch
  ```

  Expected: `main` is clean and exactly tracking `origin/main`.

### Task 3: Make combat use ATK, DEF, and live stat updates

**Files:**
- Modify: `src/game/types.ts`
- Modify: `src/game/balance/combatBalance.ts`
- Modify: `src/game/combatEngine.ts`
- Modify: `src/game/combatEngine.test.ts`
- Modify: `src/game/campaign/campaignDefinitions.ts`
- Modify: `src/game/campaign/campaignDefinitions.test.ts`
- Modify: `src/game/campaign/campaignController.ts`
- Modify: `src/game/campaign/campaignController.test.ts`
- Modify: `src/App.test.tsx`
- Modify: `src/game/phaser/battleGame.test.ts`

**Interfaces:**
- Consumes: `PlayerStats` and the current combat timing model.
- Produces: `CombatantConfig extends PlayerStats` and `CombatEngine.applyPlayerStats(stats: PlayerStats): void`.

- [ ] **Step 1: Write DEF and live-update regression tests**

  Update existing combat fixtures from `damage` to `attack`, add `defense`, and add these focused tests:

  ```ts
  it('subtracts defense and always deals at least one damage', () => {
    const engine = createCombatEngine(makeBalance({
      player: { attack: 3 },
      enemy: { defense: 20 },
    }));
    expect(engine.advance(900)).toContainEqual({ type: 'damage', target: 'enemy', amount: 1, hp: 89 });
  });

  it('applies stronger player stats without resetting active combat state', () => {
    const engine = createCombatEngine();
    engine.advance(450);
    const before = engine.getSnapshot();
    engine.applyPlayerStats({ attack: 90, defense: 5, maxHp: 128 });
    const upgraded = engine.getSnapshot();
    expect(upgraded).toMatchObject({
      activeRuntimeMs: before.activeRuntimeMs,
      totalAttacks: before.totalAttacks,
      player: { attack: 90, defense: 5, maxHp: 128, hp: 128 },
      enemy: { hp: before.enemy.hp },
    });
    expect(engine.advance(450)).toContainEqual({ type: 'damage', target: 'enemy', amount: 90, hp: 0 });
  });

  it('rejects invalid live stats before changing combat', () => {
    const engine = createCombatEngine();
    const before = engine.getSnapshot();
    expect(() => engine.applyPlayerStats({ attack: 0, defense: 2, maxHp: 120 }))
      .toThrow('Player stats must contain positive attack/maxHp and non-negative defense');
    expect(engine.getSnapshot()).toEqual(before);
  });
  ```

- [ ] **Step 2: Run the combat test and capture RED**

  ```powershell
  & 'C:\Users\alshiha\AppData\Local\OpenAI\Codex\runtimes\cua_node\03b1cdac8af3a530\bin\node.exe' '.\node_modules\vitest\vitest.mjs' run src/game/combatEngine.test.ts --configLoader runner --pool=threads --maxWorkers=1 --minWorkers=1
  ```

  Expected: FAIL because combatants still expose `damage`, have no DEF, and the engine has no live stat command.

- [ ] **Step 3: Update the combat contract and damage calculation**

  Change `CombatantConfig` and `CombatEngine` in `types.ts`:

  ```ts
  export interface CombatantConfig extends PlayerStats {
    id: ActorId;
    name: string;
    attackIntervalMs: number;
  }

  export interface CombatEngine {
    advance(elapsedMs: number): CombatEvent[];
    pause(): CombatEvent[];
    resume(): CombatEvent[];
    applyPlayerStats(stats: PlayerStats): void;
    getSnapshot(): CombatSnapshot;
  }
  ```

  In `combatEngine.ts`, calculate damage from both combatants and add the live updater:

  ```ts
  const damage = Math.max(1, attacker.attack - target.defense);
  target.hp = Math.max(0, target.hp - damage);
  events.push({ type: 'damage', target: target.id, amount: damage, hp: target.hp });

  const applyPlayerStats = (stats: PlayerStats): void => {
    if (
      !Number.isFinite(stats.attack) || stats.attack <= 0
      || !Number.isFinite(stats.defense) || stats.defense < 0
      || !Number.isFinite(stats.maxHp) || stats.maxHp < player.maxHp
    ) throw new RangeError('Player stats must contain positive attack/maxHp and non-negative defense');
    const maxHpDelta = stats.maxHp - player.maxHp;
    player.attack = stats.attack;
    player.defense = stats.defense;
    player.maxHp = stats.maxHp;
    if (player.alive) player.hp = Math.min(player.maxHp, player.hp + maxHpDelta);
  };
  ```

  Return `applyPlayerStats` from the engine. Keep attack accumulators, recovery state, counters, enemy state, and pause state untouched.

- [ ] **Step 4: Migrate every combat consumer atomically**

  Replace combatant `damage` fields with `attack`, add player `defense: 2` and enemy `defense: 0` in `combatBalance.ts`, and change campaign validation to require positive `attack`, non-negative `defense`, positive `maxHp`, and positive `attackIntervalMs`.

  In `campaignDefinitions.ts`, use:

  ```ts
  enemy: {
    ...COMBAT_BALANCE.enemy,
    maxHp: 72 + chapter * 3 * multiplier,
    attack: 2 + Math.floor(chapter / 12),
    defense: 0,
    attackIntervalMs: 1_300,
  }
  ```

  Update all typed fixtures in the listed test files in the same commit. Preserve `CombatEvent`'s event name `damage`; only the combatant stat property becomes `attack`.

- [ ] **Step 5: Run all combat and campaign consumers**

  ```powershell
  & 'C:\Users\alshiha\AppData\Local\OpenAI\Codex\runtimes\cua_node\03b1cdac8af3a530\bin\node.exe' '.\node_modules\vitest\vitest.mjs' run src/game/balance.test.ts src/game/combatEngine.test.ts src/game/campaign/campaignDefinitions.test.ts src/game/campaign/campaignController.test.ts src/game/campaign/campaignJourney.test.ts src/App.test.tsx src/game/phaser/battleGame.test.ts --configLoader runner --pool=threads --maxWorkers=1 --minWorkers=1
  & 'C:\Users\alshiha\AppData\Local\OpenAI\Codex\runtimes\cua_node\03b1cdac8af3a530\bin\node.exe' '.\node_modules\typescript\bin\tsc' -b --pretty false
  ```

  Expected: all listed tests and typecheck pass with no remaining `damage` config property.

- [ ] **Step 6: Commit and push the combat-stat contract**

  ```powershell
  git add src/game/types.ts src/game/balance/combatBalance.ts src/game/combatEngine.ts src/game/combatEngine.test.ts src/game/campaign/campaignDefinitions.ts src/game/campaign/campaignDefinitions.test.ts src/game/campaign/campaignController.ts src/game/campaign/campaignController.test.ts src/App.test.tsx src/game/phaser/battleGame.test.ts
  git commit -m "feat: apply attack and defense in combat"
  git push
  git status --short --branch
  ```

  Expected: `main` is clean and exactly tracking `origin/main`.

### Task 4: Award XP through the campaign and apply level stats

**Files:**
- Modify: `src/game/campaign/campaignTypes.ts`
- Modify: `src/game/campaign/campaignController.ts`
- Modify: `src/game/campaign/campaignController.test.ts`
- Modify: `src/game/campaign/campaignJourney.test.ts`
- Modify: `src/App.test.tsx`
- Modify: `src/game/phaser/battleGame.test.ts`

**Interfaces:**
- Consumes: `createProgressionController`, `getEncounterXp`, and `CombatEngine.applyPlayerStats`.
- Produces: `CampaignSnapshot.progression: ProgressionSnapshot`; enemy deaths award once and new encounters always use current player stats.

- [ ] **Step 1: Add failing campaign-progression tests**

  Add `progression` to every hand-built campaign snapshot. Add controller tests with chapter copies whose enemy `maxHp` is `1` and player `attackIntervalMs` is `100`:

  ```ts
  it('awards farming XP once per enemy death and none while paused', () => {
    const chapters = CHAPTERS.map((chapter) => ({
      ...chapter,
      farming: {
        ...chapter.farming,
        balance: {
          ...chapter.farming.balance,
          player: { ...chapter.farming.balance.player, attackIntervalMs: 100 },
          enemy: { ...chapter.farming.balance.enemy, maxHp: 1 },
        },
      },
    }));
    const campaign = createCampaignController(chapters);
    expect(campaign.advance(100)).toContainEqual({ type: 'death', actor: 'enemy' });
    expect(campaign.getSnapshot().progression).toMatchObject({ level: 1, xp: 10, totalXp: 10 });
    campaign.pause();
    campaign.advance(60_000);
    expect(campaign.getSnapshot().progression.totalXp).toBe(10);
  });

  it('awards breakthrough and boss XP before starting the next encounter', () => {
    const chapters = CHAPTERS.map((chapter) => ({
      ...chapter,
      breakthrough: {
        ...chapter.breakthrough,
        balance: {
          ...chapter.breakthrough.balance,
          player: { ...chapter.breakthrough.balance.player, attackIntervalMs: 100 },
          enemy: { ...chapter.breakthrough.balance.enemy, maxHp: 1 },
        },
      },
      boss: {
        ...chapter.boss,
        balance: {
          ...chapter.boss.balance,
          player: { ...chapter.boss.balance.player, attackIntervalMs: 100 },
          enemy: { ...chapter.boss.balance.enemy, maxHp: 1 },
        },
      },
    }));
    const campaign = createCampaignController(chapters);
    campaign.startBreakthrough();
    campaign.advance(100);
    expect(campaign.getSnapshot()).toMatchObject({
      mode: 'farming', bossUnlocked: true, progression: { xp: 40, totalXp: 40 },
      combat: { player: { attack: 18 } },
    });
    campaign.startBoss();
    campaign.advance(100);
    expect(campaign.getSnapshot()).toMatchObject({
      chapter: { number: 2 },
      progression: { level: 3, xp: 15, totalXp: 140, stats: { attack: 22, defense: 4, maxHp: 136 } },
      combat: { player: { attack: 22, defense: 4, maxHp: 136 } },
    });
  });

  it('gives no XP for player death', () => {
    const chapters = CHAPTERS.map((chapter) => ({
      ...chapter,
      farming: {
        ...chapter.farming,
        balance: {
          ...chapter.farming.balance,
          enemy: { ...chapter.farming.balance.enemy, attack: 10_000, attackIntervalMs: 100 },
        },
      },
    }));
    const campaign = createCampaignController(chapters);
    campaign.advance(100);
    expect(campaign.getSnapshot().progression.totalXp).toBe(0);
  });
  ```

- [ ] **Step 2: Run campaign tests and capture RED**

  ```powershell
  & 'C:\Users\alshiha\AppData\Local\OpenAI\Codex\runtimes\cua_node\03b1cdac8af3a530\bin\node.exe' '.\node_modules\vitest\vitest.mjs' run src/game/campaign/campaignController.test.ts src/game/campaign/campaignJourney.test.ts --configLoader runner --pool=threads --maxWorkers=1 --minWorkers=1
  ```

  Expected: FAIL because campaign snapshots do not expose progression and deaths do not award XP.

- [ ] **Step 3: Add progression to campaign state and encounter creation**

  Add `progression: ProgressionSnapshot` to `CampaignSnapshot`. In `createCampaignController`, create one progression controller and derive player balance for each encounter:

  ```ts
  const progression = createProgressionController();

  const startEncounter = (definition: EncounterDefinition, nextMode: CampaignMode) => {
    const stats = progression.getSnapshot().stats;
    encounter = definition;
    engine = createCombatEngine({
      ...definition.balance,
      player: {
        ...definition.balance.player,
        attack: stats.attack,
        defense: stats.defense,
        maxHp: stats.maxHp,
      },
    });
    mode = nextMode;
  };
  ```

  Include `progression: progression.getSnapshot()` in `getSnapshot()`.

- [ ] **Step 4: Award XP before resolving encounter transitions**

  Immediately after `engine.advance`, process only an enemy death:

  ```ts
  const events = engine.advance(elapsedMs);
  const death = events.find((event) => event.type === 'death');
  if (death?.actor === 'enemy' && encounter !== null) {
    progression.awardXp(getEncounterXp(chapter.number, encounter.kind));
    engine.applyPlayerStats(progression.getSnapshot().stats);
  }
  if (death === undefined || mode === 'farming') return events;
  ```

  Keep the existing Sentinel/boss transition ordering after this block. A transition-created engine will read the already-updated progression snapshot.

- [ ] **Step 5: Update snapshot fixtures and run integration tests**

  Add this initial progression object to synthetic snapshots in `App.test.tsx` and `battleGame.test.ts`:

  ```ts
  progression: {
    level: 1,
    xp: 0,
    xpToNextLevel: 50,
    totalXp: 0,
    stats: { attack: 18, defense: 2, maxHp: 120 },
  },
  ```

  Run:

  ```powershell
  & 'C:\Users\alshiha\AppData\Local\OpenAI\Codex\runtimes\cua_node\03b1cdac8af3a530\bin\node.exe' '.\node_modules\vitest\vitest.mjs' run src/game/progression/progressionController.test.ts src/game/combatEngine.test.ts src/game/campaign/campaignController.test.ts src/game/campaign/campaignJourney.test.ts src/App.test.tsx src/game/phaser/battleGame.test.ts --configLoader runner --pool=threads --maxWorkers=1 --minWorkers=1
  & 'C:\Users\alshiha\AppData\Local\OpenAI\Codex\runtimes\cua_node\03b1cdac8af3a530\bin\node.exe' '.\node_modules\typescript\bin\tsc' -b --pretty false
  ```

  Expected: progression and all campaign consumers pass, including the 36-chapter journey.

- [ ] **Step 6: Commit and push campaign progression**

  ```powershell
  git add src/game/campaign/campaignTypes.ts src/game/campaign/campaignController.ts src/game/campaign/campaignController.test.ts src/game/campaign/campaignJourney.test.ts src/App.test.tsx src/game/phaser/battleGame.test.ts
  git commit -m "feat: award progression through campaign combat"
  git push
  git status --short --branch
  ```

  Expected: `main` is clean and exactly tracking `origin/main`.

### Task 5: Show progression in React and preserve Phaser lifecycle

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles.css`
- Modify: `src/game/phaser/battleGame.test.ts`

**Interfaces:**
- Consumes: `CampaignSnapshot.progression` through `BattleStatus`.
- Produces: accessible Hero panel, XP progress, `MAX` state, and a 2.5-second `Level N reached` message without recreating Phaser.

- [ ] **Step 1: Write failing UI and scene-lifecycle tests**

  Add React tests using fake timers:

  ```ts
  it('shows level, XP, and all three base stats', () => {
    render(<App />);
    expect(screen.getByRole('region', { name: 'Hero progression' })).toBeInTheDocument();
    expect(screen.getByText('Level 1 / 200')).toBeInTheDocument();
    expect(screen.getByText('0 / 50 XP')).toBeInTheDocument();
    expect(screen.getByText('18', { selector: 'dd' })).toBeInTheDocument();
    expect(screen.getByText('2', { selector: 'dd' })).toBeInTheDocument();
    expect(screen.getByText('120', { selector: 'dd' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Experience' })).toHaveAttribute('value', '0');
  });

  it('shows the newest level-up message briefly without recreating the game', () => {
    vi.useFakeTimers();
    render(<App />);
    act(() => callbacks.onStatus({
      ...runningStatus,
      snapshot: {
        ...runningStatus.snapshot,
        progression: {
          level: 3,
          xp: 15,
          xpToNextLevel: 100,
          totalXp: 140,
          stats: { attack: 22, defense: 4, maxHp: 136 },
        },
      },
    }));
    expect(screen.getByText('Level 3 reached')).toBeInTheDocument();
    expect(battleGame.createBattleGame).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(2_500));
    expect(screen.queryByText('Level 3 reached')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('shows a full MAX progress state at level 200', () => {
    render(<App />);
    act(() => callbacks.onStatus({
      ...campaignCompleteStatus,
      snapshot: {
        ...campaignCompleteStatus.snapshot,
        progression: {
          level: 200,
          xp: 0,
          xpToNextLevel: 0,
          totalXp: 502_475,
          stats: { attack: 416, defense: 201, maxHp: 1_712 },
        },
      },
    }));
    expect(screen.getByText('MAX')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Experience' })).toHaveAttribute('value', '1');
  });
  ```

  In `battleGame.test.ts`, render two snapshots with the same encounter visual but different progression levels and assert `redrawEnemy` is not called for the progression-only update.

- [ ] **Step 2: Run App and Phaser tests and capture RED**

  ```powershell
  & 'C:\Users\alshiha\AppData\Local\OpenAI\Codex\runtimes\cua_node\03b1cdac8af3a530\bin\node.exe' '.\node_modules\vitest\vitest.mjs' run src/App.test.tsx src/game/phaser/battleGame.test.ts --configLoader runner --pool=threads --maxWorkers=1 --minWorkers=1
  ```

  Expected: FAIL because no Hero progression region, progressbar, MAX state, or level-up message exists.

- [ ] **Step 3: Implement the Hero panel and level-up message**

  In `App.tsx`, track the previous level and a 2.5-second message:

  ```ts
  const previousLevelRef = useRef<number | null>(null);
  const [levelUpMessage, setLevelUpMessage] = useState<string | null>(null);

  useEffect(() => {
    const level = snapshot?.progression.level;
    if (level === undefined) return;
    const previous = previousLevelRef.current;
    previousLevelRef.current = level;
    if (previous === null || level <= previous) return;
    setLevelUpMessage(`Level ${level} reached`);
    const timer = window.setTimeout(() => setLevelUpMessage(null), 2_500);
    return () => window.clearTimeout(timer);
  }, [snapshot?.progression.level]);
  ```

  Render an `aria-label="Hero progression"` section containing `Level N / 200`, a native `<progress aria-label="Experience">`, XP text or `MAX`, and a definition list for ATK, DEF, and HP. Render the level-up message with `role="status"`. Change the eyebrow copy to `Milestone 3 · Progression Sandbox`.

- [ ] **Step 4: Add responsive Hero-panel styles**

  Add focused styles without changing the accepted campaign/battle direction:

  ```css
  .hero-panel {
    display: grid;
    width: min(100%, 70rem);
    margin-inline: auto;
    gap: 10px;
    padding: clamp(14px, 3vw, 20px);
    border: 1px solid rgb(231 202 131 / 35%);
    border-radius: 14px;
    background: rgb(24 34 62 / 92%);
  }

  .hero-panel progress {
    width: 100%;
    min-height: 12px;
    accent-color: #ffd66b;
  }

  .hero-stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin: 0;
  }

  .level-up-message {
    margin: 0;
    color: #fff4bf;
    font-weight: 800;
  }
  ```

  At widths below `640px`, retain three equal stat columns and ensure each stat remains readable without horizontal scrolling.

- [ ] **Step 5: Run UI, Phaser, typecheck, and build**

  ```powershell
  & 'C:\Users\alshiha\AppData\Local\OpenAI\Codex\runtimes\cua_node\03b1cdac8af3a530\bin\node.exe' '.\node_modules\vitest\vitest.mjs' run src/App.test.tsx src/game/phaser/battleGame.test.ts --configLoader runner --pool=threads --maxWorkers=1 --minWorkers=1
  & 'C:\Users\alshiha\AppData\Local\OpenAI\Codex\runtimes\cua_node\03b1cdac8af3a530\bin\node.exe' '.\node_modules\typescript\bin\tsc' -b --pretty false
  & 'C:\Users\alshiha\AppData\Local\OpenAI\Codex\runtimes\cua_node\03b1cdac8af3a530\bin\node.exe' '.\node_modules\vite\bin\vite.js' build --configLoader runner
  ```

  Expected: focused tests, typecheck, and production build pass; the existing Phaser bundle-size advisory may remain non-failing.

- [ ] **Step 6: Commit and push the progression UI**

  ```powershell
  git add src/App.tsx src/App.test.tsx src/styles.css src/game/phaser/battleGame.test.ts
  git commit -m "feat: show live hero progression"
  git push
  git status --short --branch
  ```

  Expected: `main` is clean and exactly tracking `origin/main`.

### Task 6: Document and verify the complete milestone

**Files:**
- Modify: `README.md`
- Verify: all Milestone 3 source and test files.

**Interfaces:**
- Consumes: the complete balance, progression, combat, campaign, React, and Phaser implementation.
- Produces: final evidence that Milestone 3 is complete on `origin/main` without local persistence.

- [ ] **Step 1: Update README milestone scope**

  Replace the Milestone 2 feature/boundary sections with Milestone 3 text that states:

  ```markdown
  ## Milestone 3 features

  - Automatic XP from farming enemies, breakthrough Sentinels, and chapter bosses.
  - Deterministic level progression from 1 to 200 with overflow XP.
  - ATK, DEF, and max-HP scale from one central balance entrypoint and affect live combat.
  - A responsive Hero panel shows level, XP, ATK, DEF, and HP while Phaser combat continues.
  - Central equipment metadata defines 14 slots, item levels 1–200, and five rarities for Milestone 5.

  ## Milestone 3 boundaries

  Progression exists only in memory and resets on reload. This milestone has no browser persistence, accounts, server syncing, offline progress, skills, item generation, inventory, or currencies.
  ```

- [ ] **Step 2: Run the complete test suite in two bounded batches**

  ```powershell
  & 'C:\Users\alshiha\AppData\Local\OpenAI\Codex\runtimes\cua_node\03b1cdac8af3a530\bin\node.exe' '.\node_modules\vitest\vitest.mjs' run src/App.test.tsx src/game/combatEngine.test.ts src/game/visibilityController.test.ts src/game/balance.test.ts src/game/progression/progressionController.test.ts --configLoader runner --pool=threads --maxWorkers=1 --minWorkers=1
  & 'C:\Users\alshiha\AppData\Local\OpenAI\Codex\runtimes\cua_node\03b1cdac8af3a530\bin\node.exe' '.\node_modules\vitest\vitest.mjs' run src/game/campaign/campaignDefinitions.test.ts src/game/campaign/campaignController.test.ts src/game/campaign/campaignJourney.test.ts src/game/phaser/battleGame.test.ts --configLoader runner --pool=threads --maxWorkers=1 --minWorkers=1
  ```

  Expected: every listed test file passes with no failures.

- [ ] **Step 3: Run static, build, and source-policy verification**

  ```powershell
  & 'C:\Users\alshiha\AppData\Local\OpenAI\Codex\runtimes\cua_node\03b1cdac8af3a530\bin\node.exe' '.\node_modules\typescript\bin\tsc' -b --pretty false
  & 'C:\Users\alshiha\AppData\Local\OpenAI\Codex\runtimes\cua_node\03b1cdac8af3a530\bin\node.exe' '.\node_modules\vite\bin\vite.js' build --configLoader runner
  git diff --check
  rg -n "localStorage|sessionStorage|IndexedDB|document\\.cookie|boss-ready" src
  rg -n "\bdamage\s*:" src --glob '*.ts' --glob '*.tsx'
  ```

  Expected: typecheck/build exit `0`; diff check and both source searches return no matches. The existing non-failing Phaser chunk-size advisory is acceptable.

- [ ] **Step 4: Commit and push milestone documentation**

  ```powershell
  git add README.md
  git commit -m "docs: describe milestone three progression"
  git push
  git status --short --branch
  ```

  Expected: `main` is clean and exactly tracking `origin/main`.

- [ ] **Step 5: Perform final independent code review**

  Review the complete implementation range against `docs/superpowers/specs/2026-07-15-royalstory-milestone-3-design.md`. Fix every Critical or Important finding with covering tests, re-run the relevant verification, commit, push, and re-review until clean.
