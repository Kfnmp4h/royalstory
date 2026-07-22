import type { ActorId } from '../../types';
import type {
  CombatPresentationPort,
  DamageNumberHandle,
} from './CombatPresentationController';
import { COMBAT_EFFECT_MANIFEST, type CombatEffectKey } from './effectManifest';
import { COMBAT_PRESENTATION } from './presentationConstants';
import { isNativeCombatEffectKey } from '../../rendering/nativeCombatSpriteRenderer';

const EFFECT_DEPTH = 25;
const FEEDBACK_Y_OFFSET = 132;
const DAMAGE_RISE = 38;
const MISS_RISE = 28;

export interface PhaserCombatEffectSprite {
  setOrigin(x: number, y: number): PhaserCombatEffectSprite;
  setScale(scale: number): PhaserCombatEffectSprite;
  setDepth(depth: number): PhaserCombatEffectSprite;
  play(animationKey: string): PhaserCombatEffectSprite;
  once(event: string, callback: () => void): PhaserCombatEffectSprite;
  destroy(): void;
}

export type PhaserCombatFeedbackKind = 'damage' | 'critical' | 'miss';

export interface PhaserCombatFeedbackText {
  setPosition(x: number, y: number): PhaserCombatFeedbackText;
  setText(text: string): PhaserCombatFeedbackText;
  setVisible(visible: boolean): PhaserCombatFeedbackText;
  setAlpha(alpha: number): PhaserCombatFeedbackText;
  setScale(scale: number): PhaserCombatFeedbackText;
}

export interface PhaserCombatFeedbackTween {
  readonly offsetY: number;
  readonly durationMs: number;
  readonly onComplete: () => void;
}

export interface PhaserCombatPresentationPortOptions {
  animationExists(key: string): boolean;
  createSprite(x: number, y: number, textureKey: string): PhaserCombatEffectSprite;
  getActorPosition(actorId: ActorId): Readonly<{ x: number; y: number }>;
  playNativeEffect(key: CombatEffectKey, x: number, y: number): boolean;
  flashActor(actorId: ActorId, critical: boolean): void;
  createFeedbackText(kind: PhaserCombatFeedbackKind): PhaserCombatFeedbackText;
  tweenFeedbackText(text: PhaserCombatFeedbackText, tween: PhaserCombatFeedbackTween): void;
  renderHealth(actorId: ActorId, immediateRatio: number, delayedRatio: number): void;
  shake(durationMs: number, intensity: number): void;
  playEnemyDeath(onComplete: () => void): void;
  warnMissingEffect(key: CombatEffectKey): void;
}

const clampRatio = (ratio: number): number => Math.max(0, Math.min(1, ratio));

export function createPhaserCombatPresentationPort(
  options: PhaserCombatPresentationPortOptions,
): CombatPresentationPort {
  const feedbackTexts = new Map<number, PhaserCombatFeedbackText>();

  const acquireFeedbackText = (
    handle: DamageNumberHandle,
    kind: PhaserCombatFeedbackKind,
  ): PhaserCombatFeedbackText => {
    const existing = feedbackTexts.get(handle.id);
    if (existing) return existing;

    const created = options.createFeedbackText(kind);
    feedbackTexts.set(handle.id, created);
    return created;
  };

  const showFeedback = (
    handle: DamageNumberHandle,
    actorId: ActorId,
    textValue: string,
    kind: PhaserCombatFeedbackKind,
    scale: number,
    rise: number,
    durationMs: number,
    onComplete: () => void,
  ): void => {
    const position = options.getActorPosition(actorId);
    const text = acquireFeedbackText(handle, kind);
    text
      .setPosition(position.x, position.y - FEEDBACK_Y_OFFSET)
      .setText(textValue)
      .setVisible(true)
      .setAlpha(1)
      .setScale(scale);

    options.tweenFeedbackText(text, {
      offsetY: rise,
      durationMs,
      onComplete: () => {
        text.setVisible(false);
        onComplete();
      },
    });
  };

  return {
    hasEffect(key): boolean {
      return isNativeCombatEffectKey(key)
        || options.animationExists(COMBAT_EFFECT_MANIFEST[key].animationKey);
    },

    playEffect(key, actorId): void {
      const definition = COMBAT_EFFECT_MANIFEST[key];
      const position = options.getActorPosition(actorId);
      if (options.playNativeEffect(key, position.x, position.y)) return;
      if (!options.animationExists(definition.animationKey)) return;

      const sprite = options.createSprite(position.x, position.y, definition.key);
      sprite.setOrigin(definition.origin.x, definition.origin.y);
      sprite.setScale(definition.scale);
      sprite.setDepth(EFFECT_DEPTH);
      sprite.play(definition.animationKey);
      sprite.once('animationcomplete', () => sprite.destroy());
    },

    flash(actorId, critical): void {
      options.flashActor(actorId, critical);
    },

    showDamageNumber(handle, actorId, text, critical, onComplete): void {
      showFeedback(
        handle,
        actorId,
        text,
        critical ? 'critical' : 'damage',
        critical ? 1.2 : 1,
        DAMAGE_RISE,
        critical
          ? COMBAT_PRESENTATION.criticalDamageLifetimeMs
          : COMBAT_PRESENTATION.normalDamageLifetimeMs,
        onComplete,
      );
    },

    showMiss(handle, actorId, onComplete): void {
      showFeedback(
        handle,
        actorId,
        'MISS',
        'miss',
        1,
        MISS_RISE,
        COMBAT_PRESENTATION.missLifetimeMs,
        onComplete,
      );
    },

    setHealth(actorId, immediateRatio, delayedRatio): void {
      options.renderHealth(actorId, clampRatio(immediateRatio), clampRatio(delayedRatio));
    },

    shake(durationMs, intensity): void {
      options.shake(durationMs, intensity);
    },

    playEnemyDeath(onComplete): void {
      options.playEnemyDeath(onComplete);
    },

    warnMissingEffect(key): void {
      options.warnMissingEffect(key);
    },
  };
}
