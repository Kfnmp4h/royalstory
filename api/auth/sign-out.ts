import { createAuthService } from '../_lib/authService';
import { getServerEnv } from '../_lib/env';
import { handleApiError, jsonResponse, methodNotAllowed } from '../_lib/http';
import { createRequestSupabase } from '../_lib/supabaseServer';

export async function POST(request: Request): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const auth = createRequestSupabase(request);
  try {
    const result = await createAuthService(auth.client, getServerEnv().appOrigin).signOut();
    return auth.applyCookies(jsonResponse(result, result.ok ? 200 : 503));
  } catch (error) {
    return auth.applyCookies(handleApiError(error));
  }
}
