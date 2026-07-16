import type { ActorId, CombatEvent } from '../types';

export type CombatPresentationEvent =
  | { readonly type: "attack_started"; readonly actorId: ActorId; readonly targetId: ActorId; readonly timestampMs: number }
  | { readonly type: "hit_landed"; readonly actorId: ActorId; readonly targetId: ActorId; readonly damage: number; readonly critical: false; readonly resultingHealth: number; readonly timestampMs: number }
  | { readonly type: "critical_hit_landed"; readonly actorId: "player"; readonly targetId: "enemy"; readonly damage: number; readonly critical: true; readonly resultingHealth: number; readonly timestampMs: number }
  | { readonly type: "attack_missed"; readonly actorId: ActorId; readonly targetId: ActorId; readonly damage: 0; readonly critical: false; readonly resultingHealth: number; readonly timestampMs: number }
  | { readonly type: "health_changed"; readonly actorId: ActorId; readonly targetId: ActorId; readonly resultingHealth: number; readonly timestampMs: number }
  | { readonly type: "enemy_defeated"; readonly actorId: "player"; readonly targetId: "enemy"; readonly damage: number; readonly critical: boolean; readonly resultingHealth: 0; readonly timestampMs: number };

export interface CombatAdvanceResult {
  readonly events: readonly CombatEvent[];
  readonly presentationEvents: readonly CombatPresentationEvent[];
}
