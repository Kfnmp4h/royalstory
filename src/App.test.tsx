import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCampaignController } from './game/campaign/campaignController';
import { createInitialPlayerSaveState } from './game/save/saveCodec';
import type { BattleStatus } from './game/phaser/battleGame';
import type { PlayerApiRecord, PlayerApiResponse } from './game/save/saveTypes';
import appSource from './App?raw';

const battleGame = vi.hoisted(() => ({
  createBattleGame: vi.fn(),
  destroy: vi.fn(),
  setPaused: vi.fn(),
  replaceState: vi.fn(),
}));

const playerApiMock = vi.hoisted(() => ({
  command: vi.fn(),
}));

vi.mock('./game/phaser/battleGame', () => ({
  createBattleGame: battleGame.createBattleGame,
}));

vi.mock('./game/api/playerApi', () => ({
  playerApi: {
    command: playerApiMock.command,
  },
}));

import { App } from './App';

interface GameCallbacks {
  readonly parent: HTMLElement;
  readonly initialState: PlayerApiRecord['state']['campaign'];
  readonly onStatus: (status: BattleStatus) => void;
  readonly onError: (error: Error) => void;
}

const createRecord = (saveVersion = 7, gold = 125): PlayerApiRecord => {
  const state = createInitialPlayerSaveState();
  return {
    saveVersion,
    state: { ...state, gold },
    lastActivityAt: '2026-07-16T10:00:00.000Z',
    updatedAt: '2026-07-16T10:00:00.000Z',
  };
};

const createStatus = (record: PlayerApiRecord): BattleStatus => ({
  state: 'running',
  snapshot: createCampaignController(undefined, {
    initialState: record.state.campaign,
    combatRandom: () => 0.5,
    equipmentRandom: () => 0.5,
  }).getSnapshot(),
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => { resolve = nextResolve; });
  return { promise, resolve };
};

afterEach(() => vi.useRealTimers());

describe('App server-authoritative experience', () => {
  let callbacks: GameCallbacks;
  let record: PlayerApiRecord;
  let onRecordChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    record = createRecord();
    onRecordChange = vi.fn();
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });

    battleGame.createBattleGame.mockImplementation((options: GameCallbacks) => {
      callbacks = options;
      options.onStatus(createStatus(record));
      return {
        destroy: battleGame.destroy,
        setPaused: battleGame.setPaused,
        replaceState: battleGame.replaceState,
      };
    });

    playerApiMock.command.mockResolvedValue({ kind: 'saved', record } satisfies PlayerApiResponse);
  });

  const renderApp = (initialNotice: string | null = null) => render(
    <App record={record} onRecordChange={onRecordChange} initialNotice={initialNotice} />,
  );

  it('renders canonical gold and campaign state only after receiving a server record', () => {
    renderApp();

    expect(screen.getByRole('heading', { name: 'RoyalStory' })).toBeInTheDocument();
    expect(screen.getByText('Milestone 6 · Online Kingdom')).toBeInTheDocument();
    expect(screen.getByText('Gold: 125')).toBeInTheDocument();
    expect(screen.getByText('Chapter 1 / 36')).toBeInTheDocument();
    expect(screen.getByText('Level 1 / 200')).toBeInTheDocument();
  });

  it('hydrates one Phaser renderer from the canonical campaign state and destroys it on unmount', () => {
    const { unmount } = renderApp();

    expect(battleGame.createBattleGame).toHaveBeenCalledTimes(1);
    expect(callbacks.initialState).toEqual(record.state.campaign);
    expect(callbacks.parent).toBe(screen.getByLabelText('RoyalStory automatic battle'));

    unmount();
    expect(battleGame.destroy).toHaveBeenCalledOnce();
  });

  it('selects Battle by default and switches to Equipment without remounting Phaser', () => {
    renderApp();

    const battleTab = screen.getByRole('tab', { name: 'Battle' });
    const equipmentTab = screen.getByRole('tab', { name: 'Equipment' });
    const battlePanel = screen.getByRole('tabpanel', { name: 'Battle' });

    expect(battleTab).toHaveAttribute('aria-selected', 'true');
    expect(equipmentTab).toHaveAttribute('aria-selected', 'false');
    expect(battlePanel).not.toHaveAttribute('hidden');
    expect(screen.queryByRole('tabpanel', { name: 'Equipment' })).not.toBeInTheDocument();

    fireEvent.click(equipmentTab);

    expect(battleTab).toHaveAttribute('aria-selected', 'false');
    expect(equipmentTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Equipment' })).toBeInTheDocument();
    expect(battleGame.createBattleGame).toHaveBeenCalledTimes(1);
  });

  it('supports Left and Right arrow navigation between tabs', () => {
    renderApp();

    const battleTab = screen.getByRole('tab', { name: 'Battle' });
    const equipmentTab = screen.getByRole('tab', { name: 'Equipment' });

    battleTab.focus();
    fireEvent.keyDown(battleTab, { key: 'ArrowRight' });
    expect(equipmentTab).toHaveFocus();
    expect(equipmentTab).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(equipmentTab, { key: 'ArrowLeft' });
    expect(battleTab).toHaveFocus();
    expect(battleTab).toHaveAttribute('aria-selected', 'true');
  });

  it('sends campaign actions as typed commands with the expected save version', async () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Start breakthrough' }));

    await waitFor(() => expect(playerApiMock.command).toHaveBeenCalledWith({
      type: 'startBreakthrough',
      expectedVersion: 7,
    }));
    expect(onRecordChange).toHaveBeenCalledWith(record);
  });

  it('disables mutations and shows Saving while a foreground command is pending', async () => {
    const pending = deferred<PlayerApiResponse>();
    playerApiMock.command.mockReturnValueOnce(pending.promise);
    renderApp();

    const button = screen.getByRole('button', { name: 'Start breakthrough' });
    fireEvent.click(button);

    expect(button).toBeDisabled();
    expect(screen.getByText('Saving')).toBeInTheDocument();

    await act(async () => pending.resolve({ kind: 'saved', record }));
    await waitFor(() => expect(button).toBeEnabled());
  });

  it('keeps controls enabled and aborts background sync for a foreground command', async () => {
    vi.useFakeTimers();
    const pendingSync = deferred<PlayerApiResponse>();
    playerApiMock.command
      .mockReturnValueOnce(pendingSync.promise)
      .mockResolvedValueOnce({ kind: 'saved', record } satisfies PlayerApiResponse);
    renderApp();

    await act(async () => vi.advanceTimersByTime(15_000));
    const syncSignal = playerApiMock.command.mock.calls[0]?.[1] as AbortSignal;
    const button = screen.getByRole('button', { name: 'Start breakthrough' });

    expect(syncSignal).toBeInstanceOf(AbortSignal);
    expect(button).toBeEnabled();
    expect(screen.queryByText('Saving')).not.toBeInTheDocument();

    fireEvent.click(button);

    expect(syncSignal.aborted).toBe(true);
    await waitFor(() => expect(playerApiMock.command).toHaveBeenLastCalledWith({
      type: 'startBreakthrough',
      expectedVersion: 7,
    }));
  });

  it('retries a foreground command once when an in-flight sync made its version stale', async () => {
    const newerRecord = createRecord(8, 150);
    const savedRecord = createRecord(9, 150);
    playerApiMock.command
      .mockResolvedValueOnce({ kind: 'stale', record: newerRecord } satisfies PlayerApiResponse)
      .mockResolvedValueOnce({ kind: 'saved', record: savedRecord } satisfies PlayerApiResponse);
    renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'Start breakthrough' }));

    await waitFor(() => expect(playerApiMock.command).toHaveBeenNthCalledWith(2, {
      type: 'startBreakthrough',
      expectedVersion: 8,
    }));
    expect(onRecordChange).toHaveBeenCalledWith(savedRecord);
    expect(screen.queryByText('A newer server save replaced this tab’s local view.')).not.toBeInTheDocument();
  });

  it('accepts a newer stale record and tells the user that the server replaced the tab', async () => {
    const newerRecord = createRecord(9, 400);
    playerApiMock.command.mockResolvedValueOnce({ kind: 'stale', record: newerRecord });
    renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'Start breakthrough' }));

    await waitFor(() => expect(onRecordChange).toHaveBeenCalledWith(newerRecord));
    expect(screen.getByRole('status')).toHaveTextContent('A newer server save replaced this tab’s local view.');
  });

  it('keeps canonical state unchanged and exposes a recoverable server error', async () => {
    playerApiMock.command.mockResolvedValueOnce({ kind: 'unavailable', message: 'Maintenance window' });
    renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'Start breakthrough' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Maintenance window');
    expect(onRecordChange).not.toHaveBeenCalled();
  });

  it('pauses only the renderer when the page becomes hidden', () => {
    renderApp();
    act(() => {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(battleGame.setPaused).toHaveBeenLastCalledWith(true);
    expect(screen.getByText('Paused')).toBeInTheDocument();
  });

  it('shows server notices supplied by the authenticated session owner', () => {
    renderApp('Progress updated from another device');
    expect(screen.getByRole('status')).toHaveTextContent('Progress updated from another device');
  });

  it('contains no browser game persistence or direct Supabase access', () => {
    expect(appSource).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie/);
    expect(appSource).not.toMatch(/createClient\(|@supabase/);
    expect(appSource).toContain('playerApi.command');
  });
});