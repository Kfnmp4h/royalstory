# BattleScene Presentation Integration

## Goal

Connect the existing combat presentation system to the Phaser battle scene without changing combat calculations, campaign progression, timing contributions, persistence, or status publication.

## Approach

Use `CombatBattleScene` as the integration boundary. It owns a `CombatPresentationController` backed by a small Phaser-specific `CombatPresentationPort`. The existing `BattleScene` continues to own campaign advancement and gameplay rendering.

The migration is incremental:

1. Expose protected integration hooks from `BattleScene` only where required.
2. Create the presentation controller after Phaser objects exist.
3. After each campaign advance, consume the already-produced presentation events and pass them to the controller.
4. Advance presentation interpolation with the frame delta without feeding additional time into gameplay.
5. Implement the Phaser port in isolated slices: effect sprites, pooled damage text, delayed health bars, and enemy death completion.
6. Remove equivalent legacy presentation behavior only when its replacement is covered by tests.

## Data Flow

`campaign.advance(contributionMs)` remains the only gameplay time input.

After advancement:

- `campaign.consumePresentationEvents()` returns presentation-only events.
- `CombatPresentationController.present(events)` coordinates effects.
- `CombatPresentationController.advance(deltaMs)` advances visual interpolation only.
- Combat snapshots remain the source of health ratios and encounter state.

## Compatibility Rules

- No combat event generation changes.
- No balance constant changes.
- No campaign mode or encounter transition changes.
- No additional calls to `campaign.advance`.
- Existing status publication cadence remains unchanged.
- Enemy redraw deferral remains active until the new death sequence explicitly completes.
- Missing assets fall back through the controller's existing warning and flash behavior.

## Testing Strategy

Each slice follows RED/GREEN:

1. Add a focused test that specifies one integration behavior.
2. Verify the test fails for the expected missing behavior.
3. Add the smallest implementation.
4. Run the focused test, full test suite, typecheck, and production build.
5. Push one small commit and verify Vercel Production reaches READY.

The first implementation test will specify that a combat-enabled scene consumes Campaign presentation events exactly once and forwards them to its controller while gameplay advancement remains unchanged.
