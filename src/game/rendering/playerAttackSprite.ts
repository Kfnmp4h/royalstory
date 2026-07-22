export const PLAYER_ATTACK_DURATION_MS = 550;

export interface PlayerAttackFrame {
  readonly x: number;
  readonly y: number;
  readonly width: 256;
  readonly height: 256;
}

export interface PlayerAttackMetadata {
  readonly frames: readonly PlayerAttackFrame[];
}

interface FrameSource {
  readonly x?: unknown;
  readonly y?: unknown;
  readonly w?: unknown;
  readonly h?: unknown;
}

const invalidMetadata = (): never => {
  throw new Error('Invalid player attack metadata');
};

export function parsePlayerAttackMetadata(value: unknown): PlayerAttackMetadata {
  if (!value || typeof value !== 'object') invalidMetadata();
  const source = value as { readonly frames?: Record<string, FrameSource | undefined> };
  if (!source.frames || typeof source.frames !== 'object') invalidMetadata();

  const frames = Array.from({ length: 25 }, (_, index): PlayerAttackFrame => {
    const frame = source.frames?.[String(index)];
    const expectedX = (index % 5) * 256;
    const expectedY = Math.floor(index / 5) * 256;
    if (
      !frame
      || frame.x !== expectedX
      || frame.y !== expectedY
      || frame.w !== 256
      || frame.h !== 256
    ) invalidMetadata();

    return { x: expectedX, y: expectedY, width: 256, height: 256 };
  });

  return { frames };
}

export function selectPlayerAttackFrame(
  metadata: PlayerAttackMetadata,
  elapsedMs: number,
): PlayerAttackFrame | undefined {
  if (elapsedMs < 0 || elapsedMs >= PLAYER_ATTACK_DURATION_MS) return undefined;
  const index = Math.min(
    metadata.frames.length - 1,
    Math.floor((elapsedMs / PLAYER_ATTACK_DURATION_MS) * metadata.frames.length),
  );
  return metadata.frames[index];
}
