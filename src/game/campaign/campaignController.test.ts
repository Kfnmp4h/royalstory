import { describe, expect, it } from 'vitest';
import { CHAPTERS } from './campaignDefinitions';
import { createCampaignController } from './campaignController';
import type { ChapterDefinition } from './campaignTypes';

const advanceUntil = (
  campaign: ReturnType<typeof createCampaignController>,
  predicate: () => boolean,
) => {
  for (let tick = 0; tick < 20_000 && !predicate(); tick += 1) campaign.advance(100);
  expect(predicate()).toBe(true);
};

const withEncounterBalance = (
  kind: 'farming' | 'breakthrough' | 'boss',
  balance: ChapterDefinition['farming']['balance'],
): readonly ChapterDefinition[] => CHAPTERS.map((chapter) => ({
  ...chapter,
  [kind]: { ...chapter[kind], balance },
}));

describe('createCampaignController', () => {
  it('starts in chapter one farming and permits exactly one breakthrough command', () => {
    const campaign = createCampaignController();
    expect(campaign.getSnapshot()).toMatchObject({ mode: 'farming', unlockedChapter: 1, chapter: { number: 1 } });
    campaign.startBreakthrough();
    expect(campaign.getSnapshot()).toMatchObject({ mode: 'breakthrough', encounter: { kind: 'breakthrough' } });
    campaign.startBreakthrough();
    expect(campaign.getSnapshot().mode).toBe('breakthrough');
  });

  it('does not advance combat or campaign while paused', () => {
    const campaign = createCampaignController();
    campaign.pause();
    campaign.advance(60_000);
    expect(campaign.getSnapshot()).toMatchObject({ mode: 'farming', combat: { activeRuntimeMs: 0, paused: true } });
  });

  it('rejects malformed campaign definitions before a battle starts', () => {
    expect(() => createCampaignController([])).toThrow('Campaign must contain 36 ordered chapters');
    expect(() => createCampaignController(new Array<ChapterDefinition>(36))).toThrow(
      new Error('Campaign must contain 36 ordered chapters'),
    );
    const missingBoss = CHAPTERS.map((chapter) => ({ ...chapter }));
    missingBoss[0] = { ...missingBoss[0], boss: null as unknown as ChapterDefinition['boss'] };
    expect(() => createCampaignController(missingBoss)).toThrow('Campaign must contain 36 ordered chapters');
  });

  it('rejects malformed encounter definitions before a battle starts', () => {
    const wrongEncounterKind = CHAPTERS.map((chapter) => ({ ...chapter }));
    wrongEncounterKind[0] = {
      ...wrongEncounterKind[0],
      farming: { ...wrongEncounterKind[0].farming, kind: 'boss' },
    };

    const missingVisual = CHAPTERS.map((chapter) => ({ ...chapter }));
    missingVisual[0] = {
      ...missingVisual[0],
      breakthrough: { ...missingVisual[0].breakthrough, visual: undefined as unknown as ChapterDefinition['breakthrough']['visual'] },
    };

    const malformedBalance = CHAPTERS.map((chapter) => ({ ...chapter }));
    malformedBalance[0] = {
      ...malformedBalance[0],
      boss: {
        ...malformedBalance[0].boss,
        balance: {
          ...malformedBalance[0].boss.balance,
          enemy: { ...malformedBalance[0].boss.balance.enemy, maxHp: Number.NaN },
        },
      },
    };

    for (const invalidCampaign of [wrongEncounterKind, missingVisual, malformedBalance]) {
      expect(() => createCampaignController(invalidCampaign)).toThrow(
        new Error('Campaign must contain 36 ordered chapters'),
      );
    }
  });

  it('moves a won breakthrough to boss-ready without forwarding further combat', () => {
    const campaign = createCampaignController();
    campaign.startBreakthrough();
    advanceUntil(campaign, () => campaign.getSnapshot().mode === 'boss-ready');

    const ready = campaign.getSnapshot();
    expect(ready).toMatchObject({ mode: 'boss-ready', encounter: { kind: 'breakthrough' } });
    expect(campaign.advance(60_000)).toEqual([]);
    expect(campaign.getSnapshot()).toEqual(ready);
  });

  it('keeps farming after an enemy death and resumes the encounter normally', () => {
    const campaign = createCampaignController(withEncounterBalance('farming', {
      ...CHAPTERS[0].farming.balance,
      player: { ...CHAPTERS[0].farming.balance.player, damage: 10_000, attackIntervalMs: 100 },
    }));

    expect(campaign.advance(100)).toContainEqual({ type: 'death', actor: 'enemy' });
    expect(campaign.getSnapshot()).toMatchObject({ mode: 'farming', combat: { phase: 'enemy-defeated' } });
    expect(campaign.advance(1_200)).toContainEqual({ type: 'respawn', actor: 'enemy' });
    expect(campaign.getSnapshot()).toMatchObject({ mode: 'farming', combat: { phase: 'fighting' } });
    expect(campaign.advance(100)).toContainEqual({ type: 'death', actor: 'enemy' });
  });

  it('returns a lost breakthrough to farming in the same chapter', () => {
    const campaign = createCampaignController(withEncounterBalance('breakthrough', {
      ...CHAPTERS[0].breakthrough.balance,
      enemy: { ...CHAPTERS[0].breakthrough.balance.enemy, damage: 120, attackIntervalMs: 100 },
    }));
    campaign.startBreakthrough();
    advanceUntil(campaign, () => campaign.getSnapshot().mode === 'farming');

    expect(campaign.getSnapshot()).toMatchObject({
      mode: 'farming',
      chapter: { number: 1 },
      encounter: { kind: 'farming' },
    });
  });

  it('moves a won boss to the next chapter farming and raises the unlock', () => {
    const campaign = createCampaignController();
    campaign.startBreakthrough();
    advanceUntil(campaign, () => campaign.getSnapshot().mode === 'boss-ready');
    campaign.startBoss();
    advanceUntil(campaign, () => campaign.getSnapshot().chapter.number === 2);

    expect(campaign.getSnapshot()).toMatchObject({
      mode: 'farming',
      unlockedChapter: 2,
      chapter: { number: 2 },
      encounter: { kind: 'farming' },
    });
  });

  it('returns a lost boss to farming in the same chapter', () => {
    const campaign = createCampaignController(withEncounterBalance('boss', {
      ...CHAPTERS[0].boss.balance,
      enemy: { ...CHAPTERS[0].boss.balance.enemy, damage: 120, attackIntervalMs: 100 },
    }));
    campaign.startBreakthrough();
    advanceUntil(campaign, () => campaign.getSnapshot().mode === 'boss-ready');
    campaign.startBoss();
    advanceUntil(campaign, () => campaign.getSnapshot().mode === 'farming');

    expect(campaign.getSnapshot()).toMatchObject({
      mode: 'farming',
      chapter: { number: 1 },
      encounter: { kind: 'farming' },
    });
  });

  it('keeps both start commands idempotent while a boss is active', () => {
    const campaign = createCampaignController();
    campaign.startBreakthrough();
    advanceUntil(campaign, () => campaign.getSnapshot().mode === 'boss-ready');
    campaign.startBoss();
    const boss = campaign.getSnapshot();

    campaign.startBreakthrough();
    campaign.startBoss();

    expect(campaign.getSnapshot()).toEqual(boss);
    expect(campaign.getSnapshot().mode).toBe('boss');
  });

  it('completes after the final boss and ignores future commands and advancement', () => {
    const instantVictoryChapters = CHAPTERS.map((chapter) => ({
      ...chapter,
      farming: {
        ...chapter.farming,
        balance: {
          ...chapter.farming.balance,
          player: { ...chapter.farming.balance.player, damage: 10_000, attackIntervalMs: 100 },
        },
      },
      breakthrough: {
        ...chapter.breakthrough,
        balance: {
          ...chapter.breakthrough.balance,
          player: { ...chapter.breakthrough.balance.player, damage: 10_000, attackIntervalMs: 100 },
        },
      },
      boss: {
        ...chapter.boss,
        balance: {
          ...chapter.boss.balance,
          player: { ...chapter.boss.balance.player, damage: 10_000, attackIntervalMs: 100 },
        },
      },
    }));
    const campaign = createCampaignController(instantVictoryChapters);
    for (let chapter = 1; chapter < 36; chapter += 1) {
      campaign.startBreakthrough();
      advanceUntil(campaign, () => campaign.getSnapshot().mode === 'boss-ready');
      campaign.startBoss();
      advanceUntil(campaign, () => campaign.getSnapshot().chapter.number === chapter + 1);
    }
    campaign.startBreakthrough();
    advanceUntil(campaign, () => campaign.getSnapshot().mode === 'boss-ready');
    campaign.startBoss();
    advanceUntil(campaign, () => campaign.getSnapshot().mode === 'campaign-complete');

    const complete = campaign.getSnapshot();
    expect(complete).toMatchObject({ mode: 'campaign-complete', unlockedChapter: 36, chapter: { number: 36 }, encounter: null, combat: null });
    campaign.startBreakthrough();
    campaign.startBoss();
    expect(campaign.advance(60_000)).toEqual([]);
    expect(campaign.getSnapshot()).toEqual(complete);
  });

  it('makes invalid commands idempotent and returns fresh outer snapshots', () => {
    const campaign = createCampaignController();
    const initial = campaign.getSnapshot();
    campaign.startBoss();
    expect(campaign.getSnapshot()).toEqual(initial);
    expect(campaign.getSnapshot()).not.toBe(initial);

    campaign.startBreakthrough();
    campaign.startBoss();
    expect(campaign.getSnapshot().mode).toBe('breakthrough');
    advanceUntil(campaign, () => campaign.getSnapshot().mode === 'boss-ready');
    campaign.startBreakthrough();
    expect(campaign.getSnapshot().mode).toBe('boss-ready');
  });
});
