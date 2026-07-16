import { describe, expect, it } from 'vitest';
import { createInitialPlayerSaveState } from './saveCodec';
import { settleOfflineRewards } from './offlineRewards';

describe('offline rewards', () => {
  it('caps elapsed time at eight hours and equipment drops at twenty', () => {
    const initial = createInitialPlayerSaveState();
    const result = settleOfflineRewards(initial, 9 * 60 * 60 * 1_000, () => 0);

    expect(result.elapsedMs).toBe(8 * 60 * 60 * 1_000);
    expect(result.kills).toBe(4_800);
    expect(result.drops).toHaveLength(20);
    expect(result.nextState.gold).toBeGreaterThan(initial.gold);
    expect(result.nextState.campaign.chapterNumber).toBe(initial.campaign.chapterNumber);
    expect(result.nextState.campaign.mode).toBe('farming');
  });

  it('rounds incomplete kill intervals down', () => {
    const initial = createInitialPlayerSaveState();
    expect(settleOfflineRewards(initial, 5_999, () => 0).kills).toBe(0);
    expect(settleOfflineRewards(initial, 6_000, () => 0).kills).toBe(1);
  });

  it('does not settle rewards outside farming mode', () => {
    const initial = createInitialPlayerSaveState();
    const breakthrough = {
      ...initial,
      campaign: { ...initial.campaign, mode: 'breakthrough' as const },
    };
    const result = settleOfflineRewards(breakthrough, 60_000, () => 0);

    expect(result.kills).toBe(0);
    expect(result.nextState).toBe(breakthrough);
  });

  it('returns an unchanged state for invalid or non-positive elapsed time', () => {
    const initial = createInitialPlayerSaveState();
    expect(settleOfflineRewards(initial, 0).nextState).toBe(initial);
    expect(settleOfflineRewards(initial, Number.NaN).nextState).toBe(initial);
  });

  it('does not create duplicate item IDs', () => {
    const initial = createInitialPlayerSaveState();
    const result = settleOfflineRewards(initial, 8 * 60 * 60 * 1_000, () => 0);
    const ids = result.nextState.campaign.equipment.inventory.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
