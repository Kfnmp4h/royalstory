import { handleApiError, jsonResponse, methodNotAllowed } from './_lib/http';
import { createPlayerRepository } from './_lib/playerRepository';
import { createPlayerService } from './_lib/playerService';
import {
  createRequestSupabase,
  createSupabasePlayerStateDatabase,
  requireUser,
} from './_lib/supabaseServer';

export async function GET(request: Request): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  const auth = createRequestSupabase(request);
  try {
    const user = await requireUser(auth.client);
    if (!user) return auth.applyCookies(jsonResponse({ kind: 'unauthorized' }, 401));
    const repository = createPlayerRepository(createSupabasePlayerStateDatabase());
    const service = createPlayerService(repository);
    return auth.applyCookies(jsonResponse(await service.load(user.id, new Date())));
  } catch (error) {
    return auth.applyCookies(handleApiError(error));
  }
}
