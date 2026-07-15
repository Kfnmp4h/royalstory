export type ActorId = 'player' | 'enemy';
export type CombatPhase = 'fighting' | 'enemy-defeated' | 'player-defeated';
export type MonsterDamageKind = 'normal' | 'boss';

export interface PlayerStats {
  attack: number;
  defense: number;
  maxHp: number;
}

export interface CombatModifiers {
  accuracy: number;
  evasion: number;
  criticalRate: number;
  criticalDamage: number;
  attackSpeed: number;
  damage: number;
  bossDamage: number;
  normalDamage: number;
}

export interface PlayerCombatProfile extends PlayerStats, CombatModifiers {}

export interface CombatantConfig extends PlayerStats {
  id: ActorId;
  name: string;
  attackIntervalMs: number;
}

export interface CombatBalance {
  sliceMs: number;
  maxFrameContributionMs: number;
  enemyRespawnMs: number;
  playerRespawnMs: number;
  player: CombatantConfig;
  enemy: CombatantConfig;
}

export interface CombatantSnapshot extends CombatantConfig {
  hp: number;
  alive: boolean;
}

export interface PlayerCombatantSnapshot extends CombatantSnapshot, CombatModifiers {
  effectiveAttackIntervalMs: number;
}

export interface CombatSnapshot {
  phase: CombatPhase;
  paused: boolean;
  activeRuntimeMs: number;
  totalAttacks: number;
  defeatedEnemies: number;
  recoveryRemainingMs: number;
  player: PlayerCombatantSnapshot;
  enemy: CombatantSnapshot;
}

export type CombatEvent =
  | { type: 'attack'; attacker: ActorId; target: ActorId }
  | { type: 'miss'; attacker: ActorId; target: ActorId }
  | { type: 'critical'; attacker: 'player'; target: 'enemy' }
  | { type: 'damage'; target: ActorId; amount: number; hp: number }
  | { type: 'death'; actor: ActorId }
  | { type: 'respawn'; actor: ActorId }
  | { type: 'pause' }
  | { type: 'resume' };

export interface CombatEngineOptions {
  readonly random?: () => number;
  readonly monsterDamageKind?: MonsterDamageKind;
}

export interface CombatEngine {
  advance(elapsedMs: number): CombatEvent[];
  pause(): CombatEvent[];
  resume(): CombatEvent[];
  applyPlayerStats(stats: PlayerCombatProfile): void;
  getSnapshot(): CombatSnapshot;
}
