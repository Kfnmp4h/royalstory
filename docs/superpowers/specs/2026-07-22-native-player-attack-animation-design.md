# Native Player Attack Animation Design

## Goal

Render Ari's attack animation from the supplied `Base Male-attack.png` spritesheet and `Base Male-attack-v1.json` metadata through the native Canvas layer. Use the same character animation for normal hits, critical hits, and misses without changing combat rules, event timing, or the existing hit presentation.

## Scope

- Animate only the player character, Ari.
- Keep the enemy's current presentation unchanged.
- Preserve the existing native slash, basic impact, and critical impact effects.
- Preserve damage numbers, health interpolation, flashes, camera shake, death presentation, input, persistence, and battle lifecycle.
- Do not replace Phaser's scene, game loop, camera, or static actor rendering in this slice.

## Source Assets

The supplied spritesheet is 1280 by 1280 pixels and contains 25 frames in a five-column by five-row grid. Every frame is 256 by 256 pixels. Frames are read in numeric order from the supplied JSON metadata, from frame `0` through frame `24`.

The source metadata reports a total duration of 2.042 seconds. For combat presentation, the renderer scales that sequence to a fixed 550 ms lifetime so it finishes before Ari's current minimum 900 ms attack interval. Frame selection is proportional across all 25 frames; the gameplay clock and attack interval are not changed.

Repository destinations:

- `public/assets/characters/base-male-attack.png`
- `public/assets/characters/base-male-attack.json`

## Architecture

Extend the existing native Canvas combat overlay with one player-character animation runtime. The runtime loads the character PNG and JSON metadata independently from combat-effect assets, validates the required frame geometry, and exposes a narrow `playPlayerAttack` operation.

`attack_started` presentation events trigger `playPlayerAttack` only when `actorId` is `player`. Normal hits, critical hits, and misses therefore share the same character motion. Enemy `attack_started` events do not trigger it.

While the native attack runtime is active, the existing Phaser Ari visual is hidden. The native renderer draws the current character frame at Ari's established battle coordinates. On completion, asset failure, renderer destruction, or battle teardown, the Phaser Ari visual is restored. Re-triggering during an active animation restarts it at frame zero.

The existing effect runtimes and their stable draw order remain intact. The character frame is drawn as the actor layer, with slash and impact effects retaining their current overlay behavior.

## Data Flow

1. The combat engine emits `attack_started` without changing damage resolution.
2. `CombatPresentationController` forwards player attack starts through a new presentation-port operation.
3. `PhaserCombatPresentationPort` supplies Ari's world position and toggles the Phaser Ari visual.
4. `CombatBattleScene` asks the native renderer to play the player attack.
5. The renderer advances from the existing explicit scene delta, selects the correct JSON frame, and draws it on Canvas.
6. At 550 ms the renderer clears the character runtime and restores the Phaser Ari visual.
7. Hit, critical, miss, damage, health, and death presentation continue through their existing paths.

## Failure Handling

- If the PNG fails to load, report one scoped error and keep the Phaser Ari visual visible.
- If JSON loading or validation fails, report one scoped error and keep the Phaser Ari visual visible.
- Invalid or missing frames disable only the player attack animation; native slash and impact effects continue.
- Destruction is idempotent and restores Ari before removing the Canvas.
- No loading failure may block combat or alter simulation state.

## Testing and TDD Boundaries

Implementation follows RED-GREEN-REFACTOR in small commits.

Tests first lock:

- `attack_started` routes only player attacks to the native character animation;
- normal, critical, and missed player attacks use the same animation trigger;
- the 25 JSON frames are selected in numeric row-major order;
- frame source rectangles traverse the five-by-five 256 px grid correctly;
- the animation lasts exactly 550 ms and restores Ari afterward;
- a repeated trigger restarts at frame zero;
- PNG failure, invalid JSON, and teardown restore or retain the Phaser fallback;
- existing slash, impact, damage, health, shake, death, enemy presentation, and lifecycle tests remain unchanged and green.

## Acceptance Criteria

- Ari visibly performs the supplied animation for every player attack outcome.
- The enemy does not use the supplied animation.
- Ari's Phaser visual is never left hidden after completion, failure, or teardown.
- Existing combat behavior and presentation timing remain unchanged outside the 550 ms character animation.
- Focused tests, TypeScript checking, and the production build pass before delivery.
