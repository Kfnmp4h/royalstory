import type { ProfileRepository } from './profileRepository';
import type { ProfileCreateResult, ProfileLoadResult } from './profileTypes';

const CHARACTER_NAME_PATTERN = /^[A-Za-z0-9]{3,16}$/;

const unavailableMessage = 'The profile service is unavailable.';

export function createProfileService(repository: ProfileRepository) {
  return {
    async load(userId: string): Promise<ProfileLoadResult> {
      try {
        const profile = await repository.load(userId);
        return profile ? { kind: 'loaded', profile } : { kind: 'missing' };
      } catch {
        return { kind: 'unavailable', message: unavailableMessage };
      }
    },

    async create(userId: string, requestedName: string): Promise<ProfileCreateResult> {
      const characterName = requestedName.trim();
      if (!CHARACTER_NAME_PATTERN.test(characterName)) {
        return { kind: 'invalid', message: 'Character names must be 3–16 letters or digits.' };
      }

      try {
        return { kind: 'created', profile: await repository.create(userId, characterName) };
      } catch (error) {
        const code = typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code)
          : '';
        if (code === '23505') return { kind: 'name_taken' };
        return { kind: 'unavailable', message: unavailableMessage };
      }
    },
  };
}
