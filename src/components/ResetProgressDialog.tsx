import { useEffect, useState } from 'react';

interface ResetProgressDialogProps {
  readonly busy: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => Promise<void>;
}

export function ResetProgressDialog({ busy, onCancel, onConfirm }: ResetProgressDialogProps) {
  const [acknowledgement, setAcknowledgement] = useState('');
  const [finalStep, setFinalStep] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onCancel]);

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <section className="reset-dialog" role="dialog" aria-modal="true" aria-labelledby="reset-progress-title">
        {!finalStep ? (
          <>
            <p className="eyebrow">Danger zone</p>
            <h2 id="reset-progress-title">Reset all progress?</h2>
            <p>This permanently resets your level, gold, equipment, chapter progress, and battle state. Your account remains active.</p>
            <label>
              Confirm reset text
              <input
                autoFocus
                type="text"
                autoComplete="off"
                value={acknowledgement}
                onChange={(event) => setAcknowledgement(event.target.value)}
                placeholder="Type RESET"
              />
            </label>
            <div className="dialog-actions">
              <button type="button" disabled={busy} onClick={onCancel}>Cancel</button>
              <button
                type="button"
                className="destructive-action"
                disabled={busy || acknowledgement !== 'RESET'}
                onClick={() => setFinalStep(true)}
              >
                Continue to final confirmation
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="eyebrow">Final confirmation</p>
            <h2 id="reset-progress-title">This cannot be undone</h2>
            <p>All saved RoyalStory progress will be permanently replaced with a new level 1 save.</p>
            <div className="dialog-actions">
              <button type="button" disabled={busy} onClick={() => setFinalStep(false)}>Go back</button>
              <button
                type="button"
                className="destructive-action"
                disabled={busy}
                onClick={() => void onConfirm()}
              >
                {busy ? 'Resetting progress…' : 'Reset all progress permanently'}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
