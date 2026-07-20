import { createCampaignController } from '../campaign/campaignController';
import type { PlayerApiRecord, PlayerCommand } from './saveTypes';

export const applyOptimisticPlayerCommand = (
  record: PlayerApiRecord,
  command: PlayerCommand,
): PlayerApiRecord => {
  if (command.type === 'sync') return record;

  const campaign = createCampaignController(undefined, { initialState: record.state.campaign });
  let armorStones = record.state.armorStones;

  if (command.type === 'startBreakthrough') campaign.startBreakthrough();
  if (command.type === 'startBoss') campaign.startBoss();
  if (command.type === 'equip') campaign.equip(command.itemId);
  if (command.type === 'equipBest') campaign.equipBest();
  if (command.type === 'dismantle') armorStones += campaign.dismantle(command.itemId).armorStones;
  if (command.type === 'dismantleLowerPower') armorStones += campaign.dismantleLowerPower().armorStones;

  return Object.freeze({
    ...record,
    state: Object.freeze({
      ...record.state,
      armorStones,
      campaign: campaign.getPersistentState(),
    }),
  });
};
