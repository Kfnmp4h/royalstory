import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createNativeCombatSpriteRenderer } from './nativeCombatSpriteRenderer';

const createHarness = () => {
  const clearRect = vi.fn();
  const drawImage = vi.fn();
  const context = { clearRect, drawImage } as unknown as CanvasRenderingContext2D;
  const canvas = document.createElement('canvas');
  vi.spyOn(canvas, 'getContext').mockReturnValue(context);
  const image = document.createElement('img');
  const parent = document.createElement('div');
  const onError = vi.fn();
  const renderer = createNativeCombatSpriteRenderer({
    parent,
    onError,
    dependencies: {
      createCanvas: () => canvas,
      createImage: () => image,
    },
  });

  return { canvas, clearRect, drawImage, image, onError, parent, renderer };
};

describe('createNativeCombatSpriteRenderer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('draws slash frame zero immediately and advances frames from explicit delta', () => {
    const { drawImage, image, renderer } = createHarness();

    renderer.playSlash(270, 414);
    image.onload?.(new Event('load'));

    expect(drawImage).toHaveBeenLastCalledWith(image, 0, 0, 48, 48, 222, 296, 96, 96);

    renderer.advance(50);

    expect(drawImage).toHaveBeenLastCalledWith(image, 48, 0, 48, 48, 222, 296, 96, 96);
  });

  it('removes slash after the final frame duration', () => {
    const { clearRect, drawImage, image, renderer } = createHarness();
    image.onload?.(new Event('load'));
    renderer.playSlash(270, 414);

    renderer.advance(150);

    expect(clearRect).toHaveBeenLastCalledWith(0, 0, 960, 540);
    expect(drawImage).toHaveBeenCalledTimes(1);
    renderer.advance(50);
    expect(drawImage).toHaveBeenCalledTimes(1);
  });

  it('queues at most one slash until the image loads', () => {
    const { drawImage, image, renderer } = createHarness();

    renderer.playSlash(270, 414);
    renderer.playSlash(690, 414);
    image.onload?.(new Event('load'));

    expect(drawImage).toHaveBeenCalledOnce();
    expect(drawImage).toHaveBeenLastCalledWith(image, 0, 0, 48, 48, 642, 296, 96, 96);
  });

  it('reports image failure once without throwing from advance', () => {
    const { image, onError, renderer } = createHarness();
    renderer.playSlash(270, 414);

    image.onerror?.(new Event('error'));
    image.onerror?.(new Event('error'));

    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(new Error(
      'Failed to load native combat sprite: assets/combat/slash-basic.png',
    ));
    expect(() => renderer.advance(50)).not.toThrow();
  });

  it('removes its canvas and ignores calls after destroy', () => {
    const { canvas, drawImage, image, parent, renderer } = createHarness();
    expect(parent.contains(canvas)).toBe(true);

    renderer.destroy();
    renderer.destroy();
    renderer.playSlash(270, 414);
    renderer.advance(50);
    image.onload?.(new Event('load'));

    expect(parent.contains(canvas)).toBe(false);
    expect(drawImage).not.toHaveBeenCalled();
    expect(image.onload).toBeNull();
    expect(image.onerror).toBeNull();
  });
});
