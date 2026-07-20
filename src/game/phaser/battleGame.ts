import Phaser from 'phaser';
import { createCampaignController } from '../campaign/campaignController';
import type { CampaignSnapshot, EncounterVisual, PersistentCampaignController } from '../campaign/campaignTypes';
import type { CampaignPersistentState } from '../save/saveTypes';
import { CombatBattleScene } from './CombatBattleScene';
import { registerBattleCommandReceiver, registerBattleStateReceiver } from './battleStateBridge';

interface ReplaceableBattleScene {
  campaign: PersistentCampaignController;
  renderedVisualName?: string;
  pendingEnemyVisual?: EncounterVisual;
  enemyDeathFeedbackActive: boolean;
  nextPlayerDamageCritical: boolean;
  renderAndPublish(snapshot: CampaignSnapshot): void;
}

interface CampaignProgressMarker {
  readonly chapterNumber: number;
  readonly bossUnlocked: boolean;
}

interface EncounterTransitionState {
  renderedVisualName?: string;
  pendingEnemyVisual?: { readonly name: string };
  enemyDeathFeedbackActive: boolean;
  nextPlayerDamageCritical: boolean;
}

export const resetBattleSceneEncounterTransition = (scene: EncounterTransitionState): void => {
  scene.renderedVisualName = undefined;
  scene.pendingEnemyVisual = undefined;
  scene.enemyDeathFeedbackActive = false;
  scene.nextPlayerDamageCritical = false;
};

export const shouldReplaceBattleState = (
  local: CampaignProgressMarker,
  incoming: CampaignProgressMarker,
): boolean => {
  if (incoming.chapterNumber < local.chapterNumber) return false;
  if (
    incoming.chapterNumber === local.chapterNumber
    && local.bossUnlocked
    && !incoming.bossUnlocked
  ) return false;
  return true;
};

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

  const controller: BattleController = {
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
      const current = replaceableScene.campaign.getSnapshot();
      if (!shouldReplaceBattleState(
        { chapterNumber: current.chapter.number, bossUnlocked: current.bossUnlocked },
        { chapterNumber: state.chapterNumber, bossUnlocked: state.bossUnlocked },
      )) return;
      const campaign = createCampaignController(undefined, { initialState: state });
      resetBattleSceneEncounterTransition(replaceableScene);
      replaceableScene.campaign = campaign;
      replaceableScene.renderAndPublish(campaign.getSnapshot());
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unregisterBattleStateReceiver();
      unregisterBattleCommandReceiver();
      game.destroy(true);
    },
  };

  const unregisterBattleStateReceiver = registerBattleStateReceiver((state) => controller.replaceState(state));
  const unregisterBattleCommandReceiver = registerBattleCommandReceiver((command) => {
    if (command.type === 'startBreakthrough') controller.startBreakthrough();
    if (command.type === 'startBoss') controller.startBoss();
    if (command.type === 'equip') controller.equip(command.itemId);
    if (command.type === 'equipBest') controller.equipBest();
  });
  return controller;
}
