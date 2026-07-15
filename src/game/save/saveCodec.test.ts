import { describe, expect, it } from 'vitest';
import { createInitialPlayerSaveState, parsePlayerSaveState } from './saveCodec';

describe('player save codec', () => {
  it('creates a JSON-safe level-one farming state', () => {
    const state = createInitialPlayerSaveState();

    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    expect(state).toMatchObject({
      schemaVersion: 1,
      gold: 0,
      campaign: {
        chapterNumber: 1,
        unlockedChapter: 1,
        mode: 'farming',
        bossUnlocked: false,
        progression: { level: 1, xp: 0, totalXp: 0 },
      },
    });
  });

  it('parses a valid state without retaining caller-owned objects', () => {
    const source = createInitialPlayerSaveState();
    const parsed = parsePlayerSaveState(source);

    expect(parsed).toEqual(source);
    expect(parsed).not.toBe(source);
    expect(parsed.campaign).not.toBe(source.campaign);
  });

  it('rejects an invalid schema, negative gold, and invalid chapter', () => {
    const valid = createInitialPlayerSaveState();

    expect(() => parsePlayerSaveState({ ...valid, schemaVersion: 2 })).toThrow('Unsupported player save schema version');
    expect(() => parsePlayerSaveState({ ...valid, gold: -1 })).toThrow('Gold must be a non-negative integer');
    expect(() => parsePlayerSaveState({
      ...valid,
      campaign: { ...valid.campaign, chapterNumber: 37 },
    })).toThrow('Chapter number must be an integer from 1 to 36');
  });
});
