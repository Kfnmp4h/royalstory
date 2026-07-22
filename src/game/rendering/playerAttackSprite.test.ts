import { describe, expect, it } from 'vitest';
import { parsePlayerAttackMetadata, selectPlayerAttackFrame } from './playerAttackSprite';

const source = {
  frames: Object.fromEntries(Array.from({ length: 25 }, (_, index) => [String(index), {
    x: (index % 5) * 256,
    y: Math.floor(index / 5) * 256,
    w: 256,
    h: 256,
    duration: 1,
  }])),
  meta: { size: { w: 1280, h: 1280 }, frame_size: { w: 256, h: 256 } },
};

describe('playerAttackSprite', () => {
  it('orders all 25 numeric frames across the five-by-five grid', () => {
    const metadata = parsePlayerAttackMetadata(source);

    expect(metadata.frames).toHaveLength(25);
    expect(metadata.frames[0]).toMatchObject({ x: 0, y: 0, width: 256, height: 256 });
    expect(metadata.frames[5]).toMatchObject({ x: 0, y: 256, width: 256, height: 256 });
    expect(metadata.frames[24]).toMatchObject({ x: 1024, y: 1024, width: 256, height: 256 });
  });

  it('selects frame zero initially, the final frame before 550 ms, then completes', () => {
    const metadata = parsePlayerAttackMetadata(source);

    expect(selectPlayerAttackFrame(metadata, 0)).toBe(metadata.frames[0]);
    expect(selectPlayerAttackFrame(metadata, 549)).toBe(metadata.frames[24]);
    expect(selectPlayerAttackFrame(metadata, 550)).toBeUndefined();
  });

  it('rejects missing, non-contiguous, or non-256-square frames', () => {
    expect(() => parsePlayerAttackMetadata({ frames: {}, meta: {} }))
      .toThrow('Invalid player attack metadata');
    expect(() => parsePlayerAttackMetadata({
      ...source,
      frames: { ...source.frames, 12: undefined },
    })).toThrow('Invalid player attack metadata');
    expect(() => parsePlayerAttackMetadata({
      ...source,
      frames: { ...source.frames, 24: { x: 1024, y: 1024, w: 128, h: 256 } },
    })).toThrow('Invalid player attack metadata');
  });
});
