import { describe, expect, it, vi } from 'vitest';
import { calculateItemPower } from './equipmentPower';
import { EQUIPMENT_SLOTS, type DropSource, type EquipmentRarity, type RandomSource } from './equipmentTypes';
import { rollEquipmentDrop } from './itemGenerator';

function scriptedRandom(...values: number[]): RandomSource {
  let index = 0;
  return () => {
    if (index >= values.length) throw new Error('Scripted random exhausted');
    return values[index++];
  };
}

const bossRoll = (
  rarityRoll: number,
  level = 1,
  valueRoll = 0,
) => {
  const itemRolls = rarityRoll < 0.2
    ? [rarityRoll, 0, 3 / 11, valueRoll]
    : [rarityRoll, 0, 0, 3 / 11, valueRoll, 0, 0, 0, 0, 0, 0, 0];
  return rollEquipmentDrop('boss', level, 'item-1', scriptedRandom(...itemRolls));
};

describe('rollEquipmentDrop', () => {
  it('uses the exact farming drop boundary', () => {
    expect(rollEquipmentDrop('farming', 1, 'item-1', scriptedRandom(0.25))).toBeNull();
    expect(rollEquipmentDrop(
      'farming',
      1,
      'item-1',
      scriptedRandom(0.249_999, 0, 0, 0, 0),
    )).toMatchObject({ rarity: 'Normal', slot: 'Hat' });
  });

  it.each([
    ['farming', 0.599_999, 'Normal'],
    ['farming', 0.6, 'Rare'],
    ['farming', 0.85, 'Epic'],
    ['farming', 0.95, 'Unique'],
    ['farming', 0.99, 'Legendary'],
    ['breakthrough', 0.399_999, 'Normal'],
    ['breakthrough', 0.4, 'Rare'],
    ['breakthrough', 0.75, 'Epic'],
    ['breakthrough', 0.92, 'Unique'],
    ['breakthrough', 0.99, 'Legendary'],
    ['boss', 0.199_999, 'Normal'],
    ['boss', 0.2, 'Rare'],
    ['boss', 0.55, 'Epic'],
    ['boss', 0.8, 'Unique'],
    ['boss', 0.95, 'Legendary'],
  ] satisfies readonly [DropSource, number, EquipmentRarity][]) (
    'maps %s rarity roll %s to %s',
    (source, rarityRoll, rarity) => {
      const prefix = source === 'farming' ? [0] : [];
      const generated = rollEquipmentDrop(
        source,
        1,
        'item-1',
        scriptedRandom(...prefix, rarityRoll, 0, 0, 0, 0, 0, 0, 0, 0, 0),
      );
      expect(generated?.rarity).toBe(rarity);
    },
  );

  it('selects the first and last fixed equipment slots uniformly', () => {
    expect(bossRoll(0)?.slot).toBe('Hat');
    expect(rollEquipmentDrop(
      'boss',
      1,
      'item-2',
      scriptedRandom(0, 0.999_999, 0, 0),
    )?.slot).toBe('Earring');
    expect(EQUIPMENT_SLOTS).toHaveLength(14);
  });

  it.each([
    ['Normal', 0, { attack: 1, defense: 1, maxHp: 5 }, { attack: 11, defense: 8, maxHp: 65 }],
    ['Rare', 0.2, { attack: 1, defense: 1, maxHp: 6 }, { attack: 13, defense: 10, maxHp: 78 }],
    ['Epic', 0.55, { attack: 2, defense: 2, maxHp: 8 }, { attack: 17, defense: 12, maxHp: 98 }],
    ['Unique', 0.8, { attack: 2, defense: 2, maxHp: 10 }, { attack: 21, defense: 15, maxHp: 124 }],
    ['Legendary', 0.95, { attack: 3, defense: 2, maxHp: 13 }, { attack: 26, defense: 19, maxHp: 156 }],
  ] satisfies readonly [EquipmentRarity, number, object, object][]) (
    'calculates exact %s main stats at levels 1 and 200',
    (_rarity, rarityRoll, levelOne, levelTwoHundred) => {
      expect(bossRoll(rarityRoll, 1)?.mainStats).toEqual(levelOne);
      expect(bossRoll(rarityRoll, 200)?.mainStats).toEqual(levelTwoHundred);
    },
  );

  it.each([
    ['Normal', 0, 1, 1],
    ['Rare', 0.2, 1, 2],
    ['Epic', 0.55, 1, 2],
    ['Unique', 0.8, 1, 3],
    ['Legendary', 0.95, 1, 4],
  ] satisfies readonly [EquipmentRarity, number, number, number][]) (
    'rolls the approved %s substat count range',
    (_rarity, rarityRoll, minimum, maximum) => {
      const minimumItem = rollEquipmentDrop(
        'boss', 10, 'item-min', scriptedRandom(rarityRoll, 0, 0, 0, 0, 0, 0, 0, 0),
      );
      const maximumItem = rollEquipmentDrop(
        'boss', 10, 'item-max', scriptedRandom(rarityRoll, 0, 0.999_999, 0, 0, 0, 0, 0, 0, 0, 0, 0),
      );
      expect(minimumItem?.substats).toHaveLength(minimum);
      expect(maximumItem?.substats).toHaveLength(maximum);
    },
  );

  it.each([
    ['Normal', 0, 1, 1],
    ['Rare', 0.2, 1, 2],
    ['Epic', 0.55, 2, 3],
    ['Unique', 0.8, 3, 4],
    ['Legendary', 0.95, 4, 5],
  ] satisfies readonly [EquipmentRarity, number, number, number][]) (
    'rolls exact %s percentage-substat bounds',
    (_rarity, rarityRoll, minimum, maximum) => {
      expect(bossRoll(rarityRoll, 10, 0)?.substats[0]).toEqual({ type: 'accuracy', value: minimum });
      expect(bossRoll(rarityRoll, 10, 0.999_999)?.substats[0]).toEqual({ type: 'accuracy', value: maximum });
    },
  );

  it('rolls raw substats from 25 through 50 percent with Math.round', () => {
    const minimum = rollEquipmentDrop(
      'boss', 200, 'item-min', scriptedRandom(0.95, 0, 0, 0, 0),
    );
    const maximum = rollEquipmentDrop(
      'boss', 200, 'item-max', scriptedRandom(0.95, 0, 0, 0, 0.999_999),
    );
    expect(minimum?.substats[0]).toEqual({ type: 'attack', value: 7 });
    expect(maximum?.substats[0]).toEqual({ type: 'attack', value: 13 });
  });

  it('never repeats a substat and freezes the complete generated item', () => {
    const generated = rollEquipmentDrop(
      'boss',
      200,
      'item-legendary',
      scriptedRandom(0.95, 0.999_999, 0.999_999, 0, 0, 0, 0, 0, 0, 0, 0),
    );
    expect(generated).toMatchObject({
      id: 'item-legendary',
      level: 200,
      rarity: 'Legendary',
      slot: 'Earring',
      name: 'Legendary Earring',
    });
    expect(new Set(generated?.substats.map((stat) => stat.type)).size).toBe(4);
    expect(generated?.power).toBe(calculateItemPower(generated!));
    expect(Object.isFrozen(generated)).toBe(true);
    expect(Object.isFrozen(generated?.mainStats)).toBe(true);
    expect(Object.isFrozen(generated?.substats)).toBe(true);
    expect(generated?.substats.every(Object.isFrozen)).toBe(true);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -0.001, 1])(
    'rejects invalid random value %s',
    (invalid) => {
      expect(() => rollEquipmentDrop('boss', 1, 'item-1', () => invalid))
        .toThrow('Random source must return a finite value from 0 up to but not including 1');
    },
  );

  it.each([
    ['unknown source', () => rollEquipmentDrop('unknown' as DropSource, 1, 'item-1', vi.fn())],
    ['level zero', () => rollEquipmentDrop('boss', 0, 'item-1', vi.fn())],
    ['fractional level', () => rollEquipmentDrop('boss', 1.5, 'item-1', vi.fn())],
    ['level 201', () => rollEquipmentDrop('boss', 201, 'item-1', vi.fn())],
    ['empty item ID', () => rollEquipmentDrop('boss', 1, ' ', vi.fn())],
  ])('rejects %s before consuming randomness', (_label, invoke) => {
    expect(invoke).toThrow();
  });
});
