import { describe, expect, it } from 'vitest';
import { COMBAT_BALANCE } from './balance';

describe('COMBAT_BALANCE', () => {
  it('keeps every Milestone 1 combat number in one immutable contract', () => {
    expect(COMBAT_BALANCE).toMatchObject({
      sliceMs: 100,
      maxFrameContributionMs: 250,
      enemyRespawnMs: 1_200,
      playerRespawnMs: 3_000,
      player: { id: 'player', name: 'Ari', maxHp: 120, damage: 18, attackIntervalMs: 900 },
      enemy: { id: 'enemy', name: 'Mossling', maxHp: 90, damage: 9, attackIntervalMs: 1_300 },
    });
    expect(Object.isFrozen(COMBAT_BALANCE)).toBe(true);
    expect(Object.isFrozen(COMBAT_BALANCE.player)).toBe(true);
    expect(Object.isFrozen(COMBAT_BALANCE.enemy)).toBe(true);
  });
});
