import { describe, expect, it } from 'vitest';
import type { RandomSource } from './equipmentTypes';
import { EQUIPMENT_SLOTS } from './equipmentTypes';
import { createEquipmentController } from './equipmentController';

const BASE_STATS = Object.freeze({ attack: 18, defense: 2, maxHp: 120 });

function scriptedRandom(...values: number[]): RandomSource {
  let index = 0;
  return () => {
    if (index >= values.length) throw new Error('Scripted random exhausted');
    return values[index++];
  };
}

const normalItemRolls = (slotIndex: number) => [0, slotIndex / 14, 0, 0];
const legendaryAttackSpeedRolls = (slotIndex: number) => [
  0.95,
  slotIndex / 14,
  0.999_999,
  7 / 11,
  0.999_999,
  0,
  0,
  0,
  0,
  0,
  0,
];

describe('createEquipmentController', () => {
  it('starts with fourteen frozen empty slots and base effective stats', () => {
    const snapshot = createEquipmentController(() => 0).getSnapshot(BASE_STATS);
    expect(Object.keys(snapshot.equipped)).toEqual(EQUIPMENT_SLOTS);
    expect(Object.values(snapshot.equipped).every((item) => item === null)).toBe(true);
    expect(snapshot).toMatchObject({
      inventory: [],
      latestDrop: null,
      equipmentPower: 0,
      effectiveStats: {
        attack: 18,
        defense: 2,
        maxHp: 120,
        accuracy: 0,
        evasion: 0,
        criticalRate: 5,
        criticalDamage: 100,
        attackSpeed: 100,
        damage: 0,
        bossDamage: 0,
        normalDamage: 0,
      },
      heroPower: 256,
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.inventory)).toBe(true);
    expect(Object.isFrozen(snapshot.equipped)).toBe(true);
    expect(Object.isFrozen(snapshot.totals)).toBe(true);
    expect(Object.isFrozen(snapshot.effectiveStats)).toBe(true);
  });

  it('increments session IDs only after successful drops', () => {
    const controller = createEquipmentController(scriptedRandom(
      0.25,
      ...normalItemRolls(0),
      ...normalItemRolls(1),
    ));
    expect(controller.rollDrop('farming', 1)).toBeNull();
    expect(controller.rollDrop('boss', 1)?.id).toBe('item-1');
    expect(controller.rollDrop('boss', 1)?.id).toBe('item-2');
    expect(controller.getSnapshot(BASE_STATS).latestDrop?.id).toBe('item-2');
  });

  it('keeps unlimited inventory sorted by descending power then stable ID', () => {
    const controller = createEquipmentController(scriptedRandom(
      ...normalItemRolls(6),
      ...normalItemRolls(6),
      ...normalItemRolls(6),
      ...Array.from({ length: 47 }, () => normalItemRolls(6)).flat(),
    ));
    controller.rollDrop('boss', 10);
    controller.rollDrop('boss', 10);
    controller.rollDrop('boss', 200);
    for (let index = 0; index < 47; index += 1) controller.rollDrop('boss', 1);
    const inventory = controller.getSnapshot(BASE_STATS).inventory;
    expect(inventory).toHaveLength(50);
    expect(inventory.slice(0, 3).map((item) => item.id)).toEqual(['item-3', 'item-1', 'item-2']);
    expect(inventory.every((item, index) => index === 0 || inventory[index - 1].power >= item.power)).toBe(true);
  });

  it('compares, equips, and swaps same-slot items without loss', () => {
    const controller = createEquipmentController(scriptedRandom(
      ...normalItemRolls(6),
      ...normalItemRolls(6),
    ));
    const weak = controller.rollDrop('boss', 1)!;
    const strong = controller.rollDrop('boss', 200)!;
    expect(controller.compare(strong.id)).toMatchObject({
      selected: { id: strong.id },
      equipped: null,
      result: 'positive',
    });

    controller.equip(weak.id);
    expect(controller.compare(strong.id)).toMatchObject({
      selected: { id: strong.id },
      equipped: { id: weak.id },
      result: 'positive',
    });
    controller.equip(strong.id);

    const snapshot = controller.getSnapshot(BASE_STATS);
    expect(snapshot.equipped.Gloves?.id).toBe(strong.id);
    expect(snapshot.inventory.map((item) => item.id)).toEqual([weak.id]);
    expect([
      ...snapshot.inventory,
      ...Object.values(snapshot.equipped).filter((item) => item !== null),
    ]).toHaveLength(2);
  });

  it('keeps Ring and Ring 2 as isolated fixed slots', () => {
    const controller = createEquipmentController(scriptedRandom(
      ...normalItemRolls(8),
      ...normalItemRolls(9),
    ));
    const ring = controller.rollDrop('boss', 10)!;
    const ringTwo = controller.rollDrop('boss', 10)!;
    controller.equip(ring.id);
    controller.equip(ringTwo.id);
    expect(controller.getSnapshot(BASE_STATS).equipped).toMatchObject({
      Ring: { id: ring.id, slot: 'Ring' },
      'Ring 2': { id: ringTwo.id, slot: 'Ring 2' },
    });
  });

  it('equips the strongest candidate in every slot and caps Attack Speed at 120%', () => {
    const rolls = EQUIPMENT_SLOTS.flatMap((_slot, index) => legendaryAttackSpeedRolls(index));
    const controller = createEquipmentController(scriptedRandom(...rolls));
    for (let index = 0; index < EQUIPMENT_SLOTS.length; index += 1) {
      controller.rollDrop('boss', 200);
    }
    controller.equipBest();
    const snapshot = controller.getSnapshot(BASE_STATS);
    expect(snapshot.inventory).toEqual([]);
    expect(Object.values(snapshot.equipped).every((item) => item !== null)).toBe(true);
    expect(snapshot.effectiveStats.attackSpeed).toBe(120);
    expect(snapshot.equipmentPower).toBeGreaterThan(0);
    expect(snapshot.heroPower).toBeGreaterThan(256);
  });

  it('keeps the current item on an equal-power Equip Best tie', () => {
    const controller = createEquipmentController(scriptedRandom(
      ...normalItemRolls(6),
      ...normalItemRolls(6),
    ));
    const current = controller.rollDrop('boss', 10)!;
    const tied = controller.rollDrop('boss', 10)!;
    controller.equip(current.id);
    controller.equipBest();
    const once = controller.getSnapshot(BASE_STATS);
    expect(once.equipped.Gloves?.id).toBe(current.id);
    expect(once.inventory.map((item) => item.id)).toEqual([tied.id]);
    controller.equipBest();
    expect(controller.getSnapshot(BASE_STATS)).toEqual(once);
  });

  it('uses the lowest stable ID for an empty-slot equal-power tie', () => {
    const controller = createEquipmentController(scriptedRandom(
      ...normalItemRolls(6),
      ...normalItemRolls(6),
    ));
    controller.rollDrop('boss', 10);
    controller.rollDrop('boss', 10);
    controller.equipBest();
    expect(controller.getSnapshot(BASE_STATS).equipped.Gloves?.id).toBe('item-1');
  });

  it('aggregates equipped main and substats into the effective profile', () => {
    const controller = createEquipmentController(scriptedRandom(
      0.95, 6 / 14, 0.999_999,
      0, 0,
      0, 0,
      0, 0,
      0, 0,
    ));
    const gloves = controller.rollDrop('boss', 200)!;
    controller.equip(gloves.id);
    expect(controller.getSnapshot(BASE_STATS)).toMatchObject({
      totals: { attack: 33, defense: 24, maxHp: 195, accuracy: 4 },
      effectiveStats: { attack: 51, defense: 26, maxHp: 315, accuracy: 4 },
    });
  });

  it('rejects invalid commands and RNG failures without domain mutation', () => {
    const controller = createEquipmentController(() => Number.NaN);
    const before = controller.getSnapshot(BASE_STATS);
    expect(() => controller.equip('missing')).toThrow('Inventory item not found');
    expect(() => controller.compare('missing')).toThrow('Inventory item not found');
    expect(() => controller.rollDrop('boss', 1)).toThrow('Random source must return');
    expect(controller.getSnapshot(BASE_STATS)).toEqual(before);
  });

  it('returns fresh deeply frozen snapshots', () => {
    const controller = createEquipmentController(scriptedRandom(...normalItemRolls(0)));
    controller.rollDrop('boss', 1);
    const first = controller.getSnapshot(BASE_STATS);
    const second = controller.getSnapshot(BASE_STATS);
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(() => (second.inventory as unknown as unknown[]).push('invalid')).toThrow();
    expect(() => ((second.equipped as { Hat: unknown }).Hat = null)).toThrow();
  });
});
