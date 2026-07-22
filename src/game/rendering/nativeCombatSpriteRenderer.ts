import {
  COMBAT_EFFECT_MANIFEST,
  type CombatEffectKey,
} from '../phaser/combatPresentation/effectManifest';

const WORLD_WIDTH = 960;
const WORLD_HEIGHT = 540;
const EFFECT_VERTICAL_OFFSET = 70;

interface ActiveEffect {
  readonly x: number;
  readonly y: number;
  elapsedMs: number;
}

interface NativeEffectRuntime {
  readonly image: HTMLImageElement;
  loaded: boolean;
  failed: boolean;
  active?: ActiveEffect;
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
  const canvas = dependencies.createCanvas();
  canvas.width = WORLD_WIDTH;
  canvas.height = WORLD_HEIGHT;
  canvas.className = 'native-combat-overlay';
  canvas.setAttribute('aria-hidden', 'true');
  parent.append(canvas);

  const context = canvas.getContext('2d');
  const runtimes = new Map<NativeCombatEffectKey, NativeEffectRuntime>();
  let destroyed = false;

  const render = (): void => {
    if (destroyed || !context) return;
    context.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    for (const key of NATIVE_COMBAT_EFFECT_KEYS) {
      const runtime = runtimes.get(key);
      const active = runtime?.active;
      if (!runtime || runtime.failed || !runtime.loaded || !active) continue;

      const definition = COMBAT_EFFECT_MANIFEST[key];
      const frameDurationMs = 1_000 / definition.frameRate;
      const frameIndex = Math.floor(active.elapsedMs / frameDurationMs);
      if (frameIndex >= definition.frameCount) {
        runtime.active = undefined;
        continue;
      }

      const width = definition.frameWidth * definition.scale;
      const height = definition.frameHeight * definition.scale;
      context.drawImage(
        runtime.image,
        frameIndex * definition.frameWidth,
        0,
        definition.frameWidth,
        definition.frameHeight,
        active.x - (width * definition.origin.x),
        active.y - EFFECT_VERTICAL_OFFSET - (height * definition.origin.y),
        width,
        height,
      );
    }
  };

  for (const key of NATIVE_COMBAT_EFFECT_KEYS) {
    const definition = COMBAT_EFFECT_MANIFEST[key];
    const image = dependencies.createImage();
    const runtime: NativeEffectRuntime = { image, loaded: false, failed: false };
    runtimes.set(key, runtime);

    image.onload = () => {
      if (destroyed || runtime.failed) return;
      runtime.loaded = true;
      render();
    };
    image.onerror = () => {
      if (destroyed || runtime.failed) return;
      runtime.failed = true;
      runtime.active = undefined;
      onError(new Error(`Failed to load native combat sprite: ${definition.url}`));
      render();
    };
    image.src = definition.url;
  }

  return {
    playEffect(key, x, y): void {
      if (destroyed) return;
      const runtime = runtimes.get(key);
      if (!runtime || runtime.failed) return;
      runtime.active = { x, y, elapsedMs: 0 };
      render();
    },
    advance(deltaMs): void {
      if (destroyed) return;
      let hasActiveEffect = false;
      for (const runtime of runtimes.values()) {
        if (runtime.failed || !runtime.active) continue;
        runtime.active.elapsedMs += Math.max(0, deltaMs);
        hasActiveEffect = true;
      }
      if (hasActiveEffect) render();
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      for (const runtime of runtimes.values()) {
        runtime.active = undefined;
        runtime.image.onload = null;
        runtime.image.onerror = null;
      }
      canvas.remove();
    },
  };
}
