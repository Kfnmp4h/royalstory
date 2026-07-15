import { useEffect, useRef, useState } from 'react';
import { createBattleGame } from './game/phaser/battleGame';
import type { BattleController, BattleStatus } from './game/phaser/battleGame';
import type { CampaignMode } from './game/campaign/campaignTypes';
import { subscribeToVisibility } from './game/visibilityController';

const campaignMessages: Record<Exclude<CampaignMode, 'farming'>, { status: string; instruction: string }> = {
  breakthrough: {
    status: 'Breakthrough',
    instruction: 'Defeat the sentinel to challenge the chapter boss.',
  },
  boss: {
    status: 'Boss battle',
    instruction: 'Defeat the boss to unlock the next chapter.',
  },
  'campaign-complete': {
    status: 'Campaign complete',
    instruction: 'Lightrest Summit is restored.',
  },
};

function formatRuntime(runtimeMs: number): string {
  const totalSeconds = Math.floor(runtimeMs / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function App() {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<BattleController | null>(null);
  const previousLevelRef = useRef<number | null>(null);
  const [status, setStatus] = useState<BattleStatus | null>(null);
  const [visibilityState, setVisibilityState] = useState<BattleStatus['state'] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [levelUpMessage, setLevelUpMessage] = useState<string | null>(null);

  useEffect(() => {
    const parent = hostRef.current;
    if (!parent) return;
    let active = true;

    const controller = createBattleGame({
      parent,
      onStatus: (nextStatus) => {
        if (active) setStatus(nextStatus);
      },
      onError: (nextError) => {
        if (active) setError(nextError);
      },
    });
    controllerRef.current = controller;

    return () => {
      active = false;
      controller.destroy();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, []);

  useEffect(() => subscribeToVisibility(document, (hidden) => {
    controllerRef.current?.setPaused(hidden);
    setVisibilityState((current) => hidden ? 'paused' : current === 'paused' ? 'running' : null);
  }), []);

  useEffect(() => {
    const level = status?.snapshot.progression.level;
    if (level === undefined) return;
    const previous = previousLevelRef.current;
    previousLevelRef.current = level;
    if (previous === null || level <= previous) return;

    setLevelUpMessage(`Level ${level} reached`);
    const timer = window.setTimeout(() => setLevelUpMessage(null), 2_500);
    return () => window.clearTimeout(timer);
  }, [status?.snapshot.progression.level]);

  const statusLabel = error
    ? 'Error'
    : visibilityState === 'running' || (!visibilityState && status?.state === 'running')
      ? 'Running'
      : visibilityState === 'paused' || status?.state === 'paused'
        ? 'Paused'
        : 'Starting';
  const snapshot = status?.snapshot;
  const combat = snapshot?.combat;
  const progression = snapshot?.progression;
  const isMaxLevel = progression?.level === 200;
  const campaignMessage = snapshot
    ? snapshot.mode === 'farming'
      ? snapshot.bossUnlocked
        ? { status: 'Farming â€” boss unlocked', instruction: 'Keep farming or challenge the chapter boss.' }
        : { status: 'Farming', instruction: 'Defeat enemies to prepare for a breakthrough.' }
      : campaignMessages[snapshot.mode]
    : null;

  return (
    <main className="app-shell">
      <header className="hero-header">
        <p className="eyebrow">Milestone 3 · Progression Sandbox</p>
        <h1>RoyalStory</h1>
      </header>
      <section className="campaign-panel" aria-label="Campaign progress">
        {snapshot && campaignMessage ? (
          <>
            <p className="campaign-chapter">Chapter {snapshot.chapter.number} / 36</p>
            <h2>{snapshot.chapter.name}</h2>
            <p className="campaign-status">{campaignMessage.status}</p>
            <p className="campaign-instruction">{campaignMessage.instruction}</p>
            {snapshot.mode === 'farming' ? (
              snapshot.bossUnlocked ? (
                <button type="button" onClick={() => controllerRef.current?.startBoss()}>
                  Challenge boss
                </button>
              ) : (
                <button type="button" onClick={() => controllerRef.current?.startBreakthrough()}>
                  Start breakthrough
                </button>
              )
            ) : null}
          </>
        ) : <p>Loading campaign progress…</p>}
      </section>
      <section className="hero-panel" aria-label="Hero progression">
        {progression ? (
          <>
            <div className="hero-level-row">
              <p>Level {progression.level} / 200</p>
              <p>{isMaxLevel ? 'MAX' : `${progression.xp} / ${progression.xpToNextLevel} XP`}</p>
            </div>
            <progress
              aria-label="Experience"
              max={isMaxLevel ? 1 : progression.xpToNextLevel}
              value={isMaxLevel ? 1 : progression.xp}
            />
            <dl className="hero-stats">
              <div>
                <dt>ATK</dt>
                <dd>{progression.stats.attack}</dd>
              </div>
              <div>
                <dt>DEF</dt>
                <dd>{progression.stats.defense}</dd>
              </div>
              <div>
                <dt>HP</dt>
                <dd>{progression.stats.maxHp}</dd>
              </div>
            </dl>
            {levelUpMessage ? <p className="level-up-message" role="status">{levelUpMessage}</p> : null}
          </>
        ) : <p>Loading hero progression…</p>}
      </section>
      <section className="battle-card" aria-label="Automatic battle">
        <div
          ref={hostRef}
          className="battle-host"
          aria-label="RoyalStory automatic battle"
        />
      </section>
      <section className="diagnostics" aria-label="Combat diagnostics">
        <p className="status-chip">{statusLabel}</p>
        <dl>
          <div>
            <dt>Active runtime</dt>
            <dd>{formatRuntime(combat?.activeRuntimeMs ?? 0)}</dd>
          </div>
          <div>
            <dt>Total attacks</dt>
            <dd>{combat?.totalAttacks ?? 0}</dd>
          </div>
          <div>
            <dt>Defeated enemies</dt>
            <dd>{combat?.defeatedEnemies ?? 0}</dd>
          </div>
        </dl>
        {error ? <p role="alert">{error.message}</p> : null}
      </section>
    </main>
  );
}
