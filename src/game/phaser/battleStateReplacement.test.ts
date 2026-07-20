import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    AUTO: 'AUTO',
    Game: class {},
    Scale: { FIT: 'FIT', CENTER_BOTH: 'CENTER_BOTH' },
    Scene: class {},
  },
}));

import { resetBattleSceneEncounterTransition } from './battleGame';

describe('resetBattleSceneEncounterTransition', () => {
  it('clears the previous boss death transition before rendering a new breakthrough', () => {
    const scene = {
      renderedVisualName: 'Ember Ridge Warden',
      pendingEnemyVisual: { name: 'Ember Ridge Warden' },
      enemyDeathFeedbackActive: true,
      nextPlayerDamageCritical: true,
    };

    resetBattleSceneEncounterTransition(scene);

    expect(scene).toEqual({
      renderedVisualName: undefined,
      pendingEnemyVisual: undefined,
      enemyDeathFeedbackActive: false,
      nextPlayerDamageCritical: false,
    });
  });
});
