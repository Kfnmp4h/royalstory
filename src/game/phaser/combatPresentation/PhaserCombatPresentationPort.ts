import type { ActorId } from '../../types';
import { COMBAT_EFFECT_MANIFEST, type CombatEffectKey } from './effectManifest';

const EFFECT_DEPTH = 25;

export interface PhaserCombatEffectSprite {
  setOrigin(x: number, y: number): PhaserCombatEffectSprite;
  setScale(scale: number): PhaserCombatEffectSprite;
  setDepth(depth: number): PhaserCombatEffectSprite;
  play(animationKey: string): PhaserCombatEffectSprite;
  once(event: string, callback: () => void): PhaserCombatEffectSprite;
  destroy(): void;
}

export interface PhaserCombatPresentationPortOptions {
  animationExists(key: string): boolean;
  createSprite(x: number, y: number, textureKey: string): PhaserCombatEffectSprite;
  getActorPosition(actorId: ActorId): Readonly<{ x: number; y: number }>;
}

export interface PhaserCombatPresentationPort {
  hasEffect(key: CombatEffectKey): boolean;
  playEffect(key: CombatEffectKey, actorId: ActorId): void;
}

export function createPhaserCombatPresentationPort(
  options: PhaserCombatPresentationPortOptions,
): PhaserCombatPresentationPort {
  return {
    hasEffect(key): boolean {
      return options.animationExists(COMBAT_EFFECT_MANIFEST[key].animationKey);
    },

    playEffect(key, actorId): void {
      const definition = COMBAT_EFFECT_MANIFEST[key];
      if (!options.animationExists(definition.animationKey)) return;

      const position = options.getActorPosition(actorId);
      const sprite = options.createSprite(position.x, position.y, definition.key);
      sprite.setOrigin(definition.origin.x, definition.origin.y);
      sprite.setScale(definition.scale);
      sprite.setDepth(EFFECT_DEPTH);
      sprite.play(definition.animationKey);
      sprite.once('animationcomplete', () => sprite.destroy());
    },
  };
}
