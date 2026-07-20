import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCampaignController } from './campaignController';
import { CHAPTERS } from './campaignDefinitions';

const deterministicTestChapters = CHAPTERS.map((chapter) => ({
  ...chapter,
  farming: {
    ...chapter.farming,
    balance: {
      ...chapter.farming.balance,
      player: { ...chapter.farming.balance.player, attackIntervalMs: 100 },
      enemy: { ...chapter.farming.balance.enemy, attackIntervalMs: 1_000, maxHp: 10_000 },
    },
  },
}));

afterEach(() => vi.restoreAllMocks());

describe('campaign combat determinism', () => {
  it('keeps independently created client and server campaigns in the same combat state', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0);

    const client = createCampaignController(deterministicTestChapters);
    const server = createCampaignController(deterministicTestChapters);

    client.advance(100);
    server.advance(100);

    expect(client.getPersistentState()).toEqual(server.getPersistentState());
  });
});
