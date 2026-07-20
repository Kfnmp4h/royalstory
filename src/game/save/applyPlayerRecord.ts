import type { BattleController } from '../phaser/battleGame';
import type { PlayerApiRecord } from './saveTypes';

interface ReplaceStateController {
  replaceState(state: PlayerApiRecord['state']['campaign']): void;
}

export const applyPlayerRecord = (
  record: PlayerApiRecord,
  controller: Pick<BattleController, 'replaceState'> | ReplaceStateController | null,
  onRecordChange: (record: PlayerApiRecord) => void,
): void => {
  controller?.replaceState(record.state.campaign);
  onRecordChange(record);
};
