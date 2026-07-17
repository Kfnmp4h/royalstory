import { describe, expect, it } from 'vitest';
import {
  createCombatPresentationController,
  type CombatPresentationPort,
  type DamageNumberHandle,
} from './CombatPresentationController';
import type { ActorId } from '../../types';
import type { CombatEffectKey } from './effectManifest';

function createFakePort(missing: readonly CombatEffectKey[] = []) {
  const unavailable = new Set(missing);
  const effects: Array<{ key: CombatEffectKey; actorId: ActorId }> = [];
  const flashes: Array<{ actorId: ActorId; critical: boolean }> = [];
  const damageNumbers: Array<{
    handle: DamageNumberHandle;
    actorId: ActorId;
    text: string;
    critical: boolean;
    complete: () => void;
  }> = [];
  const misses: Array<{ handle: DamageNumberHandle; actorId: ActorId; complete: () => void }> = [];
  const health: Array<{ actorId: ActorId; immediateRatio: number; delayedRatio: number }> = [];
  const shakes: Array<{ durationMs: number; intensity: number }> = [];
  const warnings: CombatEffectKey[] = [];
  const deaths: Array<() => void> = [];

  const port: CombatPresentationPort = {
    hasEffect: (key) => !unavailable.has(key),
    playEffect: (key, actorId) => effects.push({ key, actorId }),
    flash: (actorId, critical) => flashes.push({ actorId, critical }),
    showDamageNumber: (handle, actorId, text, critical, onComplete) => {
      damageNumbers.push({ handle, actorId, text, critical, complete: onComplete });
    },
    showMiss: (handle, actorId, onComplete) => misses.push({ handle, actorId, complete: onComplete }),
    setHealth: (actorId, immediateRatio, delayedRatio) => health.push({ actorId, immediateRatio, delayedRatio }),
    shake: (durationMs, intensity) => shakes.push({ durationMs, intensity }),
    playEnemyDeath: (onComplete) => deaths.push(onComplete),
    warnMissingEffect: (key) => warnings.push(key),
  };

  return { port, effects, flashes, damageNumbers, misses, health, shakes, warnings, deaths };
}

describe('CombatPresentationController', () => {
  it('coordinates a normal hit without shaking below the strong-hit threshold', () => {
    const fake = createFakePort();
    const controller = createCombatPresentationController(fake.port);

    controller.present([{
      type: 'hit_landed', actorId: 'player', targetId: 'enemy',
      damage: 18, critical: false, resultingHealth: 82, timestampMs: 100,
    }]);

    expect(fake.effects).toContainEqual({ key: 'slash-basic', actorId: 'player' });
    expect(fake.effects).toContainEqual({ key: 'impact-basic', actorId: 'enemy' });
    expect(fake.damageNumbers).toContainEqual(expect.objectContaining({ actorId: 'enemy', text: '-18', critical: false }));
    expect(fake.shakes).toEqual([]);
  });

  it('uses critical feedback and suppresses shake in reduced-motion mode', () => {
    const normal = createFakePort();
    createCombatPresentationController(normal.port).present([{
      type: 'critical_hit_landed', actorId: 'player', targetId: 'enemy',
      damage: 55, critical: true, resultingHealth: 45, timestampMs: 100,
    }]);
    expect(normal.effects).toContainEqual({ key: 'impact-critical', actorId: 'enemy' });
    expect(normal.damageNumbers[0]).toEqual(expect.objectContaining({ text: '-55', critical: true }));
    expect(normal.shakes).toHaveLength(1);

    const reduced = createFakePort();
    createCombatPresentationController(reduced.port, { reducedMotion: true }).present([{
      type: 'critical_hit_landed', actorId: 'player', targetId: 'enemy',
      damage: 55, critical: true, resultingHealth: 45, timestampMs: 100,
    }]);
    expect(reduced.damageNumbers).toHaveLength(1);
    expect(reduced.shakes).toEqual([]);
  });

  it('shows MISS without impact or shake', () => {
    const fake = createFakePort();
    createCombatPresentationController(fake.port).present([{
      type: 'attack_missed', actorId: 'player', targetId: 'enemy',
      damage: 0, critical: false, resultingHealth: 100, timestampMs: 100,
    }]);

    expect(fake.misses).toHaveLength(1);
    expect(fake.effects).toEqual([]);
    expect(fake.shakes).toEqual([]);
  });

  it('warns once for a missing effect and falls back to a readable flash and number', () => {
    const fake = createFakePort(['impact-basic']);
    const controller = createCombatPresentationController(fake.port);
    const hit = {
      type: 'hit_landed' as const, actorId: 'player' as const, targetId: 'enemy' as const,
      damage: 12, critical: false as const, resultingHealth: 88, timestampMs: 100,
    };

    controller.present([hit, hit]);

    expect(fake.warnings).toEqual(['impact-basic']);
    expect(fake.flashes).toEqual([
      { actorId: 'enemy', critical: false },
      { actorId: 'enemy', critical: false },
    ]);
    expect(fake.damageNumbers).toHaveLength(2);
  });

  it('deduplicates enemy death until completion and releases pooled number handles', () => {
    const fake = createFakePort();
    const controller = createCombatPresentationController(fake.port);
    const death = {
      type: 'enemy_defeated' as const, actorId: 'player' as const, targetId: 'enemy' as const,
      damage: 60, critical: true, resultingHealth: 0 as const, timestampMs: 100,
    };

    controller.present([death, death]);
    expect(fake.deaths).toHaveLength(1);
    expect(controller.isEnemyDeathActive()).toBe(true);

    fake.deaths[0]?.();
    expect(controller.isEnemyDeathActive()).toBe(false);
    controller.present([death]);
    expect(fake.deaths).toHaveLength(2);

    controller.present(Array.from({ length: 100 }, (_, index) => ({
      type: 'hit_landed' as const, actorId: 'player' as const, targetId: 'enemy' as const,
      damage: index + 1, critical: false as const, resultingHealth: 50, timestampMs: index,
    })));
    expect(controller.activeDamageNumberCount()).toBe(100);
    fake.damageNumbers.forEach((entry) => entry.complete());
    expect(controller.activeDamageNumberCount()).toBe(0);
  });

  it('renders immediate and delayed health through the interpolation model', () => {
    const fake = createFakePort();
    const controller = createCombatPresentationController(fake.port);

    controller.renderHealth('enemy', 1);
    controller.renderHealth('enemy', 0.25);
    controller.advance(100);

    expect(fake.health.at(-1)).toEqual({ actorId: 'enemy', immediateRatio: 0.25, delayedRatio: 0.9 });
  });
});
