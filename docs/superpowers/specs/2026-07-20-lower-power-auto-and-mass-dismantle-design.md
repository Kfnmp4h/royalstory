# Lower-Power Auto and Mass Dismantle Design

## Goal

Improve equipment cleanup with two related behaviors:

1. A selected inventory item with strictly lower power than the equipped item in the same slot can be dismantled immediately without a confirmation dialog.
2. A new `Dismantle All Lower Power` action can dismantle every qualifying inventory item after one confirmation dialog.

## Qualification Rule

An inventory item qualifies as lower power only when all of the following are true:

- An item is equipped in the same equipment slot.
- The inventory item's `power` is strictly less than the equipped item's `power`.
- The item is present in inventory and is not equipped.

Items do not qualify when:

- Their power is equal to the equipped item's power.
- Their power is higher than the equipped item's power.
- No item is equipped in the same slot.

The comparison is always slot-specific. An inventory Hat is compared only with the equipped Hat, a Ring with the corresponding equipped Ring slot recorded on the item, and so on.

## Individual Dismantle Behavior

When the player clicks Dismantle for a selected inventory item:

- If the item qualifies as lower power, dismantle immediately without opening the confirmation modal.
- If the item does not qualify, preserve the existing confirmation modal behavior.
- The server remains authoritative and recalculates the item's current qualification before applying the mutation.
- If the item disappeared, became equipped, or the save version is stale, the existing error or stale-save behavior applies and no duplicate reward is granted.

The existing Armor Stones reward formula remains unchanged.

## Mass Dismantle Behavior

Add a button labeled:

`Dismantle All Lower Power`

The button:

- Is displayed in the Equipment inventory area.
- Is disabled when no inventory items currently qualify.
- Opens the existing centered modal style when at least one item qualifies.
- Shows the exact qualifying item count and total Armor Stones reward, for example:

  `Dismantle 14 lower-power items for 860 Armor Stones?`

- Provides `Cancel` and `Dismantle` actions.
- Supports Escape, backdrop dismissal, focus entry, and focus restoration consistently with the existing dismantle modal.

## Server Command and Atomicity

Add a new command:

```ts
{
  type: 'dismantleLowerPower';
  expectedVersion: number;
}
```

The client does not send item IDs for this operation. The server:

1. Loads the authoritative save.
2. Applies stale-version handling before mutation.
3. Recalculates all qualifying inventory items from the current equipped state.
4. Calculates each reward using the existing dismantle reward function.
5. Removes all qualifying items and adds the summed Armor Stones reward atomically.
6. Clears `latestDropId` when it points to any removed item.
7. Saves once and increments the save version once.

A repeated or stale command cannot reward the same items twice because qualification is recalculated from the saved inventory inside the authoritative operation.

## Domain Interfaces

The equipment domain should expose reusable qualification logic so UI and server code use the same rule names while the server still recalculates independently.

Suggested interfaces:

```ts
export function isLowerPowerThanEquipped(
  item: EquipmentItem,
  equipped: EquippedItems,
): boolean;

export interface DismantleManyResult {
  readonly itemIds: readonly string[];
  readonly itemCount: number;
  readonly armorStones: number;
}

export interface EquipmentController {
  // existing methods
  dismantleLowerPower(): DismantleManyResult;
}
```

The individual `dismantle(itemId)` method keeps its existing behavior and reward calculation.

## UI State and Feedback

The Equipment tab derives:

- Whether the selected item qualifies for immediate dismantle.
- The current count of all qualifying items.
- The current preview reward for all qualifying items.

After successful mass dismantle, show a status message such as:

`14 items dismantled. Received 860 Armor Stones.`

After successful individual immediate dismantle, preserve the existing success feedback.

The Phaser canvas must remain mounted and use the existing state replacement path after save updates.

## Error Handling

- Zero qualifying items: button disabled; server also returns a safe validation response if invoked directly.
- Stale version: return the authoritative record using existing stale behavior; do not mutate.
- Invalid or missing selected item: no reward and no removal.
- Double-click or repeated request: command-in-flight protection remains in the client, while server-side recalculation prevents duplicate rewards.
- Equipped items remain protected under all paths.

## Testing

Add tests for:

- Strictly lower power qualifies.
- Equal power does not qualify.
- Higher power does not qualify.
- Missing equipped item does not qualify.
- Individual qualifying item bypasses the modal and sends dismantle immediately.
- Individual non-qualifying item still opens the modal.
- Mass button is disabled with zero qualifying items.
- Mass modal displays exact item count and total reward.
- Cancel, Escape, and backdrop do not send the command.
- Confirm sends exactly one `dismantleLowerPower` command.
- Server removes every and only qualifying item.
- Server sums rewards correctly across rarities and levels.
- `latestDropId` is cleared when needed.
- Stale and repeated commands cannot double reward.
- Phaser is not destroyed or remounted after either individual or mass dismantle.

## Non-Goals

This change does not add:

- Rarity filters.
- Manual item selection for mass dismantle.
- Auto-dismantle on item drop.
- A setting to change the comparison rule.
- Armor Stones spending.
- Dismantling equal-power items.
