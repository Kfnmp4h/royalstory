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
    expect(EQUIPMENT_BALANCE).toEqual({
      slotCount: 14,
      minItemLevel: 1,
      maxItemLevel: 200,
      rarities: ['Normal', 'Rare', 'Epic', 'Unique', 'Legendary'],
    });
    expect(Object.isFrozen(COMBAT_BALANCE)).toBe(true);
    expect(Object.isFrozen(EQUIPMENT_BALANCE.rarities)).toBe(true);
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
