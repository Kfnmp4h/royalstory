# Equipment Dismantle and Armor Stones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let players permanently dismantle one inventory item at a time for server-calculated Armor Stones.

**Architecture:** The equipment domain owns deterministic reward calculation and inventory removal. The player service applies the returned reward atomically to `PlayerSaveState.armorStones`, while the Equipment tab only previews the same shared formula and sends a typed `dismantle` command after confirmation.

**Tech Stack:** React 19, TypeScript 5.8, Vitest 3.2, Testing Library, Vercel Functions, Phaser campaign/equipment domain.

## Global Constraints

- Only inventory items can be dismantled; equipped items are protected.
- Reward formula: `Math.floor(item.level * rarityMultiplier)`.
- Multipliers: Normal 1, Rare 2, Epic 4, Unique 7, Legendary 12.
- The server is authoritative for item ownership, reward calculation, removal, and currency balance.
- Dismantling and Armor Stone credit must persist atomically in one save-version update.
- Existing combat, drops, equipment power, progression, Gold, and offline rewards must not change.
- Existing schema version remains `1`; missing `armorStones` migrates to `0` during parsing.
- Follow strict RED → GREEN and use small commits.

---

### Task 1: Add deterministic dismantle domain behavior

**Files:**
- Create: `src/game/equipment/dismantleReward.ts`
- Create: `src/game/equipment/dismantleReward.test.ts`
- Modify: `src/game/equipment/equipmentTypes.ts`
- Modify: `src/game/equipment/equipmentController.ts`
- Modify: `src/game/equipment/equipmentController.test.ts`

**Interfaces:**
- Produces: `getDismantleReward(item: EquipmentItem): number`.
- Produces: `EquipmentController.dismantle(itemId: string): DismantleResult`.
- `DismantleResult` contains `{ item: EquipmentItem; armorStones: number }`.

- [ ] **Step 1: Write failing reward tests** for level 10 items yielding Normal 10, Rare 20, Epic 40, Unique 70, and Legendary 120 Armor Stones.
- [ ] **Step 2: Run `pnpm test src/game/equipment/dismantleReward.test.ts`** and verify RED because the module does not exist.
- [ ] **Step 3: Implement the immutable rarity multiplier map and `getDismantleReward`** with positive integer validation.
- [ ] **Step 4: Run the reward tests** and verify GREEN.
- [ ] **Step 5: Write failing controller tests** proving an inventory item is removed, the result returns the exact item/reward, `latestDropId` clears when needed, and equipped or missing IDs are rejected without mutation.
- [ ] **Step 6: Implement `dismantle` in the controller** by locating only in `inventory`, calculating the shared reward, removing once, and clearing `latestDrop` when IDs match.
- [ ] **Step 7: Run focused equipment tests** and commit as `feat: add equipment dismantle domain`.

### Task 2: Persist Armor Stones and execute server commands atomically

**Files:**
- Modify: `src/game/save/saveTypes.ts`
- Modify: `src/game/save/saveCodec.ts`
- Modify: `src/game/save/saveCodec.test.ts`
- Modify: `src/game/campaign/campaignTypes.ts`
- Modify: `src/game/campaign/campaignController.ts`
- Modify: `src/game/campaign/campaignController.test.ts`
- Modify: `api/_lib/playerService.ts`
- Modify: `api/_lib/playerService.test.ts`

**Interfaces:**
- `PlayerSaveState` gains `readonly armorStones: number` next to `gold`.
- `PlayerCommand` gains `{ type: 'dismantle'; expectedVersion: number; itemId: string }`.
- Campaign controller exposes `dismantle(itemId: string): DismantleResult` and persists the resulting inventory mutation.

- [ ] **Step 1: Write failing save tests** proving new saves start at zero, valid balances round-trip, missing legacy balances parse as zero, and negative/non-integer balances fail.
- [ ] **Step 2: Implement the additive schema migration** without changing `schemaVersion`.
- [ ] **Step 3: Write failing campaign and player-service tests** for command parsing, exact reward credit, inventory removal, stale-version rejection, invalid item rejection, and no double credit on a repeated command.
- [ ] **Step 4: Implement the campaign passthrough and player-service command branch** so `armorStones` and campaign state are included in the same `savePlayerState` call.
- [ ] **Step 5: Run save, campaign, and player-service tests** and commit as `feat: persist armor stones from dismantling`.

### Task 3: Add safe single-item Dismantle UI

**Files:**
- Modify: `src/components/EquipmentTab.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- `EquipmentTab` consumes `armorStones`, `onDismantle(itemId)`, and the shared `getDismantleReward` preview.
- `App` sends the typed command and clears selection after a saved response.

- [ ] **Step 1: Write failing UI tests** proving Armor Stones appear in the header, selected items show the exact preview, cancel sends nothing, confirm sends one command, and pending state blocks duplicate clicks.
- [ ] **Step 2: Implement the secondary Dismantle action and native confirmation** using copy that names the item and reward.
- [ ] **Step 3: Add the command callback, clear stale selection after the inventory item disappears, and show a success status message from the saved record transition.
- [ ] **Step 4: Add focused destructive-action styling** without changing existing Equipment layout behavior.
- [ ] **Step 5: Run App tests, typecheck, and build** and commit as `feat: add dismantle equipment action`.

### Task 4: Production verification

**Files:**
- Modify: `docs/superpowers/plans/2026-07-20-equipment-dismantle-armor-stones.md`

- [ ] **Step 1: Run the complete test suite, typecheck, and production build with zero failures.**
- [ ] **Step 2: Verify the final GitHub status is successful.**
- [ ] **Step 3: Verify the Vercel production deployment is `READY` and the production URL returns HTTP 200.**
- [ ] **Step 4: Mark all plan checkboxes complete and commit as `docs: mark dismantle plan complete`.**
