import type { EquipmentItem, EquipmentRarity } from './equipmentTypes';

export const DISMANTLE_RARITY_MULTIPLIERS: Readonly<Record<EquipmentRarity, number>> = Object.freeze({
  Normal: 1,
  Rare: 2,
  Epic: 4,
  Unique: 7,
  Legendary: 12,
});

export function getDismantleReward(item: EquipmentItem): number {
  if (!Number.isInteger(item.level) || item.level < 1) {
    throw new RangeError('Equipment item level must be a positive integer');
  }
  return Math.floor(item.level * DISMANTLE_RARITY_MULTIPLIERS[item.rarity]);
}
