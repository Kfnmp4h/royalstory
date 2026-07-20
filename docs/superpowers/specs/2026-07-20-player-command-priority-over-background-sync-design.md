# Player Commands Take Priority Over Background Sync Design

## Problem

The automatic `sync` command runs every 15 seconds and currently shares the same in-flight lock and `serverBusy` state as player-triggered commands. When a sync overlaps a Dismantle or Equip click, the active command can be ignored or temporarily disabled, which feels like input delay.

## Goal

Player-triggered commands must start immediately and must never be blocked by background sync. Background synchronization remains periodic but becomes invisible and lower priority.

## Command Classes

### Player commands

The following commands are interactive and high priority:

- `startBreakthrough`
- `startBoss`
- `equip`
- `equipBest`
- `dismantle`
- `dismantleLowerPower`

Only player commands use `serverBusy`, disable action buttons, and use the player-command double-submit lock.

### Background sync

The `sync` command is low priority:

- It does not set `serverBusy`.
- It does not disable buttons.
- It does not use the player-command in-flight lock.
- A new sync is skipped when a player command is already running.
- At most one background sync may be active at a time.

## Cancellation and Response Ordering

`playerApi.command` will accept an optional `AbortSignal`.

When a player command starts:

1. Abort the currently active background sync request, if any.
2. Invalidate that sync using a monotonically increasing request generation.
3. Send the player command immediately.

A background sync response may update the record only when all of these remain true:

- it was not aborted;
- its generation is still the current sync generation;
- no player command has superseded it;
- its returned `saveVersion` is not older than the latest applied record.

Aborted requests are silent. They must not show `The game server is unavailable`, stale-save notices, or other errors.

## State Tracking

`App` keeps separate refs:

- `playerCommandInFlightRef: boolean`
- `syncInFlightRef: boolean`
- `syncAbortControllerRef: AbortController | null`
- `syncGenerationRef: number`
- `latestAppliedSaveVersionRef: number`

`latestAppliedSaveVersionRef` is updated whenever a newer record is accepted from props or a response.

## Player Command Flow

1. Ignore duplicate player clicks while another player command is active.
2. Abort and invalidate any active sync.
3. Set `serverBusy` to `true`.
4. Send the command.
5. Apply saved or stale records through the existing `onRecordChange` path.
6. Show existing command-specific notices.
7. Clear `serverBusy` and the player-command lock in `finally`.

## Background Sync Flow

Every 15 seconds:

1. Skip when a player command is active or another sync is active.
2. Create a new `AbortController` and generation value.
3. Send `sync` with the current `expectedVersion` and signal.
4. Ignore aborted, superseded, or older responses.
5. Apply valid loaded/saved/stale records without setting `serverBusy`.
6. Keep existing offline reward notices for accepted sync responses.
7. Clear only the matching sync refs in `finally`.

## API Client Behavior

`playerApi.command(command, options?)` accepts:

```ts
interface PlayerCommandRequestOptions {
  readonly signal?: AbortSignal;
}
```

The underlying request forwards the signal to `fetch`.

Abort errors return a distinguishable internal result or are handled before conversion to the normal unavailable response. The UI must be able to identify an aborted sync and ignore it silently.

No server API contract changes are required.

## UI Behavior

- Dismantle and other action buttons stay enabled while only background sync is running.
- Status changes to `Saving` only for player commands.
- A clicked player action receives immediate visual busy feedback.
- Modal behavior and dismantle confirmation rules remain unchanged.
- Phaser remains mounted and receives accepted server state through `replaceState`.

## Error Handling

- Player-command network failures continue to show the existing error.
- Background-sync network failures may continue to use current background error behavior, except aborts, which are silent.
- A late background response must never overwrite a newer player-command response.
- Locks and abort refs are cleared in `finally`, including thrown errors.

## Testing

Tests must verify:

1. A running sync does not disable Dismantle or set `serverBusy`.
2. Starting Dismantle aborts a running sync and immediately sends Dismantle.
3. A late response from the aborted/superseded sync is ignored.
4. Sync is skipped while a player command is active.
5. Only one sync runs at a time.
6. Duplicate player commands remain blocked.
7. Aborted sync does not produce an unavailable error or notice.
8. A valid sync still applies state and offline reward notices.
9. Phaser is not remounted during either response path.

## Out of Scope

- Retrying failed player commands automatically.
- Queueing multiple player commands.
- Changing the 15-second sync interval.
- Server-side command prioritization.
