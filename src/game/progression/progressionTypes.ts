import type { PlayerStats } from '../types';

export interface ProgressionSnapshot {
  level: number;
  xp: number;
  xpToNextLevel: number;
  totalXp: number;
  stats: Readonly<PlayerStats>;
}

export interface ProgressionPersistentState {
  readonly level: number;
  readonly xp: number;
  readonly totalXp: number;
}

export interface ProgressionController {
  awardXp(amount: number): ProgressionSnapshot;
  getSnapshot(): ProgressionSnapshot;
  getPersistentState(): ProgressionPersistentState;
}
