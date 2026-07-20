# Battle and Equipment Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add accessible Battle and Equipment tabs, with Battle selected by default and the Phaser battle renderer remaining mounted while Equipment is viewed.

**Architecture:** `App` owns a local `AppTab` state and renders two persistent tab panels controlled with the `hidden` attribute. Equipment markup moves into a focused `EquipmentTab` component; server commands and canonical state remain owned by `App`.

**Tech Stack:** React 19, TypeScript 5.8, Testing Library, Vitest 3.2, CSS, Phaser 3.90.

## Global Constraints

- Do not change gameplay, campaign advancement, equipment formulas, save data, API commands, Supabase, or Vercel configuration.
- Keep the Phaser battle host mounted across tab changes.
- Use `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, `aria-controls`, and keyboard Left/Right navigation.
- Follow strict RED → GREEN and use small commits.

---

### Task 1: Specify tab navigation behavior

**Files:**
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: rendered `App` and mocked `createBattleGame`.
- Produces: regression coverage for default selection, tab switching, keyboard navigation, and persistent Phaser mounting.

- [x] **Step 1: Write failing tests** asserting Battle is selected by default, Equipment is hidden, clicking Equipment switches panels, ArrowLeft/ArrowRight switches tabs, and `createBattleGame` remains called once.
- [x] **Step 2: Verify RED** with `pnpm test src/App.test.tsx`; expected failure is missing tab roles.
- [x] **Step 3: Commit** as `test: specify battle equipment navigation`.

### Task 2: Extract the Equipment tab

**Files:**
- Create: `src/components/EquipmentTab.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: campaign equipment snapshot, hero level, selected item id, busy state, and command callbacks.
- Produces: the existing loadout, inventory, comparison, equip, and Equip Best UI without behavior changes.

- [x] **Step 1: Move only equipment presentation markup and formatting helpers into `EquipmentTab`**.
- [x] **Step 2: Pass explicit callbacks for selection, equip, and equip-best commands**.
- [x] **Step 3: Run the focused tests and typecheck**.
- [x] **Step 4: Commit** as `refactor: extract equipment tab`.

### Task 3: Add accessible persistent tabs

**Files:**
- Modify: `src/App.tsx`
- Create: `src/navigation.css`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: `AppTab = 'battle' | 'equipment'` local state.
- Produces: an accessible two-tab navigation whose panels stay mounted and use `hidden` for visibility.

- [x] **Step 1: Implement Battle as the default selected tab**.
- [x] **Step 2: Add click and ArrowLeft/ArrowRight navigation with focus movement**.
- [x] **Step 3: Wrap current battle content and `EquipmentTab` in persistent tab panels**.
- [x] **Step 4: Add responsive navigation styling without changing existing panel styling**.
- [x] **Step 5: Run focused/full tests, typecheck, and build**.
- [x] **Step 6: Commit** as `feat: add battle and equipment tabs`.

### Task 4: Production verification

**Files:**
- No source changes expected.

- [x] **Step 1: Verify the final GitHub commit status**.
- [x] **Step 2: Verify Vercel Production reaches `READY` and the production URL responds**.
- [x] **Step 3: Mark this plan complete only after verification evidence exists**.

## Verification evidence

- Final feature commit: `52dd0326432f8a920b48f2792f09d7f0d91c01ee`.
- GitHub Vercel status: `success`.
- Vercel production deployment: `dpl_BzQ2ajDzMBf35nHwX9N49RFXJH9o`, state `READY`.
- Production URL `https://www.playroyalstory.com` responded with HTTP 200 on 2026-07-20.
