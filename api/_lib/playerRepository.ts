import { createInitialPlayerSaveState, parsePlayerSaveState } from '../../src/game/save/saveCodec';
import type { PlayerSaveState } from '../../src/game/save/saveTypes';

export interface PlayerRecord {
  readonly userId: string;
  readonly schemaVersion: number;
  readonly saveVersion: number;
  readonly state: PlayerSaveState;
  readonly lastActivityAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type SavePlayerStateResult =
  | { readonly kind: 'saved'; readonly record: PlayerRecord }
  | { readonly kind: 'stale'; readonly record: PlayerRecord };

interface DatabaseRow {
  readonly user_id: string;
  readonly schema_version: number;
  readonly save_version: number;
  readonly state: unknown;
  readonly last_activity_at: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface PlayerStateDatabase {
  findByUserId(userId: string): Promise<DatabaseRow | null>;
  insertInitial(row: {
    readonly user_id: string;
    readonly schema_version: number;
    readonly save_version: number;
    readonly state: PlayerSaveState;
    readonly last_activity_at: string;
  }): Promise<DatabaseRow>;
  compareAndSwap(input: {
    readonly userId: string;
    readonly expectedVersion: number;
    readonly state: PlayerSaveState;
    readonly activityAt: string;
  }): Promise<DatabaseRow | null>;
}

export interface PlayerRepository {
  loadOrCreatePlayerState(userId: string, now: Date): Promise<PlayerRecord>;
  savePlayerState(
    userId: string,
    expectedVersion: number,
    state: PlayerSaveState,
    now: Date,
  ): Promise<SavePlayerStateResult>;
}

const parseUserId = (value: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) throw new TypeError('User ID is required');
  return value;
};

const parseDate = (value: Date): string => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) throw new TypeError('A valid timestamp is required');
  return value.toISOString();
};

const toRecord = (row: DatabaseRow): PlayerRecord => Object.freeze({
  userId: row.user_id,
  schemaVersion: row.schema_version,
  saveVersion: row.save_version,
  state: parsePlayerSaveState(row.state),
  lastActivityAt: row.last_activity_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export function createPlayerRepository(database: PlayerStateDatabase): PlayerRepository {
  const loadOrCreatePlayerState = async (userId: string, now: Date): Promise<PlayerRecord> => {
    const owner = parseUserId(userId);
    const timestamp = parseDate(now);
    const existing = await database.findByUserId(owner);
    if (existing) {
      if (existing.user_id !== owner) throw new Error('Player state ownership mismatch');
      return toRecord(existing);
    }

    const state = createInitialPlayerSaveState();
    const created = await database.insertInitial({
      user_id: owner,
      schema_version: state.schemaVersion,
      save_version: 0,
      state,
      last_activity_at: timestamp,
    });
    if (created.user_id !== owner) throw new Error('Player state ownership mismatch');
    return toRecord(created);
  };

  const savePlayerState = async (
    userId: string,
    expectedVersion: number,
    state: PlayerSaveState,
    now: Date,
  ): Promise<SavePlayerStateResult> => {
    const owner = parseUserId(userId);
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) {
      throw new RangeError('Expected save version must be a non-negative integer');
    }
    const validatedState = parsePlayerSaveState(state);
    const activityAt = parseDate(now);
    const saved = await database.compareAndSwap({
      userId: owner,
      expectedVersion,
      state: validatedState,
      activityAt,
    });
    if (saved) {
      if (saved.user_id !== owner) throw new Error('Player state ownership mismatch');
      return Object.freeze({ kind: 'saved', record: toRecord(saved) });
    }

    const current = await database.findByUserId(owner);
    if (!current) throw new Error('Player state disappeared during save');
    if (current.user_id !== owner) throw new Error('Player state ownership mismatch');
    return Object.freeze({ kind: 'stale', record: toRecord(current) });
  };

  return Object.freeze({ loadOrCreatePlayerState, savePlayerState });
}
