import type { OfflineRewardSummary } from '../game/save/saveTypes';

interface OfflineReturnDialogProps {
  readonly summary: OfflineRewardSummary;
  readonly onClose: () => void;
}

const formatElapsed = (elapsedMs: number): string => {
  const totalMinutes = Math.floor(elapsedMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

export function OfflineReturnDialog({ summary, onClose }: OfflineReturnDialogProps) {
  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        className="dialog-panel offline-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="offline-return-title"
      >
        <p className="eyebrow">Welcome back</p>
        <h2 id="offline-return-title">Offline rewards</h2>
        <dl className="offline-summary">
          <div><dt>Time away</dt><dd>{formatElapsed(summary.elapsedMs)}</dd></div>
          <div><dt>Enemies defeated</dt><dd>{summary.kills}</dd></div>
          <div><dt>XP earned</dt><dd>{summary.xp}</dd></div>
          <div><dt>Gold earned</dt><dd>{summary.gold}</dd></div>
        </dl>
        <div className="offline-drops">
          <h3>Equipment found ({summary.drops.length})</h3>
          {summary.drops.length > 0 ? (
            <ul>
              {summary.drops.map((item) => (
                <li key={item.id}>
                  <strong>{item.name}</strong>
                  <span>{item.rarity} · Level {item.level} · Power {item.power}</span>
                </li>
              ))}
            </ul>
          ) : <p>No equipment dropped while you were away.</p>}
        </div>
        <button className="primary-action" type="button" onClick={onClose}>Continue</button>
      </section>
    </div>
  );
}
