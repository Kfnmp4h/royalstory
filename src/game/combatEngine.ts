import { COMBAT_BALANCE, EQUIPMENT_BALANCE } from './balance';
import type {
  ActorId,
  CombatBalance,
  CombatantConfig,
  CombatEngine,
  CombatEngineOptions,
  CombatEvent,
  CombatSnapshot,
  PlayerCombatProfile,
} from './types';

const clamp = (value: number, minimum: number, maximum: number): number => (
  Math.min(maximum, Math.max(minimum, value))
);

export const createCombatEngine = (
  balance: CombatBalance = COMBAT_BALANCE,
  options: CombatEngineOptions = {},
): CombatEngine => {
  const random = options.random ?? Math.random;
  const monsterDamageKind = options.monsterDamageKind ?? 'normal';
  const player: CombatantConfig & PlayerCombatProfile & {
    effectiveAttackIntervalMs: number;
    hp: number;
    alive: boolean;
  } = {
    ...balance.player,
    ...EQUIPMENT_BALANCE.combatDefaults,
    effectiveAttackIntervalMs: balance.player.attackIntervalMs,
    hp: balance.player.maxHp,
    alive: true,
  };
  const enemy = { ...balance.enemy, hp: balance.enemy.maxHp, alive: true };
  let playerAttackAccumulatorMs = 0;
  let enemyAttackAccumulatorMs = 0;
  let activeRuntimeMs = 0;
  let totalAttacks = 0;
  let defeatedEnemies = 0;
  let phase: CombatSnapshot['phase'] = 'fighting';
  let paused = false;
  let recoveryRemainingMs = 0;

  if (options.initialState) {
    const initial = options.initialState;
    Object.assign(player, initial.player);
    Object.assign(enemy, initial.enemy);
    playerAttackAccumulatorMs = 0;
    enemyAttackAccumulatorMs = 0;
    activeRuntimeMs = initial.activeRuntimeMs;
    totalAttacks = initial.totalAttacks;
    defeatedEnemies = initial.defeatedEnemies;
    phase = initial.phase;
    paused = initial.paused;
    recoveryRemainingMs = initial.recoveryRemainingMs;
  }

  const readRandom = (): number => {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new RangeError('Random source must return a finite value from 0 up to but not including 1');
    }
    return value;
  };

  const beginRecovery = (actorId: ActorId, events: CombatEvent[]) => {
    phase = actorId === 'enemy' ? 'enemy-defeated' : 'player-defeated';
    recoveryRemainingMs = actorId === 'enemy'
      ? balance.enemyRespawnMs
      : balance.playerRespawnMs;
    playerAttackAccumulatorMs = 0;
    enemyAttackAccumulatorMs = 0;
    if (actorId === 'enemy') defeatedEnemies += 1;
    events.push({ type: 'death', actor: actorId });
  };

  const completeRecovery = (events: CombatEvent[]) => {
    const actorId: ActorId = phase === 'enemy-defeated' ? 'enemy' : 'player';
    if (actorId === 'enemy') {
      enemy.hp = enemy.maxHp;
      enemy.alive = true;
    } else {
      player.hp = player.maxHp;
      player.alive = true;
      enemy.hp = enemy.maxHp;
      enemy.alive = true;
    }
    phase = 'fighting';
    recoveryRemainingMs = 0;
    events.push({ type: 'respawn', actor: actorId });
  };

  const attack = (attackerId: ActorId, events: CombatEvent[]) => {
    const attacker = attackerId === 'player' ? player : enemy;
    const target = attackerId === 'player' ? enemy : player;
    if (!attacker.alive || !target.alive) return;

    const accuracy = attackerId === 'player' ? player.accuracy : 0;
    const evasion = attackerId === 'enemy' ? player.evasion : 0;
    const hitChance = clamp(95 + accuracy - evasion, 50, 100);
    const hit = readRandom() < hitChance / 100;
    const critical = hit && attackerId === 'player'
      ? readRandom() < player.criticalRate / 100
      : false;

    totalAttacks += 1;
    events.push({ type: 'attack', attacker: attacker.id, target: target.id });
    if (!hit) {
      events.push({ type: 'miss', attacker: attacker.id, target: target.id });
      return;
    }

    const baseDamage = Math.max(1, attacker.attack - target.defense);
    let damage = baseDamage;
    if (attackerId === 'player') {
      const encounterDamage = monsterDamageKind === 'boss'
        ? player.bossDamage
        : player.normalDamage;
      damage = Math.max(1, Math.floor(baseDamage * (1 + (player.damage + encounterDamage) / 100)));
      if (critical) {
        events.push({ type: 'critical', attacker: 'player', target: 'enemy' });
        damage = Math.max(1, Math.floor(damage * (1 + player.criticalDamage / 100)));
      }
    }
    target.hp = Math.max(0, target.hp - damage);
    events.push({ type: 'damage', target: target.id, amount: damage, hp: target.hp });
    if (target.hp === 0) {
      target.alive = false;
      beginRecovery(target.id, events);
    }
  };

  const advance = (elapsedMs: number): CombatEvent[] => {
    if (!Number.isFinite(elapsedMs) || elapsedMs <= 0 || paused) return [];

    const events: CombatEvent[] = [];
    let remainingMs = elapsedMs;
    while (remainingMs > 0) {
      const sliceMs = Math.min(balance.sliceMs, remainingMs);
      activeRuntimeMs += sliceMs;

      if (phase !== 'fighting') {
        recoveryRemainingMs = Math.max(0, recoveryRemainingMs - sliceMs);
        remainingMs -= sliceMs;
        if (recoveryRemainingMs === 0) {
          completeRecovery(events);
          activeRuntimeMs += remainingMs;
          remainingMs = 0;
        }
        continue;
      }

      playerAttackAccumulatorMs += sliceMs;
      enemyAttackAccumulatorMs += sliceMs;

      while (
        phase === 'fighting'
        && playerAttackAccumulatorMs >= player.effectiveAttackIntervalMs
      ) {
        playerAttackAccumulatorMs -= player.effectiveAttackIntervalMs;
        attack('player', events);
      }
      while (phase === 'fighting' && enemyAttackAccumulatorMs >= enemy.attackIntervalMs) {
        enemyAttackAccumulatorMs -= enemy.attackIntervalMs;
        attack('enemy', events);
      }

      remainingMs -= sliceMs;
    }
    return events;
  };

  const pause = (): CombatEvent[] => {
    if (paused) return [];
    paused = true;
    return [{ type: 'pause' }];
  };

  const resume = (): CombatEvent[] => {
    if (!paused) return [];
    paused = false;
    return [{ type: 'resume' }];
  };

  const applyPlayerStats = (stats: PlayerCombatProfile): void => {
    if (
      !Number.isFinite(stats.attack) || stats.attack <= 0
      || !Number.isFinite(stats.defense) || stats.defense < 0
      || !Number.isFinite(stats.maxHp) || stats.maxHp <= 0
      || !Number.isFinite(stats.accuracy) || stats.accuracy < 0
      || !Number.isFinite(stats.evasion) || stats.evasion < 0
      || !Number.isFinite(stats.criticalRate) || stats.criticalRate < 0 || stats.criticalRate > 100
      || !Number.isFinite(stats.criticalDamage) || stats.criticalDamage < 0
      || !Number.isFinite(stats.attackSpeed) || stats.attackSpeed < 100 || stats.attackSpeed > 120
      || !Number.isFinite(stats.damage) || stats.damage < 0
      || !Number.isFinite(stats.bossDamage) || stats.bossDamage < 0
      || !Number.isFinite(stats.normalDamage) || stats.normalDamage < 0
    ) throw new RangeError('Player stats must contain positive attack/maxHp and non-negative defense with valid combat modifiers');

    const oldMaxHp = player.maxHp;
    const oldInterval = player.effectiveAttackIntervalMs;
    const chargedFraction = oldInterval > 0 ? playerAttackAccumulatorMs / oldInterval : 0;
    player.attack = stats.attack;
    player.defense = stats.defense;
    player.maxHp = stats.maxHp;
    player.accuracy = stats.accuracy;
    player.evasion = stats.evasion;
    player.criticalRate = stats.criticalRate;
    player.criticalDamage = stats.criticalDamage;
    player.attackSpeed = stats.attackSpeed;
    player.damage = stats.damage;
    player.bossDamage = stats.bossDamage;
    player.normalDamage = stats.normalDamage;
    player.effectiveAttackIntervalMs = player.attackIntervalMs / (player.attackSpeed / 100);
    playerAttackAccumulatorMs = clamp(
      chargedFraction * player.effectiveAttackIntervalMs,
      0,
      player.effectiveAttackIntervalMs,
    );
    if (player.alive) {
      player.hp = Math.min(
        player.maxHp,
        player.hp + Math.max(0, player.maxHp - oldMaxHp),
      );
    } else {
      player.hp = 0;
    }
  };

  const getSnapshot = (): CombatSnapshot => ({
    phase,
    paused,
    activeRuntimeMs,
    totalAttacks,
    defeatedEnemies,
    recoveryRemainingMs,
    player: { ...player },
    enemy: { ...enemy },
  });

  const getPersistentState = (): CombatSnapshot => getSnapshot();

  return { advance, pause, resume, applyPlayerStats, getSnapshot, getPersistentState };
};
