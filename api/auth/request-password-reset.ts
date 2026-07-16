import { createAuthService } from '../_lib/authService';
import { getServerEnv } from '../_lib/env';
import { handleApiError, jsonResponse, methodNotAllowed, readJsonObject } from '../_lib/http';
import { createRequestSupabase } from '../_lib/supabaseServer';

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const auth = createRequestSupabase(request);
  try {
    const body = await readJsonObject(request);
    const email = typeof body.email === 'string' ? body.email : '';
    await createAuthService(auth.client, getServerEnv().appOrigin).requestPasswordReset(email);
    return auth.applyCookies(jsonResponse({ ok: true }));
  } catch (error) {
    return auth.applyCookies(handleApiError(error));
  }
}
