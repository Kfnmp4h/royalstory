import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createNativeCombatSpriteRenderer,
  type NativeCombatEffectKey,
} from './nativeCombatSpriteRenderer';

const playerMetadataSource = {
  frames: Object.fromEntries(Array.from({ length: 25 }, (_, index) => [String(index), {
    x: (index % 5) * 256,
    y: Math.floor(index / 5) * 256,
    w: 256,
    h: 256,
    duration: 1,
  }])),
};

const createHarness = (
  loadPlayerAttackMetadata = vi.fn(async (): Promise<unknown> => playerMetadataSource),
) => {
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
      loadPlayerAttackMetadata,
    },
  });
  const images = {
    'slash-basic': createdImages[0]!,
    'impact-basic': createdImages[1]!,
    'impact-critical': createdImages[2]!,
  } satisfies Record<NativeCombatEffectKey, HTMLImageElement>;

  const playerImage = createdImages[3]!;

  return { canvas, clearRect, drawImage, images, onError, parent, playerImage, renderer };
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

  it('draws all player attack frames over 550 ms and completes once', async () => {
    const { drawImage, playerImage, renderer } = createHarness();
    const complete = vi.fn();
    await Promise.resolve();
    playerImage.onload?.(new Event('load'));

    expect(renderer.playPlayerAttack(270, 414, complete)).toBe(true);
    expect(drawImage).toHaveBeenLastCalledWith(
      playerImage, 0, 0, 256, 256, 142, 158, 256, 256,
    );

    renderer.advance(549);
    expect(drawImage).toHaveBeenLastCalledWith(
      playerImage, 1024, 1024, 256, 256, 142, 158, 256, 256,
    );
    expect(complete).not.toHaveBeenCalled();

    renderer.advance(1);
    expect(complete).toHaveBeenCalledOnce();
  });

  it('restarts player attack at frame zero and completes the replaced callback', async () => {
    const { drawImage, playerImage, renderer } = createHarness();
    const firstComplete = vi.fn();
    const secondComplete = vi.fn();
    await Promise.resolve();
    playerImage.onload?.(new Event('load'));
    renderer.playPlayerAttack(270, 414, firstComplete);
    renderer.advance(300);
    drawImage.mockClear();

    expect(renderer.playPlayerAttack(270, 414, secondComplete)).toBe(true);

    expect(firstComplete).toHaveBeenCalledOnce();
    expect(secondComplete).not.toHaveBeenCalled();
    expect(drawImage).toHaveBeenLastCalledWith(
      playerImage, 0, 0, 256, 256, 142, 158, 256, 256,
    );
  });

  it('draws the player below simultaneous slash and impact effects', async () => {
    const { drawImage, images, playerImage, renderer } = createHarness();
    await Promise.resolve();
    playerImage.onload?.(new Event('load'));
    images['slash-basic'].onload?.(new Event('load'));
    images['impact-basic'].onload?.(new Event('load'));
    renderer.playPlayerAttack(270, 414, vi.fn());
    renderer.playEffect('slash-basic', 270, 414);
    renderer.playEffect('impact-basic', 690, 414);
    drawImage.mockClear();

    renderer.advance(10);

    expect(drawImage.mock.calls.map((call) => call[0])).toEqual([
      playerImage,
      images['slash-basic'],
      images['impact-basic'],
    ]);
  });

  it('keeps effects available when the player sprite fails', async () => {
    const { drawImage, images, onError, playerImage, renderer } = createHarness();
    await Promise.resolve();
    playerImage.onerror?.(new Event('error'));
    playerImage.onerror?.(new Event('error'));
    images['slash-basic'].onload?.(new Event('load'));

    expect(renderer.playPlayerAttack(270, 414, vi.fn())).toBe(false);
    renderer.playEffect('slash-basic', 270, 414);

    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(new Error(
      'Failed to load native player attack sprite: assets/characters/base-male-attack.png',
    ));
    expect(drawImage).toHaveBeenLastCalledWith(
      images['slash-basic'], 0, 0, 48, 48, 222, 296, 96, 96,
    );
  });

  it('reports invalid player metadata once and retains the Phaser fallback', async () => {
    const { onError, playerImage, renderer } = createHarness(
      vi.fn(async () => ({ frames: {} })),
    );
    playerImage.onload?.(new Event('load'));
    await Promise.resolve();
    await Promise.resolve();

    expect(renderer.playPlayerAttack(270, 414, vi.fn())).toBe(false);
    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(new Error(
      'Failed to load native player attack metadata: Invalid player attack metadata',
    ));
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

  it('removes its canvas, restores an active player, detaches every image, and ignores calls after destroy', async () => {
    const { canvas, drawImage, images, parent, playerImage, renderer } = createHarness();
    const complete = vi.fn();
    await Promise.resolve();
    playerImage.onload?.(new Event('load'));
    renderer.playPlayerAttack(270, 414, complete);
    drawImage.mockClear();
    expect(parent.contains(canvas)).toBe(true);

    renderer.destroy();
    renderer.destroy();
    renderer.playEffect('impact-critical', 690, 414);
    expect(renderer.playPlayerAttack(270, 414, vi.fn())).toBe(false);
    renderer.advance(50);

    expect(parent.contains(canvas)).toBe(false);
    expect(complete).toHaveBeenCalledOnce();
    expect(drawImage).not.toHaveBeenCalled();
    for (const image of Object.values(images)) {
      expect(image.onload).toBeNull();
      expect(image.onerror).toBeNull();
    }
    expect(playerImage.onload).toBeNull();
    expect(playerImage.onerror).toBeNull();
  });
});
