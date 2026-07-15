import type { CombatEvent, CombatSnapshot, CombatBalance } from '../types';
import type { ProgressionSnapshot } from '../progression/progressionTypes';

export type CampaignMode = 'farming' | 'breakthrough' | 'boss' | 'campaign-complete';
export type EncounterKind = 'farming' | 'breakthrough' | 'boss';

export interface EncounterVisual {
  name: string;
  color: number;
  accentColor: number;
  scale: number;
}

export interface EncounterDefinition {
  kind: EncounterKind;
  visual: EncounterVisual;
  balance: CombatBalance;
}

export interface ChapterDefinition {
  number: number;
  name: string;
  backgroundColor: number;
  farming: EncounterDefinition;
  breakthrough: EncounterDefinition;
  boss: EncounterDefinition;
}

export interface CampaignSnapshot {
  mode: CampaignMode;
  bossUnlocked: boolean;
  chapter: ChapterDefinition;
  unlockedChapter: number;
  encounter: EncounterDefinition | null;
  progression: ProgressionSnapshot;
  combat: CombatSnapshot | null;
}

export interface CampaignController {
  advance(elapsedMs: number): CombatEvent[];
  pause(): CombatEvent[];
  resume(): CombatEvent[];
  startBreakthrough(): void;
  startBoss(): void;
  getSnapshot(): CampaignSnapshot;
}
