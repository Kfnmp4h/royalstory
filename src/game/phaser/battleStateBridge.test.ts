import { describe, expect, it, vi } from 'vitest';
import type { PlayerCommand } from '../save/saveTypes';
import { applyActiveBattleCommand, registerBattleCommandReceiver } from './battleStateBridge';

describe('active battle command bridge', () => {
  it('forwards a foreground command immediately to the mounted battle', () => {
    const receiver = vi.fn();
    const unregister = registerBattleCommandReceiver(receiver);
    const command: PlayerCommand = { type: 'startBreakthrough', expectedVersion: 3 };

    applyActiveBattleCommand(command);

    expect(receiver).toHaveBeenCalledWith(command);
    unregister();
  });
});
