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
    const result = await createAuthService(auth.client, getServerEnv().appOrigin).signIn({ email, password });
    return auth.applyCookies(jsonResponse(result, result.ok ? 200 : 400));
  } catch (error) {
    return auth.applyCookies(handleApiError(error));
  }
}
