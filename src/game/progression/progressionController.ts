import { PROGRESSION_BALANCE, getStatsForLevel, getXpToNextLevel } from '../balance';
import type {
  ProgressionController,
  ProgressionPersistentState,
  ProgressionSnapshot,
} from './progressionTypes';

const getCompletedLevelXp = (level: number): number => {
  let total = 0;
  for (let current = 1; current < level; current += 1) total += getXpToNextLevel(current);
  return total;
};

const parseInitialState = (initial: ProgressionPersistentState | undefined): ProgressionPersistentState => {
  if (!initial) return Object.freeze({ level: 1, xp: 0, totalXp: 0 });
  if (!Number.isInteger(initial.level) || initial.level < 1 || initial.level > PROGRESSION_BALANCE.maxLevel) {
    throw new RangeError('Initial level must be an integer from 1 to 200');
  }
  const maximumXp = initial.level === PROGRESSION_BALANCE.maxLevel
    ? 0
    : getXpToNextLevel(initial.level) - 1;
  if (!Number.isInteger(initial.xp) || initial.xp < 0 || initial.xp > maximumXp) {
    throw new RangeError('Initial XP must be below the next level threshold');
  }
  const expectedTotalXp = getCompletedLevelXp(initial.level) + initial.xp;
  if (!Number.isInteger(initial.totalXp) || initial.totalXp !== expectedTotalXp) {
    throw new RangeError('Initial total XP must match level and XP');
  }
  return Object.freeze({ level: initial.level, xp: initial.xp, totalXp: initial.totalXp });
};

export function createProgressionController(initial?: ProgressionPersistentState): ProgressionController {
  const persisted = parseInitialState(initial);
  let level = persisted.level;
  let xp = persisted.xp;
  let totalXp = persisted.totalXp;

  const getSnapshot = (): ProgressionSnapshot => Object.freeze({
    level,
    xp,
    xpToNextLevel: getXpToNextLevel(level),
    totalXp,
    stats: getStatsForLevel(level),
  });

  const getPersistentState = (): ProgressionPersistentState => Object.freeze({ level, xp, totalXp });

  const awardXp = (amount: number): ProgressionSnapshot => {
    if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) {
      throw new RangeError('XP must be a positive finite integer');
    }
    let remaining = level === PROGRESSION_BALANCE.maxLevel ? 0 : amount;
    while (remaining > 0 && level < PROGRESSION_BALANCE.maxLevel) {
      const needed = getXpToNextLevel(level) - xp;
      const applied = Math.min(remaining, needed);
      xp += applied;
      totalXp += applied;
      remaining -= applied;
      if (xp === getXpToNextLevel(level)) {
        level += 1;
        xp = 0;
      }
    }
    return getSnapshot();
  };

  return { awardXp, getSnapshot, getPersistentState };
}
