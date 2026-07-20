import { describe, expect, it } from 'vitest';
import { shouldReplaceBattleState } from './battleGame';

describe('battle state reconciliation', () => {
  it('rejects an older server chapter after the local boss victory advanced the battle', () => {
    expect(shouldReplaceBattleState(
      { chapterNumber: 5, bossUnlocked: false },
      { chapterNumber: 4, bossUnlocked: true },
    )).toBe(false);
  });

  it('rejects losing a locally unlocked boss within the same chapter', () => {
    expect(shouldReplaceBattleState(
      { chapterNumber: 5, bossUnlocked: true },
      { chapterNumber: 5, bossUnlocked: false },
    )).toBe(false);
  });

  it('accepts equal or newer authoritative campaign progress', () => {
    expect(shouldReplaceBattleState(
      { chapterNumber: 5, bossUnlocked: false },
      { chapterNumber: 5, bossUnlocked: false },
    )).toBe(true);
    expect(shouldReplaceBattleState(
      { chapterNumber: 5, bossUnlocked: true },
      { chapterNumber: 6, bossUnlocked: false },
    )).toBe(true);
  });
});
