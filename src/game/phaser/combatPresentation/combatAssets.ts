import { COMBAT_EFFECT_MANIFEST } from './effectManifest';

export interface CombatAssetLoader {
  spritesheet(
    key: string,
    url: string,
    config: { readonly frameWidth: number; readonly frameHeight: number },
  ): unknown;
}

export interface CombatAnimationManager {
  exists(key: string): boolean;
  generateFrameNumbers(key: string, range: { readonly start: number; readonly end: number }): unknown;
  create(config: {
    readonly key: string;
    readonly frames: any;
    readonly frameRate: number;
    readonly repeat: number;
    readonly hideOnComplete: boolean;
  }): unknown;
}

export function preloadCombatEffects(loader: CombatAssetLoader): void {
  for (const definition of Object.values(COMBAT_EFFECT_MANIFEST)) {
    loader.spritesheet(definition.key, definition.url, {
      frameWidth: definition.frameWidth,
      frameHeight: definition.frameHeight,
    });
  }
}

export function registerCombatAnimations(animations: CombatAnimationManager): void {
  for (const definition of Object.values(COMBAT_EFFECT_MANIFEST)) {
    if (animations.exists(definition.animationKey)) continue;

    animations.create({
      key: definition.animationKey,
      frames: animations.generateFrameNumbers(definition.key, {
        start: 0,
        end: definition.frameCount - 1,
      }),
      frameRate: definition.frameRate,
      repeat: 0,
      hideOnComplete: true,
    });
  }
}
