import { describe, expect, it } from 'vitest';
import { CHAPTERS } from './campaignDefinitions';
import { createCampaignController as createCampaignControllerRuntime } from './campaignController';

const createCampaignController = () => createCampaignControllerRuntime(
  CHAPTERS,
  { combatRandom: () => 0.5, equipmentRandom: () => 0.999_999 },
);

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
});
