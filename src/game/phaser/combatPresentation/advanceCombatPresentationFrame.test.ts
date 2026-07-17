import { describe, expect, it, vi } from 'vitest';
import { advanceCombatPresentationFrame } from './advanceCombatPresentationFrame';

describe('advanceCombatPresentationFrame', () => {
  it('advances gameplay and presentation exactly once while preserving gameplay results', () => {
    const gameplayEvents = [{ type: 'attack', attacker: 'player', target: 'enemy' }] as const;
    const presentationEvents = [{
      type: 'attack_started',
      actorId: 'player',
      targetId: 'enemy',
      timestampMs: 120,
    }] as const;
    const snapshot = { marker: 'campaign-snapshot' } as const;
    const callOrder: string[] = [];

    const campaign = {
      advance: vi.fn((elapsedMs: number) => {
        callOrder.push(`campaign.advance:${elapsedMs}`);
        return gameplayEvents;
      }),
      consumePresentationEvents: vi.fn(() => {
        callOrder.push('campaign.consumePresentationEvents');
        return presentationEvents;
      }),
      getSnapshot: vi.fn(() => {
        callOrder.push('campaign.getSnapshot');
        return snapshot;
      }),
    };
    const presentation = {
      present: vi.fn((events: readonly unknown[]) => {
        callOrder.push(`presentation.present:${events.length}`);
      }),
      advance: vi.fn((elapsedMs: number) => {
        callOrder.push(`presentation.advance:${elapsedMs}`);
      }),
    };

    const result = advanceCombatPresentationFrame(campaign, presentation, 120);

    expect(result).toEqual({ events: gameplayEvents, snapshot });
    expect(campaign.advance).toHaveBeenCalledTimes(1);
    expect(campaign.consumePresentationEvents).toHaveBeenCalledTimes(1);
    expect(campaign.getSnapshot).toHaveBeenCalledTimes(1);
    expect(presentation.present).toHaveBeenCalledWith(presentationEvents);
    expect(presentation.present).toHaveBeenCalledTimes(1);
    expect(presentation.advance).toHaveBeenCalledWith(120);
    expect(presentation.advance).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual([
      'campaign.advance:120',
      'campaign.consumePresentationEvents',
      'presentation.present:1',
      'presentation.advance:120',
      'campaign.getSnapshot',
    ]);
  });
});
