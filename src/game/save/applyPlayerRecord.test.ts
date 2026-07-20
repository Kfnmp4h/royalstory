import { describe, expect, it, vi } from 'vitest';
import { applyPlayerRecord } from './applyPlayerRecord';
import { createInitialPlayerSaveState } from './saveCodec';
import type { PlayerApiRecord } from './saveTypes';

const createRecord = (): PlayerApiRecord => ({
  saveVersion: 8,
  state: createInitialPlayerSaveState(),
  lastActivityAt: '2026-07-20T14:00:00.000Z',
  updatedAt: '2026-07-20T14:00:00.000Z',
});

describe('applyPlayerRecord', () => {
  it('applies the server campaign to the mounted battle before publishing the record', () => {
    const calls: string[] = [];
    const record = createRecord();
    const controller = {
      replaceState: vi.fn(() => calls.push('battle')),
    };
    const onRecordChange = vi.fn(() => calls.push('record'));

    applyPlayerRecord(record, controller, onRecordChange);

    expect(controller.replaceState).toHaveBeenCalledWith(record.state.campaign);
    expect(onRecordChange).toHaveBeenCalledWith(record);
    expect(calls).toEqual(['battle', 'record']);
  });
});
