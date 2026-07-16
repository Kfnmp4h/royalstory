export interface AuthCredentials {
  readonly email: string;
  readonly password: string;
}

export type AuthApiResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: string; readonly message?: string };

const postJson = async (path: string, body?: Record<string, unknown>): Promise<AuthApiResult> => {
  try {
    const response = await fetch(path, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    const payload = await response.json() as Partial<AuthApiResult>;
    if (payload.ok === true) return { ok: true };
    return {
      ok: false,
      code: typeof payload.code === 'string' ? payload.code : 'unavailable',
      ...(typeof payload.message === 'string' ? { message: payload.message } : {}),
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
