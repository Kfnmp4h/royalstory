import Phaser from 'phaser';
import { COMBAT_BALANCE } from '../balance';
import type { PersistentCampaignController, EncounterVisual } from '../campaign/campaignTypes';
import type { ActorId, CombatEvent, CombatSnapshot } from '../types';
import { BattleScene } from './BattleScene';
import { preloadCombatEffects, registerCombatAnimations } from './combatPresentation/combatAssets';
import {
  createCombatPresentationController,
  type CombatPresentationController,
} from './combatPresentation/CombatPresentationController';
import {
  createPhaserCombatPresentationPort,
  type PhaserCombatFeedbackKind,
  type PhaserCombatFeedbackText,
  type PhaserCombatPresentationPortOptions,
} from './combatPresentation/PhaserCombatPresentationPort';

const HEALTH_WIDTH = 102;
const PLAYER_POSITION = { x: 270, y: 414 } as const;
const ENEMY_POSITION = { x: 690, y: 414 } as const;
const EFFECT_VERTICAL_OFFSET = 70;
const ENEMY_DEATH_DURATION_MS = 320;

interface BattleSceneInternals {
  campaign: PersistentCampaignController;
  playerContainer?: Phaser.GameObjects.Container;
  enemyContainer?: Phaser.GameObjects.Container;
  playerHealthFill?: Phaser.GameObjects.Graphics;
  enemyHealthFill?: Phaser.GameObjects.Graphics;
  pendingEnemyVisual?: EncounterVisual;
  failed: boolean;
  animateEvent(event: CombatEvent): void;
  drawHealth(graphics: Phaser.GameObjects.Graphics, ratio: number, color: number): void;
  redrawEnemy(visual: EncounterVisual): void;
  renderSnapshot(snapshot: CombatSnapshot): void;
}

interface DelayedHealthLayer {
  readonly container: Phaser.GameObjects.Container;
  readonly graphics: Phaser.GameObjects.Graphics;
}

export const createCombatBattlePresentationController = (
  options: PhaserCombatPresentationPortOptions,
): CombatPresentationController => createCombatPresentationController(
  createPhaserCombatPresentationPort(options),
);

export const shouldAnimateLegacyCombatEvent = (
  event: CombatEvent,
  presentationActive: boolean,
): boolean => {
  if (!presentationActive) return true;
  if (event.type === 'damage' || event.type === 'miss' || event.type === 'critical') return false;
  if (event.type === 'death' && event.actor === 'enemy') return false;
  return true;
};

export const shouldCompleteEnemyPresentationDeath = (event: CombatEvent): boolean => (
  event.type === 'respawn' && event.actor === 'enemy'
);

export class CombatBattleScene extends BattleScene {
  private presentation?: CombatPresentationController;
  private readonly delayedHealthLayers = new Map<ActorId, DelayedHealthLayer>();

  preload(): void {
    preloadCombatEffects(this.load);
  }

  override create(): void {
    registerCombatAnimations(this.anims);
    super.create();

    this.presentation = createCombatBattlePresentationController(this.createPresentationPortOptions());
    this.installPresentationOverrides();
    this.renderInitialPresentationHealth();
  }

  override update(time: number, delta: number): void {
    super.update(time, delta);
    if (!this.presentation) return;

    const internals = this.getInternals();
    if (internals.failed) return;

    const presentationEvents = internals.campaign.consumePresentationEvents?.() ?? [];
    this.presentation.present(presentationEvents);
    this.presentation.advance(Math.min(delta, COMBAT_BALANCE.maxFrameContributionMs));
  }

  private getInternals(): BattleSceneInternals {
    return this as unknown as BattleSceneInternals;
  }

  private installPresentationOverrides(): void {
    const internals = this.getInternals();
    const legacyAnimateEvent = internals.animateEvent.bind(this);
    const legacyDrawHealth = internals.drawHealth.bind(this);

    internals.animateEvent = (event): void => {
      if (this.presentation && shouldCompleteEnemyPresentationDeath(event)) {
        this.presentation.completeEnemyDeath();
      }
      if (shouldAnimateLegacyCombatEvent(event, this.presentation !== undefined)) {
        legacyAnimateEvent(event);
      }
    };

    internals.drawHealth = (graphics, ratio, color): void => {
      const actorId = graphics === internals.playerHealthFill
        ? 'player'
        : graphics === internals.enemyHealthFill
          ? 'enemy'
          : undefined;

      if (!actorId || !this.presentation) {
        legacyDrawHealth(graphics, ratio, color);
        return;
      }

      this.presentation.renderHealth(actorId, ratio);
    };
  }

  private renderInitialPresentationHealth(): void {
    const snapshot = this.getInternals().campaign.getSnapshot().combat;
    if (!snapshot || !this.presentation) return;

    this.presentation.renderHealth('player', snapshot.player.hp / snapshot.player.maxHp);
    this.presentation.renderHealth('enemy', snapshot.enemy.hp / snapshot.enemy.maxHp);
  }

  private createPresentationPortOptions(): PhaserCombatPresentationPortOptions {
    return {
      animationExists: (key) => this.anims.exists(key),
      createSprite: (x, y, textureKey) => this.add.sprite(x, y - EFFECT_VERTICAL_OFFSET, textureKey),
      getActorPosition: (actorId) => {
        const container = this.getActorContainer(actorId);
        return container
          ? { x: container.x, y: container.y }
          : actorId === 'player'
            ? PLAYER_POSITION
            : ENEMY_POSITION;
      },
      flashActor: (actorId, critical) => this.flashActor(actorId, critical),
      createFeedbackText: (kind) => this.createFeedbackText(kind),
      tweenFeedbackText: (text, tween) => {
        const target = text as Phaser.GameObjects.Text;
        this.tweens.killTweensOf(target);
        this.tweens.add({
          targets: target,
          y: target.y - tween.offsetY,
          alpha: 0,
          duration: tween.durationMs,
          ease: 'Cubic.Out',
          onComplete: tween.onComplete,
        });
      },
      renderHealth: (actorId, immediateRatio, delayedRatio) => {
        this.renderPresentationHealth(actorId, immediateRatio, delayedRatio);
      },
      shake: (durationMs, intensity) => this.cameras.main.shake(durationMs, intensity),
      playEnemyDeath: (onComplete) => this.playEnemyPresentationDeath(onComplete),
      warnMissingEffect: (key) => console.warn(`[combat-presentation] Missing animation for ${key}`),
    };
  }

  private getActorContainer(actorId: ActorId): Phaser.GameObjects.Container | undefined {
    const internals = this.getInternals();
    return actorId === 'player' ? internals.playerContainer : internals.enemyContainer;
  }

  private flashActor(actorId: ActorId, critical: boolean): void {
    const target = this.getActorContainer(actorId);
    if (!target) return;

    this.tweens.add({
      targets: target,
      alpha: critical ? 0.28 : 0.42,
      duration: critical ? 70 : 55,
      yoyo: true,
      repeat: 1,
    });
  }

  private createFeedbackText(kind: PhaserCombatFeedbackKind): PhaserCombatFeedbackText {
    const critical = kind === 'critical';
    const miss = kind === 'miss';
    return this.add.text(0, 0, '', {
      color: miss ? '#e8f2ff' : critical ? '#fff0a8' : '#ffdf72',
      fontFamily: 'Arial, sans-serif',
      fontSize: miss ? '21px' : critical ? '31px' : '25px',
      fontStyle: 'bold',
      stroke: miss ? '#38516b' : critical ? '#7a3e24' : '#73363a',
      strokeThickness: critical ? 5 : 4,
    }).setOrigin(0.5).setDepth(30).setVisible(false);
  }

  private renderPresentationHealth(
    actorId: ActorId,
    immediateRatio: number,
    delayedRatio: number,
  ): void {
    const internals = this.getInternals();
    const immediate = actorId === 'player'
      ? internals.playerHealthFill
      : internals.enemyHealthFill;
    const container = this.getActorContainer(actorId);
    if (!immediate || !container) return;

    const delayed = this.ensureDelayedHealthLayer(actorId, container);
    const immediateColor = actorId === 'player' ? 0xe0566d : 0x84c35b;
    const delayedColor = actorId === 'player' ? 0x8f4554 : 0x5f7f49;

    this.drawPresentationHealth(delayed.graphics, delayedRatio, delayedColor);
    this.drawPresentationHealth(immediate, immediateRatio, immediateColor);
  }

  private ensureDelayedHealthLayer(
    actorId: ActorId,
    container: Phaser.GameObjects.Container,
  ): DelayedHealthLayer {
    const existing = this.delayedHealthLayers.get(actorId);
    if (existing?.container === container) return existing;

    existing?.graphics.destroy();
    const graphics = this.add.graphics();
    container.addAt(graphics, 4);
    const layer = { container, graphics };
    this.delayedHealthLayers.set(actorId, layer);
    return layer;
  }

  private drawPresentationHealth(
    graphics: Phaser.GameObjects.Graphics,
    ratio: number,
    color: number,
  ): void {
    graphics.clear();
    const width = HEALTH_WIDTH * Phaser.Math.Clamp(ratio, 0, 1);
    if (width > 0) graphics.fillStyle(color, 1).fillRoundedRect(-51, -154, width, 10, 5);
  }

  private playEnemyPresentationDeath(onComplete: () => void): void {
    const internals = this.getInternals();
    const enemy = internals.enemyContainer;
    if (!enemy) {
      onComplete();
      return;
    }

    this.tweens.killTweensOf(enemy);
    this.tweens.add({
      targets: enemy,
      alpha: 0,
      y: enemy.y + 18,
      duration: ENEMY_DEATH_DURATION_MS,
      ease: 'Quad.In',
      onComplete: () => {
        this.completePendingEnemyVisual();
        onComplete();
      },
    });
  }

  private completePendingEnemyVisual(): void {
    const internals = this.getInternals();
    const visual = internals.pendingEnemyVisual;
    if (!visual || internals.failed) return;

    internals.pendingEnemyVisual = undefined;
    this.delayedHealthLayers.get('enemy')?.graphics.destroy();
    this.delayedHealthLayers.delete('enemy');
    internals.redrawEnemy(visual);

    const snapshot = internals.campaign.getSnapshot().combat;
    if (snapshot) internals.renderSnapshot(snapshot);
  }
}
