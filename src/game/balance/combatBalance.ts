import type { CombatBalance } from '../types';

export const COMBAT_BALANCE: Readonly<CombatBalance> = Object.freeze({
  sliceMs: 100,
  maxFrameContributionMs: 250,
  enemyRespawnMs: 1_200,
  playerRespawnMs: 3_000,
  player: Object.freeze({ id: 'player', name: 'Ari', attack: 18, defense: 2, maxHp: 120, attackIntervalMs: 900 }),
  enemy: Object.freeze({ id: 'enemy', name: 'Mossling', attack: 9, defense: 0, maxHp: 90, attackIntervalMs: 1_300 }),
});
