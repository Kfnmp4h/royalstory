import { describe, expect, it } from 'vitest';
import type { EquipmentItem } from './equipmentTypes';
import {
  calculateHeroPower,
  calculateItemPower,
  compareItems,
  getItemStatTotals,
} from './equipmentPower';

const item = (overrides: Partial<EquipmentItem> = {}): EquipmentItem => Object.freeze({
  id: 'item-2',
  slot: 'Gloves',
  level: 10,
  rarity: 'Epic',
  name: 'Epic Gloves',
  mainStats: Object.freeze({ attack: 4, defense: 3, maxHp: 20 }),
  substats: Object.freeze([
    Object.freeze({ type: 'criticalRate' as const, value: 3 }),
    Object.freeze({ type: 'attackSpeed' as const, value: 2 }),
  ]),
  power: 118,
  ...overrides,
});

describe('equipment power', () => {
  it('uses every approved main-stat and substat weight', () => {
    const weighted = item({
      mainStats: Object.freeze({ attack: 2, defense: 3, maxHp: 10 }),
      substats: Object.freeze([
        Object.freeze({ type: 'attack', value: 1 }),
        Object.freeze({ type: 'defense', value: 1 }),
        Object.freeze({ type: 'maxHp', value: 2 }),
        Object.freeze({ type: 'accuracy', value: 1 }),
        Object.freeze({ type: 'evasion', value: 1 }),
        Object.freeze({ type: 'criticalRate', value: 1 }),
        Object.freeze({ type: 'criticalDamage', value: 1 }),
        Object.freeze({ type: 'attackSpeed', value: 1 }),
        Object.freeze({ type: 'damage', value: 1 }),
        Object.freeze({ type: 'bossDamage', value: 1 }),
        Object.freeze({ type: 'normalDamage', value: 1 }),
      ]),
      power: 119,
    });

    expect(getItemStatTotals(weighted)).toEqual({
      attack: 3,
      maxHp: 12,
      defense: 4,
      accuracy: 1,
      evasion: 1,
      criticalRate: 1,
      criticalDamage: 1,
      attackSpeed: 1,
      damage: 1,
      bossDamage: 1,
      normalDamage: 1,
    });
    expect(calculateItemPower(weighted)).toBe(119);
  });

  it('rounds the final power sum and calculates hero power from level stats', () => {
    expect(calculateItemPower(item())).toBe(118);
    expect(calculateHeroPower({ attack: 18, defense: 2, maxHp: 121 }, 118)).toBe(375);
  });

  it('compares selected and equipped items with all stat deltas', () => {
    const equipped = item({
      id: 'item-1',
      rarity: 'Rare',
      name: 'Rare Gloves',
      mainStats: Object.freeze({ attack: 2, defense: 2, maxHp: 10 }),
      substats: Object.freeze([Object.freeze({ type: 'criticalRate', value: 1 })]),
      power: 51,
    });

    expect(compareItems(item(), equipped)).toEqual({
      selected: item(),
      equipped,
      powerDelta: 67,
      result: 'positive',
      statDeltas: {
        attack: 2,
        maxHp: 10,
        defense: 1,
        accuracy: 0,
        evasion: 0,
        criticalRate: 2,
        criticalDamage: 0,
        attackSpeed: 2,
        damage: 0,
        bossDamage: 0,
        normalDamage: 0,
      },
    });
    expect(compareItems(item({ power: 51 }), equipped).result).toBe('neutral');
    expect(compareItems(item({ power: 50 }), equipped).result).toBe('negative');
    expect(compareItems(item(), null)).toMatchObject({ powerDelta: 118, result: 'positive' });
  });
});
