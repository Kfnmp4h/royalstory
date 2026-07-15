import { ITEM_POWER_WEIGHTS } from '../balance/equipmentBalance';
import type { PlayerStats } from '../types';
import {
  EQUIPMENT_STAT_KEYS,
  type EquipmentItem,
  type EquipmentStatKey,
  type EquipmentTotals,
  type ItemComparison,
} from './equipmentTypes';

const zeroTotals = (): Record<EquipmentStatKey, number> => ({
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

export function getItemStatTotals(item: EquipmentItem): EquipmentTotals {
  const totals = zeroTotals();
  totals.attack = item.mainStats.attack;
  totals.defense = item.mainStats.defense;
  totals.maxHp = item.mainStats.maxHp;
  for (const substat of item.substats) totals[substat.type] += substat.value;
  return Object.freeze(totals);
}

export function calculateItemPower(item: EquipmentItem): number {
  const totals = getItemStatTotals(item);
  const sum = EQUIPMENT_STAT_KEYS.reduce(
    (power, stat) => power + totals[stat] * ITEM_POWER_WEIGHTS[stat],
    0,
  );
  return Math.round(sum);
}

export function calculateHeroPower(baseStats: Readonly<PlayerStats>, equipmentPower: number): number {
  return Math.round(
    baseStats.attack * 10
    + baseStats.defense * 8
    + baseStats.maxHp * 0.5
    + equipmentPower,
  );
}

export function compareItems(selected: EquipmentItem, equipped: EquipmentItem | null): ItemComparison {
  const selectedTotals = getItemStatTotals(selected);
  const equippedTotals = equipped ? getItemStatTotals(equipped) : zeroTotals();
  const statDeltas = Object.freeze(EQUIPMENT_STAT_KEYS.reduce<Record<EquipmentStatKey, number>>(
    (deltas, stat) => {
      deltas[stat] = selectedTotals[stat] - equippedTotals[stat];
      return deltas;
    },
    zeroTotals(),
  ));
  const powerDelta = selected.power - (equipped?.power ?? 0);
  return Object.freeze({
    selected,
    equipped,
    powerDelta,
    result: powerDelta > 0 ? 'positive' : powerDelta < 0 ? 'negative' : 'neutral',
    statDeltas,
  });
}
