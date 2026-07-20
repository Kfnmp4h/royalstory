import { describe, expect, it } from 'vitest';
import { createEquipmentController } from './equipmentController';
import { EQUIPMENT_SLOTS, type EquippedItems, type EquipmentItem } from './equipmentTypes';

const BASE_STATS = Object.freeze({ attack: 18, defense: 2, maxHp: 120 });
const emptyEquipped = (): EquippedItems => Object.freeze(Object.fromEntries(
  EQUIPMENT_SLOTS.map((slot) => [slot, null]),
)) as EquippedItems;

const item = (id: string, level = 10): EquipmentItem => Object.freeze({
  id,
  slot: 'Hat',
  level,
  rarity: 'Epic',
  name: 'Epic Hat',
  mainStats: Object.freeze({ attack: 1, defense: 1, maxHp: 1 }),
  substats: Object.freeze([]),
  power: 1,
});

describe('equipment dismantling', () => {
  it('removes one inventory item and returns its Armor Stone reward', () => {
    const selected = item('item-1', 12);
    const controller = createEquipmentController({
      initialState: {
        inventory: [selected],
        equipped: emptyEquipped(),
        latestDropId: selected.id,
        nextItemNumber: 2,
      },
    });

    expect(controller.dismantle(selected.id)).toEqual({ item: selected, armorStones: 48 });
    expect(controller.getSnapshot(BASE_STATS).inventory).toEqual([]);
    expect(controller.getPersistentState().latestDropId).toBeNull();
  });

  it('rejects equipped and missing items without mutation', () => {
    const equippedItem = item('item-1');
    const equipped = Object.freeze({ ...emptyEquipped(), Hat: equippedItem }) as EquippedItems;
    const controller = createEquipmentController({
      initialState: {
        inventory: [],
        equipped,
        latestDropId: equippedItem.id,
        nextItemNumber: 2,
      },
    });
    const before = controller.getPersistentState();

    expect(() => controller.dismantle(equippedItem.id)).toThrow('Inventory item not found');
    expect(() => controller.dismantle('missing')).toThrow('Inventory item not found');
    expect(controller.getPersistentState()).toEqual(before);
  });
});
