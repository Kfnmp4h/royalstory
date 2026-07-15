import { useEffect, useRef, useState } from 'react';
import { createBattleGame } from './game/phaser/battleGame';
import type { BattleController, BattleStatus } from './game/phaser/battleGame';
import type { CampaignMode } from './game/campaign/campaignTypes';
import { compareItems } from './game/equipment/equipmentPower';
import {
  EQUIPMENT_SLOTS,
  type EquipmentItem,
  type EquipmentRarity,
  type EquipmentStatKey,
} from './game/equipment/equipmentTypes';
import { subscribeToVisibility } from './game/visibilityController';

const rarityClass: Record<EquipmentRarity, string> = {
  Normal: 'rarity-normal',
  Rare: 'rarity-rare',
  Epic: 'rarity-epic',
  Unique: 'rarity-unique',
  Legendary: 'rarity-legendary',
};

const statLabels: Record<EquipmentStatKey, string> = {
  attack: 'ATK',
  maxHp: 'Max HP',
  defense: 'Defense',
  accuracy: 'Accuracy',
  evasion: 'Evasion',
  criticalRate: 'Critical Rate',
  criticalDamage: 'Critical Damage',
  attackSpeed: 'Attack Speed',
  damage: 'Damage',
  bossDamage: 'Boss Monster Damage',
  normalDamage: 'Normal Monster Damage',
};

const percentageStats = new Set<EquipmentStatKey>([
  'criticalRate',
  'criticalDamage',
  'attackSpeed',
  'damage',
  'bossDamage',
  'normalDamage',
]);

function EquipmentSummary({ item }: { item: EquipmentItem }) {
  return (
    <>
      <span className="item-rarity">{item.rarity}</span>
      <strong>{item.name}</strong>
      <span>Level {item.level} · Power {item.power}</span>
    </>
  );
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

export function App() {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<BattleController | null>(null);
  const previousLevelRef = useRef<number | null>(null);
  const previousDropIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState<BattleStatus | null>(null);
  const [visibilityState, setVisibilityState] = useState<BattleStatus['state'] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [levelUpMessage, setLevelUpMessage] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [dropMessage, setDropMessage] = useState<string | null>(null);

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

  useEffect(() => {
    const latestDrop = status?.snapshot.equipment.latestDrop;
    if (!latestDrop || latestDrop.id === previousDropIdRef.current) return;
    previousDropIdRef.current = latestDrop.id;
    setDropMessage(`New drop: ${latestDrop.name}, level ${latestDrop.level}, power ${latestDrop.power}`);
    const timer = window.setTimeout(() => setDropMessage(null), 4_000);
    return () => window.clearTimeout(timer);
  }, [status?.snapshot.equipment.latestDrop]);

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
  const equipment = snapshot?.equipment;
  const selectedItem = equipment?.inventory.find((item) => item.id === selectedItemId) ?? null;
  const comparison = selectedItem && equipment
    ? compareItems(selectedItem, equipment.equipped[selectedItem.slot])
    : null;
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
        <p className="eyebrow">Milestone 5 · Equipment Frontier</p>
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
      <section className="equipment-panel" aria-label="Equipment">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Ari's loadout</p>
            <h2>Equipment</h2>
          </div>
          <p>{equipment ? `${equipment.inventory.length} items ready` : 'Waiting for battle drops'}</p>
        </div>
        {equipment ? (
          <>
            <div className="equipment-stage">
              <div className="ari-medallion" aria-label="Ari">
                <span className="ari-crown" aria-hidden="true">♛</span>
                <strong>Ari</strong>
                <span>Level {progression?.level ?? 1}</span>
                <span>{equipment.heroPower} Power</span>
              </div>
              {EQUIPMENT_SLOTS.map((slot) => {
                const item = equipment.equipped[slot];
                return (
                  <div
                    key={slot}
                    className={`equipment-slot ${item ? rarityClass[item.rarity] : 'is-empty'}`}
                    data-slot={slot}
                    role="group"
                    aria-label={`${slot} equipment slot`}
                  >
                    <span className="slot-name">{slot}</span>
                    {item ? <EquipmentSummary item={item} /> : <span className="empty-label">Empty</span>}
                  </div>
                );
              })}
            </div>
            <button
              className="primary-action equip-best"
              type="button"
              onClick={() => controllerRef.current?.equipBest()}
            >
              Equip Best
            </button>

            <section className="inventory-panel" aria-label="Inventory">
              <div className="inventory-heading">
                <h3>Inventory</h3>
                <span>Sorted by power</span>
              </div>
              {equipment.inventory.length > 0 ? (
                <div className="inventory-grid">
                  {equipment.inventory.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`inventory-item ${rarityClass[item.rarity]} ${selectedItemId === item.id ? 'is-selected' : ''}`}
                      aria-label={`${item.name}, level ${item.level}, Power ${item.power}`}
                      aria-pressed={selectedItemId === item.id}
                      onClick={() => setSelectedItemId(item.id)}
                    >
                      <EquipmentSummary item={item} />
                    </button>
                  ))}
                </div>
              ) : <p className="empty-inventory">Defeat monsters to find equipment.</p>}
            </section>

            {comparison ? (
              <aside className={`comparison-panel comparison-${comparison.result}`} aria-label="Item comparison">
                <div>
                  <p className="comparison-result">
                    {comparison.result === 'positive'
                      ? `Upgrade +${comparison.powerDelta} power`
                      : comparison.result === 'negative'
                        ? `Downgrade ${comparison.powerDelta} power`
                        : 'Equal 0 power'}
                  </p>
                  <h3>{comparison.selected.name}</h3>
                  <p>Compared with {comparison.equipped?.name ?? `empty ${comparison.selected.slot}`}</p>
                </div>
                <dl className="comparison-stats">
                  {Object.entries(comparison.statDeltas)
                    .filter(([, value]) => value !== 0)
                    .map(([stat, value]) => {
                      const key = stat as EquipmentStatKey;
                      return (
                        <div key={key}>
                          <dt>{statLabels[key]}</dt>
                          <dd>{value > 0 ? '+' : ''}{value}{percentageStats.has(key) ? '%' : ''}</dd>
                        </div>
                      );
                    })}
                </dl>
                <button
                  className="primary-action"
                  type="button"
                  onClick={() => controllerRef.current?.equip(comparison.selected.id)}
                >
                  Equip selected
                </button>
              </aside>
            ) : null}
          </>
        ) : <p>Loading equipment…</p>}
        {dropMessage ? (
          <p className="drop-message" role="status" aria-label="Latest equipment drop" aria-live="polite">
            {dropMessage}
          </p>
        ) : null}
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
