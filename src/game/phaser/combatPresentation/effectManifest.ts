export type CombatEffectKey =
  | 'slash-basic'
  | 'impact-basic'
  | 'impact-critical'
  | 'enemy-death'
  | 'death-particles';

export interface CombatEffectDefinition {
  readonly key: CombatEffectKey;
  readonly url: string;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly frameCount: number;
  readonly frameRate: number;
  readonly origin: Readonly<{ x: 0.5; y: 0.5 }>;
  readonly scale: number;
  readonly animationKey: string;
}

export const COMBAT_EFFECT_MANIFEST = {
  'slash-basic': {
    key: 'slash-basic',
    url: 'assets/combat/slash-basic.png',
    frameWidth: 48,
    frameHeight: 48,
    frameCount: 3,
    frameRate: 20,
    origin: { x: 0.5, y: 0.5 },
    scale: 2,
    animationKey: 'royalstory-slash-basic',
  },
  'impact-basic': {
    key: 'impact-basic',
    url: 'assets/combat/impact-basic.png',
    frameWidth: 32,
    frameHeight: 32,
    frameCount: 3,
    frameRate: 24,
    origin: { x: 0.5, y: 0.5 },
    scale: 2,
    animationKey: 'royalstory-impact-basic',
  },
  'impact-critical': {
    key: 'impact-critical',
    url: 'assets/combat/impact-critical.png',
    frameWidth: 48,
    frameHeight: 48,
    frameCount: 4,
    frameRate: 24,
    origin: { x: 0.5, y: 0.5 },
    scale: 2.25,
    animationKey: 'royalstory-impact-critical',
  },
  'enemy-death': {
    key: 'enemy-death',
    url: 'assets/combat/enemy-death.png',
    frameWidth: 48,
    frameHeight: 48,
    frameCount: 4,
    frameRate: 18,
    origin: { x: 0.5, y: 0.5 },
    scale: 2,
    animationKey: 'royalstory-enemy-death',
  },
  'death-particles': {
    key: 'death-particles',
    url: 'assets/combat/death-particles.png',
    frameWidth: 32,
    frameHeight: 32,
    frameCount: 4,
    frameRate: 20,
    origin: { x: 0.5, y: 0.5 },
    scale: 1.75,
    animationKey: 'royalstory-death-particles',
  },
} as const satisfies Record<CombatEffectKey, CombatEffectDefinition>;
