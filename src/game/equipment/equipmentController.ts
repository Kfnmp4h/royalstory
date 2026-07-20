import { EQUIPMENT_BALANCE } from '../balance/equipmentBalance';
import type { PlayerCombatProfile, PlayerStats } from '../types';
import { getDismantleReward } from './dismantleReward';
import {
  calculateHeroPower,
  compareItems,
  getItemStatTotals,
} from './equipmentPower';
import {
  EQUIPMENT_SLOTS,
  EQUIPMENT_STAT_KEYS,
  type DropSource,
  type EquippedItems,
  type EquipmentController,
  type EquipmentControllerOptions,
  type EquipmentItem,
  type EquipmentSlot,
  type EquipmentStatKey,
  type EquipmentTotals,
  type EquipmentPersistentState,
  type RandomSource,
} from './equipmentTypes';
import { rollEquipmentDrop } from './itemGenerator';
import { getLowerPowerDismantleItems } from './lowerPowerDismantle';

type MutableEquippedItems = Record<EquipmentSlot, EquipmentItem | null>;

const emptyTotals = (): Record<EquipmentStatKey, number> => ({
  attack: 0,
  maxHp: 0,
  defense: 0,
  accuracy: 0,
  evasion: 0,
  criticalRate: 0,
  criticalDamage: 0,
  attackSpeed: 0,
  damage: 0,
  bossDamage: 0,
  normalDamage: 0,
});

const createEmptyEquipped = (): MutableEquippedItems => Object.fromEntries(
  EQUIPMENT_SLOTS.map((slot) => [slot, null]),
) as MutableEquippedItems;

const sortInventory = (items: readonly EquipmentItem[]): EquipmentItem[] => [...items].sort(
  (left, right) => right.power - left.power || left.id.localeCompare(right.id),
);

const assertUniqueItems = (items: readonly EquipmentItem[]): void => {
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) throw new Error('Equipment state contains duplicate item IDs');
    ids.add(item.id);
  }
};

const aggregateTotals = (equipped: MutableEquippedItems): EquipmentTotals => {
  const totals = emptyTotals();
  for (const item of Object.values(equipped)) {
    if (item === null) continue;
    const itemTotals = getItemStatTotals(item);
    for (const stat of EQUIPMENT_STAT_KEYS) totals[stat] += itemTotals[stat];
  }
  return Object.freeze(totals);
};

const assertBaseStats = (baseStats: Readonly<PlayerStats>): void => {
  if (
    !Number.isFinite(baseStats.attack) || baseStats.attack <= 0
    || !Number.isFinite(baseStats.defense) || baseStats.defense < 0
    || !Number.isFinite(baseStats.maxHp) || baseStats.maxHp <= 0
  ) throw new RangeError('Base stats must contain positive attack/maxHp and non-negative defense');
};

const getEffectiveStats = (
  baseStats: Readonly<PlayerStats>,
  totals: EquipmentTotals,
): Readonly<PlayerCombatProfile> => Object.freeze({
  attack: baseStats.attack + totals.attack,
  defense: baseStats.defense + totals.defense,
  maxHp: baseStats.maxHp + totals.maxHp,
  accuracy: EQUIPMENT_BALANCE.combatDefaults.accuracy + totals.accuracy,
  evasion: EQUIPMENT_BALANCE.combatDefaults.evasion + totals.evasion,
  criticalRate: Math.min(
    EQUIPMENT_BALANCE.combatCaps.criticalRate,
    Math.max(0, EQUIPMENT_BALANCE.combatDefaults.criticalRate + totals.criticalRate),
  ),
  criticalDamage: EQUIPMENT_BALANCE.combatDefaults.criticalDamage + totals.criticalDamage,
  attackSpeed: Math.min(
    EQUIPMENT_BALANCE.combatCaps.attackSpeed,
    Math.max(100, EQUIPMENT_BALANCE.combatDefaults.attackSpeed + totals.attackSpeed),
  ),
  damage: EQUIPMENT_BALANCE.combatDefaults.damage + totals.damage,
  bossDamage: EQUIPMENT_BALANCE.combatDefaults.bossDamage + totals.bossDamage,
  normalDamage: EQUIPMENT_BALANCE.combatDefaults.normalDamage + totals.normalDamage,
});

const selectWinner = (
  current: EquipmentItem | null,
  candidates: readonly EquipmentItem[],
): EquipmentItem | null => {
  if (candidates.length === 0) return current;
  const highestPower = candidates.reduce((power, item) => Math.max(power, item.power), -Infinity);
  if (current?.power === highestPower) return current;
  return candidates
    .filter((item) => item.power === highestPower)
    .sort((left, right) => left.id.localeCompare(right.id))[0];
};

export function createEquipmentController(
  randomOrOptions: RandomSource | EquipmentControllerOptions = Math.random,
): EquipmentController {
  const options = typeof randomOrOptions === 'function' ? { random: randomOrOptions } : randomOrOptions;
  const random = options.random ?? Math.random;
  const initial = options.initialState;
  let inventory: EquipmentItem[] = initial ? sortInventory(initial.inventory) : [];
  let equipped: MutableEquippedItems = initial
    ? { ...createEmptyEquipped(), ...initial.equipped }
    : createEmptyEquipped();
  let latestDrop: EquipmentItem | null = initial?.latestDropId
    ? [...inventory, ...Object.values(equipped)].find((item) => item?.id === initial.latestDropId) ?? null
    : null;
  let nextItemNumber = initial?.nextItemNumber ?? 1;
  assertUniqueItems([...inventory, ...Object.values(equipped).filter((item): item is EquipmentItem => item !== null)]);
  if (!Number.isInteger(nextItemNumber) || nextItemNumber < 1) throw new RangeError('Next item number must be a positive integer');

  const rollDrop = (source: DropSource, itemLevel: number): EquipmentItem | null => {
    const itemId = `item-${nextItemNumber}`;
    const generated = rollEquipmentDrop(source, itemLevel, itemId, random);
    if (generated === null) return null;
    assertUniqueItems([
      ...inventory,
      ...Object.values(equipped).filter((item): item is EquipmentItem => item !== null),
      generated,
    ]);
    inventory = sortInventory([...inventory, generated]);
    latestDrop = generated;
    nextItemNumber += 1;
    return generated;
  };

  const equip = (itemId: string): void => {
    const item = inventory.find((candidate) => candidate.id === itemId);
    if (!item) throw new Error('Inventory item not found');
    const previous = equipped[item.slot];
    const nextInventory = inventory.filter((candidate) => candidate.id !== itemId);
    if (previous) nextInventory.push(previous);
    const nextEquipped = { ...equipped, [item.slot]: item };
    assertUniqueItems([
      ...nextInventory,
      ...Object.values(nextEquipped).filter((candidate): candidate is EquipmentItem => candidate !== null),
    ]);
    inventory = sortInventory(nextInventory);
    equipped = nextEquipped;
  };

  const equipBest = (): void => {
    const allItems = [
      ...inventory,
      ...Object.values(equipped).filter((item): item is EquipmentItem => item !== null),
    ];
    assertUniqueItems(allItems);
    const nextEquipped = createEmptyEquipped();
    for (const slot of EQUIPMENT_SLOTS) {
      const candidates = allItems.filter((item) => item.slot === slot);
      nextEquipped[slot] = selectWinner(equipped[slot], candidates);
    }
    const equippedIds = new Set(
      Object.values(nextEquipped)
        .filter((item): item is EquipmentItem => item !== null)
        .map((item) => item.id),
    );
    const nextInventory = allItems.filter((item) => !equippedIds.has(item.id));
    assertUniqueItems([
      ...nextInventory,
      ...Object.values(nextEquipped).filter((item): item is EquipmentItem => item !== null),
    ]);
    inventory = sortInventory(nextInventory);
    equipped = nextEquipped;
  };

  const dismantle = (itemId: string) => {
    const item = inventory.find((candidate) => candidate.id === itemId);
    if (!item) throw new Error('Inventory item not found');
    inventory = inventory.filter((candidate) => candidate.id !== itemId);
    if (latestDrop?.id === itemId) latestDrop = null;
    return Object.freeze({ item, armorStones: getDismantleReward(item) });
  };

  const dismantleLowerPower = () => {
    const items = getLowerPowerDismantleItems(inventory, equipped as EquippedItems);
    const ids = new Set(items.map((item) => item.id));
    const armorStones = items.reduce((total, item) => total + getDismantleReward(item), 0);
    inventory = inventory.filter((item) => !ids.has(item.id));
    if (latestDrop && ids.has(latestDrop.id)) latestDrop = null;
    return Object.freeze({ items, armorStones });
  };

  const compare = (itemId: string) => {
    const item = inventory.find((candidate) => candidate.id === itemId);
    if (!item) throw new Error('Inventory item not found');
    return compareItems(item, equipped[item.slot]);
  };

  const getSnapshot = (baseStats: Readonly<PlayerStats>) => {
    assertBaseStats(baseStats);
    const totals = aggregateTotals(equipped);
    const equipmentPower = Object.values(equipped).reduce(
      (power, item) => power + (item?.power ?? 0),
      0,
    );
    const effectiveStats = getEffectiveStats(baseStats, totals);
    const equippedSnapshot = Object.freeze({ ...equipped }) as EquippedItems;
    return Object.freeze({
      inventory: Object.freeze([...inventory]),
      equipped: equippedSnapshot,
      latestDrop,
      totals,
      equipmentPower,
      effectiveStats,
      heroPower: calculateHeroPower(baseStats, equipmentPower),
    });
  };

  const getPersistentState = (): EquipmentPersistentState => Object.freeze({
    inventory: Object.freeze([...inventory]),
    equipped: Object.freeze({ ...equipped }) as EquippedItems,
    latestDropId: latestDrop?.id ?? null,
    nextItemNumber,
  });

  return { rollDrop, equip, equipBest, dismantle, dismantleLowerPower, compare, getSnapshot, getPersistentState };
}
