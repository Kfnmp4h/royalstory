import {
  EQUIPMENT_RARITIES,
  EQUIPMENT_SLOTS,
  type DropSource,
  type EquipmentRarity,
  type EquipmentStatKey,
} from '../equipment/equipmentTypes';

const rarityMultipliers = Object.freeze({
  Normal: 1,
  Rare: 1.2,
  Epic: 1.5,
  Unique: 1.9,
  Legendary: 2.4,
} satisfies Record<EquipmentRarity, number>);

const dropChances = Object.freeze({
  farming: 0.25,
  breakthrough: 1,
  boss: 1,
} satisfies Record<DropSource, number>);

const rarityThresholds = Object.freeze({
  farming: Object.freeze([0.6, 0.85, 0.95, 0.99, 1]),
  breakthrough: Object.freeze([0.4, 0.75, 0.92, 0.99, 1]),
  boss: Object.freeze([0.2, 0.55, 0.8, 0.95, 1]),
} satisfies Record<DropSource, readonly number[]>);

const substatCounts = Object.freeze({
  Normal: Object.freeze({ min: 1, max: 1 }),
  Rare: Object.freeze({ min: 1, max: 2 }),
  Epic: Object.freeze({ min: 1, max: 2 }),
  Unique: Object.freeze({ min: 1, max: 3 }),
  Legendary: Object.freeze({ min: 1, max: 4 }),
} satisfies Record<EquipmentRarity, Readonly<{ min: number; max: number }>>);

const percentageSubstatRanges = Object.freeze({
  Normal: Object.freeze({ min: 1, max: 1 }),
  Rare: Object.freeze({ min: 1, max: 2 }),
  Epic: Object.freeze({ min: 2, max: 3 }),
  Unique: Object.freeze({ min: 3, max: 4 }),
  Legendary: Object.freeze({ min: 4, max: 5 }),
} satisfies Record<EquipmentRarity, Readonly<{ min: number; max: number }>>);

export const ITEM_POWER_WEIGHTS = Object.freeze({
  attack: 10,
  maxHp: 0.5,
  defense: 8,
  accuracy: 5,
  evasion: 5,
  criticalRate: 8,
  criticalDamage: 3,
  attackSpeed: 10,
  damage: 10,
  bossDamage: 5,
  normalDamage: 5,
} satisfies Record<EquipmentStatKey, number>);

export const EQUIPMENT_BALANCE = Object.freeze({
  slotCount: 14,
  minItemLevel: 1,
  maxItemLevel: 200,
  slots: EQUIPMENT_SLOTS,
  rarities: EQUIPMENT_RARITIES,
  rarityMultipliers,
  dropChances,
  rarityThresholds,
  substatCounts,
  rawSubstatPercent: Object.freeze({ min: 25, max: 50 }),
  percentageSubstatRanges,
  combatDefaults: Object.freeze({
    accuracy: 0,
    evasion: 0,
    criticalRate: 5,
    criticalDamage: 100,
    attackSpeed: 100,
    damage: 0,
    bossDamage: 0,
    normalDamage: 0,
  }),
  combatCaps: Object.freeze({
    criticalRate: 100,
    attackSpeed: 120,
  }),
  powerWeights: ITEM_POWER_WEIGHTS,
});
