import { describe, expect, it } from 'vitest';
import { CHAPTERS } from './campaignDefinitions';
import { createCampaignController as createCampaignControllerRuntime } from './campaignController';

const createCampaignController = () => createCampaignControllerRuntime(
  CHAPTERS,
  { combatRandom: () => 0.5, equipmentRandom: () => 0.999_999 },
);

const getOwnedItemIds = (campaign: ReturnType<typeof createCampaignController>): string[] => {
  const equipment = campaign.getSnapshot().equipment;
  return [
    ...equipment.inventory.map((item) => item.id),
    ...Object.values(equipment.equipped).flatMap((item) => item ? [item.id] : []),
  ];
};

const advanceUntil = (
  campaign: ReturnType<typeof createCampaignController>,
  predicate: () => boolean,
) => {
  for (let tick = 0; tick < 20_000 && !predicate(); tick += 1) campaign.advance(100);
  expect(predicate()).toBe(true);
};

describe('campaign journey', () => {
  it('lets the deterministic test profile complete chapters 1 through 36', () => {
    const campaign = createCampaignController();

    for (let chapter = 1; chapter <= 36; chapter += 1) {
      campaign.startBreakthrough();
      advanceUntil(campaign, () => campaign.getSnapshot().bossUnlocked);
      expect(campaign.getSnapshot().mode).toBe('farming');
      campaign.startBoss();
      advanceUntil(campaign, () => campaign.getSnapshot().mode !== 'boss');

      const snapshot = campaign.getSnapshot();
      if (chapter < 36) {
        expect(snapshot).toMatchObject({
          mode: 'farming',
          bossUnlocked: false,
          chapter: { number: chapter + 1 },
        });
      }
    }

    expect(campaign.getSnapshot()).toMatchObject({ mode: 'campaign-complete', bossUnlocked: false });
    expect(campaign.getSnapshot().equipment.inventory.length).toBeGreaterThan(0);
  });

  it('keeps equipment and combat state healthy through ten simulated minutes', () => {
    const campaign = createCampaignControllerRuntime(
      CHAPTERS,
      { combatRandom: () => 0.5, equipmentRandom: () => 0 },
    );
    let previouslyOwned = new Set<string>();
    let xpAtNineMinutes = 0;

    for (let tick = 1; tick <= 6_000; tick += 1) {
      campaign.advance(100);
      if (tick % 100 !== 0) continue;
      campaign.equipBest();

      const snapshot = campaign.getSnapshot();
      const ownedIds = getOwnedItemIds(campaign);
      const currentOwned = new Set(ownedIds);
      expect(currentOwned.size).toBe(ownedIds.length);
      for (const itemId of previouslyOwned) expect(currentOwned.has(itemId)).toBe(true);
      previouslyOwned = currentOwned;

      if (snapshot.combat) {
        expect(Number.isFinite(snapshot.combat.player.hp)).toBe(true);
        expect(snapshot.combat.player.hp).toBeGreaterThanOrEqual(0);
        expect(snapshot.combat.player.hp).toBeLessThanOrEqual(snapshot.combat.player.maxHp);
        expect(Number.isFinite(snapshot.combat.enemy.hp)).toBe(true);
        expect(snapshot.combat.enemy.hp).toBeGreaterThanOrEqual(0);
        expect(snapshot.combat.enemy.hp).toBeLessThanOrEqual(snapshot.combat.enemy.maxHp);
      }
      if (tick === 5_400) xpAtNineMinutes = snapshot.progression.totalXp;
    }

    const finalSnapshot = campaign.getSnapshot();
    expect(finalSnapshot.progression.totalXp).toBeGreaterThan(xpAtNineMinutes);
    expect(previouslyOwned.size).toBeGreaterThan(0);
  }, 15_000);
});
