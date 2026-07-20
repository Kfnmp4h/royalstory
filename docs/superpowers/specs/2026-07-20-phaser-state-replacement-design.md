# Phaser State Replacement Design

## Problem

Successful server commands increment `saveVersion` and replace the canonical player record. `App.tsx` currently creates the Phaser battle game inside an effect that depends on both `record.saveVersion` and `record.state.campaign`. Every saved command therefore destroys and recreates the Phaser controller and canvas. This looks like a page refresh after dismantling equipment and can also occur after equip, sync, breakthrough, and boss commands.

## Goal

Keep the existing Phaser game instance mounted while applying updated canonical campaign state from the server. Server commands must update React UI and Phaser state without destroying the canvas, resetting the active tab, or causing visible flicker.

## Architecture

`createBattleGame` will continue to create the Phaser instance once when the battle host mounts. Its returned `BattleController` will gain a state replacement method:

```ts
replaceState(nextState: CampaignPersistentState): void
```

The initial mount effect in `App.tsx` will no longer depend on `saveVersion` or campaign state. A separate effect will call `controllerRef.current?.replaceState(record.state.campaign)` whenever the canonical campaign object changes.

The Phaser integration will forward `replaceState` to the active battle scene. The scene will rebuild its campaign controller from the provided persistent state while preserving the Phaser `Game`, canvas, scene object, DOM host, and React component tree. It will immediately emit a fresh status snapshot after the replacement.

## Required Behavior

- The Phaser game and canvas are created once per `App` mount.
- A successful dismantle does not call `destroy()` and does not replace the canvas.
- Equip, Equip Best, sync, breakthrough, boss, and stale-record replacement use the same state-replacement path.
- The active Battle/Equipment tab remains unchanged.
- Scroll position, modal state, and surrounding React state are not reset by a save-version change.
- The new canonical server state becomes the source of truth immediately after a command response.
- Existing pause/resume and visibility handling continues to work.
- Actual `App` unmount still destroys the Phaser instance exactly once.

## Scene State Replacement

The battle scene currently owns a campaign controller initialized from persistent state. To replace state safely:

1. Create a new campaign controller using the incoming `CampaignPersistentState`.
2. Replace the scene's controller reference.
3. Clear stale queued presentation events that belong to the previous controller.
4. Refresh all rendered combat and campaign presentation from the new snapshot.
5. Emit a fresh `BattleStatus` without restarting the Phaser scene.

This operation must not advance combat time or generate rewards. It only restores the state returned by the server.

## React Data Flow

After `playerApi.command` returns a record:

1. `onRecordChange(response.record)` updates the canonical React record.
2. Currency and equipment React UI rerender from that record/status.
3. The campaign-state effect invokes `replaceState` on the existing BattleController.
4. The battle scene publishes the restored snapshot.

The Dismantle modal closes normally before/while the command is sent. No browser navigation, form submission, or page reload is introduced.

## Error Handling

If state replacement throws, the existing `onError` callback reports the error and the current Phaser instance remains mounted. The app must not silently destroy and recreate the game as a fallback.

## Testing

Tests must prove:

- rerendering `App` with a higher `saveVersion` does not call the BattleController's `destroy` method;
- the same BattleController receives `replaceState` with the new campaign state;
- initial mount still passes the initial state to `createBattleGame`;
- unmount still calls `destroy` exactly once;
- the Phaser/scene controller exposes and forwards `replaceState`;
- replacing state publishes a snapshot matching the incoming persistent state;
- the Dismantle flow updates inventory and Armor Stones without recreating the battle game.

## Scope

This change does not alter combat formulas, reward generation, save schema, server commands, dismantle rewards, equipment behavior, or tab navigation. It only changes how canonical server state is applied to the already-mounted Phaser client.
