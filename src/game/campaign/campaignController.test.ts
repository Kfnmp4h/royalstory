import { describe, expect, it } from 'vitest';
import { CHAPTERS } from './campaignDefinitions';
import { createCampaignController as createCampaignControllerRuntime } from './campaignController';
import type { CampaignControllerOptions, ChapterDefinition } from './campaignTypes';

const createCampaignController = (
  chapters: readonly ChapterDefinition[] = CHAPTERS,
  options: CampaignControllerOptions = {},
) => createCampaignControllerRuntime(chapters, {
  combatRandom: () => 0.5,
  equipmentRandom: () => 0.999_999,
  ...options,
});

const scriptedRandom = (...values: number[]) => {
  let index = 0;
  return () => {
    if (index >= values.length) throw new Error('Scripted equipment random exhausted');
    return values[index++];
  };
};

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
  it('restores a persisted farming campaign without losing progression or equipment', () => {
    const original = createCampaignController(CHAPTERS, {
      equipmentRandom: scriptedRandom(0, 0, 0, 0),
    });
    original.advance(900);
    const persisted = original.getPersistentState!();

    const restored = createCampaignController(CHAPTERS, { initialState: persisted });
    expect(restored.getSnapshot()).toMatchObject({
      chapter: { number: persisted.chapterNumber },
      mode: persisted.mode,
      progression: persisted.progression,
      equipment: { inventory: persisted.equipment.inventory },
    });
  });

  it('starts with an immutable empty equipment snapshot', () => {
    const equipment = createCampaignController().getSnapshot().equipment;
    expect(equipment.inventory).toEqual([]);
    expect(Object.values(equipment.equipped).every((item) => item === null)).toBe(true);
    expect(equipment).toMatchObject({
      latestDrop: null,
      equipmentPower: 0,
      heroPower: 256,
      effectiveStats: { attack: 18, defense: 2, maxHp: 120 },
    });
    expect(Object.isFrozen(equipment)).toBe(true);
  });

  it('routes combat randomness through the injected campaign source', () => {
    let randomCalls = 0;
    const campaign = createCampaignController(CHAPTERS, {
      combatRandom: () => {
        randomCalls += 1;
        return 0.5;
      },
    });
    campaign.advance(900);
    expect(randomCalls).toBe(2);
  });

  it('rolls equipment exactly once per farming enemy death and never while paused', () => {
    const chapters = withEncounterBalance('farming', {
      ...CHAPTERS[0].farming.balance,
      player: { ...CHAPTERS[0].farming.balance.player, attackIntervalMs: 100 },
      enemy: { ...CHAPTERS[0].farming.balance.enemy, maxHp: 1 },
    });
    let equipmentRandomCalls = 0;
    const campaign = createCampaignController(chapters, {
      equipmentRandom: () => {
        equipmentRandomCalls += 1;
        return 0.999_999;
      },
    });
    expect(campaign.advance(100)).toContainEqual({ type: 'death', actor: 'enemy' });
    expect(equipmentRandomCalls).toBe(1);
    campaign.pause();
    campaign.advance(60_000);
    expect(equipmentRandomCalls).toBe(1);
    expect(campaign.getSnapshot().equipment.inventory).toEqual([]);
  });

  it('generates a farming drop at the post-XP level from the same death', () => {
    const chapters = withEncounterBalance('farming', {
      ...CHAPTERS[0].farming.balance,
      player: { ...CHAPTERS[0].farming.balance.player, attackIntervalMs: 100 },
      enemy: { ...CHAPTERS[0].farming.balance.enemy, maxHp: 1 },
    });
    const campaign = createCampaignController(chapters, {
      equipmentRandom: scriptedRandom(0.999_999, 0.999_999, 0.999_999, 0.999_999, 0, 0, 0, 0, 0),
    });
    for (let defeated = 0; defeated < 5; defeated += 1) {
      campaign.advance(100);
      if (defeated < 4) campaign.advance(1_200);
    }
    expect(campaign.getSnapshot()).toMatchObject({
      progression: { level: 2, xp: 0, totalXp: 50 },
      equipment: {
        latestDrop: { id: 'item-1', level: 2, rarity: 'Normal', slot: 'Hat' },
        inventory: [{ id: 'item-1', level: 2 }],
      },
    });
  });

  it('routes guaranteed breakthrough and boss drops through their rarity tables', () => {
    const chapters = CHAPTERS.map((chapter) => ({
      ...chapter,
      farming: { ...chapter.farming, balance: {
        ...chapter.farming.balance,
        player: { ...chapter.farming.balance.player, attackIntervalMs: 100 },
        enemy: { ...chapter.farming.balance.enemy, maxHp: 1 },
      } },
      breakthrough: { ...chapter.breakthrough, balance: {
        ...chapter.breakthrough.balance,
        player: { ...chapter.breakthrough.balance.player, attackIntervalMs: 100 },
        enemy: { ...chapter.breakthrough.balance.enemy, maxHp: 1 },
      } },
      boss: { ...chapter.boss, balance: {
        ...chapter.boss.balance,
        player: { ...chapter.boss.balance.player, attackIntervalMs: 100 },
        enemy: { ...chapter.boss.balance.enemy, maxHp: 1 },
      } },
    }));
    const campaign = createCampaignController(chapters, {
      equipmentRandom: scriptedRandom(
        0.3, 0, 0, 0,
        0.3, 0, 0, 0, 0,
      ),
    });
    campaign.startBreakthrough();
    campaign.advance(100);
    expect(campaign.getSnapshot()).toMatchObject({
      bossUnlocked: true,
      equipment: { inventory: [{ id: 'item-1', rarity: 'Normal', level: 1 }] },
    });
    campaign.startBoss();
    campaign.advance(100);
    expect(campaign.getSnapshot().equipment.inventory).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'item-1', rarity: 'Normal' }),
      expect.objectContaining({ id: 'item-2', rarity: 'Rare', level: 3 }),
    ]));
  });

  it('does not roll equipment when the player dies', () => {
    const chapters = withEncounterBalance('breakthrough', {
      ...CHAPTERS[0].breakthrough.balance,
      player: { ...CHAPTERS[0].breakthrough.balance.player, attackIntervalMs: 1_000 },
      enemy: { ...CHAPTERS[0].breakthrough.balance.enemy, attack: 122, attackIntervalMs: 100 },
    });
    let equipmentRandomCalls = 0;
    const campaign = createCampaignController(chapters, {
      equipmentRandom: () => {
        equipmentRandomCalls += 1;
        return 0;
      },
    });
    campaign.startBreakthrough();
    expect(campaign.advance(100)).toContainEqual({ type: 'death', actor: 'player' });
    expect(equipmentRandomCalls).toBe(0);
    expect(campaign.getSnapshot().equipment.inventory).toEqual([]);
  });

  it('equips an inventory item live without resetting combat or pause state', () => {
    const chapters = withEncounterBalance('breakthrough', {
      ...CHAPTERS[0].breakthrough.balance,
      player: { ...CHAPTERS[0].breakthrough.balance.player, attackIntervalMs: 100 },
      enemy: { ...CHAPTERS[0].breakthrough.balance.enemy, maxHp: 1 },
    });
    const campaign = createCampaignController(chapters, {
      equipmentRandom: scriptedRandom(0, 0, 0, 0),
    });
    campaign.startBreakthrough();
    campaign.advance(100);
    const item = campaign.getSnapshot().equipment.inventory[0];
    campaign.advance(450);
    campaign.pause();
    const before = campaign.getSnapshot();
    campaign.equip(item.id);
    const after = campaign.getSnapshot();
    expect(after).toMatchObject({
      mode: before.mode,
      chapter: { number: before.chapter.number },
      combat: {
        paused: true,
        phase: before.combat?.phase,
        activeRuntimeMs: before.combat?.activeRuntimeMs,
        totalAttacks: before.combat?.totalAttacks,
        enemy: { hp: before.combat?.enemy.hp },
      },
      equipment: {
        inventory: [],
        equipped: { Hat: { id: item.id } },
      },
    });
    expect(after.combat!.player.attack).toBeGreaterThan(after.progression.stats.attack);
    expect(after.combat!.player.maxHp).toBeGreaterThan(after.progression.stats.maxHp);
  });

  it('applies Equip Best and rejects invalid equip atomically', () => {
    const chapters = withEncounterBalance('breakthrough', {
      ...CHAPTERS[0].breakthrough.balance,
      player: { ...CHAPTERS[0].breakthrough.balance.player, attackIntervalMs: 100 },
      enemy: { ...CHAPTERS[0].breakthrough.balance.enemy, maxHp: 1 },
    });
    const campaign = createCampaignController(chapters, {
      equipmentRandom: scriptedRandom(0, 0, 0, 0),
    });
    campaign.startBreakthrough();
    campaign.advance(100);
    campaign.equipBest();
    expect(campaign.getSnapshot().equipment.equipped.Hat).not.toBeNull();
    const before = campaign.getSnapshot();
    expect(() => campaign.equip('missing')).toThrow('Inventory item not found');
    expect(campaign.getSnapshot()).toEqual(before);
  });

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

  it('returns legacy combat events while draining only the latest transient presentation batch', () => {
    const chapters = withEncounterBalance('farming', {
      ...CHAPTERS[0].farming.balance,
      player: { ...CHAPTERS[0].farming.balance.player, attackIntervalMs: 100 },
      enemy: { ...CHAPTERS[0].farming.balance.enemy, attackIntervalMs: 1_000 },
    });
    const campaign = createCampaignController(chapters);

    expect(campaign.advance(100)).toEqual([
      { type: 'attack', attacker: 'player', target: 'enemy' },
      { type: 'damage', target: 'enemy', amount: 18, hp: 57 },
    ]);
    expect(campaign.advance(100)).toEqual([
      { type: 'attack', attacker: 'player', target: 'enemy' },
      { type: 'damage', target: 'enemy', amount: 18, hp: 39 },
    ]);
    expect(campaign.consumePresentationEvents!()).toEqual([
      { type: 'attack_started', actorId: 'player', targetId: 'enemy', timestampMs: 200 },
      { type: 'hit_landed', actorId: 'player', targetId: 'enemy', damage: 18, critical: false, resultingHealth: 39, timestampMs: 200 },
      { type: 'health_changed', actorId: 'player', targetId: 'enemy', resultingHealth: 39, timestampMs: 200 },
    ]);
    expect(campaign.consumePresentationEvents!()).toEqual([]);
    expect(JSON.stringify(campaign.getPersistentState!())).not.toContain('presentationEvents');
  });

  it('clears stale presentation batches when pausing or resuming', () => {
    const chapters = withEncounterBalance('farming', {
      ...CHAPTERS[0].farming.balance,
      player: { ...CHAPTERS[0].farming.balance.player, attackIntervalMs: 100 },
      enemy: { ...CHAPTERS[0].farming.balance.enemy, attackIntervalMs: 1_000 },
    });
    const campaign = createCampaignController(chapters);

    campaign.advance(100);
    campaign.pause();
    expect(campaign.consumePresentationEvents!()).toEqual([]);

    campaign.resume();
    campaign.advance(100);
    campaign.resume();
    expect(campaign.consumePresentationEvents!()).toEqual([]);
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
