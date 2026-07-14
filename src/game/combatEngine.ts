import { COMBAT_BALANCE } from './balance';
import type {
  ActorId,
  CombatBalance,
  CombatEngine,
  CombatEvent,
  CombatSnapshot,
} from './types';

export const createCombatEngine = (
  balance: CombatBalance = COMBAT_BALANCE,
): CombatEngine => {
  const player = { ...balance.player, hp: balance.player.maxHp, alive: true };
  const enemy = { ...balance.enemy, hp: balance.enemy.maxHp, alive: true };
  let playerAttackAccumulatorMs = 0;
  let enemyAttackAccumulatorMs = 0;
  let activeRuntimeMs = 0;
  let totalAttacks = 0;
  let defeatedEnemies = 0;
  let phase: CombatSnapshot['phase'] = 'fighting';
  let paused = false;
  let recoveryRemainingMs = 0;

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
    totalAttacks += 1;
    events.push({ type: 'attack', attacker: attacker.id, target: target.id });
    target.hp = Math.max(0, target.hp - attacker.damage);
    events.push({ type: 'damage', target: target.id, amount: attacker.damage, hp: target.hp });
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

      while (phase === 'fighting' && playerAttackAccumulatorMs >= player.attackIntervalMs) {
        playerAttackAccumulatorMs -= player.attackIntervalMs;
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

  return { advance, pause, resume, getSnapshot };
};
