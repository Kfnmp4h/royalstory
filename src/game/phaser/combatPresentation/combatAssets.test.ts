import { describe, expect, it, vi } from 'vitest';
import { COMBAT_EFFECT_MANIFEST } from './effectManifest';
import { preloadCombatEffects, registerCombatAnimations } from './combatAssets';

describe('combat presentation assets', () => {
  it('preloads every manifest entry as a spritesheet with its declared frame size', () => {
    const spritesheet = vi.fn();

    preloadCombatEffects({ spritesheet });

    for (const definition of Object.values(COMBAT_EFFECT_MANIFEST)) {
      expect(spritesheet).toHaveBeenCalledWith(definition.key, definition.url, {
        frameWidth: definition.frameWidth,
        frameHeight: definition.frameHeight,
      });
    }
    expect(spritesheet).toHaveBeenCalledTimes(Object.keys(COMBAT_EFFECT_MANIFEST).length);
  });

  it('registers each missing manifest animation exactly once', () => {
    const exists = vi.fn((key: string) => key === 'royalstory-impact-basic');
    const generateFrameNumbers = vi.fn((key: string, range: { start: number; end: number }) => [key, range]);
    const create = vi.fn();

    registerCombatAnimations({ exists, generateFrameNumbers, create });

    expect(create).not.toHaveBeenCalledWith(expect.objectContaining({ key: 'royalstory-impact-basic' }));
    for (const definition of Object.values(COMBAT_EFFECT_MANIFEST).filter(
      ({ animationKey }) => animationKey !== 'royalstory-impact-basic',
    )) {
      expect(generateFrameNumbers).toHaveBeenCalledWith(definition.key, {
        start: 0,
        end: definition.frameCount - 1,
      });
      expect(create).toHaveBeenCalledWith({
        key: definition.animationKey,
        frames: [definition.key, { start: 0, end: definition.frameCount - 1 }],
        frameRate: definition.frameRate,
        repeat: 0,
        hideOnComplete: true,
      });
    }
  });
});
