import type { PlayerProfile } from './profileTypes';

export interface ProfileDatabaseRow {
  readonly user_id: string;
  readonly character_name: string;
  readonly normalized_name: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface ProfileDatabase {
  findByUserId(userId: string): Promise<ProfileDatabaseRow | null>;
  create(userId: string, characterName: string): Promise<ProfileDatabaseRow>;
}

export interface ProfileRepository {
  load(userId: string): Promise<PlayerProfile | null>;
  create(userId: string, characterName: string): Promise<PlayerProfile>;
}

const toProfile = (row: ProfileDatabaseRow): PlayerProfile => ({
  characterName: row.character_name,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export function createProfileRepository(database: ProfileDatabase): ProfileRepository {
  return {
    async load(userId) {
      const row = await database.findByUserId(userId);
      return row ? toProfile(row) : null;
    },

    async create(userId, characterName) {
      return toProfile(await database.create(userId, characterName));
    },
  };
}
