# RoyalStory Milestone 5 Equipment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build session-only equipment drops, inventory, fourteen equipped slots, live combat effects, comparison, Equip Best, and the approved Character First interface.

**Architecture:** Add a pure equipment domain with deterministic generation and immutable controller snapshots, then let the Campaign controller coordinate progression, equipment, and combat. Phaser remains the single runtime owner and command bridge, while React renders campaign snapshots and owns only the selected inventory item ID.

**Tech Stack:** TypeScript 5.8, React 19, Phaser 3.90, Vite 7, Vitest 3.2, Testing Library, CSS.

## Global Constraints

- Canonical delivery branch is `origin/main` at `https://github.com/Kfnmp4h/royalstory.git`.
- Complete tasks in order; every task ends in a verified commit and push before the next task begins.
- Use test-driven development: write the named failing test, observe the expected failure, add only the implementation required for the task, then rerun focused and affected regression tests.
- Equipment and inventory are memory-only for the active session. Never add `localStorage`, `sessionStorage`, IndexedDB, cookies, filesystem saves, accounts, server persistence, or offline progress.
- Do not add dependencies or external assets.
- Item level is the post-XP player level, clamped to integer range 1–200.
- Every item has ATK, DEF, and Max HP main stats; substats, rarity probabilities, formulas, caps, power weights, and encounter rules must match the approved design exactly.
- Keep Ring and Ring 2 as separate fixed slots.
- React may own only transient presentation state; domain state stays in controllers.
- Equipment-only updates must not recreate Phaser or redraw the enemy.
- Preserve existing campaign visuals and battle behavior except for approved miss and critical feedback.
- Failed domain commands validate fully before mutation; public snapshots and nested values are immutable.
- The full 36-chapter journey and ten-minute soak must remain valid.

---

## File Structure

### New files

- `src/game/equipment/equipmentTypes.ts` — equipment unions, immutable item/snapshot/controller interfaces, shared stat keys, and random-source type.
- `src/game/equipment/equipmentPower.ts` — centralized item power, stat contribution, hero power, and comparison arithmetic.
- `src/game/equipment/equipmentPower.test.ts` — exact power-weight and comparison arithmetic tests.
- `src/game/equipment/itemGenerator.ts` — drop chance, rarity/slot/substat selection, item construction, and random-value validation.
- `src/game/equipment/itemGenerator.test.ts` — deterministic probability boundaries and item invariant tests.
- `src/game/equipment/equipmentController.ts` — session IDs, inventory, equipped mapping, aggregation, compare, equip, Equip Best, and immutable snapshots.
- `src/game/equipment/equipmentController.test.ts` — controller atomicity, sorting, swap, tie, Ring/Ring 2, and immutability tests.

### Modified files

- `src/game/balance/equipmentBalance.ts` — exact slots, rarities, probability tables, stat ranges, and power weights.
- `src/game/balance.test.ts` — deep-freeze and policy assertions for expanded equipment balance.
- `src/game/types.ts` — effective combat profile, monster damage kind, miss/critical events, combat RNG options, and live-profile method.
- `src/game/combatEngine.ts` — hit rolls, critical/damage order, attack-speed interval, charged-fraction preservation, and safe Max-HP decreases.
- `src/game/combatEngine.test.ts` — deterministic combat and live-application coverage.
- `src/game/campaign/campaignTypes.ts` — equipment snapshot plus equip commands on campaign controller.
- `src/game/campaign/campaignController.ts` — equipment ownership, post-XP drops, effective profile application, and command atomicity.
- `src/game/campaign/campaignController.test.ts` — source-specific drops, XP ordering, no-roll cases, and live equip integration.
- `src/game/campaign/campaignJourney.test.ts` — 36-chapter and ten-minute inventory-growth regression.
- `src/game/phaser/battleGame.ts` — expose `equip(itemId)` and `equipBest()` to React.
- `src/game/phaser/BattleScene.ts` — forward equipment commands, publish snapshots, and animate miss/critical events without enemy redraw.
- `src/game/phaser/battleGame.test.ts` — command forwarding, lifecycle stability, and combat feedback tests.
- `src/App.tsx` — Character First equipment region, effective Hero stats, inventory selection/comparison, and accessible drop status.
- `src/App.test.tsx` — fourteen slots, inventory ordering, compare/equip, Equip Best, status, and singleton Phaser tests.
- `src/styles.css` — desktop Character First arrangement, rarity treatments, comparison states, and 320px stacked layout.
- `README.md` — update the milestone description and explicitly state session-only equipment.

---

### Task 1: Lock the Equipment Domain Contract and Balance

**Files:**
- Create: `src/game/equipment/equipmentTypes.ts`
- Create: `src/game/equipment/equipmentPower.ts`
- Create: `src/game/equipment/equipmentPower.test.ts`
- Modify: `src/game/balance/equipmentBalance.ts`
- Modify: `src/game/balance.test.ts`
- Modify: `src/game/types.ts`

**Interfaces:**
- Produces: `CombatModifiers`, `PlayerCombatProfile`, `EquipmentSlot`, `EquipmentRarity`, `DropSource`, `EquipmentStatKey`, `EquipmentItem`, `EquipmentTotals`, `EquipmentSnapshot`, `ItemComparison`, `EquipmentController`, `RandomSource`, `calculateItemPower(item)`, `calculateHeroPower(baseStats, equipmentPower)`, and `compareItems(selected, equipped)`.
- Consumes: existing `PlayerStats` from `src/game/types.ts`.

- [ ] **Step 1: Write failing power and immutable-balance tests**

Create `equipmentPower.test.ts` with concrete items that assert all eleven approved weights, rounded totals, positive/neutral/negative comparisons, and hero power. Extend `balance.test.ts` to mutate nested slot, rarity, drop-table, and weight structures and assert that each attempt throws.

```ts
const selected: EquipmentItem = Object.freeze({
  id: 'item-2', slot: 'Gloves', level: 10, rarity: 'Epic',
  name: 'Epic Gloves',
  mainStats: Object.freeze({ attack: 4, defense: 3, maxHp: 20 }),
  substats: Object.freeze([
    Object.freeze({ type: 'criticalRate', value: 3 }),
    Object.freeze({ type: 'attackSpeed', value: 2 }),
  ]),
  power: 118,
});

expect(calculateItemPower(selected)).toBe(118);
expect(calculateHeroPower({ attack: 18, defense: 2, maxHp: 120 }, 118)).toBe(374);
expect(compareItems(selected, null)).toMatchObject({ powerDelta: 118, result: 'positive' });
```

- [ ] **Step 2: Run the focused tests and observe RED**

Run: `pnpm exec vitest run src/game/equipment/equipmentPower.test.ts src/game/balance.test.ts --pool=threads --maxWorkers=1 --minWorkers=1`

Expected: FAIL because the equipment domain modules and expanded balance members do not exist.

- [ ] **Step 3: Define the effective-profile and equipment contracts**

First add the profile types to `src/game/types.ts`, before `equipmentTypes.ts` imports them:

```ts
export interface CombatModifiers {
  accuracy: number; evasion: number; criticalRate: number; criticalDamage: number;
  attackSpeed: number; damage: number; bossDamage: number; normalDamage: number;
}
export interface PlayerCombatProfile extends PlayerStats, CombatModifiers {}
```

Then implement these public type shapes in `equipmentTypes.ts`; use readonly fields and readonly collections throughout.

```ts
export const EQUIPMENT_SLOTS = ['Hat', 'Cape', 'Top', 'Shoulder', 'Bottom', 'Belt', 'Gloves', 'Shoes', 'Ring', 'Ring 2', 'Necklace', 'Eye', 'Face', 'Earring'] as const;
export const EQUIPMENT_RARITIES = ['Normal', 'Rare', 'Epic', 'Unique', 'Legendary'] as const;
export const EQUIPMENT_STAT_KEYS = ['attack', 'maxHp', 'defense', 'accuracy', 'evasion', 'criticalRate', 'criticalDamage', 'attackSpeed', 'damage', 'bossDamage', 'normalDamage'] as const;

export type EquipmentSlot = typeof EQUIPMENT_SLOTS[number];
export type EquipmentRarity = typeof EQUIPMENT_RARITIES[number];
export type EquipmentStatKey = typeof EQUIPMENT_STAT_KEYS[number];
export type DropSource = 'farming' | 'breakthrough' | 'boss';
export type RandomSource = () => number;

export interface EquipmentMainStats { readonly attack: number; readonly defense: number; readonly maxHp: number }
export interface EquipmentSubstat { readonly type: EquipmentStatKey; readonly value: number }
export interface EquipmentItem {
  readonly id: string; readonly slot: EquipmentSlot; readonly level: number;
  readonly rarity: EquipmentRarity; readonly name: string;
  readonly mainStats: Readonly<EquipmentMainStats>;
  readonly substats: readonly Readonly<EquipmentSubstat>[];
  readonly power: number;
}
export type EquippedItems = Readonly<Record<EquipmentSlot, EquipmentItem | null>>;
export type EquipmentTotals = Readonly<Record<EquipmentStatKey, number>>;
export interface ItemComparison {
  readonly selected: EquipmentItem; readonly equipped: EquipmentItem | null;
  readonly powerDelta: number; readonly result: 'positive' | 'neutral' | 'negative';
  readonly statDeltas: EquipmentTotals;
}
export interface EquipmentSnapshot {
  readonly inventory: readonly EquipmentItem[]; readonly equipped: EquippedItems;
  readonly latestDrop: EquipmentItem | null; readonly totals: EquipmentTotals;
  readonly equipmentPower: number; readonly effectiveStats: Readonly<import('../types').PlayerCombatProfile>;
  readonly heroPower: number;
}
export interface EquipmentController {
  rollDrop(source: DropSource, itemLevel: number): EquipmentItem | null;
  equip(itemId: string): void;
  equipBest(): void;
  compare(itemId: string): ItemComparison;
  getSnapshot(baseStats: Readonly<import('../types').PlayerStats>): EquipmentSnapshot;
}
```

- [ ] **Step 4: Expand immutable balance and power arithmetic**

Put exact approved values in `EQUIPMENT_BALANCE`: 14 slots, five rarity multipliers, 25/100/100 drop chances, three cumulative rarity tables, substat count ranges, integer raw range 25–50, percentage ranges 1/1–2/2–3/3–4/4–5, combat caps, and all power weights. Deep-freeze every nested array/object. Implement `calculateItemPower`, `calculateHeroPower`, `getItemStatTotals`, and `compareItems` using one central weight table and `Math.round` only at the final sum.

```ts
export const ITEM_POWER_WEIGHTS = Object.freeze({
  attack: 10, defense: 8, maxHp: 0.5, accuracy: 5, evasion: 5,
  criticalRate: 8, criticalDamage: 3, attackSpeed: 10, damage: 10,
  bossDamage: 5, normalDamage: 5,
} satisfies Record<EquipmentStatKey, number>);

export function calculateHeroPower(base: Readonly<PlayerStats>, equipmentPower: number): number {
  return Math.round(base.attack * 10 + base.defense * 8 + base.maxHp * 0.5 + equipmentPower);
}
```

- [ ] **Step 5: Run GREEN and affected balance tests**

Run: `pnpm exec vitest run src/game/equipment/equipmentPower.test.ts src/game/balance.test.ts --pool=threads --maxWorkers=1 --minWorkers=1`

Expected: PASS with exact weight and deep-immutability assertions.

- [ ] **Step 6: Commit and push Task 1**

```bash
git add src/game/equipment src/game/balance/equipmentBalance.ts src/game/balance.test.ts src/game/types.ts
git commit -m "feat: define equipment domain balance"
git push origin main
```

Expected: `main` and `origin/main` point to the same new commit.

---

### Task 2: Generate Deterministic Equipment Drops

**Files:**
- Create: `src/game/equipment/itemGenerator.ts`
- Create: `src/game/equipment/itemGenerator.test.ts`

**Interfaces:**
- Consumes: `RandomSource`, `DropSource`, `EquipmentItem`, `EQUIPMENT_BALANCE`, and `calculateItemPower` from Task 1.
- Produces: `rollEquipmentDrop(source: DropSource, itemLevel: number, itemId: string, random: RandomSource): EquipmentItem | null`.

- [ ] **Step 1: Write failing boundary and invariant tests**

Use a scripted random helper that throws if the implementation consumes an unexpected value. Cover farming no-drop at `0.25`, farming drop below `0.25`, cumulative rarity boundaries for all sources, the first and last slot, levels 1 and 200, every rarity's substat-count min/max, raw 25/50 rolls, percentage min/max rolls, unique substat types, and invalid random values.

```ts
function scriptedRandom(...values: number[]): RandomSource {
  let index = 0;
  return () => {
    if (index >= values.length) throw new Error('Scripted random exhausted');
    return values[index++];
  };
}

expect(rollEquipmentDrop('farming', 1, 'item-1', scriptedRandom(0.25))).toBeNull();
expect(rollEquipmentDrop('boss', 200, 'item-2', scriptedRandom(0.99, 0.999, 0, 0, 0.999, 0.999, 0.999, 0.999)))
  .toMatchObject({ level: 200, rarity: 'Legendary', slot: 'Earring' });
```

- [ ] **Step 2: Run the generator test and observe RED**

Run: `pnpm exec vitest run src/game/equipment/itemGenerator.test.ts --pool=threads --maxWorkers=1 --minWorkers=1`

Expected: FAIL because `rollEquipmentDrop` is missing.

- [ ] **Step 3: Implement validated random selection and exact formulas**

Every random read must pass `Number.isFinite(value) && value >= 0 && value < 1` before use. Farming consumes the chance roll first; guaranteed sources proceed directly to rarity. Use cumulative `< boundary` selection, `Math.floor(random * length)` for uniform arrays, `Math.floor(random * 26) + 25` for raw percentages, and a shrinking candidate array for unique substats.

```ts
const mainStats = Object.freeze({
  attack: Math.round((1 + itemLevel * 0.05) * rarityMultiplier),
  defense: Math.round((1 + itemLevel * 0.035) * rarityMultiplier),
  maxHp: Math.round((5 + itemLevel * 0.30) * rarityMultiplier),
});

const rawValue = (mainValue: number, randomValue: number) =>
  Math.max(1, Math.round(mainValue * (Math.floor(randomValue * 26) + 25) / 100));
```

Validate source, integer level 1–200, and non-empty item ID before any random call. Freeze main stats, each substat, the substat array, and the final item. Name every item exactly `${rarity} ${slot}` and calculate power only through `calculateItemPower`.

- [ ] **Step 4: Run GREEN and repeat boundary tests**

Run: `pnpm exec vitest run src/game/equipment/itemGenerator.test.ts src/game/equipment/equipmentPower.test.ts --pool=threads --maxWorkers=1 --minWorkers=1`

Expected: PASS, including all exact probability boundaries and immutable-item assertions.

- [ ] **Step 5: Commit and push Task 2**

```bash
git add src/game/equipment/itemGenerator.ts src/game/equipment/itemGenerator.test.ts
git commit -m "feat: generate equipment drops"
git push origin main
```

Expected: clean tracking branch after push.

---

### Task 3: Own Inventory, Equip, Swap, and Equip Best

**Files:**
- Create: `src/game/equipment/equipmentController.ts`
- Create: `src/game/equipment/equipmentController.test.ts`
- Modify: `src/game/equipment/equipmentTypes.ts`

**Interfaces:**
- Consumes: `rollEquipmentDrop`, `compareItems`, `calculateHeroPower`, equipment constants/types, and `PlayerStats`.
- Produces: `createEquipmentController(random?: RandomSource): EquipmentController`; `getSnapshot(baseStats)` returns sorted inventory, all fourteen slots, totals, effective profile, equipment power, and hero power.

- [ ] **Step 1: Write failing controller tests**

Cover fourteen empty slots, a farming no-drop without ID consumption, session IDs incrementing only for successful items, descending power then ID sorting, manual equip and swap, no item loss, fixed Ring/Ring 2 isolation, comparison, Equip Best across all slots, current-item tie preference, lowest-ID empty-slot tie, idempotency, invalid ID atomicity, and attempted nested snapshot mutation.

```ts
const BASE_STATS = Object.freeze({ attack: 18, defense: 2, maxHp: 120 });
const controller = createEquipmentController(() => 0);
const first = controller.rollDrop('boss', 20);
expect(first?.id).toBe('item-1');
controller.equip(first!.id);
expect(controller.getSnapshot(BASE_STATS).equipped[first!.slot]?.id).toBe('item-1');
expect(controller.getSnapshot(BASE_STATS).inventory).not.toContainEqual(first);
```

- [ ] **Step 2: Run the controller test and observe RED**

Run: `pnpm exec vitest run src/game/equipment/equipmentController.test.ts --pool=threads --maxWorkers=1 --minWorkers=1`

Expected: FAIL because the controller factory is missing.

- [ ] **Step 3: Implement transactional controller state**

Keep mutable state private. Generate a candidate ID, call the generator, and increment the counter only after a successful immutable item is returned. Before `equip`, locate the inventory item and construct the entire next inventory/equipped mapping; assign state only after validation. For `equipBest`, group current and inventory candidates per fixed slot, select all winners first, validate unique IDs and item conservation, then commit both collections once.

```ts
const selectWinner = (slot: EquipmentSlot, current: EquipmentItem | null, candidates: readonly EquipmentItem[]) =>
  candidates.reduce<EquipmentItem | null>((winner, item) => {
    if (winner === null || item.power > winner.power) return item;
    if (item.power < winner.power) return winner;
    if (current && (winner.id === current.id || item.id === current.id)) return current;
    return item.id.localeCompare(winner.id) < 0 ? item : winner;
  }, current);
```

Aggregate equipped main stats and substats into all eleven zero-initialized totals. Effective profile is progression ATK/DEF/Max HP plus raw totals, with Accuracy/Evasion/Damage bonuses summed, Critical Rate clamped to 5–100 after adding the 5 base, Critical Damage starting at 100, and Attack Speed clamped to 100–120 after adding the 100 base.

- [ ] **Step 4: Freeze every public snapshot level**

Return newly frozen arrays, equipped mapping, totals, effective profile, and root snapshot on every `getSnapshot`. Reuse immutable item objects but never expose mutable controller arrays/maps. `compare(itemId)` rejects absent items without mutation.

- [ ] **Step 5: Run GREEN and domain regression tests**

Run: `pnpm exec vitest run src/game/equipment --pool=threads --maxWorkers=1 --minWorkers=1`

Expected: PASS for generation, power, controller, transaction, and immutability tests.

- [ ] **Step 6: Commit and push Task 3**

```bash
git add src/game/equipment
git commit -m "feat: manage equipment inventory"
git push origin main
```

Expected: `main...origin/main` with no changed files.

---

### Task 4: Apply Every Equipment Stat to Live Combat

**Files:**
- Modify: `src/game/types.ts`
- Modify: `src/game/combatEngine.ts`
- Modify: `src/game/combatEngine.test.ts`
- Modify: `src/game/campaign/campaignTypes.ts`
- Modify: `src/game/campaign/campaignController.ts`
- Modify: `src/game/campaign/campaignController.test.ts`
- Modify: `src/game/campaign/campaignJourney.test.ts`
- Modify: `src/game/phaser/battleGame.test.ts`

**Interfaces:**
- Consumes: existing `CombatBalance` and approved combat formulas.
- Produces: `CombatEngineOptions`, `MonsterDamageKind`, miss/critical events, `CampaignControllerOptions.combatRandom`, and `applyPlayerStats(profile: PlayerCombatProfile)` with live timer/HP preservation.

- [ ] **Step 1: Write failing deterministic combat tests**

Add tests for hit at the exact threshold, miss immediately above it, player Accuracy, player Evasion against enemy attacks, base 5% Critical Rate, 100% cap, base 100% Critical Damage producing double damage, normal/boss/damage stacking order, 120% Attack Speed, charged-fraction preservation, safe Max-HP decrease, dead/recovering/paused application, and unchanged runtime/counters/enemy HP.

```ts
const profile: PlayerCombatProfile = {
  attack: 18, defense: 2, maxHp: 120, accuracy: 0, evasion: 0,
  criticalRate: 100, criticalDamage: 100, attackSpeed: 120,
  damage: 10, bossDamage: 20, normalDamage: 30,
};
const rolls = [0, 0];
let rollIndex = 0;
const engine = createCombatEngine(balance, { random: () => rolls[rollIndex++]!, monsterDamageKind: 'boss' });
engine.applyPlayerStats(profile);
expect(engine.advance(750)).toContainEqual(expect.objectContaining({ type: 'critical', attacker: 'player' }));
```

- [ ] **Step 2: Run combat tests and observe RED**

Run: `pnpm exec vitest run src/game/combatEngine.test.ts --pool=threads --maxWorkers=1 --minWorkers=1`

Expected: FAIL because modifiers, RNG options, miss/critical events, and reduced Max HP are unsupported.

- [ ] **Step 3: Extend combat types without changing encounter balance objects**

Keep `CombatantConfig` compatible with existing chapter definitions. Add a separate effective profile and options.

```ts
export type MonsterDamageKind = 'normal' | 'boss';
export interface CombatEngineOptions {
  readonly random?: () => number;
  readonly monsterDamageKind?: MonsterDamageKind;
}
```

Add `{ type: 'miss'; attacker; target }` and `{ type: 'critical'; attacker: 'player'; target: 'enemy' }`. Include modifiers plus `effectiveAttackIntervalMs` in player snapshots so React can display the effective profile and tests can verify it.

At the same time, add `CampaignControllerOptions { readonly combatRandom?: RandomSource }`, accept it as the second `createCampaignController` argument, and pass it into every new combat engine. Production defaults to `Math.random`. Update existing deterministic combat, campaign, journey, and Phaser tests to pass `() => 0.5`, which always hits at the base 95% chance and never triggers the base 5% critical chance. Tests for miss and critical boundaries use explicit scripted values instead.

- [ ] **Step 4: Implement exact attack resolution and live application**

Validate every random value before the attack mutates HP. Resolve each attack as attack event → hit roll → miss or damage path. Player damage uses normal/boss bonus then critical; enemy damage remains `max(1, attack - defense)` after its hit roll and never crits.

```ts
const hitChance = Math.min(100, Math.max(50, 95 + attacker.accuracy - target.evasion));
if (readRandom() >= hitChance / 100) {
  events.push({ type: 'miss', attacker: attacker.id, target: target.id });
  return;
}
```

Compute player interval as `baseAttackIntervalMs / (attackSpeed / 100)`. In `applyPlayerStats`, validate the complete profile first, preserve `oldAccumulator / oldInterval`, and set `newAccumulator = clamp(fraction * newInterval, 0, newInterval)`. Living HP becomes `min(oldHp + max(0, newMaxHp - oldMaxHp), newMaxHp)`; dead HP stays 0.

- [ ] **Step 5: Run GREEN plus campaign regressions**

Run: `pnpm exec vitest run src/game/combatEngine.test.ts src/game/campaign/campaignController.test.ts src/game/campaign/campaignJourney.test.ts --pool=threads --maxWorkers=1 --minWorkers=1`

Expected: PASS. Existing campaigns remain deterministic by injecting non-miss/non-critical test RNG where exact old damage sequences matter.

- [ ] **Step 6: Commit and push Task 4**

```bash
git add src/game/types.ts src/game/combatEngine.ts src/game/combatEngine.test.ts src/game/campaign src/game/phaser/battleGame.test.ts
git commit -m "feat: apply equipment combat modifiers"
git push origin main
```

Expected: clean tracking branch after push.

---

### Task 5: Coordinate Post-XP Drops and Live Equip in Campaign

**Files:**
- Modify: `src/game/campaign/campaignTypes.ts`
- Modify: `src/game/campaign/campaignController.ts`
- Modify: `src/game/campaign/campaignController.test.ts`
- Modify: `src/game/campaign/campaignJourney.test.ts`

**Interfaces:**
- Consumes: `createEquipmentController`, `EquipmentSnapshot`, `RandomSource`, and `PlayerCombatProfile`.
- Produces: `CampaignControllerOptions.equipmentRandom`, `CampaignSnapshot.equipment`, `CampaignController.equip(itemId)`, and `CampaignController.equipBest()`.

- [ ] **Step 1: Write failing campaign integration tests**

Prove exactly one `rollDrop` invocation per enemy death, no roll on player death or paused advancement, item level after same-death level-up, farming/breakthrough/boss source routing, no auto-equip, live manual equip without resets, boss bonus routing, completion snapshot retaining equipment, and failed equip leaving campaign/combat/equipment equal to their pre-command snapshots.

```ts
const equipmentRolls = [0.95, 6 / 14, 0, 0, 0];
let equipmentRollIndex = 0;
const campaign = createCampaignController(chapters, {
  equipmentRandom: () => equipmentRolls[equipmentRollIndex++]!,
  combatRandom: () => 0,
});
campaign.advance(100);
expect(campaign.getSnapshot().equipment.latestDrop).toMatchObject({ level: 2, slot: 'Gloves' });
expect(campaign.getSnapshot().equipment.equipped.Gloves).toBeNull();
```

- [ ] **Step 2: Run campaign tests and observe RED**

Run: `pnpm exec vitest run src/game/campaign/campaignController.test.ts src/game/campaign/campaignJourney.test.ts --pool=threads --maxWorkers=1 --minWorkers=1`

Expected: FAIL because campaign snapshots and commands do not expose equipment.

- [ ] **Step 3: Add injectable campaign options and derived profiles**

```ts
export interface CampaignControllerOptions {
  readonly combatRandom?: RandomSource;
  readonly equipmentRandom?: RandomSource;
}
```

Create exactly one Equipment controller per Campaign controller. `startEncounter` calls `equipment.getSnapshot(progression.stats).effectiveStats` and passes `monsterDamageKind: definition.kind === 'boss' ? 'boss' : 'normal'` plus combat RNG to the new engine.

- [ ] **Step 4: Enforce enemy-death ordering and command atomicity**

In `advance`, when the first death is an enemy: award XP, read the completed progression snapshot, roll exactly once with `encounter.kind` and the new level, then apply the equipment-derived profile before any campaign transition. Do not roll on player death or when no death occurred.

For `equip` and `equipBest`, save no duplicate campaign state. Execute the Equipment controller command, compute the new profile, and call `engine?.applyPlayerStats(profile)`. Equipment controller validation occurs before mutation; profile validation is deterministic from validated items.

- [ ] **Step 5: Extend immutable campaign snapshots**

Add `equipment: equipment.getSnapshot(progressionSnapshot.stats)` even when `combat` and `encounter` are null after campaign completion. Assert nested immutability and effective Hero power in tests.

- [ ] **Step 6: Run GREEN, journey, and ten-minute soak**

Run: `pnpm exec vitest run src/game/campaign/campaignController.test.ts src/game/campaign/campaignJourney.test.ts src/game/combatEngine.test.ts --pool=threads --maxWorkers=1 --minWorkers=1`

Expected: PASS across all 36 chapters; the soak inventory grows, all item IDs remain unique, and no state becomes non-finite or stuck.

- [ ] **Step 7: Commit and push Task 5**

```bash
git add src/game/campaign
git commit -m "feat: integrate equipment with campaign"
git push origin main
```

Expected: clean tracking branch after push.

---

### Task 6: Bridge Equipment Commands and Battle Feedback Through Phaser

**Files:**
- Modify: `src/game/phaser/battleGame.ts`
- Modify: `src/game/phaser/BattleScene.ts`
- Modify: `src/game/phaser/battleGame.test.ts`

**Interfaces:**
- Consumes: campaign `equip`, `equipBest`, snapshots, miss events, and critical events.
- Produces: `BattleController.equip(itemId)` and `BattleController.equipBest()` for React.

- [ ] **Step 1: Write failing bridge and feedback tests**

Assert both equipment commands reach the same BattleScene instance, publish a fresh snapshot, do not create a second Phaser game, do not redraw an unchanged enemy, become inert after destroy, and report errors once. Add event tests for `MISS` text and distinct critical damage feedback.

```ts
controller.equip('item-3');
controller.equipBest();
expect(equip).toHaveBeenCalledWith('item-3');
expect(equipBest).toHaveBeenCalledOnce();
expect(phaserBoundary.Game).toHaveBeenCalledTimes(1);
```

- [ ] **Step 2: Run Phaser tests and observe RED**

Run: `pnpm exec vitest run src/game/phaser/battleGame.test.ts --pool=threads --maxWorkers=1 --minWorkers=1`

Expected: FAIL because command methods and miss/critical switch cases are absent.

- [ ] **Step 3: Add command forwarding without lifecycle changes**

Extend `BattleController`, returned controller, and BattleScene with `equip(itemId)` and `equipBest()`. Each BattleScene method follows the existing try/fail pattern, calls the campaign command, then `renderAndPublish(campaign.getSnapshot())`. Do not instantiate a campaign or Phaser game during a command.

- [ ] **Step 4: Add restrained miss and critical animation cases**

For `miss`, float accessible visual text `MISS` at the target without camera shake or damage flash. For `critical`, set a short-lived flag or render `CRITICAL` text so the immediately following damage event uses stronger gold text and shake while retaining the existing event order. Destroy all temporary text in tween completion callbacks.

- [ ] **Step 5: Run GREEN and singleton lifecycle regressions**

Run: `pnpm exec vitest run src/game/phaser/battleGame.test.ts src/App.test.tsx --pool=threads --maxWorkers=1 --minWorkers=1`

Expected: PASS; existing visual deferral, pause/resume, destroy, completion, and singleton tests remain green.

- [ ] **Step 6: Commit and push Task 6**

```bash
git add src/game/phaser/battleGame.ts src/game/phaser/BattleScene.ts src/game/phaser/battleGame.test.ts
git commit -m "feat: bridge equipment battle commands"
git push origin main
```

Expected: clean tracking branch after push.

---

### Task 7: Build the Character First Equipment Interface

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `BattleController.equip`, `equipBest`, `CampaignSnapshot.equipment`, equipment slot/rarity types, and the pure `compareItems` helper.
- Produces: accessible Equipment region, transient selected-item ID, comparison panel, inventory controls, and drop announcement.

- [ ] **Step 1: Write failing React behavior tests**

Construct a complete BattleStatus fixture with fourteen equipped keys and sorted inventory. Assert: effective Hero ATK/DEF/HP and Total Power, fourteen labeled slots including Ring and Ring 2, rarity text, empty text, descending inventory, selection comparison with textual positive/neutral/negative result, Equip selected forwarding ID, Equip Best forwarding, latest-drop `role="status"`, keyboard-native buttons, and exactly one `createBattleGame` call through equipment-only updates.

```tsx
expect(screen.getByRole('region', { name: 'Equipment' })).toBeInTheDocument();
expect(screen.getAllByRole('group', { name: /equipment slot/i })).toHaveLength(14);
await user.click(screen.getByRole('button', { name: /Epic Gloves.*Power 118/i }));
expect(screen.getByText('Upgrade +42 power')).toBeInTheDocument();
await user.click(screen.getByRole('button', { name: 'Equip selected' }));
expect(battleGame.equip).toHaveBeenCalledWith('item-2');
```

- [ ] **Step 2: Run App tests and observe RED**

Run: `pnpm exec vitest run src/App.test.tsx --pool=threads --maxWorkers=1 --minWorkers=1`

Expected: FAIL because Equipment UI and controller commands are not rendered.

- [ ] **Step 3: Render effective Hero values and transient selection**

Add only `selectedItemId` React state plus a `previousDropIdRef` and short drop-message timer. Derive the selected item from `snapshot.equipment.inventory`; call the pure domain `compareItems(selected, equippedForSlot)` helper instead of duplicating comparison arithmetic in React. Clear the visible selection naturally when the ID is no longer in inventory.

- [ ] **Step 4: Render Character First markup**

Use a section labeled `Equipment`, an `equipment-stage` containing an Ari medallion and all fixed slots, `Equip Best` below it, an inventory list below that, and a comparison panel only when an inventory item is selected. Use native buttons and semantic `dl` data. Set rarity classes from a fixed mapping, never from arbitrary item text.

```tsx
<button type="button" onClick={() => controllerRef.current?.equipBest()}>Equip Best</button>
<button type="button" onClick={() => controllerRef.current?.equip(selectedItem.id)}>Equip selected</button>
<p role="status" aria-live="polite">{dropMessage}</p>
```

Every slot must show slot name, then either `Empty` or rarity, item level, item name, and power. Comparison must list power delta and every non-zero stat delta, and express `Upgrade`, `Equal`, or `Downgrade` in text plus color.

- [ ] **Step 5: Implement approved responsive styling**

Create a fourteen-area desktop grid around the centered Ari card, with `minmax(0, 1fr)` tracks to prevent overflow. Style Normal/Rare/Epic/Unique/Legendary with text labels and distinct borders/colors. Keep inventory as a wrapping/grid list, visible focus rings, 44px minimum control height, and no color-only state.

At `max-width: 640px`, switch the stage, slots, comparison, and inventory to a single-column flow, set every child to `min-width: 0`, and keep `overflow-x: hidden` only as a guard—not as a substitute for fitting content. The 320px layout must not require horizontal scrolling.

- [ ] **Step 6: Run GREEN and UI lifecycle regression tests**

Run: `pnpm exec vitest run src/App.test.tsx src/game/phaser/battleGame.test.ts --pool=threads --maxWorkers=1 --minWorkers=1`

Expected: PASS for equipment interactions, accessible labels, drop status, and one Phaser lifetime.

- [ ] **Step 7: Commit and push Task 7**

```bash
git add src/App.tsx src/App.test.tsx src/styles.css
git commit -m "feat: add character first equipment UI"
git push origin main
```

Expected: clean tracking branch after push.

---

### Task 8: Complete End-to-End Verification and Delivery

**Files:**
- Modify: `src/game/campaign/campaignJourney.test.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: the completed Milestone 5 public controller/snapshot contracts.
- Produces: final soak protection and accurate repository documentation; no new runtime API.

- [ ] **Step 1: Strengthen the journey/soak test before documentation**

During ten simulated minutes, periodically call `equipBest`, verify all HP values are finite and bounded, verify inventory/equipped IDs are globally unique, assert no item disappears, and assert progress after the nine-minute checkpoint. Keep the full 36-chapter completion test with equipment enabled and deterministic combat/equipment RNG.

```ts
const ownedIds = [
  ...snapshot.equipment.inventory.map((item) => item.id),
  ...Object.values(snapshot.equipment.equipped).flatMap((item) => item ? [item.id] : []),
];
expect(new Set(ownedIds).size).toBe(ownedIds.length);
expect(snapshot.combat?.player.hp ?? 0).toBeLessThanOrEqual(snapshot.combat?.player.maxHp ?? 0);
```

- [ ] **Step 2: Run the journey test and observe its protection**

Run: `pnpm exec vitest run src/game/campaign/campaignJourney.test.ts --pool=threads --maxWorkers=1 --minWorkers=1`

Expected: PASS only when inventory grows without item loss and the campaign remains live/completable.

- [ ] **Step 3: Update README scope truthfully**

Describe Milestone 5 equipment, drops, fourteen slots, live combat stats, Character First UI, and Equip Best. State explicitly that equipment exists only in memory for the current browser session and that permanent saving begins in Milestone 6. Do not claim accounts, currencies, skills, item deletion, enhancement, or persistence.

- [ ] **Step 4: Run focused equipment and integration suites**

Run: `pnpm exec vitest run src/game/equipment src/game/combatEngine.test.ts src/game/campaign src/game/phaser/battleGame.test.ts src/App.test.tsx --pool=threads --maxWorkers=1 --minWorkers=1`

Expected: all focused tests PASS with zero unhandled errors.

- [ ] **Step 5: Run full verification gates**

Run: `pnpm test`

Expected: all repository tests PASS.

Run: `pnpm typecheck`

Expected: exit 0 with no TypeScript diagnostics.

Run: `pnpm build`

Expected: production build succeeds.

Run: `git diff --check`

Expected: no whitespace errors.

Run: `rg -n "localStorage|sessionStorage|indexedDB|document\.cookie|FileSystem|showSaveFilePicker" src README.md`

Expected: no production persistence usage; any match may occur only in an explicit README prohibition or policy test assertion and must be inspected.

Run: `rg -n "T[B]D|T[O]DO|place[h]older|implement la[t]er|fill in deta[i]ls" src README.md`

Expected: no matches.

- [ ] **Step 6: Perform visual acceptance at desktop and 320px**

Start the app with `pnpm dev`, inspect the Character First layout at desktop width and 320px, and verify: fourteen readable slots, Ari centered on desktop, stacked mobile content, no horizontal scrolling, clear focus states, rarity text plus color, readable comparison, latest-drop feedback, and unchanged battle/campaign art direction. Record any defect as a failing UI test before fixing it, then repeat Steps 4–6.

- [ ] **Step 7: Commit, push, and prove canonical delivery**

```bash
git add src/game/campaign/campaignJourney.test.ts README.md
git commit -m "test: verify milestone five equipment journey"
git push origin main
git status --short --branch
git rev-parse HEAD
git rev-parse origin/main
```

Expected: `## main...origin/main`, no changed files, and identical HEAD/origin-main hashes.

---

## Self-Review Coverage Map

- Domain architecture and immutability: Tasks 1–3.
- Exact drops, rarity, levels, slots, formulas, and substats: Tasks 1–2.
- Unlimited inventory, comparison, swap, Ring isolation, and atomic Equip Best: Task 3.
- Accuracy, Evasion, critical stats, Attack Speed, Damage, Boss Damage, Normal Damage, misses, HP deltas, and live-state preservation: Task 4.
- XP-before-drop ordering, one drop roll, source routing, no player-death/pause drop, and campaign-complete retention: Task 5.
- Phaser command ownership, singleton lifecycle, miss/critical feedback, and no equipment-only enemy redraw: Task 6.
- Character First desktop/mobile UI, effective Hero stats, selection, comparison, rarity accessibility, and latest-drop announcement: Task 7.
- Full journey, ten-minute soak, policy scans, build, visual acceptance, commit/push, and clean tracking: Task 8.
- Excluded Milestones 4, 6, and 7 behavior is prohibited globally and checked again in Task 8.
