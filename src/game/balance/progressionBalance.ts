import type { PlayerStats } from '../types';

export type EncounterRewardKind = 'farming' | 'breakthrough' | 'boss';

export const PROGRESSION_BALANCE = Object.freeze({
  maxLevel: 200,
  maxChapter: 36,
  baseStats: Object.freeze({ attack: 18, defense: 2, maxHp: 120 }),
  growthPerLevel: Object.freeze({ attack: 2, defense: 1, maxHp: 8 }),
});

function assertLevel(level: number): void {
  if (!Number.isInteger(level) || level < 1 || level > 200) {
    throw new RangeError('Level must be an integer from 1 to 200');
  }
}

export function getStatsForLevel(level: number): Readonly<PlayerStats> {
  assertLevel(level);
  const gainedLevels = level - 1;
  return Object.freeze({
    attack: 18 + gainedLevels * 2,
    defense: 2 + gainedLevels,
    maxHp: 120 + gainedLevels * 8,
  });
}

export function getXpToNextLevel(level: number): number {
  assertLevel(level);
  return level === 200 ? 0 : 50 + (level - 1) * 25;
}

export function getEncounterXp(chapter: number, kind: EncounterRewardKind): number {
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > 36) {
    throw new RangeError('Chapter must be an integer from 1 to 36');
  }
  const offset = chapter - 1;
  if (kind === 'farming') return 10 + offset * 2;
  if (kind === 'breakthrough') return 40 + offset * 8;
  return 100 + offset * 20;
}

export const MAX_TOTAL_XP = Array.from(
  { length: 199 },
  (_, index) => getXpToNextLevel(index + 1),
).reduce((total, requirement) => total + requirement, 0);
