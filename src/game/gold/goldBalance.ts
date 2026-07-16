import type { EncounterKind } from '../campaign/campaignTypes';

export const OFFLINE_REWARD_BALANCE = Object.freeze({
  maximumElapsedMs: 8 * 60 * 60 * 1_000,
  killIntervalMs: 6_000,
  maximumEquipmentDrops: 20,
});

export function getEnemyGold(chapter: number, kind: EncounterKind): number {
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > 36) {
    throw new RangeError('Chapter must be an integer from 1 to 36');
  }

  const base = 10 + (chapter - 1) * 2;
  if (kind === 'farming') return base;
  if (kind === 'breakthrough') return base * 4;
  return base * 10;
}
