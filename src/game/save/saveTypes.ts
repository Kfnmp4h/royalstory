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

export type PlayerCommand =
  | { readonly type: 'sync'; readonly expectedVersion: number }
  | { readonly type: 'startBreakthrough'; readonly expectedVersion: number }
  | { readonly type: 'startBoss'; readonly expectedVersion: number }
  | { readonly type: 'equip'; readonly expectedVersion: number; readonly itemId: string }
  | { readonly type: 'equipBest'; readonly expectedVersion: number };

export interface PlayerApiRecord {
  readonly saveVersion: number;
  readonly state: PlayerSaveState;
  readonly lastActivityAt: string;
  readonly updatedAt: string;
}

export interface OfflineRewardSummary {
  readonly elapsedMs: number;
  readonly kills: number;
  readonly gold: number;
  readonly xp: number;
  readonly drops: readonly EquipmentItem[];
}

export type PlayerApiResponse =
  | {
    readonly kind: 'loaded' | 'saved';
    readonly record: PlayerApiRecord;
    readonly offline?: OfflineRewardSummary;
  }
  | { readonly kind: 'stale'; readonly record: PlayerApiRecord }
  | { readonly kind: 'unauthorized' }
  | { readonly kind: 'invalid'; readonly message: string }
  | { readonly kind: 'unavailable'; readonly message: string };
