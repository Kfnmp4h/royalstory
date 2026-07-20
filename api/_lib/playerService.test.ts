import { describe, expect, it } from 'vitest';
import { createCampaignController } from '../../src/game/campaign/campaignController';
import { createInitialPlayerSaveState } from '../../src/game/save/saveCodec';
import type { PlayerSaveState } from '../../src/game/save/saveTypes';
import type { PlayerRecord, PlayerRepository } from './playerRepository';
import { createPlayerService } from './playerService';

const createBossUnlockedState = (): PlayerSaveState => {
  const initial = createInitialPlayerSaveState();
  const campaign = createCampaignController(undefined, { initialState: initial.campaign });
  campaign.startBreakthrough();
  for (let tick = 0; tick < 20_000 && !campaign.getSnapshot().bossUnlocked; tick += 1) {
    campaign.advance(100);
  }
  expect(campaign.getSnapshot().bossUnlocked).toBe(true);
  return Object.freeze({ ...initial, campaign: campaign.getPersistentState() });
};

const createBossState = (): PlayerSaveState => {
  const state = createBossUnlockedState();
  const campaign = createCampaignController(undefined, { initialState: state.campaign });
  campaign.startBoss();
  return Object.freeze({ ...state, campaign: campaign.getPersistentState() });
};

const createRepository = (state: PlayerSaveState, lastActivityAt: string, saveVersion = 0): PlayerRepository => {
  let record: PlayerRecord = Object.freeze({
    userId: 'player-1',
    schemaVersion: state.schemaVersion,
    saveVersion,
    state,
    lastActivityAt,
    createdAt: lastActivityAt,
    updatedAt: lastActivityAt,
  });

  return {
    loadOrCreatePlayerState: async () => record,
    savePlayerState: async (_userId, expectedVersion, nextState, now) => {
      record = Object.freeze({
        ...record,
        saveVersion: expectedVersion + 1,
        state: nextState,
        lastActivityAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
      return { kind: 'saved', record };
    },
  };
};

describe('player service sync', () => {
  it('continues an active boss encounter after a delayed sync instead of discarding its progress', async () => {
    const now = new Date('2026-07-20T12:00:00.000Z');
    const state = createBossState();
    const service = createPlayerService(createRepository(
      state,
      new Date(now.getTime() - 61_000).toISOString(),
    ));

    const result = await service.execute('player-1', { type: 'sync', expectedVersion: 0 }, now);

    expect(result.kind).toBe('saved');
    if (result.kind !== 'saved') throw new Error('Expected saved response');
    expect(result.record.state.campaign.chapterNumber).toBe(2);
    expect(result.record.state.campaign.mode).toBe('farming');
  });

  it('applies an explicit boss command to the latest save after autosync advanced the version', async () => {
    const now = new Date('2026-07-20T12:00:00.000Z');
    const service = createPlayerService(createRepository(
      createBossUnlockedState(),
      now.toISOString(),
      8,
    ));

    const result = await service.execute('player-1', { type: 'startBoss', expectedVersion: 7 }, now);

    expect(result.kind).toBe('saved');
    if (result.kind !== 'saved') throw new Error('Expected saved response');
    expect(result.record.saveVersion).toBe(9);
    expect(result.record.state.campaign.mode).toBe('boss');
  });
});