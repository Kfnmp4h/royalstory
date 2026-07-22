import type { ActorId } from '../../types';
import type { CombatPresentationEvent } from '../../presentation/combatPresentationEvents';
import type { CombatEffectKey } from './effectManifest';
import { createHealthInterpolation, type HealthInterpolation } from './healthInterpolation';
import { createObjectPool } from './objectPool';
import { COMBAT_PRESENTATION } from './presentationConstants';

export interface DamageNumberHandle {
  readonly id: number;
}

export interface CombatPresentationPort {
  hasEffect(key: CombatEffectKey): boolean;
  playEffect(key: CombatEffectKey, actorId: ActorId): void;
  playPlayerAttack(actorId: ActorId): void;
  flash(actorId: ActorId, critical: boolean): void;
  showDamageNumber(
    handle: DamageNumberHandle,
    actorId: ActorId,
    text: string,
    critical: boolean,
    onComplete: () => void,
  ): void;
  showMiss(handle: DamageNumberHandle, actorId: ActorId, onComplete: () => void): void;
  setHealth(actorId: ActorId, immediateRatio: number, delayedRatio: number): void;
  shake(durationMs: number, intensity: number): void;
  playEnemyDeath(onComplete: () => void): void;
  warnMissingEffect(key: CombatEffectKey): void;
}

export interface CombatPresentationControllerOptions {
  readonly reducedMotion?: boolean;
}

export interface CombatPresentationController {
  present(events: readonly CombatPresentationEvent[]): void;
  advance(deltaMs: number): void;
  renderHealth(actorId: ActorId, ratio: number): void;
  isEnemyDeathActive(): boolean;
  completeEnemyDeath(): void;
  activeDamageNumberCount(): number;
}

export function createCombatPresentationController(
  port: CombatPresentationPort,
  options: CombatPresentationControllerOptions = {},
): CombatPresentationController {
  let nextDamageNumberId = 1;
  let enemyDeathActive = false;
  const warnedMissingEffects = new Set<CombatEffectKey>();
  const healthByActor = new Map<ActorId, HealthInterpolation>();
  const damageNumberPool = createObjectPool<DamageNumberHandle>(
    () => ({ id: nextDamageNumberId++ }),
    () => undefined,
  );

  const playEffect = (key: CombatEffectKey, actorId: ActorId, critical: boolean): void => {
    if (port.hasEffect(key)) {
      port.playEffect(key, actorId);
      return;
    }

    if (!warnedMissingEffects.has(key)) {
      warnedMissingEffects.add(key);
      port.warnMissingEffect(key);
    }
    port.flash(actorId, critical);
  };

  const showDamage = (actorId: ActorId, damage: number, critical: boolean): void => {
    const handle = damageNumberPool.acquire();
    port.showDamageNumber(handle, actorId, `-${damage}`, critical, () => {
      damageNumberPool.release(handle);
    });
  };

  const showMiss = (actorId: ActorId): void => {
    const handle = damageNumberPool.acquire();
    port.showMiss(handle, actorId, () => {
      damageNumberPool.release(handle);
    });
  };

  const presentHit = (
    actorId: ActorId,
    targetId: ActorId,
    damage: number,
    critical: boolean,
  ): void => {
    playEffect('slash-basic', actorId, critical);
    playEffect(critical ? 'impact-critical' : 'impact-basic', targetId, critical);
    showDamage(targetId, damage, critical);

    if (options.reducedMotion) {
      return;
    }

    if (critical) {
      port.shake(COMBAT_PRESENTATION.criticalShakeDurationMs, COMBAT_PRESENTATION.criticalShakeIntensity);
    } else if (damage >= COMBAT_PRESENTATION.strongHitDamageThreshold) {
      port.shake(COMBAT_PRESENTATION.strongHitShakeDurationMs, COMBAT_PRESENTATION.strongHitShakeIntensity);
    }
  };

  const presentEnemyDeath = (): void => {
    if (enemyDeathActive) {
      return;
    }

    enemyDeathActive = true;
    playEffect('enemy-death', 'enemy', false);
    playEffect('death-particles', 'enemy', false);
    port.playEnemyDeath(() => {
      enemyDeathActive = false;
    });
  };

  return {
    present(events): void {
      for (const event of events) {
        switch (event.type) {
          case 'hit_landed':
            presentHit(event.actorId, event.targetId, event.damage, false);
            break;
          case 'critical_hit_landed':
            presentHit(event.actorId, event.targetId, event.damage, true);
            break;
          case 'attack_missed':
            showMiss(event.targetId);
            break;
          case 'attack_started':
            if (event.actorId === 'player') port.playPlayerAttack(event.actorId);
            break;
          case 'enemy_defeated':
            presentEnemyDeath();
            break;
          case 'health_changed':
            break;
        }
      }
    },

    advance(deltaMs): void {
      for (const [actorId, interpolation] of healthByActor) {
        const state = interpolation.advance(deltaMs, COMBAT_PRESENTATION.healthDelayedUnitsPerSecond);
        port.setHealth(actorId, state.immediateRatio, state.delayedRatio);
      }
    },

    renderHealth(actorId, ratio): void {
      const existing = healthByActor.get(actorId);
      if (existing) {
        existing.setTarget(ratio);
        const state = existing.getState();
        port.setHealth(actorId, state.immediateRatio, state.delayedRatio);
        return;
      }

      const interpolation = createHealthInterpolation(ratio);
      healthByActor.set(actorId, interpolation);
      const state = interpolation.getState();
      port.setHealth(actorId, state.immediateRatio, state.delayedRatio);
    },

    isEnemyDeathActive(): boolean {
      return enemyDeathActive;
    },

    completeEnemyDeath(): void {
      enemyDeathActive = false;
    },

    activeDamageNumberCount(): number {
      return damageNumberPool.activeCount();
    },
  };
}
