import type { CampaignMode } from '../campaign/campaignTypes';
import type { EquippedItems, EquipmentItem } from '../equipment/equipmentTypes';
import type { CombatSnapshot } from '../types';

export interface PersistentProgressionState {
  readonly level: number;
  readonly xp: number;
  readonly totalXp: number;
}

export interface PersistentEquipmentState {
  readonly inventory: readonly EquipmentItem[];
  readonly equipped: EquippedItems;
  readonly latestDropId: string | null;
  readonly nextItemNumber: number;
}

export interface CampaignPersistentState {
  readonly chapterNumber: number;
  readonly unlockedChapter: number;
  readonly mode: CampaignMode;
  readonly bossUnlocked: boolean;
  readonly progression: PersistentProgressionState;
  readonly equipment: PersistentEquipmentState;
  readonly combat: CombatSnapshot | null;
}

export interface PlayerSaveState {
  readonly schemaVersion: 1;
  readonly gold: number;
  readonly campaign: CampaignPersistentState;
}
