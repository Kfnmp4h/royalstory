export interface HealthInterpolationState {
  readonly immediateRatio: number;
  readonly delayedRatio: number;
}

export interface HealthInterpolation {
  setTarget(ratio: number): void;
  advance(elapsedMs: number, unitsPerSecond: number): HealthInterpolationState;
  getState(): HealthInterpolationState;
}

const clampRatio = (value: number): number => Math.min(1, Math.max(0, value));

export function createHealthInterpolation(initialRatio: number): HealthInterpolation {
  let immediateRatio = clampRatio(initialRatio);
  let delayedRatio = immediateRatio;

  const snapshot = (): HealthInterpolationState => ({ immediateRatio, delayedRatio });

  return {
    setTarget(ratio: number): void {
      immediateRatio = clampRatio(ratio);
    },

    advance(elapsedMs: number, unitsPerSecond: number): HealthInterpolationState {
      const distance = immediateRatio - delayedRatio;
      const maxStep = Math.max(0, elapsedMs) / 1000 * Math.max(0, unitsPerSecond);

      if (Math.abs(distance) <= maxStep) {
        delayedRatio = immediateRatio;
      } else if (distance > 0) {
        delayedRatio += maxStep;
      } else if (distance < 0) {
        delayedRatio -= maxStep;
      }

      delayedRatio = clampRatio(delayedRatio);
      return snapshot();
    },

    getState(): HealthInterpolationState {
      return snapshot();
    },
  };
}
