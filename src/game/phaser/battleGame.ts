import Phaser from 'phaser';
import type { CampaignSnapshot } from '../campaign/campaignTypes';
import { BattleScene } from './BattleScene';

export interface BattleController {
  setPaused(paused: boolean): void;
  startBreakthrough(): void;
  startBoss(): void;
  destroy(): void;
}

export interface BattleStatus {
  snapshot: CampaignSnapshot;
  state: 'running' | 'paused';
}

interface CreateBattleGameOptions {
  parent: HTMLElement;
  onStatus: (status: BattleStatus) => void;
  onError: (error: Error) => void;
}

export function createBattleGame({
  parent,
  onStatus,
  onError,
}: CreateBattleGameOptions): BattleController {
  const battleScene = new BattleScene(onStatus, onError);
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
    destroy() {
      if (destroyed) return;
      destroyed = true;
      game.destroy(true);
    },
  };
}
