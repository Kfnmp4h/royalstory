import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DismantleConfirmDialog } from './DismantleConfirmDialog';

const renderDialog = () => {
  const onCancel = vi.fn();
  const onConfirm = vi.fn();
  render(
    <DismantleConfirmDialog
      itemName="Royal Shoulder Guard"
      reward={84}
      busy={false}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />,
  );
  return { onCancel, onConfirm };
};

describe('DismantleConfirmDialog', () => {
  it('renders a labelled modal with the item and reward', () => {
    renderDialog();
    expect(screen.getByRole('dialog', { name: 'Dismantle equipment?' })).toBeInTheDocument();
    expect(screen.getByText(/Royal Shoulder Guard/)).toBeInTheDocument();
    expect(screen.getByText(/84 Armor Stones/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('supports cancel and destructive confirmation', () => {
    const { onCancel, onConfirm } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismantle' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('dismisses with Escape and the backdrop but not panel clicks', () => {
    const { onCancel } = renderDialog();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByTestId('dismantle-modal-backdrop'));
    fireEvent.click(screen.getByRole('dialog'));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
