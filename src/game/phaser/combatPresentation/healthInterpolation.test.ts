import { describe, expect, it } from 'vitest';
import { createHealthInterpolation } from './healthInterpolation';

describe('createHealthInterpolation', () => {
  it('updates immediate health immediately and eases delayed damage without overshoot', () => {
    const bar = createHealthInterpolation(1);

    bar.setTarget(0.25);
    expect(bar.getState()).toEqual({ immediateRatio: 0.25, delayedRatio: 1 });
    expect(bar.advance(100, 1)).toEqual({ immediateRatio: 0.25, delayedRatio: 0.9 });
    expect(bar.advance(10_000, 1)).toEqual({ immediateRatio: 0.25, delayedRatio: 0.25 });
  });

  it('clamps targets and supports healing without overshoot', () => {
    const bar = createHealthInterpolation(-1);
    expect(bar.getState()).toEqual({ immediateRatio: 0, delayedRatio: 0 });

    bar.setTarget(2);
    expect(bar.getState()).toEqual({ immediateRatio: 1, delayedRatio: 0 });
    expect(bar.advance(250, 2)).toEqual({ immediateRatio: 1, delayedRatio: 0.5 });
    expect(bar.advance(10_000, 2)).toEqual({ immediateRatio: 1, delayedRatio: 1 });
  });

  it('ignores negative elapsed time and negative speed', () => {
    const bar = createHealthInterpolation(1);
    bar.setTarget(0);

    expect(bar.advance(-100, 1)).toEqual({ immediateRatio: 0, delayedRatio: 1 });
    expect(bar.advance(100, -1)).toEqual({ immediateRatio: 0, delayedRatio: 1 });
  });
});
