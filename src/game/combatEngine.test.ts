import { describe, expect, it } from 'vitest';
import { COMBAT_BALANCE } from './balance';
import { createCombatEngine } from './combatEngine';
import type { ActorId, CombatBalance, CombatEvent } from './types';

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

const countActorEvents = (
  events: CombatEvent[],
  type: 'death' | 'respawn',
  actor: ActorId,
): number => events.filter((event) => event.type === type && event.actor === actor).length;

describe('createCombatEngine', () => {
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

  it('lets Mossling attack on its independent interval', () => {
    const engine = createCombatEngine();
    engine.advance(1_300);
    expect(engine.getSnapshot().player.hp).toBe(111);
    expect(engine.getSnapshot().enemy.hp).toBe(72);
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
    const engine = createCombatEngine(makeBalance({ player: { damage: 90 } }));
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
    const engine = createCombatEngine(makeBalance({ enemy: { damage: 120, attackIntervalMs: 100 } }));
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
      player: { damage: 90, attackIntervalMs: 100 },
      enemy: { damage: 120, attackIntervalMs: 100 },
    }));
    const events = engine.advance(100);
    expect(events).toContainEqual({ type: 'death', actor: 'enemy' });
    expect(events).not.toContainEqual({ type: 'attack', attacker: 'enemy', target: 'player' });
    expect(engine.getSnapshot().player.hp).toBe(120);
  });

  it('does not carry unused recovery time into a new fighting phase', () => {
    const engine = createCombatEngine(makeBalance({ player: { damage: 90 } }));
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
});
