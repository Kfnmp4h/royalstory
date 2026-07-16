import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ResetProgressDialog } from './ResetProgressDialog';

describe('ResetProgressDialog', () => {
  it('requires exact uppercase RESET before the final step', () => {
    render(<ResetProgressDialog busy={false} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    const continueButton = screen.getByRole('button', { name: 'Continue to final confirmation' });
    expect(continueButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Confirm reset text'), { target: { value: 'reset' } });
    expect(continueButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Confirm reset text'), { target: { value: 'RESET' } });
    expect(continueButton).toBeEnabled();
  });

  it('calls the destructive action only from final confirmation', () => {
    const onConfirm = vi.fn(async () => undefined);
    render(<ResetProgressDialog busy={false} onCancel={vi.fn()} onConfirm={onConfirm} />);
    fireEvent.change(screen.getByLabelText('Confirm reset text'), { target: { value: 'RESET' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue to final confirmation' }));
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Reset all progress permanently' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('cancels without confirming', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn(async () => undefined);
    render(<ResetProgressDialog busy={false} onCancel={onCancel} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
