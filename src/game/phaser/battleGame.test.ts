import { beforeEach, describe, expect, it, vi } from 'vitest';

const phaserBoundary = vi.hoisted(() => {
  const getScene = vi.fn(() => null);
  const pause = vi.fn();
  const resume = vi.fn();
  const destroy = vi.fn();
  const graphics = vi.fn();
  const shake = vi.fn();
  const addTween = vi.fn();
  const damageText = {
    x: 0,
    y: 0,
    setOrigin() { return this; },
    setDepth() { return this; },
    destroy: vi.fn(),
  };
  const text = vi.fn(() => damageText);
  const game = {
    scene: { getScene, pause, resume },
    destroy,
  };
  const Game = vi.fn(function MockGame(_config: unknown) {
    return game;
  });

  return { Game, game, getScene, pause, resume, destroy, graphics, shake, addTween, text };
});

vi.mock('phaser', () => {
  class Scene {
    add = { graphics: phaserBoundary.graphics, text: phaserBoundary.text };
    cameras = { main: { shake: phaserBoundary.shake } };
    tweens = { add: phaserBoundary.addTween };
  }

  return {
    default: {
      AUTO: 'AUTO',
      Game: phaserBoundary.Game,
      Scale: { FIT: 'FIT', CENTER_BOTH: 'CENTER_BOTH' },
      Scene,
    },
  };
});

import { BattleScene } from './BattleScene';
import { createBattleGame } from './battleGame';
import { createCampaignController } from '../campaign/campaignController';
import type { CampaignController } from '../campaign/campaignTypes';

describe('createBattleGame', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('owns one Phaser game and coordinates pause, resume, and destruction in order', () => {
    const parent = document.createElement('div');
    const setCombatPaused = vi.spyOn(BattleScene.prototype, 'setCombatPaused');
    const setCampaignCommand = vi.fn();
    const startBreakthrough = vi.spyOn(
      BattleScene.prototype as BattleScene & { startBreakthrough(): void },
      'startBreakthrough',
    ).mockImplementation(() => setCampaignCommand('breakthrough'));
    const startBoss = vi.spyOn(
      BattleScene.prototype as BattleScene & { startBoss(): void },
      'startBoss',
    ).mockImplementation(() => setCampaignCommand('boss'));
    const controller = createBattleGame({
      parent,
      onStatus: vi.fn(),
      onError: vi.fn(),
    });

    expect(phaserBoundary.Game).toHaveBeenCalledTimes(1);
    expect(phaserBoundary.Game).toHaveBeenCalledWith(expect.objectContaining({
      parent,
      width: 960,
      height: 540,
      transparent: true,
      render: { antialias: true },
      scale: { mode: 'FIT', autoCenter: 'CENTER_BOTH' },
    }));
    const constructorConfig = phaserBoundary.Game.mock.calls[0]?.[0] as { scene: BattleScene[] };
    const registeredScene = constructorConfig.scene[0];

    expect(() => controller.setPaused(true)).not.toThrow();
    expect(phaserBoundary.getScene).not.toHaveBeenCalled();
    expect(setCombatPaused).toHaveBeenLastCalledWith(true);
    expect(setCombatPaused.mock.contexts.at(-1)).toBe(registeredScene);
    expect(phaserBoundary.pause).toHaveBeenLastCalledWith('battle');
    expect(setCombatPaused.mock.invocationCallOrder.at(-1)).toBeLessThan(
      phaserBoundary.pause.mock.invocationCallOrder.at(-1) ?? 0,
    );

    expect(() => controller.setPaused(false)).not.toThrow();
    expect(setCombatPaused).toHaveBeenLastCalledWith(false);
    expect(setCombatPaused.mock.contexts.at(-1)).toBe(registeredScene);
    expect(phaserBoundary.resume).toHaveBeenLastCalledWith('battle');
    expect(setCombatPaused.mock.invocationCallOrder.at(-1)).toBeLessThan(
      phaserBoundary.resume.mock.invocationCallOrder.at(-1) ?? 0,
    );

    expect(() => controller.startBreakthrough()).not.toThrow();
    expect(setCampaignCommand).toHaveBeenLastCalledWith('breakthrough');
    expect(startBreakthrough.mock.contexts.at(-1)).toBe(registeredScene);

    expect(() => controller.startBoss()).not.toThrow();
    expect(setCampaignCommand).toHaveBeenLastCalledWith('boss');
    expect(startBoss.mock.contexts.at(-1)).toBe(registeredScene);

    controller.destroy();
    controller.destroy();
    expect(phaserBoundary.destroy).toHaveBeenCalledTimes(1);
    expect(phaserBoundary.destroy).toHaveBeenCalledWith(true);

    controller.startBreakthrough();
    controller.startBoss();
    expect(setCampaignCommand).toHaveBeenCalledTimes(2);
  });

  it('redraws the enemy when the campaign visual name changes', () => {
    const scene = new BattleScene(vi.fn(), vi.fn());
    const campaignSnapshot = createCampaignController().getSnapshot();
    const redrawingScene = scene as unknown as {
      renderCampaign(snapshot: typeof campaignSnapshot): void;
      redrawEnemy(visual: NonNullable<typeof campaignSnapshot.encounter>['visual']): void;
      renderedVisualName?: string;
    };
    const redrawEnemy = vi.spyOn(redrawingScene, 'redrawEnemy').mockImplementation((visual) => {
      redrawingScene.renderedVisualName = visual.name;
    });

    redrawingScene.renderCampaign(campaignSnapshot);
    redrawingScene.renderCampaign({
      ...campaignSnapshot,
      encounter: {
        ...campaignSnapshot.encounter!,
        visual: { ...campaignSnapshot.encounter!.visual, name: 'Whisperwood Sentinel' },
      },
    });

    expect(redrawEnemy).toHaveBeenCalledTimes(2);
    expect(redrawEnemy).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Whisperwood Sentinel' }));
  });

  it('renders the completion message exactly when the campaign has ended', () => {
    const scene = new BattleScene(vi.fn(), vi.fn());
    const campaignSnapshot = createCampaignController().getSnapshot();
    const setText = vi.fn();
    const completedSnapshot = {
      ...campaignSnapshot,
      mode: 'campaign-complete' as const,
      encounter: null,
      combat: null,
    };
    const advance = vi.fn(() => []);
    Object.assign(scene, {
      campaign: {
        advance,
        pause: vi.fn(() => []),
        resume: vi.fn(() => []),
        startBreakthrough: vi.fn(),
        startBoss: vi.fn(),
        getSnapshot: vi.fn(() => completedSnapshot),
      } satisfies CampaignController,
      statusText: { setText },
    });

    (scene as unknown as {
      renderCampaign(snapshot: typeof campaignSnapshot): void;
    }).renderCampaign(completedSnapshot);
    scene.update(0, 1_000);

    expect(advance).toHaveBeenCalledOnce();
    expect(setText).toHaveBeenLastCalledWith('Lightrest Summit restored');
  });

  it('keeps the defeated enemy while its death feedback plays before a campaign visual changes', () => {
    const scene = new BattleScene(vi.fn(), vi.fn());
    const campaignSnapshot = createCampaignController().getSnapshot();
    const nextSnapshot = {
      ...campaignSnapshot,
      encounter: {
        ...campaignSnapshot.encounter!,
        visual: { ...campaignSnapshot.encounter!.visual, name: 'Lantern Marsh Sprig' },
      },
    };
    const redrawEnemy = vi.spyOn(
      scene as unknown as { redrawEnemy(): void },
      'redrawEnemy',
    ).mockImplementation(() => undefined);
    const addTween = vi.fn();

    Object.assign(scene, {
      campaign: {
        advance: vi.fn(() => [{ type: 'death' as const, actor: 'enemy' as const, hp: 0 }]),
        pause: vi.fn(() => []),
        resume: vi.fn(() => []),
        startBreakthrough: vi.fn(),
        startBoss: vi.fn(),
        getSnapshot: vi.fn(() => nextSnapshot),
      } satisfies CampaignController,
      renderedVisualName: 'Whisperwood Warden',
      enemyContainer: { x: 690, y: 414 },
      tweens: { add: addTween, killTweensOf: vi.fn() },
    });

    scene.update(0, 16);

    expect(redrawEnemy).not.toHaveBeenCalled();
    const deathTween = addTween.mock.calls[0]?.[0] as { onComplete(): void };
    deathTween.onComplete();
    expect(redrawEnemy).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Lantern Marsh Sprig' }));
  });

  it('reports a create failure once and stops all future updates', () => {
    const error = new Error('drawing failed');
    const onStatus = vi.fn();
    const onError = vi.fn();
    phaserBoundary.graphics.mockImplementationOnce(() => {
      throw error;
    });
    const scene = new BattleScene(onStatus, onError);

    expect(() => scene.create()).not.toThrow();
    scene.update(0, 1_000);
    scene.update(1_000, 1_000);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(error);
    expect(onStatus).not.toHaveBeenCalled();
  });

  it('adds a short restrained camera shake to damage feedback', () => {
    const scene = new BattleScene(vi.fn(), vi.fn());
    Object.assign(scene, { enemyContainer: { x: 690, y: 414 } });

    (scene as unknown as {
      animateEvent(event: { type: 'damage'; target: 'enemy'; amount: number; hp: number }): void;
    }).animateEvent({ type: 'damage', target: 'enemy', amount: 9, hp: 81 });

    expect(phaserBoundary.shake).toHaveBeenCalledOnce();
    expect(phaserBoundary.shake).toHaveBeenCalledWith(80, 0.002);
  });
});
