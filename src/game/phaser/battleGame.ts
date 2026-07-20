import Phaser from 'phaser';
import { createCampaignController } from '../campaign/campaignController';
import type { CampaignSnapshot, PersistentCampaignController } from '../campaign/campaignTypes';
import type { CampaignPersistentState } from '../save/saveTypes';
import { CombatBattleScene } from './CombatBattleScene';

interface ReplaceableBattleScene {
  campaign: PersistentCampaignController;
  renderAndPublish(snapshot: CampaignSnapshot): void;
}

export interface BattleController {
  setPaused(paused: boolean): void;
  startBreakthrough(): void;
  startBoss(): void;
  equip(itemId: string): void;
  equipBest(): void;
  replaceState(state: CampaignPersistentState): void;
  destroy(): void;
}

export interface BattleStatus {
  snapshot: CampaignSnapshot;
  state: 'running' | 'paused';
}

interface CreateBattleGameOptions {
  parent: HTMLElement;
  initialState?: CampaignPersistentState;
  onStatus: (status: BattleStatus) => void;
  onError: (error: Error) => void;
}

export function createBattleGame({
  parent,
  initialState,
  onStatus,
  onError,
}: CreateBattleGameOptions): BattleController {
  const battleScene = new CombatBattleScene(onStatus, onError);
  const replaceableScene = battleScene as unknown as ReplaceableBattleScene;
  if (initialState) {
    replaceableScene.campaign = createCampaignController(undefined, { initialState });
  }
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 960,
    height: 540,
    transparent: true,
    render: { antialias: true },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [battleScene],
  });
  let destroyed = false;

  return {
    setPaused(paused) {
      if (destroyed) return;
      battleScene.setCombatPaused(paused);
      paused ? game.scene.pause('battle') : game.scene.resume('battle');
    },
    startBreakthrough() {
      if (destroyed) return;
      battleScene.startBreakthrough();
    },
    startBoss() {
      if (destroyed) return;
      battleScene.startBoss();
    },
    equip(itemId) {
      if (destroyed) return;
      battleScene.equip(itemId);
    },
    equipBest() {
      if (destroyed) return;
      battleScene.equipBest();
    },
    replaceState(state) {
      if (destroyed) return;
      const campaign = createCampaignController(undefined, { initialState: state });
      replaceableScene.campaign = campaign;
      replaceableScene.renderAndPublish(campaign.getSnapshot());
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      game.destroy(true);
    },
  };
}
