import { handleApiError, jsonResponse, methodNotAllowed, readJsonObject } from '../_lib/http';
import { createPlayerRepository } from '../_lib/playerRepository';
import { createPlayerService, parsePlayerCommand } from '../_lib/playerService';
import {
  createRequestSupabase,
  createSupabasePlayerStateDatabase,
  requireUser,
} from '../_lib/supabaseServer';

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const auth = createRequestSupabase(request);
  try {
    const user = await requireUser(auth.client);
    if (!user) return auth.applyCookies(jsonResponse({ kind: 'unauthorized' }, 401));
    const command = parsePlayerCommand(await readJsonObject(request));
    const repository = createPlayerRepository(createSupabasePlayerStateDatabase());
    const service = createPlayerService(repository);
    const result = await service.execute(user.id, command, new Date());
    const status = result.kind === 'stale' ? 409 : 200;
    return auth.applyCookies(jsonResponse(result, status));
  } catch (error) {
    return auth.applyCookies(handleApiError(error));
  }
}
