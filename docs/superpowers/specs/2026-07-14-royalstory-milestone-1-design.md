# RoyalStory Milestone 1 — Design Specification

## Purpose

Milestone 1 delivers a playable, local combat sandbox for RoyalStory. It proves that the automatic combat loop can run continuously, pause safely when the browser tab is hidden, and resume without corrupting combat state.

The milestone is complete when the combat simulation can run for ten simulated minutes without an exception, an invalid health value, duplicate recovery sequences, or a locked state.

## Scope

### Included

- A Vite application using React and TypeScript.
- A Phaser side-view battle scene.
- One predefined test character named **Ari**.
- One original test enemy named **Mossling**.
- Automatic basic attacks from both combatants.
- Health, damage, death, enemy replacement, and player resurrection.
- Pause and resume tied to the browser Page Visibility API.
- A responsive mobile-first presentation that also works on desktop.
- Automated unit, integration, and ten-minute simulation tests.
- A production build suitable for local browser testing.

### Excluded

- Character creation.
- Accounts, backend services, server saves, and offline rewards.
- Chapters, stages, breakthrough fights, and bosses.
- XP, levels, currencies, equipment, drops, and skills.
- Imported game art, sound, analytics, and persistent settings.

These exclusions are intentional. Later milestones will add them without changing the combat engine's public boundary.

## Chosen Architecture

The application uses a React shell around an isolated Phaser battle scene. React owns application lifecycle and the small diagnostic status panel. Phaser owns rendering, animation, and visual feedback. A pure TypeScript combat engine owns all combat rules and has no dependency on React, Phaser, the DOM, or browser time.

This boundary lets automated tests advance combat with explicit elapsed time while the production Phaser scene forwards frame time to the same engine. The UI observes snapshots and domain events but never calculates damage or edits combat state directly.

## Modules and Responsibilities

### Balance configuration

A central immutable balance module defines all Milestone 1 numbers. Initial values are:

| Value | Ari | Mossling |
|---|---:|---:|
| Max HP | 120 | 90 |
| Basic attack damage | 18 | 9 |
| Attack interval | 900 ms | 1,300 ms |

Enemy replacement delay is 1,200 ms. Player resurrection delay is 3,000 ms, as required by the MVP plan. Values are prototype tuning data and can change in the balance module without changing engine or scene code.

### Combat engine

The combat engine exposes commands to advance time, pause, resume, and read a readonly snapshot. It emits domain events for `attack`, `damage`, `death`, `respawn`, `pause`, and `resume`.

The engine owns:

- Combatant health and alive/dead state.
- Independent attack accumulators.
- The enemy replacement timer.
- The player resurrection timer.
- Kill and attack counters used by the status panel.
- A monotonic active-runtime counter that excludes paused time.

Health is always clamped to `0..maxHp`. Dead combatants cannot attack. Only one recovery timer may exist for a combatant. Paused calls to advance time do not mutate combat progress.

### Phaser battle scene

The Phaser scene creates the combat engine, advances it from the scene update loop, renders the latest snapshot, and turns events into short visual effects. It does not contain combat formulas.

The scene draws all Milestone 1 assets in code:

- A bright, original forest clearing inspired by RoyalStory's Whisperwood direction.
- Ari on the left with a distinct silhouette and warm royal colors.
- Mossling on the right as a rounded green forest creature.
- Ground, distant foliage, soft clouds, and layered color shapes for depth.
- Name labels and health bars for both combatants.
- Floating damage numbers, a brief hit flash, a short attack lunge, and restrained camera shake.

No MapleStory art, names, characters, locations, or other protected assets are used.

### React shell

React mounts exactly one Phaser game instance and destroys it during cleanup. It displays a compact diagnostic panel containing:

- Running, paused, or error status.
- Active combat runtime.
- Total attacks.
- Defeated Mosslings.

An unexpected error stops further advancement and is shown in the panel instead of being silently ignored.

### Visibility controller

A small browser adapter listens for `visibilitychange`. When `document.hidden` becomes true it pauses both the engine and the Phaser scene. When visibility returns it resumes both from the unchanged in-memory state.

Hidden time is not simulated and does not count toward attack timers, replacement timers, resurrection timers, or active runtime. This milestone does not implement offline progress.

## Combat State Flow

1. Ari and Mossling start alive at full health.
2. Each living combatant accumulates time toward its own basic attack.
3. When an interval completes, the attacker emits an attack event and applies fixed damage to the living opponent.
4. Damage emits a damage event and updates the target health.
5. A target reaching zero health emits exactly one death event.
6. A dead Mossling is replaced at full health after 1,200 ms, and continuous combat resumes.
7. A dead Ari stops attacking. After 3,000 ms Ari returns at full health and the current Mossling is reset to full health.
8. If two attacks become due on the same engine step, Ari's due attack resolves first. If it kills Mossling, Mossling's due attack is cancelled because dead combatants cannot attack.

The engine processes elapsed time in bounded slices of at most 100 ms. An individual production frame contributes at most 250 ms. Larger frame gaps are treated as a suspension and discarded, preventing an attack burst after browser throttling. Automated simulation may advance arbitrary durations because the engine internally slices them.

## Responsive Presentation

The application is mobile first. The battle scene uses a fixed logical size and Phaser's fit-and-center scaling so the entire combat area remains visible without horizontal scrolling. The surrounding page uses the available viewport width with a capped desktop width.

The battle remains readable at a 360 px viewport. The desktop layout places the battle and status panel in a centered card without changing combat behavior. Text maintains strong contrast against the background, and animation does not carry gameplay information that is absent from labels or health bars.

## Error and Edge-Case Handling

- Non-finite, zero, or negative elapsed time does not advance combat.
- Health cannot be negative or exceed maximum health.
- A dead attacker cannot produce attack or damage events.
- A dead target cannot receive further damage before recovery.
- Duplicate death, replacement, or resurrection sequences are prevented by explicit phase state.
- Pause and resume are idempotent.
- React development remounting does not leave an orphaned Phaser canvas or duplicate visibility listener.
- An unexpected engine or scene exception changes application status to error and stops the combat loop.

## Testing Strategy

Vitest provides the automated test runner, using jsdom only where the browser lifecycle is required.

### Unit tests

Unit tests cover:

- Each combatant attacking only when its interval is due.
- Correct damage and health clamping.
- Enemy death emitting once and replacement after 1,200 ms.
- Player death emitting once, resurrection after 3,000 ms, and enemy health reset.
- Dead combatants being unable to attack.
- Deterministic ordering when attacks are due together.
- Pause and resume preserving state and excluding hidden time.
- Invalid elapsed time and large elapsed-time slicing.

### Integration tests

Integration tests cover:

- React mounting one Phaser host and cleaning it up on unmount.
- Visibility changes mapping to one pause or resume command.
- A simulated ten-minute combat run completing with valid health ranges, continuing kills, no pending duplicate recovery state, and no engine error.

### Build and browser verification

The verification gate requires:

1. All automated tests passing.
2. TypeScript checks passing.
3. The production build completing without errors.
4. The app loading in a browser at mobile and desktop widths.
5. A real visibility toggle demonstrating paused status, unchanged combat state while hidden, and clean continuation after return.

## Acceptance Criteria

Milestone 1 is accepted when all of the following are true:

- A responsive Phaser side-view scene visibly contains Ari and Mossling.
- Both combatants attack automatically and show health changes and damage feedback.
- Enemy death and replacement work continuously.
- Player death and three-second resurrection are implemented and tested.
- Hiding the browser tab pauses combat; showing it resumes from the same state.
- A ten-minute automated simulation completes without an error, invalid health, duplicate recovery, or locked combat state.
- Tests, type checking, and the production build pass.
- No functionality from Milestone 2 or later is included.

