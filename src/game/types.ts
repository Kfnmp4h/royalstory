export type ActorId = 'player' | 'enemy';
export type CombatPhase = 'fighting' | 'enemy-defeated' | 'player-defeated';

export interface PlayerStats {
  attack: number;
  defense: number;
  maxHp: number;
}

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

export interface CombatSnapshot {
  phase: CombatPhase;
  paused: boolean;
  activeRuntimeMs: number;
  totalAttacks: number;
  defeatedEnemies: number;
  recoveryRemainingMs: number;
  player: CombatantSnapshot;
  enemy: CombatantSnapshot;
}

export type CombatEvent =
  | { type: 'attack'; attacker: ActorId; target: ActorId }
  | { type: 'damage'; target: ActorId; amount: number; hp: number }
  | { type: 'death'; actor: ActorId }
  | { type: 'respawn'; actor: ActorId }
  | { type: 'pause' }
  | { type: 'resume' };

export interface CombatEngine {
  advance(elapsedMs: number): CombatEvent[];
  pause(): CombatEvent[];
  resume(): CombatEvent[];
  applyPlayerStats(stats: PlayerStats): void;
  getSnapshot(): CombatSnapshot;
}
