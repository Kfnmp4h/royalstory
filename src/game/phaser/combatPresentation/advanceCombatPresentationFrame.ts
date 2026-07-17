export interface CombatPresentationFrameCampaign<
  GameplayEvents,
  Snapshot,
  PresentationEvent,
> {
  advance(elapsedMs: number): GameplayEvents;
  consumePresentationEvents?(): readonly PresentationEvent[];
  getSnapshot(): Snapshot;
}

export interface CombatPresentationFrameController<PresentationEvent> {
  present(events: readonly PresentationEvent[]): void;
  advance(deltaMs: number): void;
}

export interface CombatPresentationFrameResult<GameplayEvents, Snapshot> {
  readonly events: GameplayEvents;
  readonly snapshot: Snapshot;
}

export function advanceCombatPresentationFrame<
  GameplayEvents,
  Snapshot,
  PresentationEvent,
>(
  campaign: CombatPresentationFrameCampaign<GameplayEvents, Snapshot, PresentationEvent>,
  presentation: CombatPresentationFrameController<PresentationEvent>,
  elapsedMs: number,
): CombatPresentationFrameResult<GameplayEvents, Snapshot> {
  const events = campaign.advance(elapsedMs);
  const presentationEvents = campaign.consumePresentationEvents?.() ?? [];
  presentation.present(presentationEvents);
  presentation.advance(elapsedMs);
  const snapshot = campaign.getSnapshot();

  return { events, snapshot };
}
