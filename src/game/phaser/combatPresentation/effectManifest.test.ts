import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = process.cwd();

const EXPECTED_EFFECTS = {
  'slash-basic': {
    key: 'slash-basic',
    url: 'assets/combat/slash-basic.svg',
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
    url: 'assets/combat/impact-basic.svg',
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
    url: 'assets/combat/impact-critical.svg',
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
    url: 'assets/combat/enemy-death.svg',
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
    url: 'assets/combat/death-particles.svg',
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

describe('COMBAT_EFFECT_MANIFEST', () => {
  it('defines every combat effect with its exact presentation metadata', async () => {
    const manifest = await readManifest();

    expect(Object.keys(manifest).sort()).toEqual(Object.keys(EXPECTED_EFFECTS).sort());
    expect(manifest).toEqual(EXPECTED_EFFECTS);
  });
});

describe('original combat effect sprite sheets', () => {
  it('keeps each local SVG sprite sheet attributable, self-contained, and dimensionally aligned', async () => {
    await Promise.all(Object.values(EXPECTED_EFFECTS).map(async (definition) => {
      const path = join(projectRoot, 'public', definition.url);
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
});
