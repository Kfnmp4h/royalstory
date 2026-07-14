import { useEffect, useRef, useState } from 'react';
import { createBattleGame } from './game/phaser/battleGame';
import type { BattleController, BattleStatus } from './game/phaser/battleGame';
import type { CampaignMode } from './game/campaign/campaignTypes';
import { subscribeToVisibility } from './game/visibilityController';

const campaignMessages: Record<CampaignMode, { status: string; instruction: string }> = {
  farming: {
    status: 'Farming',
    instruction: 'Defeat enemies to prepare for a breakthrough.',
  },
  breakthrough: {
    status: 'Breakthrough',
    instruction: 'Defeat the sentinel to challenge the chapter boss.',
  },
  'boss-ready': {
    status: 'Boss ready',
    instruction: 'The chapter boss is ready to be challenged.',
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
  const [status, setStatus] = useState<BattleStatus | null>(null);
  const [visibilityState, setVisibilityState] = useState<BattleStatus['state'] | null>(null);
  const [error, setError] = useState<Error | null>(null);

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

  const statusLabel = error
    ? 'Error'
    : visibilityState === 'running' || (!visibilityState && status?.state === 'running')
      ? 'Running'
      : visibilityState === 'paused' || status?.state === 'paused'
        ? 'Paused'
        : 'Starting';
  const snapshot = status?.snapshot;
  const combat = snapshot?.combat;
  const campaignMessage = snapshot ? campaignMessages[snapshot.mode] : null;

  return (
    <main className="app-shell">
      <header className="hero-header">
        <p className="eyebrow">Milestone 1 · Combat Sandbox</p>
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
              <button type="button" onClick={() => controllerRef.current?.startBreakthrough()}>
                Start breakthrough
              </button>
            ) : null}
            {snapshot.mode === 'boss-ready' ? (
              <button type="button" onClick={() => controllerRef.current?.startBoss()}>
                Challenge boss
              </button>
            ) : null}
          </>
        ) : <p>Loading campaign progress…</p>}
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
