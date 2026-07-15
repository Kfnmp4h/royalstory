import type { PlayerCombatProfile, PlayerStats } from '../types';

export const EQUIPMENT_SLOTS = Object.freeze([
  'Hat',
  'Cape',
  'Top',
  'Shoulder',
  'Bottom',
  'Belt',
  'Gloves',
  'Shoes',
  'Ring',
  'Ring 2',
  'Necklace',
  'Eye',
  'Face',
  'Earring',
] as const);

export const EQUIPMENT_RARITIES = Object.freeze([
  'Normal',
  'Rare',
  'Epic',
  'Unique',
  'Legendary',
] as const);

export const EQUIPMENT_STAT_KEYS = Object.freeze([
  'attack',
  'maxHp',
  'defense',
  'accuracy',
  'evasion',
  'criticalRate',
  'criticalDamage',
  'attackSpeed',
  'damage',
  'bossDamage',
  'normalDamage',
] as const);

export type EquipmentSlot = typeof EQUIPMENT_SLOTS[number];
export type EquipmentRarity = typeof EQUIPMENT_RARITIES[number];
export type EquipmentStatKey = typeof EQUIPMENT_STAT_KEYS[number];
export type DropSource = 'farming' | 'breakthrough' | 'boss';
export type RandomSource = () => number;

export interface EquipmentMainStats {
  readonly attack: number;
  readonly defense: number;
  readonly maxHp: number;
}

export interface EquipmentSubstat {
  readonly type: EquipmentStatKey;
  readonly value: number;
}

export interface EquipmentItem {
  readonly id: string;
  readonly slot: EquipmentSlot;
  readonly level: number;
  readonly rarity: EquipmentRarity;
  readonly name: string;
  readonly mainStats: Readonly<EquipmentMainStats>;
  readonly substats: readonly Readonly<EquipmentSubstat>[];
  readonly power: number;
}

export type EquippedItems = Readonly<Record<EquipmentSlot, EquipmentItem | null>>;
export type EquipmentTotals = Readonly<Record<EquipmentStatKey, number>>;

export interface ItemComparison {
  readonly selected: EquipmentItem;
  readonly equipped: EquipmentItem | null;
  readonly powerDelta: number;
  readonly result: 'positive' | 'neutral' | 'negative';
  readonly statDeltas: EquipmentTotals;
}

export interface EquipmentSnapshot {
  readonly inventory: readonly EquipmentItem[];
  readonly equipped: EquippedItems;
  readonly latestDrop: EquipmentItem | null;
  readonly totals: EquipmentTotals;
  readonly equipmentPower: number;
  readonly effectiveStats: Readonly<PlayerCombatProfile>;
  readonly heroPower: number;
}

export interface EquipmentPersistentState {
  readonly inventory: readonly EquipmentItem[];
  readonly equipped: EquippedItems;
  readonly latestDropId: string | null;
  readonly nextItemNumber: number;
}

export interface EquipmentControllerOptions {
  readonly random?: RandomSource;
  readonly initialState?: EquipmentPersistentState;
}

export interface EquipmentController {
  rollDrop(source: DropSource, itemLevel: number): EquipmentItem | null;
  equip(itemId: string): void;
  equipBest(): void;
  compare(itemId: string): ItemComparison;
  getSnapshot(baseStats: Readonly<PlayerStats>): EquipmentSnapshot;
  getPersistentState(): EquipmentPersistentState;
}
