import { act, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BattleStatus } from './game/phaser/battleGame';
import { getChapter } from './game/campaign/campaignDefinitions';

const battleGame = vi.hoisted(() => ({
  createBattleGame: vi.fn(),
  destroy: vi.fn(),
  setPaused: vi.fn(),
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
    expect(diagnosticsRegion).toContainElement(screen.getByText('Defeated Mosslings'));
  });

  it('ignores callbacks from a cleaned-up StrictMode battle lifetime', () => {
    const lifetimes: GameCallbacks[] = [];
    const firstDestroy = vi.fn();
    battleGame.createBattleGame.mockImplementation((options: GameCallbacks) => {
      lifetimes.push(options);
      return {
        destroy: lifetimes.length === 1 ? firstDestroy : battleGame.destroy,
        setPaused: battleGame.setPaused,
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
