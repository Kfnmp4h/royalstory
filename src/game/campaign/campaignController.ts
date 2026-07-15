import { createCombatEngine } from '../combatEngine';
import type { CombatEngine, CombatEvent } from '../types';
import { CHAPTERS, getChapter } from './campaignDefinitions';
import type {
  CampaignController,
  CampaignMode,
  CampaignSnapshot,
  ChapterDefinition,
  EncounterDefinition,
} from './campaignTypes';

const activeModes: ReadonlySet<CampaignMode> = new Set(['farming', 'breakthrough', 'boss']);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const isNonEmptyString = (value: unknown): value is string => (
  typeof value === 'string' && value.trim().length > 0
);

const isPositiveNumber = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value) && value > 0
);

const isColor = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 0xffffff
);

const hasCombatant = (value: unknown, id: 'player' | 'enemy'): boolean => (
  isRecord(value)
  && value.id === id
  && isNonEmptyString(value.name)
  && isPositiveNumber(value.maxHp)
  && isPositiveNumber(value.damage)
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
): CampaignController => {
  if (!hasOrderedEncounters(chapters)) {
    throw new Error('Campaign must contain 36 ordered chapters');
  }

  let chapter = chapters === CHAPTERS ? getChapter(1) : chapters[0];
  let unlockedChapter = 1;
  let mode: CampaignMode = 'farming';
  let bossUnlocked = false;
  let encounter: EncounterDefinition | null;
  let engine: CombatEngine | null;

  const startEncounter = (definition: EncounterDefinition, nextMode: CampaignMode) => {
    encounter = definition;
    engine = createCombatEngine(definition.balance);
    mode = nextMode;
  };

  const returnToFarming = () => startEncounter(chapter.farming, 'farming');

  startEncounter(chapter.farming, 'farming');

  const advance = (elapsedMs: number): CombatEvent[] => {
    if (!activeModes.has(mode) || engine === null) return [];

    const events = engine.advance(elapsedMs);
    const death = events.find((event) => event.type === 'death');
    if (death === undefined || mode === 'farming') return events;

    if (mode === 'breakthrough') {
      if (death.actor === 'enemy') bossUnlocked = true;
      else bossUnlocked = false;
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
    chapter = chapters[unlockedChapter - 1];
    bossUnlocked = false;
    returnToFarming();
    return events;
  };

  const getSnapshot = (): CampaignSnapshot => ({
    mode,
    bossUnlocked,
    chapter,
    unlockedChapter,
    encounter,
    combat: engine?.getSnapshot() ?? null,
  });

  return {
    advance,
    pause: () => engine?.pause() ?? [],
    resume: () => engine?.resume() ?? [],
    startBreakthrough: () => {
      if (mode === 'farming' && !bossUnlocked) startEncounter(chapter.breakthrough, 'breakthrough');
    },
    startBoss: () => {
      if (mode === 'farming' && bossUnlocked) startEncounter(chapter.boss, 'boss');
    },
    getSnapshot,
  };
};
