import Phaser from 'phaser';
import { COMBAT_BALANCE } from '../balance';
import type { ActorId, CombatEvent, CombatSnapshot } from '../types';
import { createCampaignController } from '../campaign/campaignController';
import type { CampaignSnapshot, EncounterVisual } from '../campaign/campaignTypes';
import type { BattleStatus } from './battleGame';

const WORLD_WIDTH = 960;
const WORLD_HEIGHT = 540;
const HEALTH_WIDTH = 102;
const STATUS_INTERVAL_MS = 250;
const PLAYER_POSITION = { x: 270, y: 414 } as const;
const ENEMY_POSITION = { x: 690, y: 414 } as const;

export class BattleScene extends Phaser.Scene {
  private readonly campaign = createCampaignController();
  private playerContainer?: Phaser.GameObjects.Container;
  private enemyContainer?: Phaser.GameObjects.Container;
  private playerHealthFill?: Phaser.GameObjects.Graphics;
  private enemyHealthFill?: Phaser.GameObjects.Graphics;
  private chapterBackdrop?: Phaser.GameObjects.Graphics;
  private statusText?: Phaser.GameObjects.Text;
  private statusElapsedMs = 0;
  private renderedVisualName?: string;
  private renderedChapterNumber?: number;
  private pendingEnemyVisual?: EncounterVisual;
  private enemyDeathFeedbackActive = false;
  private nextPlayerDamageCritical = false;
  private ready = false;
  private failed = false;

  constructor(
    private readonly onStatus: (status: BattleStatus) => void,
    private readonly onError: (error: Error) => void,
  ) {
    super({ key: 'battle' });
  }

  create(): void {
    if (this.failed) return;

    try {
      const snapshot = this.campaign.getSnapshot();
      this.drawBackdrop(snapshot.chapter.backgroundColor);

      const player = this.drawAri();
      this.playerContainer = player.container;
      this.playerHealthFill = player.healthFill;

      this.statusText = this.add.text(WORLD_WIDTH / 2, 28, '', {
        color: '#fff8df',
        fontFamily: 'Georgia, serif',
        fontSize: '20px',
        fontStyle: 'bold',
        stroke: '#335044',
        strokeThickness: 5,
      }).setOrigin(0.5).setDepth(20);

      this.ready = true;
      this.renderAndPublish(snapshot);
    } catch (error) {
      this.fail(error);
    }
  }

  setCombatPaused(paused: boolean): void {
    if (this.failed) return;

    try {
      paused ? this.campaign.pause() : this.campaign.resume();
      this.renderAndPublish(this.campaign.getSnapshot());
    } catch (error) {
      this.fail(error);
    }
  }

  startBreakthrough(): void {
    if (this.failed) return;

    try {
      this.campaign.startBreakthrough();
      this.renderAndPublish(this.campaign.getSnapshot());
    } catch (error) {
      this.fail(error);
    }
  }

  startBoss(): void {
    if (this.failed) return;

    try {
      this.campaign.startBoss();
      this.renderAndPublish(this.campaign.getSnapshot());
    } catch (error) {
      this.fail(error);
    }
  }

  equip(itemId: string): void {
    if (this.failed) return;

    try {
      this.campaign.equip(itemId);
      this.renderAndPublish(this.campaign.getSnapshot());
    } catch (error) {
      this.fail(error);
    }
  }

  equipBest(): void {
    if (this.failed) return;

    try {
      this.campaign.equipBest();
      this.renderAndPublish(this.campaign.getSnapshot());
    } catch (error) {
      this.fail(error);
    }
  }

  update(_time: number, delta: number): void {
    if (this.failed || !this.ready) return;

    try {
      const contributionMs = Math.min(delta, COMBAT_BALANCE.maxFrameContributionMs);
      const events = this.campaign.advance(contributionMs);
      const snapshot = this.campaign.getSnapshot();

      const deferEnemyRedraw = events.some(
        (event) => event.type === 'death' && event.actor === 'enemy'
          && snapshot.encounter?.visual.name !== this.renderedVisualName,
      );
      this.renderCampaign(snapshot, deferEnemyRedraw);
      for (const event of events) this.animateEvent(event);

      this.statusElapsedMs += Math.max(0, delta);
      if (this.statusElapsedMs >= STATUS_INTERVAL_MS) {
        this.statusElapsedMs %= STATUS_INTERVAL_MS;
        this.publishStatus(snapshot);
      }
    } catch (error) {
      this.fail(error);
    }
  }

  private drawBackdrop(backgroundColor: number): void {
    this.chapterBackdrop = this.add.graphics().setDepth(-1);
    this.drawChapterBackdrop(backgroundColor);

    const sky = this.add.graphics();
    const skyColors = [0x94cfff, 0xa9d9ff, 0xbde3ff, 0xd1ecff, 0xe4f2ff, 0xf2f6ec];
    const bandHeight = WORLD_HEIGHT / skyColors.length;
    skyColors.forEach((color, index) => {
      sky.fillStyle(color, 0.72);
      sky.fillRect(0, index * bandHeight, WORLD_WIDTH, bandHeight + 1);
    });

    this.drawCloud(150, 105, 0.72);
    this.drawCloud(520, 82, 0.5);
    this.drawCloud(810, 145, 0.82);

    this.drawHillLayer(315, 0x9fc89b, 0.15, 185);
    this.drawHillLayer(355, 0x73aa7d, 0.25, 155);
    this.drawHillLayer(395, 0x4f865f, 0.35, 125);

    [92, 176, 805, 876].forEach((x, index) => this.drawTree(x, 364 + (index % 2) * 16, 0.8));
    [34, 224, 756, 928].forEach((x) => this.drawTree(x, 408, 0.58));

    const ground = this.add.graphics();
    ground.fillStyle(0x355f42, 1);
    ground.fillRect(0, 428, WORLD_WIDTH, 112);
    ground.fillStyle(0x69a25f, 1);
    ground.fillRect(0, 428, WORLD_WIDTH, 13);
    ground.fillStyle(0x527f4b, 1);
    ground.fillRect(0, 441, WORLD_WIDTH, 9);
    ground.fillStyle(0xf4d69a, 0.2);
    for (let x = 18; x < WORLD_WIDTH; x += 54) ground.fillCircle(x, 478 + (x % 3) * 12, 2);
  }

  private drawChapterBackdrop(backgroundColor: number): void {
    if (!this.chapterBackdrop) return;
    this.chapterBackdrop.clear();
    this.chapterBackdrop.fillStyle(backgroundColor, 1).fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  }

  private drawCloud(x: number, y: number, scale: number): void {
    const cloud = this.add.graphics().setPosition(x, y).setAlpha(0.72).setScale(scale);
    cloud.fillStyle(0xffffff, 1);
    cloud.fillCircle(0, 0, 32);
    cloud.fillCircle(34, -10, 42);
    cloud.fillCircle(74, 2, 30);
    cloud.fillRoundedRect(-8, 0, 108, 34, 17);
    cloud.setScrollFactor(0.08);
  }

  private drawHillLayer(y: number, color: number, scrollFactor: number, radius: number): void {
    const hills = this.add.graphics().setScrollFactor(scrollFactor);
    hills.fillStyle(color, 1);
    for (let x = -radius; x < WORLD_WIDTH + radius; x += radius * 1.35) {
      hills.fillEllipse(x, y, radius * 2.2, radius * 1.25);
    }
    hills.fillRect(0, y, WORLD_WIDTH, WORLD_HEIGHT - y);
  }

  private drawTree(x: number, y: number, scale: number): void {
    const tree = this.add.graphics().setPosition(x, y).setScale(scale).setDepth(2);
    tree.fillStyle(0x674631, 1);
    tree.fillRoundedRect(-8, -76, 16, 82, 6);
    tree.fillStyle(0x2f6d42, 1);
    tree.fillCircle(0, -91, 38);
    tree.fillCircle(-27, -73, 29);
    tree.fillCircle(28, -70, 31);
    tree.fillStyle(0x4c8b50, 1);
    tree.fillCircle(-10, -104, 22);
  }

  private drawAri(): { container: Phaser.GameObjects.Container; healthFill: Phaser.GameObjects.Graphics } {
    const shadow = this.add.graphics();
    shadow.fillStyle(0x183829, 0.38).fillEllipse(0, 19, 108, 24);

    const figure = this.add.graphics();
    figure.fillStyle(0x453529, 1).fillRoundedRect(-29, -8, 22, 31, 7);
    figure.fillRoundedRect(8, -8, 22, 31, 7);
    figure.fillStyle(0x8b3457, 1).fillTriangle(-47, 2, 0, -95, 48, 2);
    figure.fillStyle(0x416faa, 1).fillRoundedRect(-35, -82, 70, 81, 19);
    figure.fillStyle(0xf2c8a2, 1).fillCircle(0, -111, 31);
    figure.fillStyle(0x6a3d29, 1).fillCircle(-5, -122, 31);
    figure.fillStyle(0xf2c8a2, 1).fillCircle(6, -106, 25);
    figure.fillStyle(0x243344, 1).fillCircle(-4, -108, 3).fillCircle(14, -108, 3);
    figure.fillStyle(0xf3c449, 1).fillTriangle(-18, -141, -6, -160, 2, -139);
    figure.fillTriangle(-2, -140, 10, -164, 18, -138);
    figure.fillStyle(0xe8e1d2, 1).fillRoundedRect(41, -93, 8, 88, 4);
    figure.fillStyle(0xd4ad43, 1).fillRoundedRect(31, -89, 28, 8, 4);

    const label = this.add.text(0, -186, COMBAT_BALANCE.player.name, {
      color: '#fff4cf',
      fontFamily: 'Georgia, serif',
      fontSize: '18px',
      fontStyle: 'bold',
      stroke: '#2f4050',
      strokeThickness: 4,
    }).setOrigin(0.5);

    const healthBack = this.add.graphics();
    healthBack.fillStyle(0x20372f, 0.9).fillRoundedRect(-57, -158, 114, 18, 9);
    healthBack.lineStyle(2, 0xfff0c4, 0.9).strokeRoundedRect(-57, -158, 114, 18, 9);
    const healthFill = this.add.graphics();

    const container = this.add.container(PLAYER_POSITION.x, PLAYER_POSITION.y, [
      shadow,
      figure,
      label,
      healthBack,
      healthFill,
    ]).setDepth(10);

    return { container, healthFill };
  }

  private drawEnemy(visual: EncounterVisual): { container: Phaser.GameObjects.Container; healthFill: Phaser.GameObjects.Graphics } {
    const shadow = this.add.graphics();
    shadow.fillStyle(0x183829, 0.38).fillEllipse(0, 18, 118, 25);

    const figure = this.add.graphics();
    figure.fillStyle(visual.color, 1).fillEllipse(0, -45, 116, 118);
    figure.fillStyle(visual.accentColor, 1).fillCircle(-33, -78, 34).fillCircle(35, -76, 35);
    figure.fillStyle(visual.accentColor, 0.72).fillCircle(0, -54, 42);
    figure.fillStyle(0xe8e7c8, 1).fillCircle(-17, -61, 11).fillCircle(18, -61, 11);
    figure.fillStyle(0x203529, 1).fillCircle(-14, -60, 5).fillCircle(15, -60, 5);
    figure.fillStyle(0x234532, 1).fillRoundedRect(-19, -35, 38, 7, 3);
    figure.fillStyle(visual.color, 1).fillTriangle(-40, -102, -25, -139, -10, -101);
    figure.fillTriangle(13, -102, 34, -141, 45, -96);
    figure.fillStyle(visual.accentColor, 1).fillEllipse(-29, -123, 22, 40).fillEllipse(31, -124, 22, 42);
    figure.fillStyle(visual.color, 0.82).fillRoundedRect(-46, -6, 32, 25, 10);
    figure.fillRoundedRect(15, -6, 32, 25, 10);

    const label = this.add.text(0, -186, visual.name, {
      color: '#e9ffd8',
      fontFamily: 'Georgia, serif',
      fontSize: '18px',
      fontStyle: 'bold',
      stroke: '#294633',
      strokeThickness: 4,
    }).setOrigin(0.5);

    const healthBack = this.add.graphics();
    healthBack.fillStyle(0x20372f, 0.9).fillRoundedRect(-57, -158, 114, 18, 9);
    healthBack.lineStyle(2, 0xe8ffd4, 0.9).strokeRoundedRect(-57, -158, 114, 18, 9);
    const healthFill = this.add.graphics();

    const container = this.add.container(ENEMY_POSITION.x, ENEMY_POSITION.y, [
      shadow,
      figure,
      label,
      healthBack,
      healthFill,
    ]).setDepth(10).setScale(visual.scale);

    return { container, healthFill };
  }

  private redrawEnemy(visual: EncounterVisual): void {
    this.enemyHealthFill?.destroy();
    this.enemyContainer?.destroy();
    const enemy = this.drawEnemy(visual);
    this.enemyContainer = enemy.container;
    this.enemyHealthFill = enemy.healthFill;
    this.renderedVisualName = visual.name;
  }

  private renderAndPublish(snapshot: CampaignSnapshot): void {
    if (!this.ready) return;
    this.renderCampaign(snapshot);
    this.publishStatus(snapshot);
  }

  private renderCampaign(snapshot: CampaignSnapshot, deferEnemyRedraw = false): void {
    if (this.renderedChapterNumber !== snapshot.chapter.number) {
      this.drawChapterBackdrop(snapshot.chapter.backgroundColor);
      this.renderedChapterNumber = snapshot.chapter.number;
    }

    const visual = snapshot.encounter?.visual;
    if (visual && this.renderedVisualName !== visual.name) {
      if (deferEnemyRedraw || this.enemyDeathFeedbackActive || this.pendingEnemyVisual?.name === visual.name) {
        this.pendingEnemyVisual = visual;
      } else {
        this.redrawEnemy(visual);
      }
    }

    if (snapshot.combat) {
      this.renderSnapshot(snapshot.combat);
      return;
    }

    this.enemyHealthFill?.clear();
    if (this.statusText) {
      this.statusText.setText(
        snapshot.mode === 'campaign-complete' ? 'Lightrest Summit restored' : 'Preparing the next encounter',
      );
    }
  }

  private renderSnapshot(snapshot: CombatSnapshot): void {
    if (this.playerHealthFill) {
      this.drawHealth(this.playerHealthFill, snapshot.player.hp / snapshot.player.maxHp, 0xe0566d);
    }
    if (this.enemyHealthFill) {
      this.drawHealth(this.enemyHealthFill, snapshot.enemy.hp / snapshot.enemy.maxHp, 0x84c35b);
    }
    if (this.statusText) {
      const status = snapshot.paused
        ? 'Battle paused'
        : snapshot.phase === 'enemy-defeated'
          ? 'A new Mossling is gathering courage…'
          : snapshot.phase === 'player-defeated'
            ? 'Ari is recovering…'
            : 'Battle in progress';
      this.statusText.setText(status);
    }
  }

  private drawHealth(graphics: Phaser.GameObjects.Graphics, ratio: number, color: number): void {
    graphics.clear();
    const width = HEALTH_WIDTH * Phaser.Math.Clamp(ratio, 0, 1);
    if (width > 0) graphics.fillStyle(color, 1).fillRoundedRect(-51, -154, width, 10, 5);
  }

  private animateEvent(event: CombatEvent): void {
    switch (event.type) {
      case 'attack': {
        const attacker = this.getContainer(event.attacker);
        if (!attacker) return;
        const direction = event.attacker === 'player' ? 1 : -1;
        this.tweens.add({
          targets: attacker,
          x: attacker.x + direction * 22,
          duration: 90,
          yoyo: true,
          ease: 'Sine.InOut',
        });
        return;
      }
      case 'damage': {
        const target = this.getContainer(event.target);
        if (!target) return;
        const critical = event.target === 'enemy' && this.nextPlayerDamageCritical;
        this.nextPlayerDamageCritical = false;
        this.cameras.main.shake(critical ? 110 : 80, critical ? 0.0035 : 0.002);
        const damageText = this.add.text(target.x, target.y - 132, `-${event.amount}`, {
          color: critical ? '#fff0a8' : '#ffdf72',
          fontFamily: 'Arial, sans-serif',
          fontSize: critical ? '31px' : '25px',
          fontStyle: 'bold',
          stroke: '#73363a',
          strokeThickness: 5,
        }).setOrigin(0.5).setDepth(30);
        this.tweens.add({
          targets: damageText,
          y: damageText.y - 38,
          alpha: 0,
          duration: 560,
          ease: 'Cubic.Out',
          onComplete: () => damageText.destroy(),
        });
        this.tweens.add({
          targets: target,
          alpha: 0.42,
          duration: 55,
          yoyo: true,
          repeat: 1,
        });
        return;
      }
      case 'miss': {
        const target = this.getContainer(event.target);
        if (!target) return;
        const missText = this.add.text(target.x, target.y - 132, 'MISS', {
          color: '#e8f2ff',
          fontFamily: 'Arial, sans-serif',
          fontSize: '21px',
          fontStyle: 'bold',
          stroke: '#38516b',
          strokeThickness: 4,
        }).setOrigin(0.5).setDepth(30);
        this.tweens.add({
          targets: missText,
          y: missText.y - 28,
          alpha: 0,
          duration: 460,
          ease: 'Cubic.Out',
          onComplete: () => missText.destroy(),
        });
        return;
      }
      case 'critical': {
        const target = this.getContainer(event.target);
        if (!target) return;
        this.nextPlayerDamageCritical = true;
        const criticalText = this.add.text(target.x, target.y - 158, 'CRITICAL', {
          color: '#ffe083',
          fontFamily: 'Arial, sans-serif',
          fontSize: '22px',
          fontStyle: 'bold',
          stroke: '#7a3e24',
          strokeThickness: 5,
        }).setOrigin(0.5).setDepth(31);
        this.tweens.add({
          targets: criticalText,
          y: criticalText.y - 24,
          alpha: 0,
          duration: 620,
          ease: 'Cubic.Out',
          onComplete: () => criticalText.destroy(),
        });
        return;
      }
      case 'death': {
        const actor = this.getContainer(event.actor);
        if (!actor) return;
        if (event.actor === 'enemy') this.enemyDeathFeedbackActive = true;
        const position = this.getBasePosition(event.actor);
        this.tweens.killTweensOf(actor);
        this.tweens.add({
          targets: actor,
          alpha: 0,
          y: position.y + 18,
          duration: 320,
          ease: 'Quad.In',
          onComplete: () => {
            if (event.actor !== 'enemy') {
              if (this.campaign.getSnapshot().combat?.player.alive) {
                this.animateEvent({ type: 'respawn', actor: 'player' });
              }
              return;
            }
            this.enemyDeathFeedbackActive = false;
            if (!this.pendingEnemyVisual || this.failed) return;
            const visual = this.pendingEnemyVisual;
            this.pendingEnemyVisual = undefined;
            this.redrawEnemy(visual);
            const snapshot = this.campaign.getSnapshot();
            if (snapshot.combat) this.renderSnapshot(snapshot.combat);
          },
        });
        return;
      }
      case 'respawn': {
        const actor = this.getContainer(event.actor);
        if (!actor) return;
        const position = this.getBasePosition(event.actor);
        this.tweens.killTweensOf(actor);
        actor.setPosition(position.x, position.y + 18).setAlpha(0).setScale(0.72);
        this.tweens.add({
          targets: actor,
          y: position.y,
          alpha: 1,
          scaleX: 1,
          scaleY: 1,
          duration: 280,
          ease: 'Back.Out',
        });
        return;
      }
      case 'pause':
      case 'resume':
        return;
    }
  }

  private getContainer(actor: ActorId): Phaser.GameObjects.Container | undefined {
    return actor === 'player' ? this.playerContainer : this.enemyContainer;
  }

  private getBasePosition(actor: ActorId): typeof PLAYER_POSITION | typeof ENEMY_POSITION {
    return actor === 'player' ? PLAYER_POSITION : ENEMY_POSITION;
  }

  private publishStatus(snapshot: CampaignSnapshot): void {
    this.onStatus({ snapshot, state: snapshot.combat?.paused ? 'paused' : 'running' });
  }

  private fail(error: unknown): void {
    if (this.failed) return;
    this.failed = true;
    this.onError(error instanceof Error ? error : new Error(String(error)));
  }
}
