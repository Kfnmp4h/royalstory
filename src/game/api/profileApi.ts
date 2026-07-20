import type { ProfileCreateResult, ProfileLoadResult } from '../profile/profileTypes';

const unavailableLoad = (): ProfileLoadResult => ({ kind: 'unavailable', message: 'The profile service is unavailable.' });
const unavailableCreate = (): ProfileCreateResult => ({ kind: 'unavailable', message: 'The profile service is unavailable.' });

const request = async <T>(path: string, init: RequestInit, fallback: () => T): Promise<T> => {
  try {
    const response = await fetch(path, {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
    return await response.json() as T;
  } catch {
    return fallback();
  }
};

export const profileApi = Object.freeze({
  load: () => request<ProfileLoadResult>('/api/profile', { method: 'GET' }, unavailableLoad),
  create: (characterName: string) => request<ProfileCreateResult>('/api/profile', {
    method: 'POST',
    body: JSON.stringify({ characterName }),
  }, unavailableCreate),
});
