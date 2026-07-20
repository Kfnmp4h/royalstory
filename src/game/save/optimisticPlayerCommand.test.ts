import { describe, expect, it } from 'vitest';
import { createCampaignController } from '../campaign/campaignController';
import { createInitialPlayerSaveState } from './saveCodec';
import type { PlayerApiRecord } from './saveTypes';
import { applyOptimisticPlayerCommand } from './optimisticPlayerCommand';

const createRecord = (): PlayerApiRecord => ({
  saveVersion: 4,
  state: createInitialPlayerSaveState(),
  lastActivityAt: '2026-07-20T15:00:00.000Z',
  updatedAt: '2026-07-20T15:00:00.000Z',
});

describe('optimistic player commands', () => {
  it('starts breakthrough immediately without changing the server version', () => {
    const record = createRecord();
    const next = applyOptimisticPlayerCommand(record, { type: 'startBreakthrough', expectedVersion: 4 });

    expect(next).not.toBe(record);
    expect(next.saveVersion).toBe(4);
    expect(next.state.campaign.mode).toBe('breakthrough');
  });

  it('starts an unlocked boss immediately', () => {
    const record = createRecord();
    const campaign = createCampaignController(undefined, { initialState: record.state.campaign });
    campaign.startBreakthrough();
    for (let tick = 0; tick < 20_000 && !campaign.getSnapshot().bossUnlocked; tick += 1) campaign.advance(100);
    const unlocked = { ...record, state: { ...record.state, campaign: campaign.getPersistentState() } };

    const next = applyOptimisticPlayerCommand(unlocked, { type: 'startBoss', expectedVersion: 4 });

    expect(next.state.campaign.mode).toBe('boss');
  });

  it('leaves sync commands unchanged', () => {
    const record = createRecord();
    expect(applyOptimisticPlayerCommand(record, { type: 'sync', expectedVersion: 4 })).toBe(record);
  });
});
