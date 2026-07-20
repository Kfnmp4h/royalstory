# Equipment Dismantle and Armor Stones Design

## Goal

Add a safe, server-authoritative Dismantle action that removes one selected inventory item and grants a permanent currency named Armor Stones.

## User Experience

The Equipment tab keeps its current item selection and comparison flow. When an inventory item is selected, the comparison panel also shows a `Dismantle` action, the exact reward preview as `Receive N Armor Stones`, and a confirmation step before permanent removal.

After success, the item disappears, selection clears, Armor Stones update, and a status message reports the item and reward. Equipped items cannot be dismantled.

## Reward Formula

Armor Stones are calculated server-side:

```text
floor(item.level × rarityMultiplier)
```

| Rarity | Multiplier |
|---|---:|
| Normal | 1 |
| Rare | 2 |
| Epic | 4 |
| Unique | 7 |
| Legendary | 12 |

The client may preview the reward, but the server recalculates it from the persisted item.

## Persistent State

Add `armorStones` beside `gold` in `PlayerSaveState`. Existing saves without the field load with `armorStones: 0`; schema version remains `1` and decoding supplies the backward-compatible default. Armor Stones must be a finite, non-negative integer.

## Equipment Domain

Add:

```ts
calculateDismantleReward(item: EquipmentItem): number

interface DismantleResult {
  readonly item: EquipmentItem;
  readonly armorStones: number;
}
```

Extend `EquipmentController` with:

```ts
dismantle(itemId: string): DismantleResult
```

The controller locates the item only in inventory, rejects missing or equipped items, calculates the reward, removes the item exactly once, clears `latestDrop` when needed, and returns the removed item plus reward. Currency remains owned by the player-command layer.

## Server Command

Extend `PlayerCommand` with:

```ts
{
  readonly type: 'dismantle';
  readonly expectedVersion: number;
  readonly itemId: string;
}
```

The server loads canonical state, reconstructs equipment, dismantles the item, adds the reward to `armorStones`, persists both changes atomically, and increments save version once. Invalid items do not mutate state. Duplicate or stale submissions cannot grant a second reward.

## Client Integration

Show `Armor Stones: N` in the main header beside Gold. `EquipmentTab` receives the selected item reward preview and an `onDismantle(itemId)` callback. The client sends only `itemId` and `expectedVersion`.

Confirmation copy includes the irreversible action and exact reward, for example:

```text
Dismantle Royal Shoulder Guard for 84 Armor Stones? This cannot be undone.
```

The first version supports one selected inventory item at a time. No bulk dismantle, filters, auto-dismantle, equipped-item dismantle, or spending system is included.

## Error and Busy Behavior

The Dismantle button is disabled while any mutation is in flight. Rejected commands leave the item selected and perform no local mutation. Stale responses render canonical inventory and currency.

## Testing Requirements

Tests cover all rarity rewards, level scaling, inventory removal, equipped-item rejection, latest-drop cleanup, persistence and legacy decoding, invalid currency values, atomic server updates, stale and duplicate protection, confirmation UI, typed command sending, selection clearing after canonical success, and disabled state while saving.

## Non-Goals

No changes to drop rates, item generation, equipment power, stats, Equip Best, combat, progression, offline rewards, gold, Supabase architecture, Vercel configuration, or Armor Stones spending.
