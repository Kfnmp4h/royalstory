import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OfflineReturnDialog } from './OfflineReturnDialog';
import type { OfflineRewardSummary } from '../game/save/saveTypes';

const summary: OfflineRewardSummary = {
  elapsedMs: 8 * 60 * 60 * 1_000,
  kills: 240,
  gold: 2_400,
  xp: 4_800,
  drops: [{
    id: 'offline-item-1',
    slot: 'Hat',
    level: 12,
    rarity: 'Rare',
    name: 'Rare Hat',
    mainStats: { attack: 3, defense: 2, maxHp: 14 },
    substats: [{ type: 'accuracy', value: 2 }],
    power: 90,
  }],
};

describe('OfflineReturnDialog', () => {
  it('shows every reward category and closes locally', () => {
    const onClose = vi.fn();
    render(<OfflineReturnDialog summary={summary} onClose={onClose} />);

    const dialog = screen.getByRole('dialog', { name: 'Offline rewards' });
    expect(within(dialog).getByText('8h 0m')).toBeInTheDocument();
    expect(within(dialog).getByText('240')).toBeInTheDocument();
    expect(within(dialog).getByText('2,400')).toBeInTheDocument();
    expect(within(dialog).getByText('4,800')).toBeInTheDocument();
    expect(within(dialog).getByText('Rare Hat')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
