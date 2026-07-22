import { describe, expect, it, vi } from 'vitest';
import type { DamageNumberHandle } from './CombatPresentationController';
import {
  createPhaserCombatPresentationPort,
  type PhaserCombatEffectSprite,
  type PhaserCombatFeedbackText,
} from './PhaserCombatPresentationPort';
import type { CombatEffectKey } from './effectManifest';

const createEffectSprite = () => {
  const destroy = vi.fn();
  let sprite: PhaserCombatEffectSprite;
  const once = vi.fn((_event: string, callback: () => void) => {
    callback();
    return sprite;
  });
  const play = vi.fn(() => sprite);
  const setDepth = vi.fn(() => sprite);
  const setScale = vi.fn(() => sprite);
  const setOrigin = vi.fn(() => sprite);
  sprite = { destroy, once, play, setDepth, setScale, setOrigin };
  return { sprite, destroy, once, play, setDepth, setScale, setOrigin };
};

const createFeedbackText = (): PhaserCombatFeedbackText => {
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

const createOptions = () => ({
  animationExists: vi.fn<(key: string) => boolean>((key) => key === 'royalstory-impact-basic'),
  createSprite: vi.fn(() => createEffectSprite().sprite),
  getActorPosition: vi.fn(() => ({ x: 690, y: 282 })),
  playNativeEffect: vi.fn<(key: CombatEffectKey, x: number, y: number) => boolean>(() => false),
  playPlayerAttack: vi.fn(),
  flashActor: vi.fn(),
  createFeedbackText: vi.fn(() => createFeedbackText()),
  tweenFeedbackText: vi.fn((_text: PhaserCombatFeedbackText, config: { onComplete: () => void }) => config.onComplete()),
  renderHealth: vi.fn(),
  shake: vi.fn(),
  playEnemyDeath: vi.fn((onComplete: () => void) => onComplete()),
  warnMissingEffect: vi.fn(),
});

describe('PhaserCombatPresentationPort', () => {
  it.each(['slash-basic', 'impact-basic', 'impact-critical'] as const)(
    'routes %s to the native effect renderer without creating a Phaser sprite',
    (key) => {
      const options = createOptions();
      options.playNativeEffect.mockImplementation((candidate) => candidate === key);
      const port = createPhaserCombatPresentationPort(options);

      expect(port.hasEffect(key)).toBe(true);
      port.playEffect(key, key === 'slash-basic' ? 'player' : 'enemy');

      expect(options.playNativeEffect).toHaveBeenCalledWith(key, 690, 282);
      expect(options.createSprite).not.toHaveBeenCalled();
    },
  );

  it('keeps enemy-death on the registered Phaser sprite path', () => {
    const effect = createEffectSprite();
    const options = createOptions();
    options.animationExists.mockImplementation((key) => key === 'royalstory-enemy-death');
    options.createSprite.mockReturnValue(effect.sprite);
    const port = createPhaserCombatPresentationPort(options);

    expect(port.hasEffect('enemy-death')).toBe(true);

    port.playEffect('enemy-death', 'enemy');

    expect(options.createSprite).toHaveBeenCalledWith(690, 282, 'enemy-death');
    expect(effect.setOrigin).toHaveBeenCalledWith(0.5, 0.5);
    expect(effect.setScale).toHaveBeenCalledWith(2);
    expect(effect.setDepth).toHaveBeenCalledWith(25);
    expect(effect.play).toHaveBeenCalledWith('royalstory-enemy-death');
    expect(effect.once).toHaveBeenCalledWith('animationcomplete', expect.any(Function));
    expect(effect.destroy).toHaveBeenCalledOnce();
  });

  it('forwards fallback feedback and scene-level presentation operations', () => {
    const options = createOptions();
    const port = createPhaserCombatPresentationPort(options);
    const deathComplete = vi.fn();

    port.flash('enemy', true);
    port.setHealth('player', 1.4, -0.2);
    port.shake(110, 0.0035);
    port.playEnemyDeath(deathComplete);
    port.warnMissingEffect('impact-critical');

    expect(options.flashActor).toHaveBeenCalledWith('enemy', true);
    expect(options.renderHealth).toHaveBeenCalledWith('player', 1, 0);
    expect(options.shake).toHaveBeenCalledWith(110, 0.0035);
    expect(options.playEnemyDeath).toHaveBeenCalledWith(deathComplete);
    expect(deathComplete).toHaveBeenCalledOnce();
    expect(options.warnMissingEffect).toHaveBeenCalledWith('impact-critical');
  });

  it('reuses one feedback text for the same released damage-number handle', () => {
    const options = createOptions();
    const port = createPhaserCombatPresentationPort(options);
    const handle: DamageNumberHandle = { id: 7 };
    const firstComplete = vi.fn();
    const secondComplete = vi.fn();

    port.showDamageNumber(handle, 'enemy', '-42', false, firstComplete);
    port.showDamageNumber(handle, 'enemy', '-84', true, secondComplete);

    expect(options.createFeedbackText).toHaveBeenCalledOnce();
    const text = options.createFeedbackText.mock.results[0]!.value;
    expect(text.setPosition).toHaveBeenCalledTimes(2);
    expect(text.setText).toHaveBeenNthCalledWith(1, '-42');
    expect(text.setText).toHaveBeenNthCalledWith(2, '-84');
    expect(text.setScale).toHaveBeenNthCalledWith(1, 1);
    expect(text.setScale).toHaveBeenNthCalledWith(2, 1.2);
    expect(firstComplete).toHaveBeenCalledOnce();
    expect(secondComplete).toHaveBeenCalledOnce();
  });

  it('renders MISS through the same pooled feedback text lifecycle', () => {
    const options = createOptions();
    const port = createPhaserCombatPresentationPort(options);
    const complete = vi.fn();

    port.showMiss({ id: 3 }, 'player', complete);

    const text = options.createFeedbackText.mock.results[0]!.value;
    expect(options.createFeedbackText).toHaveBeenCalledWith('miss');
    expect(text.setText).toHaveBeenCalledWith('MISS');
    expect(text.setPosition).toHaveBeenCalledWith(690, 150);
    expect(complete).toHaveBeenCalledOnce();
  });
});
