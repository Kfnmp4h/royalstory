import type { SupabaseClient } from '@supabase/supabase-js';

export interface AuthCredentials {
  readonly email: string;
  readonly password: string;
}

export type AuthResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: 'invalid_credentials' | 'confirmation_required' | 'unavailable' };

const normalizeCredentials = (input: AuthCredentials): AuthCredentials => {
  const email = input.email.trim().toLowerCase();
  if (!email.includes('@') || email.length > 320) throw new TypeError('A valid email address is required');
  if (input.password.length < 8 || input.password.length > 128) {
    throw new TypeError('Password must contain between 8 and 128 characters');
  }
  return { email, password: input.password };
};

export function createAuthService(client: SupabaseClient, appOrigin: string) {
  const signUp = async (input: AuthCredentials): Promise<AuthResult> => {
    const credentials = normalizeCredentials(input);
    const { data, error } = await client.auth.signUp({
      ...credentials,
      options: { emailRedirectTo: new URL('/api/auth/confirm', appOrigin).toString() },
    });
    if (error) return { ok: false, code: 'invalid_credentials' };
    if (!data.session) return { ok: false, code: 'confirmation_required' };
    return { ok: true };
  };

  const signIn = async (input: AuthCredentials): Promise<AuthResult> => {
    const credentials = normalizeCredentials(input);
    const { error } = await client.auth.signInWithPassword(credentials);
    return error ? { ok: false, code: 'invalid_credentials' } : { ok: true };
  };

  const signOut = async (): Promise<AuthResult> => {
    const { error } = await client.auth.signOut();
    return error ? { ok: false, code: 'unavailable' } : { ok: true };
  };

  const requestPasswordReset = async (emailValue: string): Promise<AuthResult> => {
    const email = emailValue.trim().toLowerCase();
    if (!email.includes('@') || email.length > 320) throw new TypeError('A valid email address is required');
    await client.auth.resetPasswordForEmail(email, {
      redirectTo: new URL('/reset-password', appOrigin).toString(),
    });
    return { ok: true };
  };

  const updatePassword = async (password: string): Promise<AuthResult> => {
    if (password.length < 8 || password.length > 128) {
      throw new TypeError('Password must contain between 8 and 128 characters');
    }
    const { error } = await client.auth.updateUser({ password });
    return error ? { ok: false, code: 'unavailable' } : { ok: true };
  };

  return Object.freeze({ signUp, signIn, signOut, requestPasswordReset, updatePassword });
}
