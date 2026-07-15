import { EQUIPMENT_BALANCE } from '../balance/equipmentBalance';
import { calculateItemPower } from './equipmentPower';
import {
  EQUIPMENT_RARITIES,
  EQUIPMENT_STAT_KEYS,
  type DropSource,
  type EquipmentItem,
  type EquipmentMainStats,
  type EquipmentRarity,
  type EquipmentStatKey,
  type EquipmentSubstat,
  type RandomSource,
} from './equipmentTypes';

const DROP_SOURCES: ReadonlySet<DropSource> = new Set(['farming', 'breakthrough', 'boss']);
const RAW_STATS: ReadonlySet<EquipmentStatKey> = new Set(['attack', 'maxHp', 'defense']);

function assertInputs(
  source: DropSource,
  itemLevel: number,
  itemId: string,
  random: RandomSource,
): void {
  if (!DROP_SOURCES.has(source)) throw new RangeError('Unknown equipment drop source');
  if (
    !Number.isInteger(itemLevel)
    || itemLevel < EQUIPMENT_BALANCE.minItemLevel
    || itemLevel > EQUIPMENT_BALANCE.maxItemLevel
  ) throw new RangeError('Item level must be an integer from 1 to 200');
  if (typeof itemId !== 'string' || itemId.trim().length === 0) {
    throw new TypeError('Item ID must be a non-empty string');
  }
  if (typeof random !== 'function') throw new TypeError('Random source must be a function');
}

function readRandom(random: RandomSource): number {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError('Random source must return a finite value from 0 up to but not including 1');
  }
  return value;
}

function selectRarity(source: DropSource, random: RandomSource): EquipmentRarity {
  const roll = readRandom(random);
  const thresholds = EQUIPMENT_BALANCE.rarityThresholds[source];
  const index = thresholds.findIndex((threshold) => roll < threshold);
  return EQUIPMENT_RARITIES[index];
}

function calculateMainStats(itemLevel: number, rarity: EquipmentRarity): Readonly<EquipmentMainStats> {
  const multiplier = EQUIPMENT_BALANCE.rarityMultipliers[rarity];
  return Object.freeze({
    attack: Math.round((1 + itemLevel * 0.05) * multiplier),
    defense: Math.round((1 + itemLevel * 0.035) * multiplier),
    maxHp: Math.round((5 + itemLevel * 0.30) * multiplier),
  });
}

function selectSubstatCount(rarity: EquipmentRarity, random: RandomSource): number {
  const range = EQUIPMENT_BALANCE.substatCounts[rarity];
  if (range.min === range.max) return range.min;
  return range.min + Math.floor(readRandom(random) * (range.max - range.min + 1));
}

function calculateSubstatValue(
  type: EquipmentStatKey,
  rarity: EquipmentRarity,
  mainStats: Readonly<EquipmentMainStats>,
  random: RandomSource,
): number {
  const roll = readRandom(random);
  if (RAW_STATS.has(type)) {
    const rawPercent = EQUIPMENT_BALANCE.rawSubstatPercent.min
      + Math.floor(roll * (
        EQUIPMENT_BALANCE.rawSubstatPercent.max
        - EQUIPMENT_BALANCE.rawSubstatPercent.min
        + 1
      ));
    return Math.max(1, Math.round(mainStats[type as keyof EquipmentMainStats] * rawPercent / 100));
  }
  const range = EQUIPMENT_BALANCE.percentageSubstatRanges[rarity];
  return range.min + Math.floor(roll * (range.max - range.min + 1));
}

function generateSubstats(
  rarity: EquipmentRarity,
  mainStats: Readonly<EquipmentMainStats>,
  random: RandomSource,
): readonly Readonly<EquipmentSubstat>[] {
  const count = selectSubstatCount(rarity, random);
  const candidates = [...EQUIPMENT_STAT_KEYS];
  const substats: Readonly<EquipmentSubstat>[] = [];
  for (let index = 0; index < count; index += 1) {
    const candidateIndex = Math.floor(readRandom(random) * candidates.length);
    const type = candidates.splice(candidateIndex, 1)[0];
    substats.push(Object.freeze({
      type,
      value: calculateSubstatValue(type, rarity, mainStats, random),
    }));
  }
  return Object.freeze(substats);
}

export function rollEquipmentDrop(
  source: DropSource,
  itemLevel: number,
  itemId: string,
  random: RandomSource,
): EquipmentItem | null {
  assertInputs(source, itemLevel, itemId, random);
  if (source === 'farming' && readRandom(random) >= EQUIPMENT_BALANCE.dropChances.farming) {
    return null;
  }

  const rarity = selectRarity(source, random);
  const slot = EQUIPMENT_BALANCE.slots[Math.floor(readRandom(random) * EQUIPMENT_BALANCE.slotCount)];
  const mainStats = calculateMainStats(itemLevel, rarity);
  const substats = generateSubstats(rarity, mainStats, random);
  const itemWithoutPower: EquipmentItem = {
    id: itemId,
    slot,
    level: itemLevel,
    rarity,
    name: `${rarity} ${slot}`,
    mainStats,
    substats,
    power: 0,
  };
  return Object.freeze({
    ...itemWithoutPower,
    power: calculateItemPower(itemWithoutPower),
  });
}
