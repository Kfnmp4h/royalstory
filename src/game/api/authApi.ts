export interface AuthCredentials {
  readonly email: string;
  readonly password: string;
}

export type AuthApiResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: string; readonly message?: string };

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const postJson = async (path: string, body?: object): Promise<AuthApiResult> => {
  try {
    const response = await fetch(path, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    const payload: unknown = await response.json();
    if (isRecord(payload) && payload.ok === true) return { ok: true };

    const code = isRecord(payload) && typeof payload.code === 'string'
      ? payload.code
      : 'unavailable';
    const message = isRecord(payload) && typeof payload.message === 'string'
      ? payload.message
      : undefined;

    return {
      ok: false,
      code,
      ...(message ? { message } : {}),
    };
  } catch {
    return { ok: false, code: 'unavailable' };
  }
};

export const authApi = Object.freeze({
  signUp: (credentials: AuthCredentials) => postJson('/api/auth/sign-up', credentials),
  signIn: (credentials: AuthCredentials) => postJson('/api/auth/sign-in', credentials),
  signOut: () => postJson('/api/auth/sign-out'),
  requestPasswordReset: (email: string) => postJson('/api/auth/request-password-reset', { email }),
});