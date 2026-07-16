import { describe, expect, it } from 'vitest';
import { getEnemyGold, OFFLINE_REWARD_BALANCE } from './goldBalance';

describe('gold balance', () => {
  it('awards the approved farming and boss values', () => {
    expect(getEnemyGold(1, 'farming')).toBe(10);
    expect(getEnemyGold(36, 'boss')).toBe(800);
  });

  it('scales breakthrough rewards from the same chapter base', () => {
    expect(getEnemyGold(1, 'breakthrough')).toBe(40);
    expect(getEnemyGold(36, 'breakthrough')).toBe(320);
  });

  it('defines the offline caps centrally', () => {
    expect(OFFLINE_REWARD_BALANCE.maximumElapsedMs).toBe(8 * 60 * 60 * 1_000);
    expect(OFFLINE_REWARD_BALANCE.killIntervalMs).toBe(6_000);
    expect(OFFLINE_REWARD_BALANCE.maximumEquipmentDrops).toBe(20);
  });

  it('rejects chapters outside the campaign', () => {
    expect(() => getEnemyGold(0, 'farming')).toThrow(RangeError);
    expect(() => getEnemyGold(37, 'boss')).toThrow(RangeError);
  });
});
