import { describe, expect, it } from 'vitest';
import type { EquipmentItem, EquipmentRarity } from './equipmentTypes';
import { getDismantleReward } from './dismantleReward';

const createItem = (rarity: EquipmentRarity, level = 10): EquipmentItem => Object.freeze({
  id: `item-${rarity}`,
  slot: 'Hat',
  level,
  rarity,
  name: `${rarity} Hat`,
  mainStats: Object.freeze({ attack: 1, defense: 1, maxHp: 1 }),
  substats: Object.freeze([]),
  power: 1,
});

describe('getDismantleReward', () => {
  it.each([
    ['Normal', 10],
    ['Rare', 20],
    ['Epic', 40],
    ['Unique', 70],
    ['Legendary', 120],
  ] as const)('returns the level-scaled %s reward', (rarity, expected) => {
    expect(getDismantleReward(createItem(rarity))).toBe(expected);
  });

  it('scales the reward with item level', () => {
    expect(getDismantleReward(createItem('Epic', 37))).toBe(148);
  });
});
