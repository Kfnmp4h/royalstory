import {
  EQUIPMENT_RARITIES,
  EQUIPMENT_SLOTS,
  EQUIPMENT_STAT_KEYS,
  type EquippedItems,
  type EquipmentItem,
  type EquipmentRarity,
  type EquipmentSlot,
  type EquipmentStatKey,
} from '../equipment/equipmentTypes';
import type { CampaignMode } from '../campaign/campaignTypes';
import type { CombatSnapshot, CombatPhase, ActorId } from '../types';
import type {
  CampaignPersistentState,
  PersistentEquipmentState,
  PersistentProgressionState,
  PlayerSaveState,
} from './saveTypes';

const CAMPAIGN_MODES: ReadonlySet<CampaignMode> = new Set(['farming', 'breakthrough', 'boss', 'campaign-complete']);
const COMBAT_PHASES: ReadonlySet<CombatPhase> = new Set(['fighting', 'enemy-defeated', 'player-defeated']);
const SLOT_SET = new Set<string>(EQUIPMENT_SLOTS);
const RARITY_SET = new Set<string>(EQUIPMENT_RARITIES);
const STAT_SET = new Set<string>(EQUIPMENT_STAT_KEYS);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const parseInteger = (value: unknown, minimum: number, maximum: number, message: string): number => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum || value > maximum) throw new Error(message);
  return value;
};

const parseFinite = (value: unknown, minimum: number, message: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) throw new Error(message);
  return value;
};

const parseString = (value: unknown, message: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(message);
  return value;
};

const parseProgression = (value: unknown): PersistentProgressionState => {
  if (!isRecord(value)) throw new Error('Progression must be an object');
  const level = parseInteger(value.level, 1, 200, 'Level must be an integer from 1 to 200');
  const xp = parseInteger(value.xp, 0, Number.MAX_SAFE_INTEGER, 'XP must be a non-negative integer');
  const totalXp = parseInteger(value.totalXp, 0, Number.MAX_SAFE_INTEGER, 'Total XP must be a non-negative integer');
  if (totalXp < xp) throw new Error('Total XP cannot be lower than current XP');
  return Object.freeze({ level, xp, totalXp });
};

const parseItem = (value: unknown): EquipmentItem => {
  if (!isRecord(value)) throw new Error('Equipment item must be an object');
  const id = parseString(value.id, 'Equipment item ID must be a non-empty string');
  if (typeof value.slot !== 'string' || !SLOT_SET.has(value.slot)) throw new Error('Equipment item slot is invalid');
  if (typeof value.rarity !== 'string' || !RARITY_SET.has(value.rarity)) throw new Error('Equipment item rarity is invalid');
  const level = parseInteger(value.level, 1, 200, 'Equipment item level must be an integer from 1 to 200');
  const name = parseString(value.name, 'Equipment item name must be a non-empty string');
  const power = parseInteger(value.power, 0, Number.MAX_SAFE_INTEGER, 'Equipment item power must be a non-negative integer');
  if (!isRecord(value.mainStats)) throw new Error('Equipment main stats must be an object');
  const mainStats = Object.freeze({
    attack: parseInteger(value.mainStats.attack, 1, Number.MAX_SAFE_INTEGER, 'Equipment attack must be positive'),
    defense: parseInteger(value.mainStats.defense, 1, Number.MAX_SAFE_INTEGER, 'Equipment defense must be positive'),
    maxHp: parseInteger(value.mainStats.maxHp, 1, Number.MAX_SAFE_INTEGER, 'Equipment max HP must be positive'),
  });
  if (!Array.isArray(value.substats) || value.substats.length > 4) throw new Error('Equipment substats must be an array with at most four entries');
  const seenStats = new Set<string>();
  const substats = value.substats.map((substat) => {
    if (!isRecord(substat) || typeof substat.type !== 'string' || !STAT_SET.has(substat.type)) throw new Error('Equipment substat type is invalid');
    if (seenStats.has(substat.type)) throw new Error('Equipment substats cannot contain duplicate types');
    seenStats.add(substat.type);
    return Object.freeze({
      type: substat.type as EquipmentStatKey,
      value: parseInteger(substat.value, 1, Number.MAX_SAFE_INTEGER, 'Equipment substat value must be positive'),
    });
  });
  return Object.freeze({
    id,
    slot: value.slot as EquipmentSlot,
    level,
    rarity: value.rarity as EquipmentRarity,
    name,
    mainStats,
    substats: Object.freeze(substats),
    power,
  });
};

const parseEquipment = (value: unknown): PersistentEquipmentState => {
  if (!isRecord(value)) throw new Error('Equipment must be an object');
  if (!Array.isArray(value.inventory)) throw new Error('Saved equipment inventory must be an array');
  if (!isRecord(value.equipped)) throw new Error('Equipped items must be an object');
  if (Object.keys(value.equipped).some((slot) => !SLOT_SET.has(slot))) throw new Error('Equipped items contain an invalid slot');
  const inventory = value.inventory.map(parseItem);
  const equipped = {} as Record<EquipmentSlot, EquipmentItem | null>;
  for (const slot of EQUIPMENT_SLOTS) {
    const itemValue = value.equipped[slot];
    if (itemValue === null) equipped[slot] = null;
    else {
      const item = parseItem(itemValue);
      if (item.slot !== slot) throw new Error(`Saved ${slot} item belongs to another slot`);
      equipped[slot] = item;
    }
  }
  const allItems = [...inventory, ...Object.values(equipped).filter((item): item is EquipmentItem => item !== null)];
  const ids = new Set<string>();
  for (const item of allItems) {
    if (ids.has(item.id)) throw new Error('Equipment state contains duplicate item IDs');
    ids.add(item.id);
  }
  const latestDropId = value.latestDropId === null ? null : parseString(value.latestDropId, 'Latest drop ID must be null or a non-empty string');
  if (latestDropId !== null && !ids.has(latestDropId)) throw new Error('Latest drop ID must reference an owned item');
  return Object.freeze({
    inventory: Object.freeze(inventory),
    equipped: Object.freeze(equipped) as EquippedItems,
    latestDropId,
    nextItemNumber: parseInteger(value.nextItemNumber, 1, Number.MAX_SAFE_INTEGER, 'Next item number must be a positive integer'),
  });
};

const parseCombatant = (value: unknown, expectedId: ActorId, player: boolean) => {
  if (!isRecord(value) || value.id !== expectedId) throw new Error('Combatant ID is invalid');
  const maxHp = parseFinite(value.maxHp, 1, 'Combatant max HP must be positive');
  const hp = parseFinite(value.hp, 0, 'Combatant HP must be non-negative');
  if (hp > maxHp) throw new Error('Combatant HP cannot exceed max HP');
  if (typeof value.alive !== 'boolean' || value.alive !== (hp > 0)) throw new Error('Combatant alive state must match HP');
  const base = {
    id: expectedId,
    name: parseString(value.name, 'Combatant name must be non-empty'),
    attack: parseFinite(value.attack, 1, 'Combatant attack must be positive'),
    defense: parseFinite(value.defense, 0, 'Combatant defense must be non-negative'),
    maxHp,
    attackIntervalMs: parseFinite(value.attackIntervalMs, 1, 'Combatant attack interval must be positive'),
    hp,
    alive: value.alive,
  };
  if (!player) return Object.freeze(base);
  return Object.freeze({
    ...base,
    accuracy: parseFinite(value.accuracy, 0, 'Accuracy must be non-negative'),
    evasion: parseFinite(value.evasion, 0, 'Evasion must be non-negative'),
    criticalRate: parseFinite(value.criticalRate, 0, 'Critical rate must be non-negative'),
    criticalDamage: parseFinite(value.criticalDamage, 0, 'Critical damage must be non-negative'),
    attackSpeed: parseFinite(value.attackSpeed, 100, 'Attack speed must be at least 100'),
    damage: parseFinite(value.damage, 0, 'Damage must be non-negative'),
    bossDamage: parseFinite(value.bossDamage, 0, 'Boss damage must be non-negative'),
    normalDamage: parseFinite(value.normalDamage, 0, 'Normal damage must be non-negative'),
    effectiveAttackIntervalMs: parseFinite(value.effectiveAttackIntervalMs, 1, 'Effective attack interval must be positive'),
  });
};

const parseCombat = (value: unknown): CombatSnapshot | null => {
  if (value === null) return null;
  if (!isRecord(value)) throw new Error('Combat state must be an object or null');
  if (typeof value.phase !== 'string' || !COMBAT_PHASES.has(value.phase as CombatPhase)) throw new Error('Combat phase is invalid');
  if (typeof value.paused !== 'boolean') throw new Error('Combat paused state must be a boolean');
  return Object.freeze({
    phase: value.phase as CombatPhase,
    paused: value.paused,
    activeRuntimeMs: parseFinite(value.activeRuntimeMs, 0, 'Combat runtime must be non-negative'),
    totalAttacks: parseInteger(value.totalAttacks, 0, Number.MAX_SAFE_INTEGER, 'Total attacks must be a non-negative integer'),
    defeatedEnemies: parseInteger(value.defeatedEnemies, 0, Number.MAX_SAFE_INTEGER, 'Defeated enemies must be a non-negative integer'),
    recoveryRemainingMs: parseFinite(value.recoveryRemainingMs, 0, 'Recovery time must be non-negative'),
    player: parseCombatant(value.player, 'player', true),
    enemy: parseCombatant(value.enemy, 'enemy', false),
  }) as CombatSnapshot;
};

const parseCampaign = (value: unknown): CampaignPersistentState => {
  if (!isRecord(value)) throw new Error('Campaign must be an object');
  const chapterNumber = parseInteger(value.chapterNumber, 1, 36, 'Chapter number must be an integer from 1 to 36');
  const unlockedChapter = parseInteger(value.unlockedChapter, 1, 36, 'Unlocked chapter must be an integer from 1 to 36');
  if (unlockedChapter < chapterNumber) throw new Error('Unlocked chapter cannot be behind the current chapter');
  if (typeof value.mode !== 'string' || !CAMPAIGN_MODES.has(value.mode as CampaignMode)) throw new Error('Campaign mode is invalid');
  if (typeof value.bossUnlocked !== 'boolean') throw new Error('Boss unlock must be a boolean');
  const mode = value.mode as CampaignMode;
  const combat = parseCombat(value.combat);
  if (mode === 'campaign-complete' && combat !== null) throw new Error('Completed campaigns cannot contain active combat');
  if ((mode === 'breakthrough' || mode === 'boss') && combat === null) throw new Error('Active challenge modes must contain combat state');
  if (mode === 'boss' && !value.bossUnlocked) throw new Error('Boss mode requires an unlocked boss');
  return Object.freeze({
    chapterNumber,
    unlockedChapter,
    mode,
    bossUnlocked: value.bossUnlocked,
    progression: parseProgression(value.progression),
    equipment: parseEquipment(value.equipment),
    combat,
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
      equipment: Object.freeze({ inventory: Object.freeze([]), equipped: Object.freeze(equipped), latestDropId: null, nextItemNumber: 1 }),
      combat: null,
    }),
  });
}

export function parsePlayerSaveState(value: unknown): PlayerSaveState {
  if (!isRecord(value)) throw new Error('Player save state must be an object');
  if (value.schemaVersion !== 1) throw new Error('Unsupported player save schema version');
  return Object.freeze({
    schemaVersion: 1,
    gold: parseInteger(value.gold, 0, Number.MAX_SAFE_INTEGER, 'Gold must be a non-negative integer'),
    campaign: parseCampaign(value.campaign),
  });
}
