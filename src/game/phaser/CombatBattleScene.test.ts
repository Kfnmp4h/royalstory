import { describe, expect, it, vi } from 'vitest';
import { COMBAT_BALANCE } from '../balance';
import type { CombatEvent } from '../types';
import type {
  PhaserCombatEffectSprite,
  PhaserCombatFeedbackText,
  PhaserCombatPresentationPortOptions,
} from './combatPresentation/PhaserCombatPresentationPort';
import {
  createCombatBattlePresentationController,
  CombatBattleScene,
  shouldAnimateLegacyCombatEvent,
  shouldCompleteEnemyPresentationDeath,
} from './CombatBattleScene';
import { BattleScene } from './BattleScene';

vi.mock('phaser', () => ({
  default: { Scene: class Scene {} },
}));

const createSprite = (): PhaserCombatEffectSprite => {
  let sprite: PhaserCombatEffectSprite;
  sprite = {
    setOrigin: vi.fn(() => sprite),
    setScale: vi.fn(() => sprite),
    setDepth: vi.fn(() => sprite),
    play: vi.fn(() => sprite),
    once: vi.fn(() => sprite),
    destroy: vi.fn(),
  };
  return sprite;
};

const createText = (): PhaserCombatFeedbackText => {
  let text: PhaserCombatFeedbackText;
  text = {
    setPosition: vi.fn(() => text),
    setText: vi.fn(() => text),
    setVisible: vi.fn(() => text),
    setAlpha: vi.fn(() => text),
    setScale: vi.fn(() => text),
  };
  return text;
};

describe('CombatBattleScene presentation runtime', () => {
  it('routes only slash-basic to the native renderer', () => {
    const nativeRenderer = {
      playSlash: vi.fn(),
      advance: vi.fn(),
      destroy: vi.fn(),
    };
    const scene = new CombatBattleScene(vi.fn(), vi.fn(), nativeRenderer);
    const options = (scene as unknown as {
      createPresentationPortOptions(): PhaserCombatPresentationPortOptions;
    }).createPresentationPortOptions();

    expect(options.playNativeEffect('slash-basic', 270, 414)).toBe(true);
    expect(options.playNativeEffect('impact-basic', 690, 414)).toBe(false);
    expect(nativeRenderer.playSlash).toHaveBeenCalledOnce();
    expect(nativeRenderer.playSlash).toHaveBeenCalledWith(270, 414);
  });

  it('advances the native renderer with the clamped presentation delta', () => {
    const nativeRenderer = {
      playSlash: vi.fn(),
      advance: vi.fn(),
      destroy: vi.fn(),
    };
    vi.spyOn(BattleScene.prototype, 'update').mockImplementation(() => undefined);
    const scene = new CombatBattleScene(vi.fn(), vi.fn(), nativeRenderer);
    Object.assign(scene, {
      presentation: { present: vi.fn(), advance: vi.fn() },
      campaign: { consumePresentationEvents: vi.fn(() => []) },
      failed: false,
    });

    scene.update(0, COMBAT_BALANCE.maxFrameContributionMs + 500);

    expect(nativeRenderer.advance).toHaveBeenCalledWith(COMBAT_BALANCE.maxFrameContributionMs);
  });

  it('routes critical hits and health through the controller and Phaser port', () => {
    const options: PhaserCombatPresentationPortOptions = {
      animationExists: vi.fn(() => true),
      createSprite: vi.fn(() => createSprite()),
      getActorPosition: vi.fn((actorId) => actorId === 'player'
        ? { x: 270, y: 414 }
        : { x: 690, y: 414 }),
      playNativeEffect: vi.fn(() => false),
      flashActor: vi.fn(),
      createFeedbackText: vi.fn(() => createText()),
      tweenFeedbackText: vi.fn(),
      renderHealth: vi.fn(),
      shake: vi.fn(),
      playEnemyDeath: vi.fn(),
      warnMissingEffect: vi.fn(),
    };
    const controller = createCombatBattlePresentationController(options);

    controller.present([{
      type: 'critical_hit_landed',
      actorId: 'player',
      targetId: 'enemy',
      damage: 84,
      critical: true,
      resultingHealth: 16,
      timestampMs: 120,
    }]);
    controller.renderHealth('enemy', 0.16);

    expect(options.createSprite).toHaveBeenCalledTimes(2);
    expect(options.createSprite).toHaveBeenNthCalledWith(1, 270, 414, 'slash-basic');
    expect(options.createSprite).toHaveBeenNthCalledWith(2, 690, 414, 'impact-critical');
    expect(options.createFeedbackText).toHaveBeenCalledWith('critical');
    expect(options.shake).toHaveBeenCalledWith(110, 0.0035);
    expect(options.renderHealth).toHaveBeenCalledWith('enemy', 0.16, 0.16);
  });

  it('suppresses only legacy feedback replaced by the presentation controller', () => {
    const events: readonly CombatEvent[] = [
      { type: 'attack', attacker: 'player', target: 'enemy' },
      { type: 'damage', target: 'enemy', amount: 20, hp: 80 },
      { type: 'critical', attacker: 'player', target: 'enemy' },
      { type: 'miss', attacker: 'enemy', target: 'player' },
      { type: 'death', actor: 'enemy' },
      { type: 'death', actor: 'player' },
      { type: 'respawn', actor: 'player' },
    ];

    expect(events.map((event) => shouldAnimateLegacyCombatEvent(event, true))).toEqual([
      true,
      false,
      false,
      false,
      false,
      true,
      true,
    ]);
    expect(events.every((event) => shouldAnimateLegacyCombatEvent(event, false))).toBe(true);
  });

  it('releases an active enemy-death presentation when enemy respawn begins', () => {
    expect(shouldCompleteEnemyPresentationDeath({ type: 'respawn', actor: 'enemy' })).toBe(true);
    expect(shouldCompleteEnemyPresentationDeath({ type: 'respawn', actor: 'player' })).toBe(false);
    expect(shouldCompleteEnemyPresentationDeath({ type: 'death', actor: 'enemy' })).toBe(false);
  });
});
