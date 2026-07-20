import type { CampaignPersistentState, PlayerCommand } from '../save/saveTypes';

export type BattleStateReceiver = (state: CampaignPersistentState) => void;
export type BattleCommandReceiver = (command: PlayerCommand) => void;

let activeStateReceiver: BattleStateReceiver | null = null;
let activeCommandReceiver: BattleCommandReceiver | null = null;

export const registerBattleStateReceiver = (receiver: BattleStateReceiver): (() => void) => {
  activeStateReceiver = receiver;
  return () => {
    if (activeStateReceiver === receiver) activeStateReceiver = null;
  };
};

export const registerBattleCommandReceiver = (receiver: BattleCommandReceiver): (() => void) => {
  activeCommandReceiver = receiver;
  return () => {
    if (activeCommandReceiver === receiver) activeCommandReceiver = null;
  };
};

export const applyActiveBattleState = (state: CampaignPersistentState): void => {
  activeStateReceiver?.(state);
};

export const applyActiveBattleCommand = (command: PlayerCommand): void => {
  if (command.type !== 'sync') activeCommandReceiver?.(command);
};
