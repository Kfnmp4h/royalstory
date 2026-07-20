import type { EquippedItems, EquipmentItem } from './equipmentTypes';

export const getLowerPowerDismantleItems = (
  inventory: readonly EquipmentItem[],
  equipped: EquippedItems,
): readonly EquipmentItem[] => Object.freeze(
  inventory.filter((item) => {
    const equippedItem = equipped[item.slot];
    return equippedItem !== null && item.power < equippedItem.power;
  }),
);
