import type { PlayerApiResponse, PlayerCommand } from '../save/saveTypes';

const unavailable = (): PlayerApiResponse => ({
  kind: 'unavailable',
  message: 'The game server is unavailable.',
});

const readResponse = async (response: Response): Promise<PlayerApiResponse> => {
  try {
    return await response.json() as PlayerApiResponse;
  } catch {
    return unavailable();
  }
};

const request = async (path: string, init: RequestInit): Promise<PlayerApiResponse> => {
  try {
    return await readResponse(await fetch(path, {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    }));
  } catch {
    return unavailable();
  }
};

export const playerApi = Object.freeze({
  load: () => request('/api/player', { method: 'GET' }),
  command: (command: PlayerCommand) => request('/api/player/commands', {
    method: 'POST',
    body: JSON.stringify(command),
  }),
  reset: (expectedVersion: number, acknowledgement: string, finalConfirmation: boolean) => request('/api/player/reset', {
    method: 'POST',
    body: JSON.stringify({ expectedVersion, acknowledgement, finalConfirmation }),
  }),
});
