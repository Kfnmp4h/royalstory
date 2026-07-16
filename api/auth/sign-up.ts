import { createAuthService } from '../_lib/authService';
import { getServerEnv } from '../_lib/env';
import { handleApiError, jsonResponse, methodNotAllowed, readJsonObject } from '../_lib/http';
import { createRequestSupabase } from '../_lib/supabaseServer';

export async function POST(request: Request): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const auth = createRequestSupabase(request);
  try {
    const body = await readJsonObject(request);
    const email = typeof body.email === 'string' ? body.email : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const result = await createAuthService(auth.client, getServerEnv().appOrigin).signUp({ email, password });
    const status = result.ok ? 200 : result.code === 'confirmation_required' ? 202 : 400;
    return auth.applyCookies(jsonResponse(result, status));
  } catch (error) {
    return auth.applyCookies(handleApiError(error));
  }
}
