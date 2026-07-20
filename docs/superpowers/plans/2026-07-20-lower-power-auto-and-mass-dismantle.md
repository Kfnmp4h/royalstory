# Lower-Power Auto and Mass Dismantle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Skip confirmation for a selected inventory item that is weaker than the equipped item in the same slot, and add an atomic server-authoritative mass dismantle action for all such items.

**Architecture:** A pure eligibility helper defines the strict same-slot lower-power rule. The equipment controller uses that helper for atomic bulk removal and reward aggregation. A new typed player command invokes the bulk operation server-side, while the UI previews count/reward and uses the existing centered confirmation dialog.

**Tech Stack:** TypeScript, React, Phaser, Vitest, Vercel Functions.

## Global Constraints

- Eligibility is `inventoryItem.power < equippedItem.power` for the same slot.
- Equal power, higher power, and slots without equipped items are excluded.
- Selected eligible items dismantle without confirmation.
- Mass dismantle always requires one confirmation showing count and total reward.
- Server recalculates eligibility and reward atomically.
- Existing save-version stale protection and persistent Phaser canvas behavior remain unchanged.

---

### Task 1: Eligibility and atomic domain operation

**Files:**
- Create: `src/game/equipment/lowerPowerDismantle.ts`
- Modify: `src/game/equipment/equipmentTypes.ts`
- Modify: `src/game/equipment/equipmentController.ts`
- Modify: `src/game/equipment/equipmentController.test.ts`

**Interfaces:**
- Produces: `getLowerPowerDismantleItems(inventory, equipped)` and `EquipmentController.dismantleLowerPower()` returning `{ items, armorStones }`.

- [ ] Write failing tests for strict lower power, equal-power exclusion, empty-slot exclusion, aggregate reward, item removal, and latest-drop clearing.
- [ ] Run `pnpm test -- src/game/equipment/equipmentController.test.ts` and verify failure.
- [ ] Implement the pure selector and atomic controller operation.
- [ ] Run the focused tests and verify pass.
- [ ] Commit with `feat: add lower-power dismantle domain operation`.

### Task 2: Typed server command

**Files:**
- Modify: `src/game/save/saveTypes.ts`
- Modify: `api/_lib/playerService.ts`
- Modify: `api/_lib/playerService.test.ts`
- Modify: `src/game/campaign/campaignTypes.ts`
- Modify: `src/game/campaign/campaignController.ts`

**Interfaces:**
- Produces: `{ type: 'dismantleLowerPower'; expectedVersion: number }` and `PersistentCampaignController.dismantleLowerPower()`.

- [ ] Write failing parser/service tests for the command, aggregate reward, stale version, and repeated command safety.
- [ ] Run the focused service tests and verify failure.
- [ ] Implement parsing and the server-authoritative bulk mutation.
- [ ] Run focused tests and verify pass.
- [ ] Commit with `feat: add mass dismantle server command`.

### Task 3: UI behavior and confirmation

**Files:**
- Modify: `src/components/EquipmentTab.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/EquipmentTab.test.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: pure eligibility helper and `onDismantleLowerPower()`.
- Produces: immediate selected-item dismantle when eligible and `Dismantle All Lower Power` confirmation flow.

- [ ] Write failing UI tests for no selected-item confirmation, normal confirmation for non-eligible items, disabled empty bulk action, and count/reward preview.
- [ ] Run focused UI tests and verify failure.
- [ ] Implement the two flows using the existing centered dialog.
- [ ] Run focused UI tests and verify pass.
- [ ] Commit with `feat: add lower-power dismantle controls`.

### Task 4: Verification

- [ ] Run `pnpm test`.
- [ ] Run `pnpm run build`.
- [ ] Verify Vercel deployment reaches READY and production responds successfully.
