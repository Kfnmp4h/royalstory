# Centered Dismantle Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the browser-controlled dismantle confirmation with an accessible, centered in-game modal.

**Architecture:** Add a focused `DismantleConfirmDialog` presentation component. `EquipmentTab` owns open/closed state and the trigger ref, while the existing `onDismantle(itemId)` callback remains the only mutation boundary.

**Tech Stack:** React 19, TypeScript, Testing Library, Vitest, CSS.

## Global Constraints

- Do not change dismantle rewards, server commands, save data, or equipment behavior.
- Render the confirmation in the center of the viewport above a full-screen backdrop.
- Support Cancel, destructive confirmation, Escape, backdrop dismissal, initial focus, and focus restoration.
- Keep one selected inventory item at a time.
- Follow RED → GREEN and use small commits.

---

### Task 1: Specify modal interaction

**Files:**
- Create: `src/components/DismantleConfirmDialog.test.tsx`

**Interfaces:**
- Consumes: `itemName`, `reward`, `busy`, `onCancel`, and `onConfirm`.
- Produces: regression coverage for dialog semantics, confirmation, cancellation, Escape, and backdrop behavior.

- [ ] **Step 1: Write failing tests** that import `DismantleConfirmDialog`, assert `role="dialog"`, verify the item/reward copy, and exercise Cancel, Dismantle, Escape, and backdrop clicks.
- [ ] **Step 2: Verify RED** with `pnpm test src/components/DismantleConfirmDialog.test.tsx`; expected failure is a missing component module.
- [ ] **Step 3: Commit** as `test: specify centered dismantle modal`.

### Task 2: Build the accessible dialog

**Files:**
- Create: `src/components/DismantleConfirmDialog.tsx`

**Interfaces:**
- Consumes: `{ itemName: string; reward: number; busy: boolean; onCancel(): void; onConfirm(): void }`.
- Produces: a centered modal overlay with labelled dialog content and safe dismissal.

- [ ] **Step 1: Implement the modal markup** with `role="dialog"`, `aria-modal="true"`, labelled heading, backdrop click detection, and destructive action copy.
- [ ] **Step 2: Add lifecycle behavior** that focuses the Cancel button on mount and listens for Escape while not busy.
- [ ] **Step 3: Run the focused test** and expect PASS.
- [ ] **Step 4: Commit** as `feat: add dismantle confirmation modal`.

### Task 3: Replace `window.confirm`

**Files:**
- Modify: `src/components/EquipmentTab.tsx`
- Modify: `src/navigation.css`

**Interfaces:**
- Consumes: selected inventory item and the existing `onDismantle(itemId)` callback.
- Produces: trigger-controlled modal state and focus restoration without changing server behavior.

- [ ] **Step 1: Replace `window.confirm`** with local `dismantleDialogOpen` state and a trigger ref.
- [ ] **Step 2: Confirm through the existing callback**, close the modal, and restore focus to the Dismantle trigger after cancel or confirmation.
- [ ] **Step 3: Add fixed overlay and centered panel styling**, including responsive width and clear destructive/cancel actions.
- [ ] **Step 4: Run focused tests and `pnpm run build`**, expecting all checks to pass.
- [ ] **Step 5: Commit** as `feat: center dismantle confirmation modal`.

### Task 4: Production verification

**Files:**
- No source changes expected.

- [ ] **Step 1: Verify GitHub/Vercel status is successful**.
- [ ] **Step 2: Verify the production URL responds successfully**.
- [ ] **Step 3: Mark this plan complete only after evidence exists**.
