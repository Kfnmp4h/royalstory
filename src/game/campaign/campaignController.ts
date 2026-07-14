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

const hasOrderedEncounters = (chapters: readonly ChapterDefinition[]): boolean => (
  chapters.length === 36
  && chapters.every((chapter, index) => (
    chapter?.number === index + 1
    && chapter.farming != null
    && chapter.breakthrough != null
    && chapter.boss != null
  ))
);

export const createCampaignController = (
  chapters: readonly ChapterDefinition[] = CHAPTERS,
): CampaignController => {
  if (!hasOrderedEncounters(chapters)) {
    throw new Error('Campaign must contain 36 ordered chapters');
  }

  let chapter = chapters === CHAPTERS ? getChapter(1) : chapters[0];
  let unlockedChapter = 1;
  let mode: CampaignMode = 'farming';
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
      if (death.actor === 'enemy') mode = 'boss-ready';
      else returnToFarming();
      return events;
    }

    if (death.actor === 'player') {
      returnToFarming();
      return events;
    }

    if (chapter.number === 36) {
      mode = 'campaign-complete';
      encounter = null;
      engine = null;
      return events;
    }

    unlockedChapter = chapter.number + 1;
    chapter = chapters[unlockedChapter - 1];
    returnToFarming();
    return events;
  };

  const getSnapshot = (): CampaignSnapshot => ({
    mode,
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
      if (mode === 'farming') startEncounter(chapter.breakthrough, 'breakthrough');
    },
    startBoss: () => {
      if (mode === 'boss-ready') startEncounter(chapter.boss, 'boss');
    },
    getSnapshot,
  };
};
