import { describe, expect, it } from 'vitest';
import { COMBAT_BALANCE } from './balance';
import { createCombatEngine as createCombatEngineRuntime } from './combatEngine';
import type {
  ActorId,
  CombatBalance,
  CombatEngineOptions,
  CombatEvent,
  PlayerCombatProfile,
} from './types';

type BalanceOverrides = Partial<Omit<CombatBalance, 'player' | 'enemy'>> & {
  player?: Partial<CombatBalance['player']>;
  enemy?: Partial<CombatBalance['enemy']>;
};

const makeBalance = (overrides: BalanceOverrides = {}): CombatBalance => ({
  ...COMBAT_BALANCE,
  ...overrides,
  player: { ...COMBAT_BALANCE.player, ...overrides.player },
  enemy: { ...COMBAT_BALANCE.enemy, ...overrides.enemy },
});

const createCombatEngine = (
  balance: CombatBalance = COMBAT_BALANCE,
  options: CombatEngineOptions = {},
) => createCombatEngineRuntime(balance, { random: () => 0.5, ...options });

const scriptedRandom = (...values: number[]) => {
  let index = 0;
  return () => {
    if (index >= values.length) throw new Error('Scripted random exhausted');
    return values[index++];
  };
};

const makeProfile = (overrides: Partial<PlayerCombatProfile> = {}): PlayerCombatProfile => ({
  attack: 18,
  defense: 2,
  maxHp: 120,
  accuracy: 0,
  evasion: 0,
  criticalRate: 5,
  criticalDamage: 100,
  attackSpeed: 100,
  damage: 0,
  bossDamage: 0,
  normalDamage: 0,
  ...overrides,
});

const countActorEvents = (
  events: CombatEvent[],
  type: 'death' | 'respawn',
  actor: ActorId,
): number => events.filter((event) => event.type === type && event.actor === actor).length;

describe('createCombatEngine', () => {
  it('restores an active combat snapshot without resetting counters or HP', () => {
    const original = createCombatEngine();
    original.advance(900);
    const persisted = original.getPersistentState();

    const restored = createCombatEngine(undefined, { initialState: persisted });
    expect(restored.getSnapshot()).toEqual(original.getSnapshot());
  });

  it('waits for Ari attack interval before damaging Mossling', () => {
    const engine = createCombatEngine();
    expect(engine.advance(899)).toEqual([]);
    expect(engine.getSnapshot().enemy.hp).toBe(90);

    expect(engine.advance(1)).toEqual([
      { type: 'attack', attacker: 'player', target: 'enemy' },
      { type: 'damage', target: 'enemy', amount: 18, hp: 72 },
    ]);
    expect(engine.getSnapshot().totalAttacks).toBe(1);
  });

  it('emits legacy and presentation events for a deterministic normal hit', () => {
    const engine = createCombatEngine(
      makeBalance({ player: { attackIntervalMs: 100 }, enemy: { attackIntervalMs: 1_000 } }),
      { random: scriptedRandom(0, 0.5) },
    );

    const result = engine.advanceWithPresentation(100);

    expect(result.events).toEqual([
      { type: 'attack', attacker: 'player', target: 'enemy' },
      { type: 'damage', target: 'enemy', amount: 18, hp: 72 },
    ]);
    expect(result.presentationEvents).toEqual([
      { type: 'attack_started', actorId: 'player', targetId: 'enemy', timestampMs: 100 },
      { type: 'hit_landed', actorId: 'player', targetId: 'enemy', damage: 18, critical: false, resultingHealth: 72, timestampMs: 100 },
      { type: 'health_changed', actorId: 'player', targetId: 'enemy', resultingHealth: 72, timestampMs: 100 },
    ]);
    expect(result.presentationEvents.every((event) => Number.isFinite(event.timestampMs))).toBe(true);
  });

  it('emits a critical presentation event without a normal-hit event', () => {
    const engine = createCombatEngine(
      makeBalance({ player: { attackIntervalMs: 100 }, enemy: { attackIntervalMs: 1_000 } }),
      { random: scriptedRandom(0, 0) },
    );

    const result = engine.advanceWithPresentation(100);

    expect(result.events).toEqual([
      { type: 'attack', attacker: 'player', target: 'enemy' },
      { type: 'critical', attacker: 'player', target: 'enemy' },
      { type: 'damage', target: 'enemy', amount: 36, hp: 54 },
    ]);
    expect(result.presentationEvents).toEqual([
      { type: 'attack_started', actorId: 'player', targetId: 'enemy', timestampMs: 100 },
      { type: 'critical_hit_landed', actorId: 'player', targetId: 'enemy', damage: 36, critical: true, resultingHealth: 54, timestampMs: 100 },
      { type: 'health_changed', actorId: 'player', targetId: 'enemy', resultingHealth: 54, timestampMs: 100 },
    ]);
    expect(result.presentationEvents).not.toContainEqual(expect.objectContaining({ type: 'hit_landed' }));
  });

  it('emits a zero-damage presentation miss without a health change', () => {
    const engine = createCombatEngine(
      makeBalance({ player: { attackIntervalMs: 100 }, enemy: { attackIntervalMs: 1_000 } }),
      { random: scriptedRandom(0.95) },
    );

    const result = engine.advanceWithPresentation(100);

    expect(result.events).toEqual([
      { type: 'attack', attacker: 'player', target: 'enemy' },
      { type: 'miss', attacker: 'player', target: 'enemy' },
    ]);
    expect(result.presentationEvents).toEqual([
      { type: 'attack_started', actorId: 'player', targetId: 'enemy', timestampMs: 100 },
      { type: 'attack_missed', actorId: 'player', targetId: 'enemy', damage: 0, critical: false, resultingHealth: 90, timestampMs: 100 },
    ]);
    expect(result.presentationEvents).not.toContainEqual(expect.objectContaining({ type: 'health_changed' }));
  });

  it('emits enemy_defeated after the presentation hit and health events', () => {
    const engine = createCombatEngine(
      makeBalance({ player: { attack: 90, attackIntervalMs: 100 }, enemy: { attackIntervalMs: 1_000 } }),
      { random: scriptedRandom(0, 0.5) },
    );

    const result = engine.advanceWithPresentation(100);

    expect(result.events).toEqual([
      { type: 'attack', attacker: 'player', target: 'enemy' },
      { type: 'damage', target: 'enemy', amount: 90, hp: 0 },
      { type: 'death', actor: 'enemy' },
    ]);
    expect(result.presentationEvents).toEqual([
      { type: 'attack_started', actorId: 'player', targetId: 'enemy', timestampMs: 100 },
      { type: 'hit_landed', actorId: 'player', targetId: 'enemy', damage: 90, critical: false, resultingHealth: 0, timestampMs: 100 },
      { type: 'health_changed', actorId: 'player', targetId: 'enemy', resultingHealth: 0, timestampMs: 100 },
      { type: 'enemy_defeated', actorId: 'player', targetId: 'enemy', damage: 90, critical: false, resultingHealth: 0, timestampMs: 100 },
    ]);
  });

  it('lets Mossling attack on its independent interval', () => {
    const engine = createCombatEngine();
    engine.advance(1_300);
    expect(engine.getSnapshot().player.hp).toBe(113);
    expect(engine.getSnapshot().enemy.hp).toBe(72);
  });

  it('subtracts defense and always deals at least one damage', () => {
    const engine = createCombatEngine(makeBalance({
      player: { attack: 3 },
      enemy: { defense: 20 },
    }));
    expect(engine.advance(900)).toContainEqual({ type: 'damage', target: 'enemy', amount: 1, hp: 89 });
  });

  it('applies stronger player stats without resetting active combat state', () => {
    const engine = createCombatEngine();
    engine.advance(450);
    const before = engine.getSnapshot();
    engine.applyPlayerStats(makeProfile({ attack: 90, defense: 5, maxHp: 128 }));
    const upgraded = engine.getSnapshot();
    expect(upgraded).toMatchObject({
      activeRuntimeMs: before.activeRuntimeMs,
      totalAttacks: before.totalAttacks,
      player: { attack: 90, defense: 5, maxHp: 128, hp: 128 },
      enemy: { hp: before.enemy.hp },
    });
    expect(engine.advance(450)).toContainEqual({ type: 'damage', target: 'enemy', amount: 90, hp: 0 });
  });

  it('rejects invalid live stats before changing combat', () => {
    const engine = createCombatEngine();
    const before = engine.getSnapshot();
    expect(() => engine.applyPlayerStats(makeProfile({ attack: 0, defense: 2, maxHp: 120 })))
      .toThrow('Player stats must contain positive attack/maxHp and non-negative defense');
    expect(engine.getSnapshot()).toEqual(before);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 0, -1])(
    'ignores invalid elapsed time %s',
    (elapsed) => {
      const engine = createCombatEngine();
      expect(engine.advance(elapsed)).toEqual([]);
      expect(engine.getSnapshot().activeRuntimeMs).toBe(0);
    },
  );

  it('emits one enemy death and replaces Mossling after 1,200 ms', () => {
    const engine = createCombatEngine(makeBalance({ player: { attack: 90 } }));
    const events = engine.advance(900);
    expect(countActorEvents(events, 'death', 'enemy')).toBe(1);
    expect(engine.getSnapshot()).toMatchObject({ phase: 'enemy-defeated', defeatedEnemies: 1 });
    events.push(...engine.advance(1_199));
    expect(countActorEvents(events, 'respawn', 'enemy')).toBe(0);
    events.push(...engine.advance(1));
    expect(countActorEvents(events, 'death', 'enemy')).toBe(1);
    expect(countActorEvents(events, 'respawn', 'enemy')).toBe(1);
    expect(engine.getSnapshot()).toMatchObject({ phase: 'fighting', enemy: { hp: 90, alive: true } });
  });

  it('resurrects Ari after 3 seconds and resets Mossling health', () => {
    const engine = createCombatEngine(makeBalance({ enemy: { attack: 122, attackIntervalMs: 100 } }));
    const events = engine.advance(100);
    expect(countActorEvents(events, 'death', 'player')).toBe(1);
    events.push(...engine.advance(2_999));
    expect(countActorEvents(events, 'respawn', 'player')).toBe(0);
    events.push(...engine.advance(1));
    expect(countActorEvents(events, 'death', 'player')).toBe(1);
    expect(countActorEvents(events, 'respawn', 'player')).toBe(1);
    expect(engine.getSnapshot()).toMatchObject({
      phase: 'fighting',
      player: { hp: 120, alive: true },
      enemy: { hp: 90, alive: true },
    });
  });

  it('pauses idempotently and excludes paused time', () => {
    const engine = createCombatEngine();
    expect(engine.pause()).toEqual([{ type: 'pause' }]);
    expect(engine.pause()).toEqual([]);
    engine.advance(60_000);
    expect(engine.getSnapshot().activeRuntimeMs).toBe(0);
    expect(engine.resume()).toEqual([{ type: 'resume' }]);
    expect(engine.resume()).toEqual([]);
    engine.advance(900);
    expect(engine.getSnapshot().enemy.hp).toBe(72);
  });

  it('resolves Ari first when both attacks are due and cancels a dead Mossling attack', () => {
    const engine = createCombatEngine(makeBalance({
      player: { attack: 90, attackIntervalMs: 100 },
      enemy: { attack: 122, attackIntervalMs: 100 },
    }));
    const events = engine.advance(100);
    expect(events).toContainEqual({ type: 'death', actor: 'enemy' });
    expect(events).not.toContainEqual({ type: 'attack', attacker: 'enemy', target: 'player' });
    expect(engine.getSnapshot().player.hp).toBe(120);
  });

  it('does not carry unused recovery time into a new fighting phase', () => {
    const engine = createCombatEngine(makeBalance({ player: { attack: 90 } }));
    engine.advance(900);
    expect(engine.advance(1_201)).toContainEqual({ type: 'respawn', actor: 'enemy' });

    expect(engine.advance(899)).not.toContainEqual({ type: 'attack', attacker: 'player', target: 'enemy' });
    expect(engine.advance(1)).toContainEqual({ type: 'attack', attacker: 'player', target: 'enemy' });
  });

  it('runs ten simulated minutes without invalid or locked state', () => {
    const engine = createCombatEngine();
    let attacksAt540Seconds = 0;
    let killsAt540Seconds = 0;
    for (let elapsed = 0; elapsed < 600_000; elapsed += 250) {
      engine.advance(250);
      const state = engine.getSnapshot();
      for (const actor of [state.player, state.enemy]) {
        expect(Number.isFinite(actor.hp)).toBe(true);
        expect(actor.hp).toBeGreaterThanOrEqual(0);
        expect(actor.hp).toBeLessThanOrEqual(actor.maxHp);
      }
      expect(state.recoveryRemainingMs).toBeGreaterThanOrEqual(0);
      if (elapsed === 539_750) {
        expect(state.activeRuntimeMs).toBe(540_000);
        attacksAt540Seconds = state.totalAttacks;
        killsAt540Seconds = state.defeatedEnemies;
      }
    }
    const finalState = engine.getSnapshot();
    expect(finalState.activeRuntimeMs).toBe(600_000);
    expect(finalState.defeatedEnemies).toBeGreaterThan(killsAt540Seconds);
    expect(finalState.totalAttacks).toBeGreaterThan(attacksAt540Seconds);
  });

  it('uses the exact hit boundary and emits misses without damage', () => {
    const balance = makeBalance({ player: { attackIntervalMs: 100 }, enemy: { attackIntervalMs: 1_000 } });
    const hit = createCombatEngine(balance, { random: scriptedRandom(0.949_999, 0.5) });
    expect(hit.advance(100)).toContainEqual({ type: 'damage', target: 'enemy', amount: 18, hp: 72 });

    const miss = createCombatEngine(balance, { random: scriptedRandom(0.95) });
    expect(miss.advance(100)).toEqual([
      { type: 'attack', attacker: 'player', target: 'enemy' },
      { type: 'miss', attacker: 'player', target: 'enemy' },
    ]);
    expect(miss.getSnapshot()).toMatchObject({ totalAttacks: 1, enemy: { hp: 90 } });
  });

  it('applies Accuracy to player hits and Evasion to enemy hits', () => {
    const accurate = createCombatEngine(
      makeBalance({ player: { attackIntervalMs: 100 }, enemy: { attackIntervalMs: 1_000 } }),
      { random: scriptedRandom(0.999_999, 0.5) },
    );
    accurate.applyPlayerStats(makeProfile({ accuracy: 5 }));
    expect(accurate.advance(100)).toContainEqual(expect.objectContaining({ type: 'damage', target: 'enemy' }));

    const evasive = createCombatEngine(
      makeBalance({ player: { attackIntervalMs: 1_000 }, enemy: { attackIntervalMs: 100 } }),
      { random: scriptedRandom(0.5) },
    );
    evasive.applyPlayerStats(makeProfile({ evasion: 50 }));
    expect(evasive.advance(100)).toContainEqual({ type: 'miss', attacker: 'enemy', target: 'player' });
    expect(evasive.getSnapshot().player.hp).toBe(120);
  });

  it('starts Critical Rate at 5% and Critical Damage at 100% bonus', () => {
    const balance = makeBalance({ player: { attackIntervalMs: 100 }, enemy: { attackIntervalMs: 1_000 } });
    const critical = createCombatEngine(balance, { random: scriptedRandom(0, 0.049_999) });
    expect(critical.advance(100)).toEqual([
      { type: 'attack', attacker: 'player', target: 'enemy' },
      { type: 'critical', attacker: 'player', target: 'enemy' },
      { type: 'damage', target: 'enemy', amount: 36, hp: 54 },
    ]);

    const normal = createCombatEngine(balance, { random: scriptedRandom(0, 0.05) });
    const events = normal.advance(100);
    expect(events).toContainEqual({ type: 'damage', target: 'enemy', amount: 18, hp: 72 });
    expect(events).not.toContainEqual(expect.objectContaining({ type: 'critical' }));
  });

  it('applies general and encounter damage before critical damage', () => {
    const balance = makeBalance({
      player: { attack: 20, attackIntervalMs: 100 },
      enemy: { defense: 5, maxHp: 200, attackIntervalMs: 1_000 },
    });
    const normal = createCombatEngine(balance, {
      monsterDamageKind: 'normal',
      random: scriptedRandom(0, 0.5),
    });
    normal.applyPlayerStats(makeProfile({ attack: 20, damage: 10, normalDamage: 30, bossDamage: 20 }));
    expect(normal.advance(100)).toContainEqual({ type: 'damage', target: 'enemy', amount: 21, hp: 179 });

    const bossCritical = createCombatEngine(balance, {
      monsterDamageKind: 'boss',
      random: scriptedRandom(0, 0),
    });
    bossCritical.applyPlayerStats(makeProfile({
      attack: 20,
      criticalRate: 100,
      criticalDamage: 150,
      damage: 10,
      normalDamage: 30,
      bossDamage: 20,
    }));
    expect(bossCritical.advance(100)).toContainEqual({ type: 'damage', target: 'enemy', amount: 47, hp: 153 });
  });

  it('uses 120% Attack Speed and preserves the charged timer fraction', () => {
    const engine = createCombatEngine(
      makeBalance({ enemy: { attackIntervalMs: 10_000 } }),
      { random: scriptedRandom(0, 0.5) },
    );
    engine.advance(450);
    engine.applyPlayerStats(makeProfile({ attackSpeed: 120 }));
    expect(engine.getSnapshot().player.effectiveAttackIntervalMs).toBe(750);
    expect(engine.advance(374)).not.toContainEqual(expect.objectContaining({ type: 'attack' }));
    expect(engine.advance(1)).toContainEqual({ type: 'attack', attacker: 'player', target: 'enemy' });
  });

  it('allows safe Max HP decreases and preserves live combat state', () => {
    const engine = createCombatEngine(makeBalance({
      player: { attackIntervalMs: 10_000 },
      enemy: { attack: 12, attackIntervalMs: 100 },
    }));
    engine.advance(100);
    const before = engine.getSnapshot();
    engine.applyPlayerStats(makeProfile({ attack: 30, maxHp: 100 }));
    expect(engine.getSnapshot()).toMatchObject({
      phase: before.phase,
      activeRuntimeMs: before.activeRuntimeMs,
      totalAttacks: before.totalAttacks,
      player: { attack: 30, maxHp: 100, hp: 100 },
      enemy: { hp: before.enemy.hp },
    });
  });

  it('keeps a dead player dead when applying a new profile during recovery', () => {
    const engine = createCombatEngine(makeBalance({
      player: { attackIntervalMs: 10_000 },
      enemy: { attack: 122, attackIntervalMs: 100 },
    }));
    engine.advance(100);
    engine.applyPlayerStats(makeProfile({ maxHp: 200 }));
    expect(engine.getSnapshot().player).toMatchObject({ alive: false, hp: 0, maxHp: 200 });
    engine.advance(3_000);
    expect(engine.getSnapshot().player).toMatchObject({ alive: true, hp: 200, maxHp: 200 });
  });
});
