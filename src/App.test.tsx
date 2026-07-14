import { act, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BattleStatus } from './game/phaser/battleGame';
import { getChapter } from './game/campaign/campaignDefinitions';
import appSource from './App?raw';

const battleGame = vi.hoisted(() => ({
  createBattleGame: vi.fn(),
  destroy: vi.fn(),
  setPaused: vi.fn(),
  startBreakthrough: vi.fn(),
  startBoss: vi.fn(),
}));

vi.mock('./game/phaser/battleGame', () => ({
  createBattleGame: battleGame.createBattleGame,
}));

import { App } from './App';

interface GameCallbacks {
  parent: HTMLElement;
  onStatus: (status: BattleStatus) => void;
  onError: (error: Error) => void;
}

const runningStatus: BattleStatus = {
  state: 'running',
  snapshot: {
    mode: 'farming',
    chapter: getChapter(1),
    unlockedChapter: 1,
    encounter: getChapter(1).farming,
    combat: {
      phase: 'fighting',
      paused: false,
      activeRuntimeMs: 65_000,
      totalAttacks: 12,
      defeatedEnemies: 3,
      recoveryRemainingMs: 0,
      player: {
        id: 'player',
        name: 'Knight',
        maxHp: 100,
        hp: 80,
        damage: 10,
        attackIntervalMs: 1_000,
        alive: true,
      },
      enemy: {
        id: 'enemy',
        name: 'Mossling',
        maxHp: 40,
        hp: 20,
        damage: 5,
        attackIntervalMs: 1_500,
        alive: true,
      },
    },
  },
};

const bossReadyStatus: BattleStatus = {
  ...runningStatus,
  snapshot: {
    ...runningStatus.snapshot,
    mode: 'boss-ready',
    encounter: getChapter(1).breakthrough,
  },
};

const campaignCompleteStatus: BattleStatus = {
  state: 'running',
  snapshot: {
    mode: 'campaign-complete',
    chapter: getChapter(36),
    unlockedChapter: 36,
    encounter: null,
    combat: null,
  },
};

describe('App', () => {
  let callbacks: GameCallbacks;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    battleGame.createBattleGame.mockImplementation((options: GameCallbacks) => {
      callbacks = options;
      options.onStatus(runningStatus);
      return {
        destroy: battleGame.destroy,
        setPaused: battleGame.setPaused,
        startBreakthrough: battleGame.startBreakthrough,
        startBoss: battleGame.startBoss,
      };
    });
  });

  it('introduces the RoyalStory combat sandbox', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'RoyalStory' })).toBeInTheDocument();
    expect(screen.getByText('Milestone 1 · Combat Sandbox')).toBeInTheDocument();
  });

  it('immediately displays Paused when initially hidden before the first battle status', () => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    battleGame.createBattleGame.mockImplementation((options: GameCallbacks) => {
      callbacks = options;
      return {
        destroy: battleGame.destroy,
        setPaused: battleGame.setPaused,
        startBreakthrough: battleGame.startBreakthrough,
        startBoss: battleGame.startBoss,
      };
    });

    render(<App />);

    expect(battleGame.setPaused).toHaveBeenLastCalledWith(true);
    expect(screen.getByText('Paused')).toBeInTheDocument();
  });

  it('mounts exactly one battle game in its labelled host and destroys it on unmount', () => {
    const { container, unmount } = render(<App />);
    const host = screen.getByLabelText('RoyalStory automatic battle');

    expect(container.querySelectorAll('.battle-host')).toHaveLength(1);
    expect(battleGame.createBattleGame).toHaveBeenCalledTimes(1);
    expect(callbacks.parent).toBe(host);

    unmount();
    expect(battleGame.destroy).toHaveBeenCalledTimes(1);
  });

  it('groups the battle and diagnostic values into named regions', () => {
    render(<App />);

    const battleRegion = screen.getByRole('region', { name: 'Automatic battle' });
    const diagnosticsRegion = screen.getByRole('region', { name: 'Combat diagnostics' });

    expect(battleRegion).toContainElement(screen.getByLabelText('RoyalStory automatic battle'));
    expect(diagnosticsRegion).toContainElement(screen.getByText('Active runtime'));
    expect(diagnosticsRegion).toContainElement(screen.getByText('Total attacks'));
    expect(diagnosticsRegion).toContainElement(screen.getByText('Defeated enemies'));
  });

  it('ignores callbacks from a cleaned-up StrictMode battle lifetime', () => {
    const lifetimes: GameCallbacks[] = [];
    const firstDestroy = vi.fn();
    battleGame.createBattleGame.mockImplementation((options: GameCallbacks) => {
      lifetimes.push(options);
      return {
        destroy: lifetimes.length === 1 ? firstDestroy : battleGame.destroy,
        setPaused: battleGame.setPaused,
        startBreakthrough: battleGame.startBreakthrough,
        startBoss: battleGame.startBoss,
      };
    });

    const { unmount } = render(<StrictMode><App /></StrictMode>);
    expect(battleGame.createBattleGame).toHaveBeenCalledTimes(2);
    expect(firstDestroy).toHaveBeenCalledTimes(1);

    act(() => lifetimes[1]?.onStatus(runningStatus));
    expect(screen.getByText('Running')).toBeInTheDocument();

    act(() => {
      lifetimes[0]?.onStatus({
        ...runningStatus,
        state: 'paused',
        snapshot: {
          ...runningStatus.snapshot,
          combat: { ...runningStatus.snapshot.combat!, paused: true },
        },
      });
      lifetimes[0]?.onError(new Error('stale engine failure'));
    });

    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    unmount();
    expect(battleGame.destroy).toHaveBeenCalledTimes(1);
  });

  it('does not recreate the battle game when status changes', () => {
    render(<App />);

    act(() => callbacks.onStatus({
      ...runningStatus,
      state: 'paused',
      snapshot: {
        ...runningStatus.snapshot,
        combat: { ...runningStatus.snapshot.combat!, paused: true },
      },
    }));

    expect(screen.getByText('Paused')).toBeInTheDocument();
    expect(battleGame.createBattleGame).toHaveBeenCalledTimes(1);
  });

  it('shows chapter farming and starts a breakthrough from the campaign control', () => {
    render(<App />);

    expect(screen.getByText('Chapter 1 / 36')).toBeInTheDocument();
    expect(screen.getByText('Whisperwood')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start breakthrough' }));

    expect(battleGame.startBreakthrough).toHaveBeenCalledOnce();
  });

  it('shows the boss action only after a breakthrough win', () => {
    render(<App />);

    act(() => callbacks.onStatus(bossReadyStatus));

    const bossButton = screen.getByRole('button', { name: 'Challenge boss' });
    expect(bossButton).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Start breakthrough' })).not.toBeInTheDocument();

    fireEvent.click(bossButton);
    expect(battleGame.startBoss).toHaveBeenCalledOnce();
  });

  it('shows no campaign action during breakthrough and boss battles', () => {
    render(<App />);

    act(() => callbacks.onStatus({
      ...runningStatus,
      snapshot: { ...runningStatus.snapshot, mode: 'breakthrough', encounter: getChapter(1).breakthrough },
    }));
    expect(screen.getByText('Breakthrough')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    act(() => callbacks.onStatus({
      ...runningStatus,
      snapshot: { ...runningStatus.snapshot, mode: 'boss', encounter: getChapter(1).boss },
    }));
    expect(screen.getByText('Boss battle')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows no campaign action after completing the campaign', () => {
    render(<App />);

    act(() => callbacks.onStatus(campaignCompleteStatus));

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Campaign complete')).toBeInTheDocument();
  });

  it('does not create a second game for campaign status updates', () => {
    render(<App />);

    act(() => callbacks.onStatus(bossReadyStatus));
    act(() => callbacks.onStatus(campaignCompleteStatus));

    expect(battleGame.createBattleGame).toHaveBeenCalledTimes(1);
  });

  it('does not include browser persistence APIs', () => {
    expect(appSource).not.toMatch(/localStorage|sessionStorage|IndexedDB|document\\.cookie/);
  });

  it('pauses the controller and displayed status when the document becomes hidden', () => {
    const { unmount } = render(<App />);
    battleGame.setPaused.mockClear();
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });

    act(() => document.dispatchEvent(new Event('visibilitychange')));

    expect(battleGame.setPaused).toHaveBeenLastCalledWith(true);
    expect(screen.getByText('Paused')).toBeInTheDocument();

    unmount();
    battleGame.setPaused.mockClear();
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(battleGame.setPaused).not.toHaveBeenCalled();
  });

  it('shows live diagnostics and surfaces engine errors', () => {
    render(<App />);

    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText('01:05')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();

    act(() => callbacks.onError(new Error('engine failed')));

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('engine failed');
  });
});
