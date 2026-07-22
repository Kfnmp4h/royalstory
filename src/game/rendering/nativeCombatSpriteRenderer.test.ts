import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createNativeCombatSpriteRenderer,
  type NativeCombatEffectKey,
} from './nativeCombatSpriteRenderer';

const createHarness = () => {
  const clearRect = vi.fn();
  const drawImage = vi.fn();
  const context = { clearRect, drawImage } as unknown as CanvasRenderingContext2D;
  const canvas = document.createElement('canvas');
  vi.spyOn(canvas, 'getContext').mockReturnValue(context);
  const createdImages: HTMLImageElement[] = [];
  const parent = document.createElement('div');
  const onError = vi.fn();
  const renderer = createNativeCombatSpriteRenderer({
    parent,
    onError,
    dependencies: {
      createCanvas: () => canvas,
      createImage: () => {
        const image = document.createElement('img');
        createdImages.push(image);
        return image;
      },
    },
  });
  const images = {
    'slash-basic': createdImages[0]!,
    'impact-basic': createdImages[1]!,
    'impact-critical': createdImages[2]!,
  } satisfies Record<NativeCombatEffectKey, HTMLImageElement>;

  return { canvas, clearRect, drawImage, images, onError, parent, renderer };
};

describe('createNativeCombatSpriteRenderer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('draws slash frame zero immediately and advances frames from explicit delta', () => {
    const { drawImage, images, renderer } = createHarness();
    const image = images['slash-basic'];

    renderer.playEffect('slash-basic', 270, 414);
    image.onload?.(new Event('load'));

    expect(drawImage).toHaveBeenLastCalledWith(image, 0, 0, 48, 48, 222, 296, 96, 96);
    renderer.advance(50);
    expect(drawImage).toHaveBeenLastCalledWith(image, 48, 0, 48, 48, 222, 296, 96, 96);
  });

  it('removes slash after the final frame duration', () => {
    const { clearRect, drawImage, images, renderer } = createHarness();
    images['slash-basic'].onload?.(new Event('load'));
    renderer.playEffect('slash-basic', 270, 414);

    renderer.advance(150);

    expect(clearRect).toHaveBeenLastCalledWith(0, 0, 960, 540);
    expect(drawImage).toHaveBeenCalledTimes(1);
    renderer.advance(50);
    expect(drawImage).toHaveBeenCalledTimes(1);
  });

  it('replaces a queued effect with the same key before its image loads', () => {
    const { drawImage, images, renderer } = createHarness();

    renderer.playEffect('slash-basic', 270, 414);
    renderer.playEffect('slash-basic', 690, 414);
    images['slash-basic'].onload?.(new Event('load'));

    expect(drawImage).toHaveBeenCalledOnce();
    expect(drawImage).toHaveBeenLastCalledWith(
      images['slash-basic'], 0, 0, 48, 48, 642, 296, 96, 96,
    );
  });

  it('draws and advances basic impact with its manifest geometry', () => {
    const { drawImage, images, renderer } = createHarness();
    const image = images['impact-basic'];

    renderer.playEffect('impact-basic', 690, 414);
    image.onload?.(new Event('load'));
    expect(drawImage).toHaveBeenLastCalledWith(image, 0, 0, 32, 32, 658, 312, 64, 64);

    renderer.advance(1_000 / 24);
    expect(drawImage).toHaveBeenLastCalledWith(image, 32, 0, 32, 32, 658, 312, 64, 64);
  });

  it('draws critical impact with its manifest geometry and removes it after four frames', () => {
    const { drawImage, images, renderer } = createHarness();
    const image = images['impact-critical'];

    renderer.playEffect('impact-critical', 690, 414);
    image.onload?.(new Event('load'));
    expect(drawImage).toHaveBeenLastCalledWith(image, 0, 0, 48, 48, 636, 290, 108, 108);

    renderer.advance(1_000 / 24);
    expect(drawImage).toHaveBeenLastCalledWith(image, 48, 0, 48, 48, 636, 290, 108, 108);

    renderer.advance(3 * (1_000 / 24));
    const callsAfterCompletion = drawImage.mock.calls.length;
    renderer.advance(1_000 / 24);
    expect(drawImage).toHaveBeenCalledTimes(callsAfterCompletion);
  });

  it('draws slash and impact simultaneously in stable key order', () => {
    const { drawImage, images, renderer } = createHarness();
    images['slash-basic'].onload?.(new Event('load'));
    images['impact-basic'].onload?.(new Event('load'));
    renderer.playEffect('slash-basic', 270, 414);
    renderer.playEffect('impact-basic', 690, 414);
    drawImage.mockClear();

    renderer.advance(10);

    expect(drawImage).toHaveBeenCalledTimes(2);
    expect(drawImage.mock.calls[0]?.[0]).toBe(images['slash-basic']);
    expect(drawImage.mock.calls[1]?.[0]).toBe(images['impact-basic']);
  });

  it('replaces only an active animation with the same effect key', () => {
    const { drawImage, images, renderer } = createHarness();
    images['impact-basic'].onload?.(new Event('load'));
    renderer.playEffect('slash-basic', 270, 414);
    renderer.playEffect('impact-basic', 270, 414);
    drawImage.mockClear();

    renderer.playEffect('impact-basic', 690, 414);

    expect(drawImage).toHaveBeenCalledOnce();
    expect(drawImage).toHaveBeenCalledWith(
      images['impact-basic'], 0, 0, 32, 32, 658, 312, 64, 64,
    );
  });

  it('keeps other native effects running when one asset fails', () => {
    const { drawImage, images, onError, renderer } = createHarness();
    renderer.playEffect('impact-basic', 690, 414);
    images['impact-basic'].onerror?.(new Event('error'));
    images['impact-basic'].onerror?.(new Event('error'));

    images['slash-basic'].onload?.(new Event('load'));
    renderer.playEffect('slash-basic', 270, 414);

    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(new Error(
      'Failed to load native combat sprite: assets/combat/impact-basic.png',
    ));
    expect(drawImage).toHaveBeenLastCalledWith(
      images['slash-basic'], 0, 0, 48, 48, 222, 296, 96, 96,
    );
  });

  it('removes its canvas, detaches every image, and ignores calls after destroy', () => {
    const { canvas, drawImage, images, parent, renderer } = createHarness();
    expect(parent.contains(canvas)).toBe(true);

    renderer.destroy();
    renderer.destroy();
    renderer.playEffect('impact-critical', 690, 414);
    renderer.advance(50);

    expect(parent.contains(canvas)).toBe(false);
    expect(drawImage).not.toHaveBeenCalled();
    for (const image of Object.values(images)) {
      expect(image.onload).toBeNull();
      expect(image.onerror).toBeNull();
    }
  });
});
