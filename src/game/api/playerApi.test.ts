import { afterEach, describe, expect, it, vi } from 'vitest';
import { playerApi } from './playerApi';
import type { PlayerApiRecord } from '../save/saveTypes';

const record = {
  saveVersion: 9,
  state: {
    schemaVersion: 1,
    gold: 40,
    campaign: {
      chapterNumber: 1,
      unlockedChapter: 1,
      mode: 'farming',
      bossUnlocked: false,
      progression: { level: 1, xp: 0, totalXp: 0 },
      equipment: { inventory: [], equipped: {}, latestDropId: null, nextItemNumber: 1 },
      combat: null,
    },
  },
  lastActivityAt: '2026-07-16T10:00:00.000Z',
  updatedAt: '2026-07-16T10:00:00.000Z',
} as unknown as PlayerApiRecord;

afterEach(() => vi.unstubAllGlobals());

describe('playerApi', () => {
  it('preserves stale canonical responses and credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ kind: 'stale', record }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(playerApi.command({ type: 'equipBest', expectedVersion: 2 }))
      .resolves.toEqual({ kind: 'stale', record });
    expect(fetchMock).toHaveBeenCalledWith('/api/player/commands', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ type: 'equipBest', expectedVersion: 2 }),
    }));
  });

  it('forwards an abort signal for cancellable commands', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ kind: 'saved', record }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    await playerApi.command({ type: 'sync', expectedVersion: 9 }, controller.signal);

    expect(fetchMock).toHaveBeenCalledWith('/api/player/commands', expect.objectContaining({
      signal: controller.signal,
    }));
  });

  it('maps network failure to an unavailable response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    await expect(playerApi.load()).resolves.toEqual({
      kind: 'unavailable',
      message: 'The game server is unavailable.',
    });
  });
});