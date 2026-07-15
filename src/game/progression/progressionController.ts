import { PROGRESSION_BALANCE, getStatsForLevel, getXpToNextLevel } from '../balance';
import type { ProgressionController, ProgressionSnapshot } from './progressionTypes';

export function createProgressionController(): ProgressionController {
  let level = 1;
  let xp = 0;
  let totalXp = 0;

  const getSnapshot = (): ProgressionSnapshot => Object.freeze({
    level,
    xp,
    xpToNextLevel: getXpToNextLevel(level),
    totalXp,
    stats: getStatsForLevel(level),
  });

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

  return { awardXp, getSnapshot };
}
