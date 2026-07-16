import { getEncounterXp } from '../balance/progressionBalance';
import { createEquipmentController } from '../equipment/equipmentController';
import type { EquipmentItem, RandomSource } from '../equipment/equipmentTypes';
import { getEnemyGold, OFFLINE_REWARD_BALANCE } from '../gold/goldBalance';
import { createProgressionController } from '../progression/progressionController';
import type { PlayerSaveState } from './saveTypes';

export interface OfflineRewardResult {
  readonly elapsedMs: number;
  readonly kills: number;
  readonly gold: number;
  readonly xp: number;
  readonly drops: readonly EquipmentItem[];
  readonly nextState: PlayerSaveState;
}

const unchangedResult = (save: PlayerSaveState, elapsedMs: number): OfflineRewardResult => Object.freeze({
  elapsedMs,
  kills: 0,
  gold: 0,
  xp: 0,
  drops: Object.freeze([]),
  nextState: save,
});

export function settleOfflineRewards(
  save: PlayerSaveState,
  elapsedMs: number,
  random: RandomSource = Math.random,
): OfflineRewardResult {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return unchangedResult(save, 0);

  const clampedElapsedMs = Math.min(
    Math.floor(elapsedMs),
    OFFLINE_REWARD_BALANCE.maximumElapsedMs,
  );

  if (save.campaign.mode !== 'farming') return unchangedResult(save, clampedElapsedMs);

  const kills = Math.floor(clampedElapsedMs / OFFLINE_REWARD_BALANCE.killIntervalMs);
  if (kills === 0) return unchangedResult(save, clampedElapsedMs);

  const progression = createProgressionController(save.campaign.progression);
  const equipment = createEquipmentController({
    random,
    initialState: save.campaign.equipment,
  });
  const drops: EquipmentItem[] = [];
  const xpPerKill = getEncounterXp(save.campaign.chapterNumber, 'farming');
  const goldPerKill = getEnemyGold(save.campaign.chapterNumber, 'farming');

  for (let index = 0; index < kills; index += 1) {
    progression.awardXp(xpPerKill);
    if (drops.length < OFFLINE_REWARD_BALANCE.maximumEquipmentDrops) {
      const drop = equipment.rollDrop('farming', progression.getSnapshot().level);
      if (drop) drops.push(drop);
    }
  }

  const gold = goldPerKill * kills;
  const xp = xpPerKill * kills;
  const nextState: PlayerSaveState = Object.freeze({
    ...save,
    gold: save.gold + gold,
    campaign: Object.freeze({
      ...save.campaign,
      progression: progression.getPersistentState(),
      equipment: equipment.getPersistentState(),
    }),
  });

  return Object.freeze({
    elapsedMs: clampedElapsedMs,
    kills,
    gold,
    xp,
    drops: Object.freeze(drops),
    nextState,
  });
}
