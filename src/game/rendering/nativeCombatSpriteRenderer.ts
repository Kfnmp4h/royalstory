import {
  COMBAT_EFFECT_MANIFEST,
  type CombatEffectKey,
} from '../phaser/combatPresentation/effectManifest';

const WORLD_WIDTH = 960;
const WORLD_HEIGHT = 540;
const EFFECT_VERTICAL_OFFSET = 70;

interface ActiveSlash {
  readonly x: number;
  readonly y: number;
  elapsedMs: number;
}

export const NATIVE_COMBAT_EFFECT_KEYS = [
  'slash-basic',
  'impact-basic',
  'impact-critical',
] as const;

export type NativeCombatEffectKey = typeof NATIVE_COMBAT_EFFECT_KEYS[number];

export const isNativeCombatEffectKey = (key: CombatEffectKey): key is NativeCombatEffectKey => (
  NATIVE_COMBAT_EFFECT_KEYS.includes(key as NativeCombatEffectKey)
);

export interface NativeCombatSpriteRenderer {
  playEffect(key: NativeCombatEffectKey, x: number, y: number): void;
  advance(deltaMs: number): void;
  destroy(): void;
}

export interface NativeCombatSpriteRendererDependencies {
  createCanvas(): HTMLCanvasElement;
  createImage(): HTMLImageElement;
}

interface CreateNativeCombatSpriteRendererOptions {
  readonly parent: HTMLElement;
  readonly onError: (error: Error) => void;
  readonly dependencies?: NativeCombatSpriteRendererDependencies;
}

const defaultDependencies: NativeCombatSpriteRendererDependencies = {
  createCanvas: () => document.createElement('canvas'),
  createImage: () => new Image(),
};

export function createNativeCombatSpriteRenderer({
  parent,
  onError,
  dependencies = defaultDependencies,
}: CreateNativeCombatSpriteRendererOptions): NativeCombatSpriteRenderer {
  const definition = COMBAT_EFFECT_MANIFEST['slash-basic'];
  const frameDurationMs = 1_000 / definition.frameRate;
  const canvas = dependencies.createCanvas();
  canvas.width = WORLD_WIDTH;
  canvas.height = WORLD_HEIGHT;
  canvas.className = 'native-combat-overlay';
  canvas.setAttribute('aria-hidden', 'true');
  parent.append(canvas);

  const context = canvas.getContext('2d');
  const image = dependencies.createImage();
  let activeSlash: ActiveSlash | undefined;
  let destroyed = false;
  let loaded = false;
  let failed = false;

  const reportFailure = (): void => {
    if (failed || destroyed) return;
    failed = true;
    activeSlash = undefined;
    onError(new Error(`Failed to load native combat sprite: ${definition.url}`));
  };

  const render = (): void => {
    if (destroyed || failed || !context) return;
    context.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    if (!loaded || !activeSlash) return;

    const frameIndex = Math.floor(activeSlash.elapsedMs / frameDurationMs);
    if (frameIndex >= definition.frameCount) {
      activeSlash = undefined;
      return;
    }

    const width = definition.frameWidth * definition.scale;
    const height = definition.frameHeight * definition.scale;
    context.drawImage(
      image,
      frameIndex * definition.frameWidth,
      0,
      definition.frameWidth,
      definition.frameHeight,
      activeSlash.x - (width * definition.origin.x),
      activeSlash.y - EFFECT_VERTICAL_OFFSET - (height * definition.origin.y),
      width,
      height,
    );
  };

  image.onload = () => {
    if (destroyed || failed) return;
    loaded = true;
    render();
  };
  image.onerror = reportFailure;
  image.src = definition.url;

  return {
    playEffect(key, x, y): void {
      if (destroyed || failed) return;
      if (key !== 'slash-basic') return;
      activeSlash = { x, y, elapsedMs: 0 };
      render();
    },
    advance(deltaMs): void {
      if (destroyed || failed || !activeSlash) return;
      activeSlash.elapsedMs += Math.max(0, deltaMs);
      render();
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      activeSlash = undefined;
      image.onload = null;
      image.onerror = null;
      canvas.remove();
    },
  };
}
