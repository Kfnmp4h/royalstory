import { handleApiError, jsonResponse, methodNotAllowed } from './_lib/http';
import { createProfileRepository } from './_lib/profileRepository';
import { createProfileService } from './_lib/profileService';
import { createSupabaseProfileDatabase } from './_lib/profileSupabase';
import { createRequestSupabase, requireUser } from './_lib/supabaseServer';

const createService = () => createProfileService(createProfileRepository(createSupabaseProfileDatabase()));

export async function GET(request: Request): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET', 'POST']);
  const auth = createRequestSupabase(request);
  try {
    const user = await requireUser(auth.client);
    if (!user) return auth.applyCookies(jsonResponse({ kind: 'unauthorized' }, 401));
    return auth.applyCookies(jsonResponse(await createService().load(user.id)));
  } catch (error) {
    return auth.applyCookies(handleApiError(error));
  }
}

export async function POST(request: Request): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['GET', 'POST']);
  const auth = createRequestSupabase(request);
  try {
    const user = await requireUser(auth.client);
    if (!user) return auth.applyCookies(jsonResponse({ kind: 'unauthorized' }, 401));
    const body = await request.json() as { characterName?: unknown };
    const result = await createService().create(
      user.id,
      typeof body.characterName === 'string' ? body.characterName : '',
    );
    const status = result.kind === 'created'
      ? 201
      : result.kind === 'name_taken'
        ? 409
        : result.kind === 'invalid'
          ? 400
          : 503;
    return auth.applyCookies(jsonResponse(result, status));
  } catch (error) {
    return auth.applyCookies(handleApiError(error));
  }
}
