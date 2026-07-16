import { createAuthService } from '../_lib/authService';
import { handleApiError, jsonResponse, methodNotAllowed, readJsonObject } from '../_lib/http';
import { createRequestSupabase } from '../_lib/supabaseServer';

export async function POST(request: Request): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const auth = createRequestSupabase(request);
  try {
    const body = await readJsonObject(request);
    const email = typeof body.email === 'string' ? body.email : '';
    const appOrigin = new URL(request.url).origin;
    const recoveryRedirect = new URL('/api/auth/recover', appOrigin).toString();
    console.info('password-reset redirect diagnostic', {
      requestUrl: request.url,
      forwardedHost: request.headers.get('x-forwarded-host'),
      forwardedProto: request.headers.get('x-forwarded-proto'),
      appOrigin,
      recoveryRedirect,
    });
    const result = await createAuthService(auth.client, appOrigin).requestPasswordReset(email);
    return auth.applyCookies(jsonResponse(result, result.ok ? 200 : 503));
  } catch (error) {
    return auth.applyCookies(handleApiError(error));
  }
}
