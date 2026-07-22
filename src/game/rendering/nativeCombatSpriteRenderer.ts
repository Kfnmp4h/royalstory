import {
  COMBAT_EFFECT_MANIFEST,
  type CombatEffectKey,
} from '../phaser/combatPresentation/effectManifest';
import {
  parsePlayerAttackMetadata,
  selectPlayerAttackFrame,
  type PlayerAttackMetadata,
} from './playerAttackSprite';

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

interface ActivePlayerAttack extends ActiveEffect {
  readonly onComplete: () => void;
}

interface PlayerAttackRuntime {
  readonly image: HTMLImageElement;
  imageLoaded: boolean;
  metadata?: PlayerAttackMetadata;
  failed: boolean;
  active?: ActivePlayerAttack;
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
  playPlayerAttack(x: number, y: number, onComplete: () => void): boolean;
  advance(deltaMs: number): void;
  destroy(): void;
}

export interface NativeCombatSpriteRendererDependencies {
  createCanvas(): HTMLCanvasElement;
  createImage(): HTMLImageElement;
  loadPlayerAttackMetadata(): Promise<unknown>;
}

interface CreateNativeCombatSpriteRendererOptions {
  readonly parent: HTMLElement;
  readonly onError: (error: Error) => void;
  readonly dependencies?: NativeCombatSpriteRendererDependencies;
}

const defaultDependencies: NativeCombatSpriteRendererDependencies = {
  createCanvas: () => document.createElement('canvas'),
  createImage: () => new Image(),
  loadPlayerAttackMetadata: async () => {
    const response = await fetch('assets/characters/base-male-attack.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  },
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
  let playerAttack!: PlayerAttackRuntime;
  let destroyed = false;

  const completePlayerAttack = (): void => {
    const active = playerAttack.active;
    if (!active) return;
    playerAttack.active = undefined;
    active.onComplete();
  };

  const failPlayerAttack = (kind: 'sprite' | 'metadata', cause: unknown): void => {
    if (destroyed || playerAttack.failed) return;
    playerAttack.failed = true;
    completePlayerAttack();
    const detail = cause instanceof Error ? cause.message : String(cause);
    onError(new Error(`Failed to load native player attack ${kind}: ${detail}`));
  };

  const render = (): void => {
    if (destroyed || !context) return;
    context.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    const activePlayer = playerAttack.active;
    if (
      activePlayer
      && playerAttack.imageLoaded
      && playerAttack.metadata
      && !playerAttack.failed
    ) {
      const frame = selectPlayerAttackFrame(playerAttack.metadata, activePlayer.elapsedMs);
      if (!frame) {
        completePlayerAttack();
      } else {
        context.drawImage(
          playerAttack.image,
          frame.x,
          frame.y,
          frame.width,
          frame.height,
          activePlayer.x - 128,
          activePlayer.y - 256,
          256,
          256,
        );
      }
    }

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

  playerAttack = {
    image: dependencies.createImage(),
    imageLoaded: false,
    failed: false,
  };

  playerAttack.image.onload = () => {
    if (destroyed || playerAttack.failed) return;
    playerAttack.imageLoaded = true;
    render();
  };
  playerAttack.image.onerror = () => {
    failPlayerAttack('sprite', new Error('assets/characters/base-male-attack.png'));
    render();
  };
  playerAttack.image.src = 'assets/characters/base-male-attack.png';

  void dependencies.loadPlayerAttackMetadata()
    .then((value) => {
      if (destroyed || playerAttack.failed) return;
      playerAttack.metadata = parsePlayerAttackMetadata(value);
      render();
    })
    .catch((error: unknown) => {
      failPlayerAttack('metadata', error);
      render();
    });

  return {
    playEffect(key, x, y): void {
      if (destroyed) return;
      const runtime = runtimes.get(key);
      if (!runtime || runtime.failed) return;
      runtime.active = { x, y, elapsedMs: 0 };
      render();
    },
    playPlayerAttack(x, y, onComplete): boolean {
      if (
        destroyed
        || playerAttack.failed
        || !playerAttack.imageLoaded
        || !playerAttack.metadata
      ) return false;
      completePlayerAttack();
      playerAttack.active = { x, y, elapsedMs: 0, onComplete };
      render();
      return true;
    },
    advance(deltaMs): void {
      if (destroyed) return;
      let hasActiveEffect = false;
      if (playerAttack.active && !playerAttack.failed) {
        playerAttack.active.elapsedMs += Math.max(0, deltaMs);
        hasActiveEffect = true;
      }
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
      completePlayerAttack();
      playerAttack.image.onload = null;
      playerAttack.image.onerror = null;
      canvas.remove();
    },
  };
}
