import { createAuthService } from '../_lib/authService';
import { getServerEnv } from '../_lib/env';
import { handleApiError, jsonResponse, methodNotAllowed, readJsonObject } from '../_lib/http';
import { createRequestSupabase, requireUser } from '../_lib/supabaseServer';

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const auth = createRequestSupabase(request);

  try {
    const user = await requireUser(auth.client);
    if (!user) return auth.applyCookies(jsonResponse({ ok: false, code: 'unauthorized' }, 401));

    const body = await readJsonObject(request);
    const password = typeof body.password === 'string' ? body.password : '';
    const result = await createAuthService(auth.client, getServerEnv().appOrigin).updatePassword(password);
    return auth.applyCookies(jsonResponse(result, result.ok ? 200 : 400));
  } catch (error) {
    return auth.applyCookies(handleApiError(error));
  }
}
