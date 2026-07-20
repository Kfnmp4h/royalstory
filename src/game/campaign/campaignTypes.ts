import type { CombatEvent, CombatSnapshot, CombatBalance } from '../types';
import type { DismantleResult, EquipmentSnapshot, RandomSource } from '../equipment/equipmentTypes';
import type { CombatPresentationEvent } from '../presentation/combatPresentationEvents';
import type { ProgressionSnapshot } from '../progression/progressionTypes';
import type { CampaignPersistentState } from '../save/saveTypes';

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
  equipment: EquipmentSnapshot;
  combat: CombatSnapshot | null;
}

export interface CampaignControllerOptions {
  readonly combatRandom?: RandomSource;
  readonly equipmentRandom?: RandomSource;
  readonly initialState?: CampaignPersistentState;
}

export interface CampaignController {
  advance(elapsedMs: number): CombatEvent[];
  consumePresentationEvents?(): readonly CombatPresentationEvent[];
  pause(): CombatEvent[];
  resume(): CombatEvent[];
  startBreakthrough(): void;
  startBoss(): void;
  equip(itemId: string): void;
  equipBest(): void;
  getSnapshot(): CampaignSnapshot;
  getPersistentState?(): CampaignPersistentState;
}

export interface PersistentCampaignController extends CampaignController {
  dismantle(itemId: string): DismantleResult;
  getPersistentState(): CampaignPersistentState;
}
