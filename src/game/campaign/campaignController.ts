import { createCombatEngine } from '../combatEngine';
import { getEncounterXp } from '../balance';
import { createEquipmentController } from '../equipment/equipmentController';
import type { CombatPresentationEvent } from '../presentation/combatPresentationEvents';
import { createProgressionController } from '../progression/progressionController';
import type { CombatEngine, CombatEvent, CombatSnapshot } from '../types';
import { CHAPTERS, getChapter } from './campaignDefinitions';
import type {
  CampaignControllerOptions,
  CampaignMode,
  CampaignSnapshot,
  ChapterDefinition,
  EncounterDefinition,
  PersistentCampaignController,
} from './campaignTypes';

const activeModes: ReadonlySet<CampaignMode> = new Set(['farming', 'breakthrough', 'boss']);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isPositiveNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
const isNonNegativeNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const isColor = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 0xffffff;

const hasCombatant = (value: unknown, id: 'player' | 'enemy'): boolean => (
  isRecord(value)
  && value.id === id
  && isNonEmptyString(value.name)
  && isPositiveNumber(value.attack)
  && isNonNegativeNumber(value.defense)
  && isPositiveNumber(value.maxHp)
  && isPositiveNumber(value.attackIntervalMs)
);

const hasBalance = (value: unknown): boolean => (
  isRecord(value)
  && isPositiveNumber(value.sliceMs)
  && isPositiveNumber(value.maxFrameContributionMs)
  && isPositiveNumber(value.enemyRespawnMs)
  && isPositiveNumber(value.playerRespawnMs)
  && hasCombatant(value.player, 'player')
  && hasCombatant(value.enemy, 'enemy')
);

const hasEncounter = (value: unknown, kind: EncounterDefinition['kind']): boolean => (
  isRecord(value)
  && value.kind === kind
  && isRecord(value.visual)
  && isNonEmptyString(value.visual.name)
  && isColor(value.visual.color)
  && isColor(value.visual.accentColor)
  && isPositiveNumber(value.visual.scale)
  && hasBalance(value.balance)
);

const hasOrderedEncounters = (chapters: readonly ChapterDefinition[]): boolean => {
  if (!Array.isArray(chapters) || chapters.length !== 36) return false;
  for (let index = 0; index < 36; index += 1) {
    const chapter = chapters[index];
    if (
      !isRecord(chapter)
      || chapter.number !== index + 1
      || !isNonEmptyString(chapter.name)
      || !isColor(chapter.backgroundColor)
      || !hasEncounter(chapter.farming, 'farming')
      || !hasEncounter(chapter.breakthrough, 'breakthrough')
      || !hasEncounter(chapter.boss, 'boss')
    ) return false;
  }
  return true;
};

export const createCampaignController = (
  chapters: readonly ChapterDefinition[] = CHAPTERS,
  options: CampaignControllerOptions = {},
): PersistentCampaignController => {
  if (!hasOrderedEncounters(chapters)) throw new Error('Campaign must contain 36 ordered chapters');

  const initial = options.initialState;
  let chapter = initial ? chapters[initial.chapterNumber - 1]! : chapters === CHAPTERS ? getChapter(1) : chapters[0]!;
  let unlockedChapter = initial?.unlockedChapter ?? 1;
  let mode: CampaignMode = initial?.mode ?? 'farming';
  let bossUnlocked = initial?.bossUnlocked ?? false;
  let encounter: EncounterDefinition | null;
  let engine: CombatEngine | null;
  let presentationEvents: readonly CombatPresentationEvent[] = [];
  const progression = createProgressionController(initial?.progression);
  const equipment = createEquipmentController({
    random: options.equipmentRandom ?? Math.random,
    initialState: initial?.equipment,
  });

  const startEncounter = (
    definition: EncounterDefinition,
    nextMode: CampaignMode,
    restoredCombat: CombatSnapshot | null = null,
  ) => {
    const stats = progression.getSnapshot().stats;
    const profile = equipment.getSnapshot(stats).effectiveStats;
    encounter = definition;
    engine = createCombatEngine({
      ...definition.balance,
      player: {
        ...definition.balance.player,
        attack: profile.attack,
        defense: profile.defense,
        maxHp: profile.maxHp,
      },
    }, {
      random: options.combatRandom ?? Math.random,
      monsterDamageKind: definition.kind === 'boss' ? 'boss' : 'normal',
      initialState: restoredCombat ?? undefined,
    });
    if (restoredCombat === null) engine.applyPlayerStats(profile);
    mode = nextMode;
  };

  const returnToFarming = () => startEncounter(chapter.farming, 'farming');

  if (mode === 'campaign-complete') {
    encounter = null;
    engine = null;
  } else if (mode === 'breakthrough') {
    startEncounter(chapter.breakthrough, 'breakthrough', initial?.combat ?? null);
  } else if (mode === 'boss') {
    startEncounter(chapter.boss, 'boss', initial?.combat ?? null);
  } else {
    startEncounter(chapter.farming, 'farming', initial?.combat ?? null);
  }

  const advance = (elapsedMs: number): CombatEvent[] => {
    presentationEvents = [];
    if (!activeModes.has(mode) || engine === null) return [];
    const result = engine.advanceWithPresentation(elapsedMs);
    presentationEvents = result.presentationEvents;
    const events = result.events as CombatEvent[];
    const deaths = events.filter((event): event is Extract<CombatEvent, { type: 'death' }> => event.type === 'death');

    for (const death of deaths) {
      if (death.actor !== 'enemy' || encounter === null) continue;
      progression.awardXp(getEncounterXp(chapter.number, encounter.kind));
      const progressionSnapshot = progression.getSnapshot();
      equipment.rollDrop(encounter.kind, progressionSnapshot.level);
      engine.applyPlayerStats(equipment.getSnapshot(progressionSnapshot.stats).effectiveStats);
      if (mode !== 'farming') break;
    }

    const death = deaths[0];
    if (death === undefined || mode === 'farming') return events;

    if (mode === 'breakthrough') {
      bossUnlocked = death.actor === 'enemy';
      returnToFarming();
      return events;
    }

    if (death.actor === 'player') {
      returnToFarming();
      return events;
    }

    if (chapter.number === 36) {
      bossUnlocked = false;
      mode = 'campaign-complete';
      encounter = null;
      engine = null;
      return events;
    }

    unlockedChapter = chapter.number + 1;
    chapter = chapters[unlockedChapter - 1]!;
    bossUnlocked = false;
    returnToFarming();
    return events;
  };

  const applyEquipmentProfile = (): void => {
    if (engine === null) return;
    const progressionSnapshot = progression.getSnapshot();
    engine.applyPlayerStats(equipment.getSnapshot(progressionSnapshot.stats).effectiveStats);
  };

  const getSnapshot = (): CampaignSnapshot => {
    const progressionSnapshot = progression.getSnapshot();
    return {
      mode,
      bossUnlocked,
      chapter,
      unlockedChapter,
      encounter,
      progression: progressionSnapshot,
      equipment: equipment.getSnapshot(progressionSnapshot.stats),
      combat: engine?.getSnapshot() ?? null,
    };
  };

  const getPersistentState = () => Object.freeze({
    chapterNumber: chapter.number,
    unlockedChapter,
    mode,
    bossUnlocked,
    progression: progression.getPersistentState(),
    equipment: equipment.getPersistentState(),
    combat: engine?.getPersistentState() ?? null,
  });

  const consumePresentationEvents = (): readonly CombatPresentationEvent[] => {
    const events = presentationEvents;
    presentationEvents = [];
    return events;
  };

  const pause = (): CombatEvent[] => {
    presentationEvents = [];
    return engine?.pause() ?? [];
  };

  const resume = (): CombatEvent[] => {
    presentationEvents = [];
    return engine?.resume() ?? [];
  };

  return {
    advance,
    consumePresentationEvents,
    pause,
    resume,
    startBreakthrough: () => {
      if (mode === 'farming' && !bossUnlocked) startEncounter(chapter.breakthrough, 'breakthrough');
    },
    startBoss: () => {
      if (mode === 'farming' && bossUnlocked) startEncounter(chapter.boss, 'boss');
    },
    equip: (itemId: string) => {
      equipment.equip(itemId);
      applyEquipmentProfile();
    },
    equipBest: () => {
      equipment.equipBest();
      applyEquipmentProfile();
    },
    dismantle: (itemId: string) => equipment.dismantle(itemId),
    getSnapshot,
    getPersistentState,
  };
};
