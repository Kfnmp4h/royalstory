# Native Impact Sprites Migration Design

## Context

RoyalStory now renders `slash-basic` through a project-owned Canvas overlay while Phaser continues to own the battle scene, game loop, other combat effects, text, health presentation, tweens, and camera shake. The native renderer already advances from the same clamped presentation delta used by `CombatBattleScene`.

This slice extends that proven boundary to the two impact sprites without changing gameplay or broadening the renderer into a general scene engine.

## Goal

Render `impact-basic` and `impact-critical` through the existing native Canvas overlay while preserving their current assets, manifest metadata, actor positions, timing, layering, and associated combat feedback.

After this slice, `slash-basic`, `impact-basic`, and `impact-critical` are native. `enemy-death` and `death-particles` remain Phaser-backed.

## Non-Goals

- Removing Phaser or replacing `Phaser.Game`, `BattleScene`, or `CombatBattleScene`.
- Migrating enemy death, death particles, damage numbers, miss text, actor flash, health interpolation, tweens, or camera shake.
- Changing combat events, damage rules, critical-hit rules, campaign state, rewards, persistence, React input, or responsive layout.
- Adding a new animation loop, timer, scene graph, batching system, or generic asset manager.

## Architecture

Generalize the existing native renderer from a slash-specific method to one narrow effect method:

```ts
playEffect(key: NativeCombatEffectKey, x: number, y: number): void
```

`NativeCombatEffectKey` contains exactly:

```ts
type NativeCombatEffectKey = 'slash-basic' | 'impact-basic' | 'impact-critical';
```

The renderer loads those three assets from `COMBAT_EFFECT_MANIFEST`, stores active animation state by effect key, and redraws all active native effects onto the existing overlay after each explicit `advance(deltaMs)` call.

Starting a new animation replaces only the active animation with the same key. This preserves simultaneous slash and impact rendering while preventing unbounded duplicate state. The renderer continues to use one Canvas element and no independent clock.

## Effect Contracts

Every migrated effect uses its existing manifest definition without modification.

### `slash-basic`

- Frame size: 48 by 48
- Frames: 3
- Frame rate: 20
- Scale: 2

### `impact-basic`

- Frame size: 32 by 32
- Frames: 3
- Frame rate: 24
- Scale: 2

### `impact-critical`

- Frame size: 48 by 48
- Frames: 4
- Frame rate: 24
- Scale: 2.25

All three retain origin `0.5, 0.5`, their current URLs and animation keys, and the existing 70-logical-pixel presentation offset. Source rectangles advance horizontally from frame zero. Destination rectangles are derived from each definition's frame dimensions, scale, origin, and requested actor position.

## Loading and Failure Behavior

The renderer creates and loads one image per native effect key. An animation request made before its image is ready is retained as the current pending animation for that key and appears at frame zero after load.

An asset failure reports one error containing the failed manifest URL. Failure disables only that effect key; other native effects continue loading, advancing, and drawing. No Phaser fallback is introduced for a failed migrated effect because replaying the same presentation event through two render paths risks duplicate feedback.

Destroy remains idempotent: it clears all active animations, detaches all image callbacks, removes the one overlay Canvas, and makes later calls harmless.

## Presentation Routing

The Phaser presentation port continues to resolve the actor's current logical position. Its native-effect hook accepts exactly the three native keys. Other keys return `false` and follow the existing Phaser sprite path.

Critical impact migration changes only sprite rendering. The existing critical damage number, actor flash, health interpolation, and camera shake retain their current controller and Phaser-backed behavior.

## Timing and Drawing

`CombatBattleScene.update` continues to clamp presentation delta to `COMBAT_BALANCE.maxFrameContributionMs` and forwards the same value to the native renderer.

For each loaded active effect:

1. Add the non-negative explicit delta to its elapsed time.
2. Compute `Math.floor(elapsedMs / (1_000 / frameRate))`.
3. Remove the effect when the frame index reaches `frameCount`.
4. Otherwise draw its current horizontal source frame at the manifest-derived destination rectangle.

The Canvas is cleared once per redraw, then active effects are rendered in stable native-key order: slash, basic impact, critical impact. This gives deterministic tests and keeps critical impact above basic impact if both occupy the same target.

## Testing Strategy

Follow strict RED-GREEN-REFACTOR:

1. Add a failing port test proving both impact keys are accepted natively and never create Phaser sprites.
2. Add the minimum routing generalization.
3. Add failing renderer tests for basic-impact geometry and timing, critical-impact geometry and timing, simultaneous slash/impact drawing, same-key replacement, isolated asset failure, and teardown.
4. Add the minimum renderer generalization.
5. Verify scene delta forwarding and battle lifecycle remain unchanged.
6. Run all focused presentation tests, TypeScript verification, production build, and the full test suite for comparison with the documented pre-existing baseline failures.

## Commit Boundaries

1. Design specification.
2. Failing native impact routing tests.
3. Minimal routing implementation.
4. Failing generalized renderer tests.
5. Minimal generalized renderer implementation.
6. Any behavior-neutral cleanup after GREEN.

Every production change must be preceded by a test observed failing for the intended missing behavior. Verified commits are pushed directly to GitHub `main` and the resulting Vercel production deployment is checked to a terminal status.

## Acceptance Criteria

- `impact-basic` and `impact-critical` are drawn by project-owned Canvas code.
- Phaser creates no sprite for slash or either impact effect.
- Slash and impact effects can be active simultaneously.
- A new animation replaces only the same effect key.
- Each migrated effect retains all existing manifest metadata.
- One asset failure does not stop the other native effects.
- Critical damage text, flash, health, and camera shake remain behaviorally unchanged.
- Enemy death and death particles remain Phaser-backed.
- Pause, resume, state replacement, tab switching, and teardown retain current behavior.
- Focused tests, typecheck, and production build pass.
- The full suite introduces no failures beyond the documented pre-existing baseline.
