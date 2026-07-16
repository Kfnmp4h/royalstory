import { describe, expect, it } from 'vitest';
import type { CombatAdvanceResult, CombatPresentationEvent } from './combatPresentationEvents';

describe('CombatPresentationEvent', () => {
  it('supports the Phaser-free presentation event payload contract', () => {
    const events = [
      { type: 'attack_started', actorId: 'player', targetId: 'enemy', timestampMs: 100 },
      { type: 'hit_landed', actorId: 'enemy', targetId: 'player', damage: 9, critical: false, resultingHealth: 111, timestampMs: 100 },
      { type: 'critical_hit_landed', actorId: 'player', targetId: 'enemy', damage: 36, critical: true, resultingHealth: 54, timestampMs: 100 },
      { type: 'attack_missed', actorId: 'enemy', targetId: 'player', damage: 0, critical: false, resultingHealth: 120, timestampMs: 100 },
      { type: 'health_changed', actorId: 'player', targetId: 'enemy', resultingHealth: 54, timestampMs: 100 },
      { type: 'enemy_defeated', actorId: 'player', targetId: 'enemy', damage: 54, critical: false, resultingHealth: 0, timestampMs: 100 },
    ] satisfies readonly CombatPresentationEvent[];
    const result: CombatAdvanceResult = { events: [], presentationEvents: events };

    expect(result.presentationEvents).toEqual(events);
  });
});
