import { createAuthService } from '../_lib/authService';
import { handleApiError, jsonResponse, methodNotAllowed, readJsonObject } from '../_lib/http';
import { createRequestSupabase } from '../_lib/supabaseServer';

export async function POST(request: Request): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const auth = createRequestSupabase(request);
  try {
    const body = await readJsonObject(request);
    const email = typeof body.email === 'string' ? body.email : '';
    await createAuthService(auth.client, new URL(request.url).origin).requestPasswordReset(email);
    return auth.applyCookies(jsonResponse({ ok: true }));
  } catch (error) {
    return auth.applyCookies(handleApiError(error));
  }
}
