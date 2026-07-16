import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { getServerEnv } from './env';
import type { PlayerStateDatabase } from './playerRepository';

interface CookieOptions {
  readonly domain?: string;
  readonly expires?: Date;
  readonly httpOnly?: boolean;
  readonly maxAge?: number;
  readonly path?: string;
  readonly sameSite?: boolean | 'lax' | 'strict' | 'none';
  readonly secure?: boolean;
}

interface CookieMutation {
  readonly name: string;
  readonly value: string;
  readonly options: CookieOptions;
}

const parseCookies = (header: string | null): { name: string; value: string }[] => {
  if (!header) return [];
  return header.split(';').flatMap((part) => {
    const separator = part.indexOf('=');
    if (separator < 1) return [];
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    return name ? [{ name, value }] : [];
  });
};

const serializeCookie = (mutation: CookieMutation): string => {
  const options = mutation.options;
  const parts = [`${mutation.name}=${mutation.value}`];
  parts.push(`Path=${options.path ?? '/'}`);
  if (options.domain) parts.push(`Domain=${options.domain}`);
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  if (options.httpOnly ?? true) parts.push('HttpOnly');
  if (options.secure ?? true) parts.push('Secure');
  const sameSite = options.sameSite === true ? 'Strict' : options.sameSite === false || options.sameSite === undefined
    ? 'Lax'
    : `${options.sameSite.charAt(0).toUpperCase()}${options.sameSite.slice(1)}`;
  parts.push(`SameSite=${sameSite}`);
  return parts.join('; ');
};

export interface RequestSupabaseContext {
  readonly client: SupabaseClient;
  applyCookies(response: Response): Response;
}

export function createRequestSupabase(request: Request): RequestSupabaseContext {
  const env = getServerEnv();
  const mutations: CookieMutation[] = [];
  const client = createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    cookies: {
      getAll: () => parseCookies(request.headers.get('cookie')),
      setAll: (cookiesToSet) => {
        for (const cookie of cookiesToSet) {
          mutations.push({
            name: cookie.name,
            value: cookie.value,
            options: {
              ...cookie.options,
              httpOnly: true,
              secure: true,
              sameSite: 'lax',
              path: '/',
            },
          });
        }
      },
    },
  });

  return {
    client,
    applyCookies(response: Response): Response {
      if (mutations.length === 0) return response;
      const headers = new Headers(response.headers);
      for (const mutation of mutations) headers.append('Set-Cookie', serializeCookie(mutation));
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    },
  };
}

export async function requireUser(client: SupabaseClient): Promise<User | null> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

interface DatabaseRow {
  readonly user_id: string;
  readonly schema_version: number;
  readonly save_version: number;
  readonly state: unknown;
  readonly last_activity_at: string;
  readonly created_at: string;
  readonly updated_at: string;
}

const selectColumns = 'user_id,schema_version,save_version,state,last_activity_at,created_at,updated_at';

export function createSupabasePlayerStateDatabase(): PlayerStateDatabase {
  const env = getServerEnv();
  const client = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  return {
    async findByUserId(userId) {
      const { data, error } = await client
        .from('player_states')
        .select(selectColumns)
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw new Error(`Unable to load player state: ${error.message}`);
      return data as DatabaseRow | null;
    },

    async insertInitial(row) {
      const { data, error } = await client
        .from('player_states')
        .insert(row)
        .select(selectColumns)
        .single();
      if (error) throw new Error(`Unable to create player state: ${error.message}`);
      return data as DatabaseRow;
    },

    async compareAndSwap(input) {
      const { data, error } = await client.rpc('save_player_state', {
        player_user_id: input.userId,
        expected_version: input.expectedVersion,
        next_state: input.state,
        activity_at: input.activityAt,
      });
      if (error) throw new Error(`Unable to save player state: ${error.message}`);
      const rows = data as DatabaseRow[] | null;
      return rows?.[0] ?? null;
    },
  };
}
