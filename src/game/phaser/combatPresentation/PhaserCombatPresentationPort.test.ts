import { describe, expect, it, vi } from 'vitest';
import { createPhaserCombatPresentationPort } from './PhaserCombatPresentationPort';

describe('PhaserCombatPresentationPort effects', () => {
  it('plays a registered manifest effect at the requested actor position', () => {
    const destroy = vi.fn();
    const once = vi.fn((_event: string, callback: () => void) => {
      callback();
      return sprite;
    });
    const play = vi.fn(() => sprite);
    const setDepth = vi.fn(() => sprite);
    const setScale = vi.fn(() => sprite);
    const setOrigin = vi.fn(() => sprite);
    const sprite = { destroy, once, play, setDepth, setScale, setOrigin };
    const create = vi.fn(() => sprite);

    const port = createPhaserCombatPresentationPort({
      animationExists: (key) => key === 'royalstory-impact-basic',
      createSprite: create,
      getActorPosition: () => ({ x: 690, y: 282 }),
    });

    expect(port.hasEffect('impact-basic')).toBe(true);

    port.playEffect('impact-basic', 'enemy');

    expect(create).toHaveBeenCalledWith(690, 282, 'impact-basic');
    expect(setOrigin).toHaveBeenCalledWith(0.5, 0.5);
    expect(setScale).toHaveBeenCalledWith(2);
    expect(setDepth).toHaveBeenCalledWith(25);
    expect(play).toHaveBeenCalledWith('royalstory-impact-basic');
    expect(once).toHaveBeenCalledWith('animationcomplete', expect.any(Function));
    expect(destroy).toHaveBeenCalledOnce();
  });
});
