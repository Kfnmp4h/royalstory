import { describe, expect, it } from 'vitest';
import { MAX_TOTAL_XP } from '../balance';
import { createProgressionController } from './progressionController';

describe('createProgressionController', () => {
  it('starts at level one with derived stats', () => {
    expect(createProgressionController().getSnapshot()).toEqual({
      level: 1,
      xp: 0,
      xpToNextLevel: 50,
      totalXp: 0,
      stats: { attack: 18, defense: 2, maxHp: 120 },
    });
  });

  it('keeps overflow and can gain several levels in one award', () => {
    const progression = createProgressionController();
    expect(progression.awardXp(140)).toMatchObject({
      level: 3,
      xp: 15,
      xpToNextLevel: 100,
      totalXp: 140,
      stats: { attack: 22, defense: 4, maxHp: 136 },
    });
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid XP %s without mutation',
    (amount) => {
      const progression = createProgressionController();
      const before = progression.getSnapshot();
      expect(() => progression.awardXp(amount)).toThrow('XP must be a positive finite integer');
      expect(progression.getSnapshot()).toEqual(before);
    },
  );

  it('caps exactly at level 200 and ignores further valid XP', () => {
    const progression = createProgressionController();
    progression.awardXp(MAX_TOTAL_XP + 10_000);
    const capped = progression.getSnapshot();
    expect(capped).toMatchObject({ level: 200, xp: 0, xpToNextLevel: 0, totalXp: MAX_TOTAL_XP });
    expect(progression.awardXp(1_000)).toEqual(capped);
  });

  it('returns immutable nested snapshots and fresh outer objects', () => {
    const progression = createProgressionController();
    const first = progression.getSnapshot();
    const second = progression.getSnapshot();
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.stats)).toBe(true);
  });
});
