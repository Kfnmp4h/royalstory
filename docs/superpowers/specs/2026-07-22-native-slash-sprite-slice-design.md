# Native Slash Sprite Migration Slice Design

## Context

RoyalStory currently keeps gameplay rules in pure TypeScript while Phaser owns the battle canvas, scene lifecycle, primitive drawing, presentation tweens, camera shake, and combat-effect spritesheets. The existing `CombatPresentationController` already separates combat presentation decisions from the Phaser-backed port.

This first migration slice must demonstrate a project-owned sprite and animation path without rewriting `BattleScene`, replacing the game loop, or changing combat presentation behavior.

## Goal

Render the existing `slash-basic` combat effect through a small native Canvas sprite renderer while Phaser continues to own every other part of the battle scene. The effect must retain its current asset, position, frame metadata, scale, ordering, and lifetime.

## Non-Goals

- Removing the Phaser dependency.
- Replacing `Phaser.Game`, `BattleScene`, or `CombatBattleScene`.
- Migrating impact, critical, death, particle, health, text, tween, or camera effects.
- Changing combat formulas, event ordering, campaign state, rewards, persistence, or React controls.
- Introducing a general-purpose engine, scene graph, input system, or asset pipeline.

## Architecture

`createBattleGame` will mount one transparent native Canvas overlay in the existing battle host alongside the Phaser canvas. The overlay shares the battle's fixed logical size of 960 by 540 and is scaled by CSS with the same host bounds. It is presentation-only and must not accept pointer input.

A focused native sprite renderer owns:

- loading the existing `assets/combat/slash-basic.png` spritesheet;
- creating a `slash-basic` animation at the requested logical coordinates;
- advancing animation time from explicit frame deltas;
- clearing and redrawing the overlay;
- removing the sprite after its final frame; and
- destroying the overlay and any retained animation state during battle teardown.

`CombatBattleScene` continues to receive Phaser's update delta. It forwards the same clamped presentation delta to the native renderer. The existing presentation port routes only `slash-basic` to the native renderer. All other effect keys retain their current Phaser sprite path.

The native renderer is injected behind a narrow interface so its timing and routing can be tested without Phaser, image decoding, or a browser animation loop.

## Sprite Contract

The native `slash-basic` path must use the existing manifest values unchanged:

- URL: `assets/combat/slash-basic.png`
- Frame size: 48 by 48 pixels
- Frame count: 3
- Frame rate: 20 frames per second
- Origin: 0.5, 0.5
- Scale: 2
- Logical actor position: the current player position supplied by the presentation port
- Vertical presentation offset: the same 70 logical pixels currently applied by `CombatBattleScene`

The first frame appears immediately. Explicit delta advances frames deterministically. Once the third frame's duration has elapsed, the sprite is removed and the next render clears it from the overlay.

## Data Flow

1. Combat produces its existing presentation event.
2. `CombatPresentationController` requests `playEffect('slash-basic', 'player')` through the existing presentation port contract.
3. The port resolves the player's current logical position.
4. The port routes `slash-basic` to the native sprite renderer instead of calling Phaser's sprite factory.
5. `CombatBattleScene.update` advances both the existing presentation controller and the native renderer with the same clamped delta.
6. The native renderer selects the appropriate source frame and draws it on the transparent overlay.
7. Other combat effects and feedback continue through their current Phaser implementation.

## Lifecycle and Error Handling

Asset loading begins when the battle renderer is created. A slash request made before the image is ready may be queued as one pending animation; it must not duplicate combat events or fall back to a second Phaser slash.

If the slash asset fails to load, the existing error callback receives an `Error`. Gameplay and the Phaser scene remain mounted and continue running. No automatic Phaser fallback is introduced because it would risk rendering the same presentation event twice.

Pause and resume do not create a separate clock. When Phaser stops scene updates, the native animation also stops receiving delta. Destroy removes the overlay, clears pending animation state, and makes later calls harmless.

## Rendering and Layout

The overlay is transparent, absolutely positioned over the Phaser canvas, and marked `pointer-events: none`. Its backing dimensions remain 960 by 540; responsive sizing follows the existing battle host rather than introducing a second independent scale calculation.

The overlay must not change the battle host's accessible name, focus behavior, tab behavior, or DOM ownership in React. It is decorative and is not exposed as a separate interactive element.

## Testing Strategy

Implementation follows strict RED-GREEN-REFACTOR:

1. Add a focused failing routing test proving that `slash-basic` calls the native sprite renderer and does not call Phaser's `createSprite` path.
2. Add the minimum port change required to pass.
3. Add a failing native renderer test proving immediate first-frame drawing, deterministic frame advancement, final-frame removal, and teardown behavior using a fake drawing surface and image source.
4. Add the minimum native renderer implementation required to pass.
5. Add a focused lifecycle test proving the overlay is mounted once, advanced from scene delta, and destroyed once.
6. Run focused tests after every RED and GREEN step, then run the complete test suite, typecheck, and production build.

Tests must preserve existing assertions for critical hits, damage numbers, misses, health interpolation, enemy death, camera shake, state replacement, visibility pause/resume, and single battle destruction.

## Commit Boundaries

Changes remain independently reviewable:

1. Design specification.
2. Failing test defining native slash routing.
3. Minimal routing implementation.
4. Failing tests defining native sprite timing and lifecycle.
5. Minimal native Canvas renderer and integration.
6. Any behavior-neutral cleanup required after all tests are green.

Every implementation commit must be preceded by a test that was observed failing for the intended missing behavior. Verified commits are pushed according to the repository delivery rules.

## Acceptance Criteria

- `slash-basic` is drawn by project-owned Canvas code.
- Phaser does not create or animate a sprite for `slash-basic`.
- All other combat presentation remains Phaser-backed and behaviorally unchanged.
- The slash retains the existing asset and manifest metadata.
- Animation timing is driven by explicit clamped frame delta.
- Pause, resume, state replacement, tab switching, and teardown retain current behavior.
- The overlay is mounted and destroyed exactly once with the battle controller.
- Focused tests, the full suite, typecheck, and production build pass.
- No Phaser dependency is removed in this slice.
