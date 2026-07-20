import type { CampaignPersistentState } from '../save/saveTypes';

export type BattleStateReceiver = (state: CampaignPersistentState) => void;

let activeReceiver: BattleStateReceiver | null = null;

export const registerBattleStateReceiver = (receiver: BattleStateReceiver): (() => void) => {
  activeReceiver = receiver;
  return () => {
    if (activeReceiver === receiver) activeReceiver = null;
  };
};

export const applyActiveBattleState = (state: CampaignPersistentState): void => {
  activeReceiver?.(state);
};
