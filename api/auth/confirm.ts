import { createRequestSupabase } from '../_lib/supabaseServer';

export async function GET(request: Request): Promise<Response> {
  const auth = createRequestSupabase(request);
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const destination = new URL('/', url.origin);
  if (!code) {
    destination.searchParams.set('auth', 'invalid-link');
    return Response.redirect(destination, 303);
  }

  const { error } = await auth.client.auth.exchangeCodeForSession(code);
  destination.searchParams.set('auth', error ? 'confirmation-failed' : 'confirmed');
  return auth.applyCookies(Response.redirect(destination, 303));
}
