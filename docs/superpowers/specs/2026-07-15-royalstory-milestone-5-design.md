# RoyalStory Milestone 5 Equipment Design

**Status:** Approved design, pending written-spec review  
**Date:** 2026-07-15  
**Roadmap order:** Milestone 5 → Milestone 6 → Milestone 7 → Milestone 4. Skill development remains numbered Milestone 4 but moves to the end.

## Goal

Add equipment drops, an unlimited in-memory inventory, fourteen equipped slots, item comparison, `Equip`, and `Equip Best`. Equipment must immediately and correctly affect combat through ATK, DEF, Max HP, Accuracy, Evasion, critical stats, Attack Speed, and conditional damage bonuses.

Milestone 5 is complete when equipment can be found, retained for the current session, compared, equipped, automatically optimized, and observed changing combat. Permanent server saving remains Milestone 6. Browser storage and filesystem saves remain forbidden.

## Scope

Milestone 5 includes:

- equipment drops from farming, breakthrough, and boss enemies;
- immutable generated items with item level 1–200 and one of five rarities;
- an unlimited in-memory inventory sorted by descending item power;
- fourteen distinct equipment slots;
- ATK, DEF, and Max HP as main stats on every item;
- one to four unique substats according to rarity;
- all approved substats affecting live combat;
- manual comparison and equip;
- atomic `Equip Best` across all slots;
- a Character First Equipment UI;
- short drop and combat feedback for item finds, misses, and critical hits.

Milestone 5 excludes:

- selling, deleting, dismantling, locking, filtering, or inventory limits;
- gold, Skill Stones, Gems, or other currencies;
- accounts, server persistence, browser persistence, filesystem persistence, and offline progress;
- potentials, cubing, rerolling, enhancement, set bonuses, advanced item naming, and external item art;
- skills or any Milestone 4 behavior.

## Approved Equipment Slots

The slots are separate identities, including the two ring slots:

1. Hat
2. Cape
3. Top
4. Shoulder
5. Bottom
6. Belt
7. Gloves
8. Shoes
9. Ring
10. Ring 2
11. Necklace
12. Eye
13. Face
14. Earring

Every generated item belongs to exactly one slot and can only be equipped in that slot.

## Domain Architecture

Equipment is a separate pure domain beside progression and combat.

### Equipment types

`equipmentTypes` defines the slot and rarity unions, main stats, substats, immutable items, equipped-slot state, snapshots, drop source, and controller interface.

An equipment item contains at least:

- a session-unique immutable ID;
- slot;
- item level;
- rarity;
- main stats containing ATK, DEF, and Max HP;
- an immutable ordered list of unique substats;
- a centrally calculated immutable item-power value.

### Item generator

`itemGenerator` owns drop rolls, rarity selection, slot selection, stat rolls, and item construction. It consumes an injected random-number source returning finite values in `[0, 1)`. Production uses session randomness; tests use scripted values.

### Equipment controller

`equipmentController` owns:

- the unlimited inventory;
- all fourteen equipped slots;
- session item IDs;
- latest drop;
- equipment-stat aggregation;
- item comparison;
- `equip(itemId)`;
- `equipBest()`;
- immutable snapshots.

React never owns inventory or equipped state. React may own only transient presentation state such as the currently selected item ID.

### Campaign integration

One Equipment controller is created per Campaign controller. Each campaign snapshot includes an Equipment snapshot. The Campaign controller remains the coordinator between progression, equipment, and combat.

For an enemy death, processing order is exact:

1. Award encounter XP.
2. Finish every resulting level-up.
3. Roll the encounter's equipment drop.
4. When a drop succeeds, generate it using the player's new current level.
5. Add the item to inventory.
6. Continue or transition the encounter using the current equipped combat profile.

Player death and paused advancement produce no drop roll. One enemy death produces at most one item and exactly one drop roll.

Items are never automatically equipped when found.

## Drop Balance

### Drop chance

| Source | Chance for one item |
| --- | ---: |
| Farming | 25% |
| Breakthrough | 100% |
| Boss | 100% |

### Rarity distribution after a successful drop

| Source | Normal | Rare | Epic | Unique | Legendary |
| --- | ---: | ---: | ---: | ---: | ---: |
| Farming | 60% | 25% | 10% | 4% | 1% |
| Breakthrough | 40% | 35% | 17% | 7% | 1% |
| Boss | 20% | 35% | 25% | 15% | 5% |

Probability boundaries are cumulative in the displayed order and must be tested exactly, including values immediately below and on every boundary.

### Item level and slot

- Item level equals the player's level after XP from the same enemy death.
- Item level is an integer from 1 through 200.
- Slot selection is uniform across the fourteen approved slots.

## Main Stats

Every item has all three main stats. Let `L` be item level and `R` the rarity multiplier.

- `ATK = round((1 + L × 0.05) × R)`
- `DEF = round((1 + L × 0.035) × R)`
- `Max HP = round((5 + L × 0.30) × R)`

Rarity multipliers are:

| Rarity | Multiplier |
| --- | ---: |
| Normal | 1.0 |
| Rare | 1.2 |
| Epic | 1.5 |
| Unique | 1.9 |
| Legendary | 2.4 |

`round` means JavaScript `Math.round`. All three results must be positive integers.

## Substats

Approved substat types are:

- ATK
- Max HP
- Defense
- Accuracy
- Evasion
- Critical Rate %
- Critical Damage %
- Attack Speed %
- Damage %
- Boss Monster Damage %
- Normal Monster Damage %

No substat type may appear more than once on an item.

### Substat count

| Rarity | Count |
| --- | --- |
| Normal | Exactly 1 |
| Rare | Uniformly 1 or 2 |
| Epic | Uniformly 1 or 2 |
| Unique | Uniformly 1, 2, or 3 |
| Legendary | Uniformly 1, 2, 3, or 4 |

### Substat values

Raw-stat substats use the corresponding rolled main stat:

- ATK: a uniformly rolled 25–50% of main ATK;
- Defense: a uniformly rolled 25–50% of main DEF;
- Max HP: a uniformly rolled 25–50% of main Max HP.

The raw percentage is an integer from 25 through 50, selected uniformly as
`floor(random × 26) + 25`. It is multiplied by the corresponding main stat,
divided by 100, rounded with `Math.round`, and clamped to a minimum of 1.

All percentage-based substats use integer percentage points:

| Rarity | Inclusive value range per percentage roll |
| --- | --- |
| Normal | 1% |
| Rare | 1–2% |
| Epic | 2–3% |
| Unique | 3–4% |
| Legendary | 4–5% |

Higher rarity therefore increases main stats, the possible substat count, and individual percentage-substat values.

## Effective Combat Profile

The player's progression stats are combined with every equipped item's main stats and raw-stat substats. Percentage substats are summed and converted into the following effective profile.

- Accuracy starts at 0.
- Evasion starts at 0.
- Critical Rate starts at 5% and is clamped to 0–100%.
- Critical Damage starts at 100% bonus damage and has no additional Milestone 5 cap.
- Attack Speed starts at 100% and is clamped to 100–120%.
- Damage, Boss Monster Damage, and Normal Monster Damage start at 0%.

Enemies have 0 Accuracy and 0 Evasion in Milestone 5. Enemies do not critically hit. Player equipment is the only source of the new percentage combat stats.

### Hit and miss

For every attack:

`hitChance = clamp(95 + attacker Accuracy − target Evasion, 50, 100)`

The hit succeeds when the injected combat random value is below `hitChance / 100`. A miss emits attack and miss feedback but no damage event.

### Damage order

For a successful player hit:

1. `baseDamage = max(1, ATK − target DEF)`.
2. Select Normal Monster Damage for farming and breakthrough, or Boss Monster Damage for a boss.
3. `modifiedDamage = floor(baseDamage × (1 + (Damage + selected monster damage) / 100))`.
4. Roll critical chance using the effective Critical Rate.
5. For a critical hit, `finalDamage = floor(modifiedDamage × (1 + Critical Damage / 100))`.
6. For a non-critical hit, `finalDamage = modifiedDamage`.
7. Final damage is never below 1.

A base Critical Damage value of 100% therefore produces 200% total damage.

Enemy damage continues using the existing `max(1, ATK − DEF)` formula after its hit roll. Player Damage, Critical, Boss Damage, and Normal Damage bonuses do not affect enemy attacks.

### Attack Speed

The effective player interval is:

`effectiveInterval = baseAttackInterval / (Attack Speed / 100)`

At 120% Attack Speed the interval is approximately 16.7% shorter than at 100%.

When equipment changes Attack Speed during combat, the engine preserves the charged fraction of the current attack timer:

`newAccumulator = oldAccumulator / oldInterval × newInterval`

The value is clamped to the valid new interval. Equipping never grants an immediate free attack and never resets progress to zero.

## Live Equipment Application

Equipping or using `Equip Best` immediately applies the complete derived combat profile.

Live application must not reset:

- enemy HP;
- attack counters;
- defeated-enemy count;
- active runtime;
- pause state;
- recovery state;
- encounter state;
- campaign state.

Max-HP changes are applied safely in both directions because a manual swap may
replace an item with a weaker one:

- for a living player, a positive Max-HP delta is added to current HP;
- for a living player, a negative Max-HP delta leaves current HP unchanged unless
  it exceeds the new maximum, in which case it is clamped to the new maximum;
- a dead player remains at 0 HP and respawns later with the new maximum HP.

Formally, living HP becomes
`min(oldCurrentHP + max(0, newMaxHP − oldMaxHP), newMaxHP)`. An equipment swap
may therefore reduce effective Max HP but can never directly kill a living player.

## Equip and Inventory Rules

- Inventory has no capacity limit in Milestone 5.
- Inventory snapshots are sorted by descending item power, then stable item ID.
- An equipped item is removed from inventory.
- The previously equipped item in the same slot returns to inventory.
- `equip(itemId)` accepts only an inventory item and equips it into its fixed slot.
- A failed command validates everything before mutation and leaves inventory, equipment, and combat unchanged.
- No item is deleted by equip or `Equip Best`.

`Equip Best` considers the current equipped item and every inventory item for each slot. It selects the highest item-power candidate independently for all fourteen slots. Equal power keeps the currently equipped item; otherwise the stable lowest item ID wins. The entire operation is atomic.

Ring and Ring 2 remain separate fixed slots. A Ring item cannot fill Ring 2 and vice versa.

## Power and Comparison

Item power is the rounded sum of the item's main stats and substats using these central weights:

| Stat | Weight |
| --- | ---: |
| ATK | 10 |
| DEF | 8 |
| Max HP | 0.5 |
| Accuracy | 5 |
| Evasion | 5 |
| Critical Rate | 8 |
| Critical Damage | 3 |
| Attack Speed | 10 |
| Damage | 10 |
| Boss Monster Damage | 5 |
| Normal Monster Damage | 5 |

Caps affect effective combat but do not change an item's immutable displayed power. This keeps comparisons stable.

Equipment power is the sum of equipped item power. Hero power is:

`round(level ATK × 10 + level DEF × 8 + level Max HP × 0.5 + equipment power)`

Comparison shows:

- selected item versus the currently equipped item for that slot;
- item-power difference;
- every changed main stat and substat contribution;
- a positive, neutral, or negative result expressed in text as well as color.

## Character First UI

The approved layout is Character First.

- A new Equipment region appears below the existing Hero region.
- Ari is centered with all fourteen equipment slots arranged around the character on wider screens.
- Each slot shows empty state or equipped item rarity, item level, name, and power.
- `Equip Best` is immediately below the character equipment area.
- The inventory drawer appears below the equipped area and is sorted by descending power.
- Selecting an inventory item opens a comparison with the equipped item in the same slot.
- `Equip selected` sends the item ID to the game controller.
- The latest successful drop briefly announces text such as `Epic Gloves found` through accessible status feedback.
- Rarity is always communicated by text and color, never color alone.
- The Hero panel shows effective ATK, DEF, Max HP, and Total Power, with an equipment contribution where useful.

On narrow screens the slots, Ari, comparison, and inventory stack without horizontal scrolling. Controls remain native keyboard-accessible elements. The existing battle and campaign visual direction remains unchanged.

Equipment-only status updates must not recreate the Phaser game or redraw the enemy visual. Phaser consumes miss and critical events only for battle feedback.

## Errors and Atomicity

The following inputs are rejected before mutation:

- invalid or duplicate item IDs;
- item levels outside integer range 1–200;
- unknown slots, rarities, or substat names;
- non-finite, negative, or otherwise out-of-range stat values;
- duplicate substat types on one item;
- invalid random values outside `[0, 1)`;
- equipping an item not present in inventory;
- any internally inconsistent `Equip Best` candidate set.

Every snapshot, item, stat object, substat list, inventory list, and equipped mapping exposed to consumers is immutable.

## Testing Strategy

### Balance and generation

- exact drop and rarity boundary tests for each encounter source;
- no-drop and successful-drop boundaries;
- item level after same-death XP and level-up;
- all fourteen slot boundaries;
- exact main-stat formulas at level 1 and 200 for all rarities;
- exact substat-count boundaries by rarity;
- raw and percentage substat minimum and maximum rolls;
- no duplicate substats;
- invalid random-source values rejected without state mutation.

### Equipment controller

- immutable initial state with fourteen empty slots;
- unlimited inventory and stable descending-power sorting;
- equip and swap without item loss;
- Ring and Ring 2 isolation;
- comparison deltas;
- `Equip Best` selection, tie behavior, atomicity, and idempotency;
- immutable nested snapshots and unique session IDs.

### Combat

- deterministic hit and miss boundaries;
- Evasion affecting enemy hit chance;
- Critical Rate 5–100% and Critical Damage starting at 100%;
- Damage, Boss Damage, and Normal Damage order;
- Attack Speed 100–120% and charged-fraction preservation;
- live stat application while healthy, damaged, paused, dead, and recovering;
- no reset of enemy HP, runtime, counters, or encounter state.

### Campaign

- one drop roll per enemy death;
- no roll on player death or pause;
- XP and level-up before item generation;
- source-specific drop and rarity behavior;
- farming continuation, breakthrough, boss, boss retry, and full 36-chapter journey with equipment enabled;
- ten-minute automated soak with inventory growth and no stuck state.

### React and Phaser

- all fourteen Character First slots and accessible empty states;
- inventory ordering, selection, comparison, manual equip, and `Equip Best`;
- effective Hero stats and Total Power;
- latest-drop status feedback;
- rarity text plus color;
- responsive 320px and desktop acceptance without horizontal scrolling;
- equipment-only updates neither recreate Phaser nor redraw the enemy;
- miss and critical feedback consume the correct events.

### Policy and delivery

- no `localStorage`, `sessionStorage`, IndexedDB, cookies, or filesystem saves in production code;
- no new dependencies or external assets;
- focused tests, full regression suite, TypeScript build, production build, diff check, and source-policy scans;
- every verified user-facing change committed and pushed to canonical `origin/main`, ending with a clean tracking branch.

## Completion Criteria

Milestone 5 is complete when:

1. farming, breakthrough, and boss drops follow the approved probabilities;
2. generated items meet every slot, level, rarity, main-stat, and substat invariant;
3. inventory retains every unequipped item for the session and sorts it predictably;
4. manual equip, comparison, and `Equip Best` work without item loss;
5. all approved stats immediately affect combat using the approved formulas;
6. Character First UI works accessibly on mobile and desktop;
7. equipment does not regress campaign, progression, or Phaser lifecycle behavior;
8. no persistence or out-of-scope Milestone 4/6/7 behavior is added;
9. the full test, build, review, GitHub push, and clean-tracking gates pass.
