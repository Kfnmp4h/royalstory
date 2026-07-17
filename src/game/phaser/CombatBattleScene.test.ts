import { describe, expect, it, vi } from 'vitest';
import type {
  PhaserCombatEffectSprite,
  PhaserCombatFeedbackText,
  PhaserCombatPresentationPortOptions,
} from './combatPresentation/PhaserCombatPresentationPort';
import { createCombatBattlePresentationController } from './CombatBattleScene';

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
  it('routes critical hits and health through the controller and Phaser port', () => {
    const options: PhaserCombatPresentationPortOptions = {
      animationExists: vi.fn(() => true),
      createSprite: vi.fn(() => createSprite()),
      getActorPosition: vi.fn((actorId) => actorId === 'player'
        ? { x: 270, y: 414 }
        : { x: 690, y: 414 }),
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
});
