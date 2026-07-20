import { applyActiveBattleState } from '../phaser/battleStateBridge';
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

const sendCommand = (command: PlayerCommand, signal?: AbortSignal) => request('/api/player/commands', {
  method: 'POST',
  body: JSON.stringify(command),
  signal,
});

const applyCommandResponse = (response: PlayerApiResponse): PlayerApiResponse => {
  if (response.kind === 'loaded' || response.kind === 'saved' || response.kind === 'stale') {
    applyActiveBattleState(response.record.state.campaign);
  }
  return response;
};

const command = async (commandToSend: PlayerCommand, signal?: AbortSignal): Promise<PlayerApiResponse> => {
  const response = await sendCommand(commandToSend, signal);
  if (commandToSend.type === 'sync' || response.kind !== 'stale') return applyCommandResponse(response);

  return applyCommandResponse(await sendCommand({
    ...commandToSend,
    expectedVersion: response.record.saveVersion,
  }, signal));
};

export const playerApi = Object.freeze({
  load: () => request('/api/player', { method: 'GET' }),
  command,
  reset: (expectedVersion: number, acknowledgement: string, finalConfirmation: boolean) => request('/api/player/reset', {
    method: 'POST',
    body: JSON.stringify({ expectedVersion, acknowledgement, finalConfirmation }),
  }),
});
