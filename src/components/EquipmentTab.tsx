import { useRef, useState } from 'react';
import { getDismantleReward } from '../game/equipment/dismantleReward';
import { compareItems } from '../game/equipment/equipmentPower';
import {
  EQUIPMENT_SLOTS,
  type EquipmentItem,
  type EquipmentRarity,
  type EquipmentSnapshot,
  type EquipmentStatKey,
} from '../game/equipment/equipmentTypes';
import { DismantleConfirmDialog } from './DismantleConfirmDialog';

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

interface EquipmentTabProps {
  readonly equipment: EquipmentSnapshot | undefined;
  readonly heroLevel: number;
  readonly selectedItemId: string | null;
  readonly dropMessage: string | null;
  readonly serverBusy: boolean;
  readonly onSelectItem: (itemId: string) => void;
  readonly onEquip: (itemId: string) => void;
  readonly onEquipBest: () => void;
  readonly onDismantle: (itemId: string) => void;
}

function EquipmentSummary({ item }: { item: EquipmentItem }) {
  return (
    <>
      <span className="item-rarity">{item.rarity}</span>
      <strong>{item.name}</strong>
      <span>Level {item.level} · Power {item.power}</span>
    </>
  );
}

export function EquipmentTab({
  equipment,
  heroLevel,
  selectedItemId,
  dropMessage,
  serverBusy,
  onSelectItem,
  onEquip,
  onEquipBest,
  onDismantle,
}: EquipmentTabProps) {
  const dismantleTriggerRef = useRef<HTMLButtonElement>(null);
  const [dismantleDialogOpen, setDismantleDialogOpen] = useState(false);
  const selectedItem = equipment?.inventory.find((item) => item.id === selectedItemId) ?? null;
  const comparison = selectedItem && equipment
    ? compareItems(selectedItem, equipment.equipped[selectedItem.slot])
    : null;
  const dismantleReward = selectedItem ? getDismantleReward(selectedItem) : 0;

  const closeDismantleDialog = () => {
    setDismantleDialogOpen(false);
    window.requestAnimationFrame(() => dismantleTriggerRef.current?.focus());
  };

  const confirmDismantle = () => {
    if (!selectedItem) return;
    const itemId = selectedItem.id;
    closeDismantleDialog();
    onDismantle(itemId);
  };

  return (
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
              <span>Level {heroLevel}</span>
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
            disabled={serverBusy}
            onClick={onEquipBest}
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
                    onClick={() => onSelectItem(item.id)}
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
              <div className="equipment-actions">
                <button
                  className="primary-action"
                  type="button"
                  disabled={serverBusy}
                  onClick={() => onEquip(comparison.selected.id)}
                >
                  Equip selected
                </button>
                <button
                  ref={dismantleTriggerRef}
                  className="dismantle-action"
                  type="button"
                  disabled={serverBusy}
                  onClick={() => setDismantleDialogOpen(true)}
                >
                  Dismantle · Receive {dismantleReward} Armor Stones
                </button>
              </div>
            </aside>
          ) : null}
        </>
      ) : <p>Loading equipment…</p>}
      {dropMessage ? (
        <p className="drop-message" role="status" aria-label="Latest equipment drop" aria-live="polite">
          {dropMessage}
        </p>
      ) : null}
      {dismantleDialogOpen && selectedItem ? (
        <DismantleConfirmDialog
          itemName={selectedItem.name}
          reward={dismantleReward}
          busy={serverBusy}
          onCancel={closeDismantleDialog}
          onConfirm={confirmDismantle}
        />
      ) : null}
    </section>
  );
}
