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

describe('createBattleGame', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('owns one Phaser game and coordinates pause, resume, and destruction in order', () => {
    const parent = document.createElement('div');
    const setCombatPaused = vi.spyOn(BattleScene.prototype, 'setCombatPaused');
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

    controller.destroy();
    controller.destroy();
    expect(phaserBoundary.destroy).toHaveBeenCalledTimes(1);
    expect(phaserBoundary.destroy).toHaveBeenCalledWith(true);
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
