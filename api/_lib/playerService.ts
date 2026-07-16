import { createCampaignController } from '../../src/game/campaign/campaignController';
import { getEnemyGold } from '../../src/game/gold/goldBalance';
import { createInitialPlayerSaveState } from '../../src/game/save/saveCodec';
import { settleOfflineRewards } from '../../src/game/save/offlineRewards';
import type {
  OfflineRewardSummary,
  PlayerApiRecord,
  PlayerApiResponse,
  PlayerCommand,
  PlayerSaveState,
} from '../../src/game/save/saveTypes';
import type { PlayerRecord, PlayerRepository } from './playerRepository';

const SHORT_SYNC_LIMIT_MS = 60_000;
const SYNC_SLICE_MS = 100;

const toApiRecord = (record: PlayerRecord): PlayerApiRecord => Object.freeze({
  saveVersion: record.saveVersion,
  state: record.state,
  lastActivityAt: record.lastActivityAt,
  updatedAt: record.updatedAt,
});

const staleResponse = (record: PlayerRecord): PlayerApiResponse => Object.freeze({
  kind: 'stale',
  record: toApiRecord(record),
});

const parseExpectedVersion = (value: unknown): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new RangeError('Expected version must be a non-negative integer');
  }
  return value as number;
};

export function parsePlayerCommand(value: unknown): PlayerCommand {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('Player command must be an object');
  }
  const input = value as Record<string, unknown>;
  const expectedVersion = parseExpectedVersion(input.expectedVersion);
  switch (input.type) {
    case 'sync':
    case 'startBreakthrough':
    case 'startBoss':
    case 'equipBest':
      return { type: input.type, expectedVersion };
    case 'equip':
      if (typeof input.itemId !== 'string' || input.itemId.trim().length === 0) {
        throw new TypeError('Equipment item ID is required');
      }
      return { type: 'equip', expectedVersion, itemId: input.itemId };
    default:
      throw new TypeError('Unknown player command');
  }
}

const advanceShortSync = (state: PlayerSaveState, elapsedMs: number): PlayerSaveState => {
  const campaign = createCampaignController(undefined, { initialState: state.campaign });
  let remainingMs = elapsedMs;
  let gold = state.gold;

  while (remainingMs > 0) {
    const slice = Math.min(SYNC_SLICE_MS, remainingMs);
    const before = campaign.getSnapshot();
    const events = campaign.advance(slice);
    const enemyDeaths = events.filter((event) => event.type === 'death' && event.actor === 'enemy').length;
    if (enemyDeaths > 0 && before.encounter) {
      gold += getEnemyGold(before.chapter.number, before.encounter.kind) * enemyDeaths;
    }
    remainingMs -= slice;
  }

  return Object.freeze({
    ...state,
    gold,
    campaign: campaign.getPersistentState(),
  });
};

export function createPlayerService(repository: PlayerRepository) {
  const load = async (userId: string, now: Date): Promise<PlayerApiResponse> => {
    const record = await repository.loadOrCreatePlayerState(userId, now);
    return Object.freeze({ kind: 'loaded', record: toApiRecord(record) });
  };

  const execute = async (userId: string, command: PlayerCommand, now: Date): Promise<PlayerApiResponse> => {
    const record = await repository.loadOrCreatePlayerState(userId, now);
    if (record.saveVersion !== command.expectedVersion) return staleResponse(record);

    let nextState = record.state;
    let offline: OfflineRewardSummary | undefined;

    if (command.type === 'sync') {
      const lastActivity = Date.parse(record.lastActivityAt);
      const elapsedMs = Number.isFinite(lastActivity) ? Math.max(0, now.getTime() - lastActivity) : 0;
      if (elapsedMs > SHORT_SYNC_LIMIT_MS) {
        const result = settleOfflineRewards(record.state, elapsedMs);
        nextState = result.nextState;
        offline = Object.freeze({
          elapsedMs: result.elapsedMs,
          kills: result.kills,
          gold: result.gold,
          xp: result.xp,
          drops: result.drops,
        });
      } else if (elapsedMs > 0) {
        nextState = advanceShortSync(record.state, elapsedMs);
      }
    } else {
      const campaign = createCampaignController(undefined, { initialState: record.state.campaign });
      if (command.type === 'startBreakthrough') campaign.startBreakthrough();
      if (command.type === 'startBoss') campaign.startBoss();
      if (command.type === 'equip') campaign.equip(command.itemId);
      if (command.type === 'equipBest') campaign.equipBest();
      nextState = Object.freeze({ ...record.state, campaign: campaign.getPersistentState() });
    }

    const result = await repository.savePlayerState(userId, command.expectedVersion, nextState, now);
    if (result.kind === 'stale') return staleResponse(result.record);
    return Object.freeze({
      kind: 'saved',
      record: toApiRecord(result.record),
      ...(offline ? { offline } : {}),
    });
  };

  const reset = async (
    userId: string,
    expectedVersion: number,
    acknowledgement: string,
    finalConfirmation: boolean,
    now: Date,
  ): Promise<PlayerApiResponse> => {
    if (acknowledgement !== 'RESET' || finalConfirmation !== true) {
      throw new TypeError('Reset requires RESET and final confirmation');
    }
    const current = await repository.loadOrCreatePlayerState(userId, now);
    if (current.saveVersion !== parseExpectedVersion(expectedVersion)) return staleResponse(current);
    const result = await repository.savePlayerState(userId, expectedVersion, createInitialPlayerSaveState(), now);
    if (result.kind === 'stale') return staleResponse(result.record);
    return Object.freeze({ kind: 'saved', record: toApiRecord(result.record) });
  };

  return Object.freeze({ load, execute, reset });
}
