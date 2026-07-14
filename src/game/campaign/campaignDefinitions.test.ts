import { describe, expect, it } from 'vitest';
import { CHAPTERS, createEncounterBalance, getChapter } from './campaignDefinitions';

describe('CHAPTERS', () => {
  it('contains 36 ordered original chapters with every encounter type', () => {
    expect(CHAPTERS).toHaveLength(36);
    expect(CHAPTERS.map((chapter) => chapter.number)).toEqual(
      Array.from({ length: 36 }, (_, index) => index + 1),
    );
    expect(CHAPTERS[0]).toMatchObject({
      name: 'Whisperwood',
      farming: { kind: 'farming', balance: { enemy: { name: 'Whisperwood Sprig' } } },
      breakthrough: { kind: 'breakthrough' },
      boss: { kind: 'boss', balance: { enemy: { name: 'Whisperwood Warden' } } },
    });
    expect(CHAPTERS.at(-1)?.name).toBe('Lightrest Summit');
  });

  it('returns immutable encounter values and rejects invalid chapter numbers', () => {
    const chapter = getChapter(12);
    expect(Object.isFrozen(chapter)).toBe(true);
    expect(Object.isFrozen(chapter.boss)).toBe(true);
    expect(Object.isFrozen(chapter.boss.balance)).toBe(true);
    expect(chapter.boss.balance.enemy.maxHp).toBeGreaterThan(chapter.farming.balance.enemy.maxHp);
    expect(() => getChapter(0)).toThrow('Unknown chapter: 0');
    expect(() => getChapter(37)).toThrow('Unknown chapter: 37');
  });
});

describe('createEncounterBalance', () => {
  it('preserves Ari values while scaling enemy values by encounter kind', () => {
    const farming = createEncounterBalance(12, 'farming');
    const breakthrough = createEncounterBalance(12, 'breakthrough');
    const boss = createEncounterBalance(12, 'boss');

    expect(farming.player).toMatchObject({ name: 'Ari', maxHp: 120, damage: 18, attackIntervalMs: 900 });
    expect([farming.enemy.maxHp, breakthrough.enemy.maxHp, boss.enemy.maxHp]).toEqual([144, 216, 288]);
    expect(boss.enemy).toMatchObject({ id: 'enemy', damage: 3, attackIntervalMs: 1_300 });
    expect(boss).not.toBe(farming);
    expect(boss.enemy).not.toBe(farming.enemy);
  });
});
