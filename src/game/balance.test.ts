import { describe, expect, it } from 'vitest';
import {
  COMBAT_BALANCE,
  EQUIPMENT_BALANCE,
  MAX_TOTAL_XP,
  PROGRESSION_BALANCE,
  getEncounterXp,
  getStatsForLevel,
  getXpToNextLevel,
} from './balance';

describe('central balance', () => {
  it('keeps combat and equipment metadata frozen', () => {
    expect(COMBAT_BALANCE.player).toMatchObject({ name: 'Ari', maxHp: 120 });
    expect(EQUIPMENT_BALANCE).toMatchObject({
      slotCount: 14,
      minItemLevel: 1,
      maxItemLevel: 200,
      slots: ['Hat', 'Cape', 'Top', 'Shoulder', 'Bottom', 'Belt', 'Gloves', 'Shoes', 'Ring', 'Ring 2', 'Necklace', 'Eye', 'Face', 'Earring'],
      rarities: ['Normal', 'Rare', 'Epic', 'Unique', 'Legendary'],
      rarityMultipliers: { Normal: 1, Rare: 1.2, Epic: 1.5, Unique: 1.9, Legendary: 2.4 },
      dropChances: { farming: 0.25, breakthrough: 1, boss: 1 },
      rarityThresholds: {
        farming: [0.6, 0.85, 0.95, 0.99, 1],
        breakthrough: [0.4, 0.75, 0.92, 0.99, 1],
        boss: [0.2, 0.55, 0.8, 0.95, 1],
      },
      rawSubstatPercent: { min: 25, max: 50 },
      percentageSubstatRanges: {
        Normal: { min: 1, max: 1 },
        Rare: { min: 1, max: 2 },
        Epic: { min: 2, max: 3 },
        Unique: { min: 3, max: 4 },
        Legendary: { min: 4, max: 5 },
      },
    });
    expect(Object.isFrozen(COMBAT_BALANCE)).toBe(true);
    expect(Object.isFrozen(EQUIPMENT_BALANCE)).toBe(true);
    expect(Object.isFrozen(EQUIPMENT_BALANCE.slots)).toBe(true);
    expect(Object.isFrozen(EQUIPMENT_BALANCE.rarities)).toBe(true);
    expect(Object.isFrozen(EQUIPMENT_BALANCE.rarityMultipliers)).toBe(true);
    expect(Object.isFrozen(EQUIPMENT_BALANCE.rarityThresholds)).toBe(true);
    expect(Object.isFrozen(EQUIPMENT_BALANCE.rarityThresholds.farming)).toBe(true);
    expect(Object.isFrozen(EQUIPMENT_BALANCE.percentageSubstatRanges.Legendary)).toBe(true);
    expect(Object.isFrozen(EQUIPMENT_BALANCE.powerWeights)).toBe(true);
  });

  it('exposes exact level, stat, and encounter formulas', () => {
    expect(PROGRESSION_BALANCE.maxLevel).toBe(200);
    expect(getStatsForLevel(1)).toEqual({ attack: 18, defense: 2, maxHp: 120 });
    expect(getStatsForLevel(200)).toEqual({ attack: 416, defense: 201, maxHp: 1_712 });
    expect(getXpToNextLevel(1)).toBe(50);
    expect(getXpToNextLevel(199)).toBe(5_000);
    expect(getXpToNextLevel(200)).toBe(0);
    expect(MAX_TOTAL_XP).toBe(502_475);
    expect(getEncounterXp(1, 'farming')).toBe(10);
    expect(getEncounterXp(36, 'breakthrough')).toBe(320);
    expect(getEncounterXp(36, 'boss')).toBe(800);
  });

  it('rejects values outside the designed level and chapter ranges', () => {
    expect(() => getStatsForLevel(0)).toThrow('Level must be an integer from 1 to 200');
    expect(() => getXpToNextLevel(201)).toThrow('Level must be an integer from 1 to 200');
    expect(() => getEncounterXp(0, 'farming')).toThrow('Chapter must be an integer from 1 to 36');
    expect(() => getEncounterXp(37, 'boss')).toThrow('Chapter must be an integer from 1 to 36');
  });
});
