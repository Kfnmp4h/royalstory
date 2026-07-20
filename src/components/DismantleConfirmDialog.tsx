import { useEffect, useRef } from 'react';

interface DismantleConfirmDialogProps {
  readonly itemName: string;
  readonly reward: number;
  readonly busy: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

export function DismantleConfirmDialog({
  itemName,
  reward,
  busy,
  onCancel,
  onConfirm,
}: DismantleConfirmDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || busy) return;
      event.preventDefault();
      onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [busy, onCancel]);

  return (
    <div
      className="dismantle-modal-backdrop"
      data-testid="dismantle-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <section
        className="dismantle-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dismantle-modal-title"
        aria-describedby="dismantle-modal-description"
      >
        <p className="eyebrow">Permanent action</p>
        <h2 id="dismantle-modal-title">Dismantle equipment?</h2>
        <p id="dismantle-modal-description">
          Dismantle <strong>{itemName}</strong> permanently and receive <strong>{reward} Armor Stones</strong>?
        </p>
        <div className="dismantle-modal-actions">
          <button
            ref={cancelButtonRef}
            type="button"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="dismantle-confirm-action"
            type="button"
            disabled={busy}
            onClick={onConfirm}
          >
            Dismantle
          </button>
        </div>
      </section>
    </div>
  );
}
