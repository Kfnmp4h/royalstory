import type { CombatBalance } from '../types';

export const COMBAT_BALANCE: Readonly<CombatBalance> = Object.freeze({
  sliceMs: 100,
  maxFrameContributionMs: 250,
  enemyRespawnMs: 1_200,
  playerRespawnMs: 3_000,
  player: Object.freeze({ id: 'player', name: 'Ari', maxHp: 120, damage: 18, attackIntervalMs: 900 }),
  enemy: Object.freeze({ id: 'enemy', name: 'Mossling', maxHp: 90, damage: 9, attackIntervalMs: 1_300 }),
});
