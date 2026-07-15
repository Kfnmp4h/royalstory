import { EQUIPMENT_SLOTS, type EquippedItems, type EquipmentSlot } from '../equipment/equipmentTypes';
import type { CampaignMode } from '../campaign/campaignTypes';
import type {
  CampaignPersistentState,
  PersistentEquipmentState,
  PersistentProgressionState,
  PlayerSaveState,
} from './saveTypes';

const CAMPAIGN_MODES: ReadonlySet<CampaignMode> = new Set([
  'farming',
  'breakthrough',
  'boss',
  'campaign-complete',
]);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isIntegerInRange = (value: unknown, minimum: number, maximum: number): value is number => (
  typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum
);

const parseInteger = (value: unknown, minimum: number, maximum: number, message: string): number => {
  if (!isIntegerInRange(value, minimum, maximum)) throw new Error(message);
  return value;
};

const parseProgression = (value: unknown): PersistentProgressionState => {
  if (!isRecord(value)) throw new Error('Progression must be an object');
  const level = parseInteger(value.level, 1, 200, 'Level must be an integer from 1 to 200');
  const xp = parseInteger(value.xp, 0, Number.MAX_SAFE_INTEGER, 'XP must be a non-negative integer');
  const totalXp = parseInteger(value.totalXp, 0, Number.MAX_SAFE_INTEGER, 'Total XP must be a non-negative integer');
  return Object.freeze({ level, xp, totalXp });
};

const parseEquipment = (value: unknown): PersistentEquipmentState => {
  if (!isRecord(value)) throw new Error('Equipment must be an object');
  if (!Array.isArray(value.inventory) || value.inventory.length !== 0) {
    throw new Error('Saved equipment inventory must be an empty array until equipment restoration is enabled');
  }
  if (!isRecord(value.equipped)) throw new Error('Equipped items must be an object');
  const equipped = {} as Record<EquipmentSlot, null>;
  for (const slot of EQUIPMENT_SLOTS) {
    if (value.equipped[slot] !== null) throw new Error(`Saved ${slot} slot must be empty until equipment restoration is enabled`);
    equipped[slot] = null;
  }
  if (value.latestDropId !== null) throw new Error('Latest drop must be null until equipment restoration is enabled');
  const nextItemNumber = parseInteger(
    value.nextItemNumber,
    1,
    Number.MAX_SAFE_INTEGER,
    'Next item number must be a positive integer',
  );
  return Object.freeze({
    inventory: Object.freeze([]),
    equipped: Object.freeze(equipped) as EquippedItems,
    latestDropId: null,
    nextItemNumber,
  });
};

const parseCampaign = (value: unknown): CampaignPersistentState => {
  if (!isRecord(value)) throw new Error('Campaign must be an object');
  const chapterNumber = parseInteger(value.chapterNumber, 1, 36, 'Chapter number must be an integer from 1 to 36');
  const unlockedChapter = parseInteger(value.unlockedChapter, 1, 36, 'Unlocked chapter must be an integer from 1 to 36');
  if (unlockedChapter < chapterNumber) throw new Error('Unlocked chapter cannot be behind the current chapter');
  if (typeof value.mode !== 'string' || !CAMPAIGN_MODES.has(value.mode as CampaignMode)) {
    throw new Error('Campaign mode is invalid');
  }
  if (typeof value.bossUnlocked !== 'boolean') throw new Error('Boss unlock must be a boolean');
  if (value.combat !== null) throw new Error('Saved combat must be null until combat restoration is enabled');
  return Object.freeze({
    chapterNumber,
    unlockedChapter,
    mode: value.mode as CampaignMode,
    bossUnlocked: value.bossUnlocked,
    progression: parseProgression(value.progression),
    equipment: parseEquipment(value.equipment),
    combat: null,
  });
};

export function createInitialPlayerSaveState(): PlayerSaveState {
  const equipped = Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot, null])) as EquippedItems;
  return Object.freeze({
    schemaVersion: 1,
    gold: 0,
    campaign: Object.freeze({
      chapterNumber: 1,
      unlockedChapter: 1,
      mode: 'farming',
      bossUnlocked: false,
      progression: Object.freeze({ level: 1, xp: 0, totalXp: 0 }),
      equipment: Object.freeze({
        inventory: Object.freeze([]),
        equipped: Object.freeze(equipped),
        latestDropId: null,
        nextItemNumber: 1,
      }),
      combat: null,
    }),
  });
}

export function parsePlayerSaveState(value: unknown): PlayerSaveState {
  if (!isRecord(value)) throw new Error('Player save state must be an object');
  if (value.schemaVersion !== 1) throw new Error('Unsupported player save schema version');
  const gold = parseInteger(value.gold, 0, Number.MAX_SAFE_INTEGER, 'Gold must be a non-negative integer');
  return Object.freeze({
    schemaVersion: 1,
    gold,
    campaign: parseCampaign(value.campaign),
  });
}
