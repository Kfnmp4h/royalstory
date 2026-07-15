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
    expect(campaign.getSnapshot()).toMatchObject({ mode: 'farming', bossUnlocked: false, unlockedChapter: 1, chapter: { number: 1 } });
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

  it('awards farming XP once per enemy death and none while paused', () => {
    const chapters = CHAPTERS.map((chapter) => ({
      ...chapter,
      farming: {
        ...chapter.farming,
        balance: {
          ...chapter.farming.balance,
          player: { ...chapter.farming.balance.player, attackIntervalMs: 100 },
          enemy: { ...chapter.farming.balance.enemy, maxHp: 1 },
        },
      },
    }));
    const campaign = createCampaignController(chapters);
    expect(campaign.advance(100)).toContainEqual({ type: 'death', actor: 'enemy' });
    expect(campaign.getSnapshot().progression).toMatchObject({ level: 1, xp: 10, totalXp: 10 });
    campaign.pause();
    campaign.advance(60_000);
    expect(campaign.getSnapshot().progression.totalXp).toBe(10);
  });

  it('awards breakthrough and boss XP before starting the next encounter', () => {
    const chapters = CHAPTERS.map((chapter) => ({
      ...chapter,
      breakthrough: {
        ...chapter.breakthrough,
        balance: {
          ...chapter.breakthrough.balance,
          player: { ...chapter.breakthrough.balance.player, attackIntervalMs: 100 },
          enemy: { ...chapter.breakthrough.balance.enemy, maxHp: 1 },
        },
      },
      boss: {
        ...chapter.boss,
        balance: {
          ...chapter.boss.balance,
          player: { ...chapter.boss.balance.player, attackIntervalMs: 100 },
          enemy: { ...chapter.boss.balance.enemy, maxHp: 1 },
        },
      },
    }));
    const campaign = createCampaignController(chapters);
    campaign.startBreakthrough();
    campaign.advance(100);
    expect(campaign.getSnapshot()).toMatchObject({
      mode: 'farming', bossUnlocked: true, progression: { xp: 40, totalXp: 40 },
      combat: { player: { attack: 18 } },
    });
    campaign.startBoss();
    campaign.advance(100);
    expect(campaign.getSnapshot()).toMatchObject({
      chapter: { number: 2 },
      progression: { level: 3, xp: 15, totalXp: 140, stats: { attack: 22, defense: 4, maxHp: 136 } },
      combat: { player: { attack: 22, defense: 4, maxHp: 136 } },
    });
  });

  it('gives no XP for player death', () => {
    const chapters = CHAPTERS.map((chapter) => ({
      ...chapter,
      farming: {
        ...chapter.farming,
        balance: {
          ...chapter.farming.balance,
          enemy: { ...chapter.farming.balance.enemy, attack: 10_000, attackIntervalMs: 100 },
        },
      },
    }));
    const campaign = createCampaignController(chapters);
    campaign.advance(100);
    expect(campaign.getSnapshot().progression.totalXp).toBe(0);
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

    const invalidAttack = CHAPTERS.map((chapter) => ({ ...chapter }));
    invalidAttack[0] = {
      ...invalidAttack[0],
      farming: {
        ...invalidAttack[0].farming,
        balance: {
          ...invalidAttack[0].farming.balance,
          player: { ...invalidAttack[0].farming.balance.player, attack: 0 },
        },
      },
    };

    const invalidDefense = CHAPTERS.map((chapter) => ({ ...chapter }));
    invalidDefense[0] = {
      ...invalidDefense[0],
      boss: {
        ...invalidDefense[0].boss,
        balance: {
          ...invalidDefense[0].boss.balance,
          enemy: { ...invalidDefense[0].boss.balance.enemy, defense: -1 },
        },
      },
    };

    for (const invalidCampaign of [
      wrongEncounterKind,
      missingVisual,
      malformedBalance,
      invalidAttack,
      invalidDefense,
    ]) {
      expect(() => createCampaignController(invalidCampaign)).toThrow(
        new Error('Campaign must contain 36 ordered chapters'),
      );
    }
  });

  it('returns a won breakthrough to farming with the boss unlocked and keeps farming active', () => {
    const campaign = createCampaignController(withEncounterBalance('breakthrough', {
      ...CHAPTERS[0].breakthrough.balance,
      player: { ...CHAPTERS[0].breakthrough.balance.player, attack: 10_000, attackIntervalMs: 100 },
    }));
    campaign.startBreakthrough();
    advanceUntil(campaign, () => campaign.getSnapshot().bossUnlocked);

    expect(campaign.getSnapshot()).toMatchObject({
      mode: 'farming', bossUnlocked: true, encounter: { kind: 'farming' }, combat: { phase: 'fighting' },
    });
    const runtimeBefore = campaign.getSnapshot().combat!.activeRuntimeMs;
    campaign.advance(100);
    expect(campaign.getSnapshot().combat!.activeRuntimeMs).toBeGreaterThan(runtimeBefore);
  });

  it('keeps farming after an enemy death and resumes the encounter normally', () => {
    const campaign = createCampaignController(withEncounterBalance('farming', {
      ...CHAPTERS[0].farming.balance,
      player: { ...CHAPTERS[0].farming.balance.player, attackIntervalMs: 100 },
      enemy: { ...CHAPTERS[0].farming.balance.enemy, maxHp: 1 },
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
      enemy: { ...CHAPTERS[0].breakthrough.balance.enemy, attack: 120, attackIntervalMs: 100 },
    }));
    campaign.startBreakthrough();
    advanceUntil(campaign, () => campaign.getSnapshot().mode === 'farming');

    expect(campaign.getSnapshot()).toMatchObject({
      mode: 'farming',
      bossUnlocked: false,
      chapter: { number: 1 },
      encounter: { kind: 'farming' },
    });
  });

  it('moves a won boss to the next chapter farming and clears the boss unlock', () => {
    const campaign = createCampaignController();
    campaign.startBreakthrough();
    advanceUntil(campaign, () => campaign.getSnapshot().bossUnlocked);
    campaign.startBoss();
    advanceUntil(campaign, () => campaign.getSnapshot().chapter.number === 2);

    expect(campaign.getSnapshot()).toMatchObject({
      mode: 'farming',
      bossUnlocked: false,
      unlockedChapter: 2,
      chapter: { number: 2 },
      encounter: { kind: 'farming' },
    });
  });

  it('keeps the boss unlocked after a boss loss and only starts a boss from unlocked farming', () => {
    const chapters = CHAPTERS.map((chapter) => ({
      ...chapter,
      breakthrough: {
        ...chapter.breakthrough,
        balance: {
          ...chapter.breakthrough.balance,
          player: { ...chapter.breakthrough.balance.player, attack: 10_000, attackIntervalMs: 100 },
        },
      },
      boss: {
        ...chapter.boss,
        balance: {
          ...chapter.boss.balance,
          enemy: { ...chapter.boss.balance.enemy, attack: 120, attackIntervalMs: 100 },
        },
      },
    }));
    const campaign = createCampaignController(chapters);
    campaign.startBoss();
    expect(campaign.getSnapshot()).toMatchObject({ mode: 'farming', bossUnlocked: false });
    campaign.startBreakthrough();
    advanceUntil(campaign, () => campaign.getSnapshot().bossUnlocked);
    campaign.startBoss();
    advanceUntil(campaign, () => campaign.getSnapshot().mode === 'farming');

    expect(campaign.getSnapshot()).toMatchObject({ mode: 'farming', bossUnlocked: true });
  });

  it('keeps both start commands idempotent while a boss is active', () => {
    const campaign = createCampaignController();
    campaign.startBreakthrough();
    advanceUntil(campaign, () => campaign.getSnapshot().bossUnlocked);
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
          player: { ...chapter.farming.balance.player, attack: 10_000, attackIntervalMs: 100 },
        },
      },
      breakthrough: {
        ...chapter.breakthrough,
        balance: {
          ...chapter.breakthrough.balance,
          player: { ...chapter.breakthrough.balance.player, attack: 10_000, attackIntervalMs: 100 },
        },
      },
      boss: {
        ...chapter.boss,
        balance: {
          ...chapter.boss.balance,
          player: { ...chapter.boss.balance.player, attack: 10_000, attackIntervalMs: 100 },
        },
      },
    }));
    const campaign = createCampaignController(instantVictoryChapters);
    for (let chapter = 1; chapter < 36; chapter += 1) {
      campaign.startBreakthrough();
      advanceUntil(campaign, () => campaign.getSnapshot().bossUnlocked);
      campaign.startBoss();
      advanceUntil(campaign, () => campaign.getSnapshot().chapter.number === chapter + 1);
    }
    campaign.startBreakthrough();
    advanceUntil(campaign, () => campaign.getSnapshot().bossUnlocked);
    campaign.startBoss();
    advanceUntil(campaign, () => campaign.getSnapshot().mode === 'campaign-complete');

    const complete = campaign.getSnapshot();
    expect(complete).toMatchObject({ mode: 'campaign-complete', bossUnlocked: false, unlockedChapter: 36, chapter: { number: 36 }, encounter: null, combat: null });
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
    advanceUntil(campaign, () => campaign.getSnapshot().bossUnlocked);
    campaign.startBreakthrough();
    expect(campaign.getSnapshot()).toMatchObject({ mode: 'farming', bossUnlocked: true });
  });
});
