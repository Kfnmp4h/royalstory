import { handleApiError, jsonResponse, methodNotAllowed, readJsonObject } from '../_lib/http';
import { createPlayerRepository } from '../_lib/playerRepository';
import { createPlayerService } from '../_lib/playerService';
import {
  createRequestSupabase,
  createSupabasePlayerStateDatabase,
  requireUser,
} from '../_lib/supabaseServer';

export async function POST(request: Request): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const auth = createRequestSupabase(request);
  try {
    const user = await requireUser(auth.client);
    if (!user) return auth.applyCookies(jsonResponse({ kind: 'unauthorized' }, 401));
    const body = await readJsonObject(request);
    const expectedVersion = body.expectedVersion;
    if (!Number.isSafeInteger(expectedVersion) || (expectedVersion as number) < 0) {
      throw new RangeError('Expected version must be a non-negative integer');
    }
    const acknowledgement = typeof body.acknowledgement === 'string' ? body.acknowledgement : '';
    const finalConfirmation = body.finalConfirmation === true;
    const repository = createPlayerRepository(createSupabasePlayerStateDatabase());
    const service = createPlayerService(repository);
    const result = await service.reset(
      user.id,
      expectedVersion as number,
      acknowledgement,
      finalConfirmation,
      new Date(),
    );
    const status = result.kind === 'stale' ? 409 : 200;
    return auth.applyCookies(jsonResponse(result, status));
  } catch (error) {
    return auth.applyCookies(handleApiError(error));
  }
}
