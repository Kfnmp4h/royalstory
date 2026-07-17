# BattleScene Presentation Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect Campaign presentation events to `CombatPresentationController` in `BattleScene` without changing gameplay advancement, snapshots, progression, or encounter transitions.

**Architecture:** Introduce one pure frame coordinator that advances Campaign exactly once, consumes presentation events exactly once, and advances presentation time independently. `BattleScene` will use the coordinator, while `CombatBattleScene` will own a Phaser-backed presentation port and controller. Existing legacy visuals are removed only when their replacement port behavior is verified.

**Tech Stack:** TypeScript 5.9, Phaser 3.90, Vitest 3.2, Vite 7, Vercel Production.

## Global Constraints

- Follow strict RED → GREEN → verification for every behavior change.
- Keep commits small and independently deployable.
- Do not alter combat balance, Campaign progression, event ordering, snapshots, pause behavior, or encounter transitions.
- Do not perform broad rewrites of `BattleScene`.
- Every production commit must finish with `pnpm test`, `pnpm run typecheck`, `pnpm run build`, and Vercel Production `READY` when the environment supports them.

---

### Task 1: Coordinate gameplay and presentation frames

**Files:**
- Create: `src/game/phaser/combatPresentation/advanceCombatPresentationFrame.ts`
- Create: `src/game/phaser/combatPresentation/advanceCombatPresentationFrame.test.ts`
- Modify: `src/game/phaser/BattleScene.ts:123-142`

**Interfaces:**
- Consumes: `CampaignController.advance(elapsedMs)`, `CampaignController.consumePresentationEvents()`, `CampaignController.getSnapshot()`.
- Produces: `advanceCombatPresentationFrame(campaign, presentation, elapsedMs)` returning the existing gameplay events and Campaign snapshot.

- [ ] **Step 1: Write the failing test** proving Campaign advances once, presentation events are consumed once, controller receives them once, presentation time advances once, and the existing gameplay events/snapshot are returned unchanged.
- [ ] **Step 2: Verify RED** with `pnpm test src/game/phaser/combatPresentation/advanceCombatPresentationFrame.test.ts`; expected failure is unresolved module/export.
- [ ] **Step 3: Implement the smallest pure coordinator** with no Phaser dependency.
- [ ] **Step 4: Replace only the corresponding calls in `BattleScene.update`** while preserving render order and legacy animation behavior.
- [ ] **Step 5: Verify GREEN** with the focused test, full tests, typecheck, build, and Vercel Production.
- [ ] **Step 6: Commit** as `feat: coordinate battle presentation frames`.

### Task 2: Create the Phaser presentation port

**Files:**
- Create: `src/game/phaser/combatPresentation/PhaserCombatPresentationPort.ts`
- Create: `src/game/phaser/combatPresentation/PhaserCombatPresentationPort.test.ts`
- Modify: `src/game/phaser/CombatBattleScene.ts`

**Interfaces:**
- Consumes: `CombatPresentationPort`, actor containers, registered effect animations, camera, tweens, and health graphics.
- Produces: a port implementing effect lookup/playback, fallback flash, pooled text handles, health rendering, shake, death completion, and missing-effect warnings.

- [ ] **Step 1: RED-test one port behavior at a time**, beginning with effect lookup and playback placement.
- [ ] **Step 2: Implement only the tested behavior**, then verify focused/full tests and build.
- [ ] **Step 3: Instantiate `CombatPresentationController` in `CombatBattleScene.create`** after animation registration and before `super.create()`.
- [ ] **Step 4: Commit** each independently verified port behavior separately.

### Task 3: Route presentation events and health

**Files:**
- Modify: `src/game/phaser/BattleScene.ts`
- Modify: `src/game/phaser/CombatBattleScene.ts`
- Test: focused integration tests under `src/game/phaser/combatPresentation/`.

**Interfaces:**
- Consumes: the controller created in Task 2 and the coordinator from Task 1.
- Produces: presentation events, immediate health, and delayed health rendered through the controller.

- [ ] **Step 1: RED-test event delivery and health delivery independently.**
- [ ] **Step 2: Wire the controller without changing Campaign advancement or snapshot rendering.**
- [ ] **Step 3: Verify no event is delivered twice and health ratios remain clamped.**
- [ ] **Step 4: Commit event routing and health routing separately.**

### Task 4: Replace legacy feedback incrementally

**Files:**
- Modify: `src/game/phaser/BattleScene.ts`
- Modify: `src/game/phaser/combatPresentation/PhaserCombatPresentationPort.ts`
- Test: corresponding focused port/integration tests.

**Interfaces:**
- Consumes: controller events for hits, critical hits, misses, damage numbers, and enemy defeat.
- Produces: pooled damage numbers, registered sprite effects, delayed HP bar, and coordinated enemy death sequence.

- [ ] **Step 1: Replace damage numbers after RED/GREEN verification.**
- [ ] **Step 2: Replace hit/critical/miss feedback after RED/GREEN verification.**
- [ ] **Step 3: Replace enemy death feedback after RED/GREEN verification.**
- [ ] **Step 4: Remove only the now-duplicated legacy code.**
- [ ] **Step 5: Run regression tests, typecheck, build, and verify Vercel Production `READY`.**
