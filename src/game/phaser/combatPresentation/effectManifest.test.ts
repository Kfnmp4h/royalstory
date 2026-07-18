import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = process.cwd();
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const EXPECTED_EFFECTS = {
  'slash-basic': {
    key: 'slash-basic',
    url: 'assets/combat/slash-basic.png',
    frameWidth: 48,
    frameHeight: 48,
    frameCount: 3,
    frameRate: 20,
    origin: { x: 0.5, y: 0.5 },
    scale: 2,
    animationKey: 'royalstory-slash-basic',
  },
  'impact-basic': {
    key: 'impact-basic',
    url: 'assets/combat/impact-basic.png',
    frameWidth: 32,
    frameHeight: 32,
    frameCount: 3,
    frameRate: 24,
    origin: { x: 0.5, y: 0.5 },
    scale: 2,
    animationKey: 'royalstory-impact-basic',
  },
  'impact-critical': {
    key: 'impact-critical',
    url: 'assets/combat/impact-critical.png',
    frameWidth: 48,
    frameHeight: 48,
    frameCount: 4,
    frameRate: 24,
    origin: { x: 0.5, y: 0.5 },
    scale: 2.25,
    animationKey: 'royalstory-impact-critical',
  },
  'enemy-death': {
    key: 'enemy-death',
    url: 'assets/combat/enemy-death.png',
    frameWidth: 48,
    frameHeight: 48,
    frameCount: 4,
    frameRate: 18,
    origin: { x: 0.5, y: 0.5 },
    scale: 2,
    animationKey: 'royalstory-enemy-death',
  },
  'death-particles': {
    key: 'death-particles',
    url: 'assets/combat/death-particles.png',
    frameWidth: 32,
    frameHeight: 32,
    frameCount: 4,
    frameRate: 20,
    origin: { x: 0.5, y: 0.5 },
    scale: 1.75,
    animationKey: 'royalstory-death-particles',
  },
} as const;

const readManifest = async () => (await import('./effectManifest')).COMBAT_EFFECT_MANIFEST;

const readFrameSections = (source: string): readonly string[] => {
  const matches = [...source.matchAll(/<!-- Frame \d+:[\s\S]*?(?=<!-- Frame \d+:|<\/svg>)/g)];
  return matches.map((match) => match[0]);
};

const polygonXCoordinates = (section: string): readonly number[] =>
  [...section.matchAll(/<polygon\b[^>]*\bpoints="([^"]+)"/g)].flatMap((match) =>
    match[1].trim().split(/\s+/).map((point) => Number(point.split(',')[0])),
  );

const rectHorizontalBounds = (section: string): readonly Readonly<{ x: number; endX: number }>[] =>
  [...section.matchAll(/<rect\b[^>]*\bx="(\d+)"[^>]*\bwidth="(\d+)"/g)].map((match) => ({
    x: Number(match[1]),
    endX: Number(match[1]) + Number(match[2]),
  }));

describe('COMBAT_EFFECT_MANIFEST', () => {
  it('defines every combat effect with its exact presentation metadata', async () => {
    const manifest = await readManifest();

    expect(Object.keys(manifest).sort()).toEqual(Object.keys(EXPECTED_EFFECTS).sort());
    expect(manifest).toEqual(EXPECTED_EFFECTS);
  });
});

describe('raster combat effect sprite sheets', () => {
  it('ships every manifest effect as a Phaser-loadable PNG sprite sheet', async () => {
    await Promise.all(Object.values(EXPECTED_EFFECTS).map(async (definition) => {
      const bytes = await readFile(join(projectRoot, 'public', definition.url));

      expect(bytes.subarray(0, PNG_SIGNATURE.length)).toEqual(PNG_SIGNATURE);
      expect(bytes.readUInt32BE(16)).toBe(definition.frameWidth * definition.frameCount);
      expect(bytes.readUInt32BE(20)).toBe(definition.frameHeight);
    }));
  });
});

describe('original combat effect sprite sheets', () => {
  it('keeps each local SVG sprite sheet attributable, self-contained, and dimensionally aligned', async () => {
    await Promise.all(Object.values(EXPECTED_EFFECTS).map(async (definition) => {
      const path = join(projectRoot, 'public', definition.url.replace('.png', '.svg'));
      const source = await readFile(path, 'utf8');
      const root = source.match(/<svg\b[^>]*>/i)?.[0] ?? '';

      expect(source).toContain('RoyalStory original pixel-art asset');
      expect(root).toContain('shape-rendering="crispEdges"');
      expect(source).toMatch(/<(?:rect|polygon)\b/);
      expect(source).not.toMatch(/MapleStory|https?:\/\//i);
      expect(source).not.toMatch(/<(?:image|use)\b|(?:xlink:)?href\s*=/i);
      expect(root.match(/\bwidth="(\d+)"/)?.[1]).toBe(String(definition.frameWidth * definition.frameCount));
      expect(root.match(/\bheight="(\d+)"/)?.[1]).toBe(String(definition.frameHeight));
    }));
  });

  it('keeps every primitive inside the horizontal bounds of its labelled frame', async () => {
    await Promise.all(Object.values(EXPECTED_EFFECTS).map(async (definition) => {
      const source = await readFile(join(projectRoot, 'public', definition.url.replace('.png', '.svg')), 'utf8');
      const frames = readFrameSections(source);

      expect(frames).toHaveLength(definition.frameCount);
      frames.forEach((frame, index) => {
        const startX = index * definition.frameWidth;
        const endX = startX + definition.frameWidth;

        for (const x of polygonXCoordinates(frame)) {
          expect(x, `${definition.key} frame ${index + 1} polygon x`).toBeGreaterThanOrEqual(startX);
          expect(x, `${definition.key} frame ${index + 1} polygon x`).toBeLessThan(endX);
        }
        for (const rect of rectHorizontalBounds(frame)) {
          expect(rect.x, `${definition.key} frame ${index + 1} rect x`).toBeGreaterThanOrEqual(startX);
          expect(rect.endX, `${definition.key} frame ${index + 1} rect end`).toBeLessThanOrEqual(endX);
        }
      });
    }));
  });
});
