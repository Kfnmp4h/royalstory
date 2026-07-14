import { useEffect, useRef, useState } from 'react';
import { createBattleGame } from './game/phaser/battleGame';
import type { BattleController, BattleStatus } from './game/phaser/battleGame';
import { subscribeToVisibility } from './game/visibilityController';

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

  return (
    <main className="app-shell">
      <header className="hero-header">
        <p className="eyebrow">Milestone 1 · Combat Sandbox</p>
        <h1>RoyalStory</h1>
      </header>
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
            <dt>Defeated Mosslings</dt>
            <dd>{combat?.defeatedEnemies ?? 0}</dd>
          </div>
        </dl>
        {error ? <p role="alert">{error.message}</p> : null}
      </section>
    </main>
  );
}
