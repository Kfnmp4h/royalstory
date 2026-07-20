import { useCallback, useEffect, useRef, useState } from 'react';
import { EquipmentTab } from './components/EquipmentTab';
import { playerApi } from './game/api/playerApi';
import type { CampaignMode } from './game/campaign/campaignTypes';
import { createBattleGame } from './game/phaser/battleGame';
import type { BattleController, BattleStatus } from './game/phaser/battleGame';
import type { CampaignPersistentState, PlayerApiRecord, PlayerApiResponse, PlayerCommand } from './game/save/saveTypes';
import { subscribeToVisibility } from './game/visibilityController';

interface AppProps {
  readonly record: PlayerApiRecord;
  readonly onRecordChange: (record: PlayerApiRecord) => void;
  readonly initialNotice?: string | null;
}

type AppTab = 'battle' | 'equipment';

interface BackgroundSyncRequest {
  readonly controller: AbortController;
  readonly requestId: number;
}

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

const hasRecord = (response: PlayerApiResponse): response is Extract<PlayerApiResponse, { record: PlayerApiRecord }> => (
  response.kind === 'loaded' || response.kind === 'saved' || response.kind === 'stale'
);

export function App({ record, onRecordChange, initialNotice = null }: AppProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<BattleController | null>(null);
  const mountedCampaignRef = useRef<CampaignPersistentState | null>(null);
  const foregroundCommandInFlightRef = useRef(false);
  const backgroundSyncRef = useRef<BackgroundSyncRequest | null>(null);
  const nextBackgroundSyncIdRef = useRef(1);
  const previousLevelRef = useRef<number | null>(null);
  const previousDropIdRef = useRef<string | null>(null);
  const battleTabRef = useRef<HTMLButtonElement>(null);
  const equipmentTabRef = useRef<HTMLButtonElement>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('battle');
  const [status, setStatus] = useState<BattleStatus | null>(null);
  const [visibilityState, setVisibilityState] = useState<BattleStatus['state'] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [levelUpMessage, setLevelUpMessage] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [dropMessage, setDropMessage] = useState<string | null>(null);
  const [serverNotice, setServerNotice] = useState<string | null>(initialNotice);
  const [serverBusy, setServerBusy] = useState(false);

  useEffect(() => setServerNotice(initialNotice), [initialNotice]);

  useEffect(() => {
    const parent = hostRef.current;
    if (!parent) return;
    let active = true;
    setStatus(null);
    setError(null);
    mountedCampaignRef.current = record.state.campaign;

    const controller = createBattleGame({
      parent,
      initialState: record.state.campaign,
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
      backgroundSyncRef.current?.controller.abort();
      backgroundSyncRef.current = null;
      controller.destroy();
      if (controllerRef.current === controller) controllerRef.current = null;
      mountedCampaignRef.current = null;
      parent.replaceChildren();
    };
  }, []);

  useEffect(() => {
    if (mountedCampaignRef.current === record.state.campaign) return;
    mountedCampaignRef.current = record.state.campaign;
    controllerRef.current?.replaceState(record.state.campaign);
  }, [record.state.campaign]);

  useEffect(() => subscribeToVisibility(document, (hidden) => {
    controllerRef.current?.setPaused(hidden);
    setVisibilityState((current) => hidden ? 'paused' : current === 'paused' ? 'running' : null);
  }), []);

  const handleCommandResponse = useCallback((response: PlayerApiResponse, command: PlayerCommand) => {
    if (hasRecord(response)) {
      onRecordChange(response.record);
      if (response.kind === 'stale') {
        setServerNotice('A newer server save replaced this tab’s local view.');
      } else if (response.kind === 'saved' && command.type === 'dismantle') {
        setSelectedItemId(null);
        setServerNotice(`Equipment dismantled. Armor Stones: ${response.record.state.armorStones}.`);
      } else if (response.kind === 'saved' && command.type === 'dismantleLowerPower') {
        setSelectedItemId(null);
        setServerNotice(`Lower-power equipment dismantled. Armor Stones: ${response.record.state.armorStones}.`);
      } else if ('offline' in response && response.offline && response.offline.kills > 0) {
        setServerNotice(
          `Offline rewards: ${response.offline.gold} gold, ${response.offline.xp} XP, ${response.offline.drops.length} drops.`,
        );
      }
    } else if (response.kind === 'unauthorized') {
      setError(new Error('Your session expired. Sign in again.'));
    } else {
      setError(new Error(response.message));
    }
  }, [onRecordChange]);

  const issueCommand = useCallback(async (command: PlayerCommand) => {
    if (foregroundCommandInFlightRef.current) return;
    foregroundCommandInFlightRef.current = true;
    backgroundSyncRef.current?.controller.abort();
    backgroundSyncRef.current = null;
    setServerBusy(true);
    try {
      const response = await playerApi.command(command);
      handleCommandResponse(response, command);
    } finally {
      setServerBusy(false);
      foregroundCommandInFlightRef.current = false;
    }
  }, [handleCommandResponse]);

  const issueBackgroundSync = useCallback(async (expectedVersion: number) => {
    if (foregroundCommandInFlightRef.current || backgroundSyncRef.current) return;
    const controller = new AbortController();
    const requestId = nextBackgroundSyncIdRef.current;
    nextBackgroundSyncIdRef.current += 1;
    backgroundSyncRef.current = { controller, requestId };
    const command: PlayerCommand = { type: 'sync', expectedVersion };

    try {
      const response = await playerApi.command(command, controller.signal);
      if (controller.signal.aborted || backgroundSyncRef.current?.requestId !== requestId) return;
      handleCommandResponse(response, command);
    } finally {
      if (backgroundSyncRef.current?.requestId === requestId) backgroundSyncRef.current = null;
    }
  }, [handleCommandResponse]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void issueBackgroundSync(record.saveVersion);
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [issueBackgroundSync, record.saveVersion]);

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

  useEffect(() => {
    const latestDrop = status?.snapshot.equipment.latestDrop;
    if (!latestDrop || latestDrop.id === previousDropIdRef.current) return;
    previousDropIdRef.current = latestDrop.id;
    setDropMessage(`New drop: ${latestDrop.name}, level ${latestDrop.level}, power ${latestDrop.power}`);
    const timer = window.setTimeout(() => setDropMessage(null), 4_000);
    return () => window.clearTimeout(timer);
  }, [status?.snapshot.equipment.latestDrop]);

  const selectTab = (tab: AppTab, moveFocus = false) => {
    setActiveTab(tab);
    if (moveFocus) {
      const target = tab === 'battle' ? battleTabRef.current : equipmentTabRef.current;
      target?.focus();
    }
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    selectTab(activeTab === 'battle' ? 'equipment' : 'battle', true);
  };

  const statusLabel = error
    ? 'Error'
    : serverBusy
      ? 'Saving'
      : visibilityState === 'running' || (!visibilityState && status?.state === 'running')
        ? 'Running'
        : visibilityState === 'paused' || status?.state === 'paused'
          ? 'Paused'
          : 'Starting';
  const snapshot = status?.snapshot;
  const combat = snapshot?.combat;
  const progression = snapshot?.progression;
  const equipment = snapshot?.equipment;
  const isMaxLevel = progression?.level === 200;
  const campaignMessage = snapshot
    ? snapshot.mode === 'farming'
      ? snapshot.bossUnlocked
        ? { status: 'Farming — boss unlocked', instruction: 'Keep farming or challenge the chapter boss.' }
        : { status: 'Farming', instruction: 'Defeat enemies to prepare for a breakthrough.' }
      : campaignMessages[snapshot.mode]
    : null;

  return (
    <main className="app-shell">
      <header className="hero-header">
        <p className="eyebrow">Milestone 6 · Online Kingdom</p>
        <h1>RoyalStory</h1>
        <div className="currency-summary" aria-label="Currencies">
          <p>Gold: {record.state.gold}</p>
          <p>Armor Stones: {record.state.armorStones}</p>
        </div>
        {serverNotice ? <p role="status">{serverNotice}</p> : null}
      </header>

      <nav className="primary-tabs" aria-label="Game sections">
        <div role="tablist" aria-label="RoyalStory navigation">
          <button
            ref={battleTabRef}
            id="battle-tab"
            type="button"
            role="tab"
            aria-selected={activeTab === 'battle'}
            aria-controls="battle-panel"
            tabIndex={activeTab === 'battle' ? 0 : -1}
            onClick={() => selectTab('battle')}
            onKeyDown={handleTabKeyDown}
          >
            Battle
          </button>
          <button
            ref={equipmentTabRef}
            id="equipment-tab"
            type="button"
            role="tab"
            aria-selected={activeTab === 'equipment'}
            aria-controls="equipment-panel"
            tabIndex={activeTab === 'equipment' ? 0 : -1}
            onClick={() => selectTab('equipment')}
            onKeyDown={handleTabKeyDown}
          >
            Equipment
          </button>
        </div>
      </nav>

      <div
        id="battle-panel"
        className="tab-panel"
        role="tabpanel"
        aria-labelledby="battle-tab"
        hidden={activeTab !== 'battle'}
      >
        <section className="campaign-panel" aria-label="Campaign progress">
          {snapshot && campaignMessage ? (
            <>
              <p className="campaign-chapter">Chapter {snapshot.chapter.number} / 36</p>
              <h2>{snapshot.chapter.name}</h2>
              <p className="campaign-status">{campaignMessage.status}</p>
              <p className="campaign-instruction">{campaignMessage.instruction}</p>
              {snapshot.mode === 'farming' ? (
                snapshot.bossUnlocked ? (
                  <button
                    type="button"
                    disabled={serverBusy}
                    onClick={() => void issueCommand({ type: 'startBoss', expectedVersion: record.saveVersion })}
                  >
                    Challenge boss
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={serverBusy}
                    onClick={() => void issueCommand({ type: 'startBreakthrough', expectedVersion: record.saveVersion })}
                  >
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
                  <dd>{equipment?.effectiveStats.attack ?? progression.stats.attack}</dd>
                </div>
                <div>
                  <dt>DEF</dt>
                  <dd>{equipment?.effectiveStats.defense ?? progression.stats.defense}</dd>
                </div>
                <div>
                  <dt>HP</dt>
                  <dd>{equipment?.effectiveStats.maxHp ?? progression.stats.maxHp}</dd>
                </div>
                <div>
                  <dt>Total Power</dt>
                  <dd>{equipment?.heroPower ?? 0}</dd>
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
      </div>

      <div
        id="equipment-panel"
        className="tab-panel"
        role="tabpanel"
        aria-labelledby="equipment-tab"
        hidden={activeTab !== 'equipment'}
      >
        <EquipmentTab
          equipment={equipment}
          heroLevel={progression?.level ?? 1}
          selectedItemId={selectedItemId}
          dropMessage={dropMessage}
          serverBusy={serverBusy}
          onSelectItem={setSelectedItemId}
          onEquipBest={() => void issueCommand({ type: 'equipBest', expectedVersion: record.saveVersion })}
          onEquip={(itemId) => void issueCommand({
            type: 'equip',
            expectedVersion: record.saveVersion,
            itemId,
          })}
          onDismantle={(itemId) => void issueCommand({
            type: 'dismantle',
            expectedVersion: record.saveVersion,
            itemId,
          })}
          onDismantleLowerPower={() => void issueCommand({
            type: 'dismantleLowerPower',
            expectedVersion: record.saveVersion,
          })}
        />
      </div>
    </main>
  );
}
