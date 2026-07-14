import { COMBAT_BALANCE } from '../balance';
import type { CombatBalance } from '../types';
import type { ChapterDefinition, EncounterDefinition, EncounterKind, EncounterVisual } from './campaignTypes';

const CHAPTER_NAMES = [
  'Whisperwood', 'Lantern Marsh', 'Bramble Burrow', 'Sunroot Grove',
  'Ember Ridge', 'Tideglass Shore', 'Moonmoss Hollow', 'Copper Canopy',
  'Mistbell Fen', 'Starfall Orchard', 'Thornwake Vale', 'Cinderpine Pass',
  'Gilded Thicket', 'Cloudfern Rise', 'Hollowbloom Garden', 'Crystalfall Grotto',
  'Galevine Cliffs', 'Silverreed Basin', 'Ashenwild Trail', 'Wispwater Crossing',
  'Verdant Spire', 'Duskpetal Fields', 'Saffron Hollow', 'Lumenwood Run',
  'Stormcap Heights', 'Mossfire Glade', 'Rainsong Ravine', 'Brightbriar Wilds',
  'Twilight Copse', 'Kingshade Vale', 'Auroroot Terrace', 'Frostfern Reach',
  'Dawnspark Basin', 'Crownleaf Sanctuary', 'Radiant Keep', 'Lightrest Summit',
] as const;

const ENCOUNTER_MULTIPLIERS: Readonly<Record<EncounterKind, number>> = Object.freeze({
  farming: 1,
  breakthrough: 2,
  boss: 3,
});

const VISUAL_STYLES: Readonly<Record<EncounterKind, Omit<EncounterVisual, 'name'>>> = Object.freeze({
  farming: Object.freeze({ color: 0x77c97a, accentColor: 0xc7f29a, scale: 1 }),
  breakthrough: Object.freeze({ color: 0xd69f57, accentColor: 0xffdf8c, scale: 1 }),
  boss: Object.freeze({ color: 0xb85678, accentColor: 0xffaac1, scale: 1.3 }),
});

const ENCOUNTER_SUFFIXES: Readonly<Record<EncounterKind, string>> = Object.freeze({
  farming: 'Sprig',
  breakthrough: 'Sentinel',
  boss: 'Warden',
});

export function createEncounterBalance(chapter: number, kind: EncounterKind): CombatBalance {
  const multiplier = ENCOUNTER_MULTIPLIERS[kind];

  return {
    ...COMBAT_BALANCE,
    player: { ...COMBAT_BALANCE.player },
    enemy: {
      ...COMBAT_BALANCE.enemy,
      maxHp: 72 + chapter * 3 * multiplier,
      damage: 2 + Math.floor(chapter / 12),
      attackIntervalMs: 1_300,
    },
  };
}

function createEncounter(chapter: number, chapterName: string, kind: EncounterKind): EncounterDefinition {
  const style = VISUAL_STYLES[kind];
  const balance = createEncounterBalance(chapter, kind);
  const enemyName = `${chapterName} ${ENCOUNTER_SUFFIXES[kind]}`;

  return Object.freeze({
    kind,
    visual: Object.freeze({
      name: enemyName,
      ...style,
    }),
    balance: Object.freeze({
      ...balance,
      player: Object.freeze(balance.player),
      enemy: Object.freeze({ ...balance.enemy, name: enemyName }),
    }),
  });
}

function createChapter(name: string, index: number): ChapterDefinition {
  const number = index + 1;

  return Object.freeze({
    number,
    name,
    backgroundColor: 0x17333f + index * 0x03070b,
    farming: createEncounter(number, name, 'farming'),
    breakthrough: createEncounter(number, name, 'breakthrough'),
    boss: createEncounter(number, name, 'boss'),
  });
}

export const CHAPTERS: readonly ChapterDefinition[] = Object.freeze(
  CHAPTER_NAMES.map(createChapter),
);

export function getChapter(number: number): ChapterDefinition {
  const chapter = CHAPTERS[number - 1];
  if (chapter === undefined) throw new Error(`Unknown chapter: ${number}`);

  return chapter;
}
