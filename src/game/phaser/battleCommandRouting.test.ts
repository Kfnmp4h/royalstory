import { describe, expect, it, vi } from 'vitest';
import type { PlayerCommand } from '../save/saveTypes';
import { routeBattleCommand, type BattleCommandTarget } from './battleGame';

const createTarget = (): BattleCommandTarget => ({
  startBreakthrough: vi.fn(),
  startBoss: vi.fn(),
  equip: vi.fn(),
  equipBest: vi.fn(),
  dismantle: vi.fn(),
  dismantleLowerPower: vi.fn(),
});

describe('battle command routing', () => {
  it.each<[PlayerCommand, keyof BattleCommandTarget]>([
    [{ type: 'dismantle', expectedVersion: 4, itemId: 'item-1' }, 'dismantle'],
    [{ type: 'dismantleLowerPower', expectedVersion: 4 }, 'dismantleLowerPower'],
  ])('applies %s immediately to the mounted equipment state', (command, method) => {
    const target = createTarget();

    routeBattleCommand(target, command);

    expect(target[method]).toHaveBeenCalledOnce();
  });
});
