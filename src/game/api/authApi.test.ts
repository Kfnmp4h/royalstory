import { afterEach, describe, expect, it, vi } from 'vitest';
import { authApi } from './authApi';

afterEach(() => vi.unstubAllGlobals());

describe('authApi', () => {
  it('posts credentials with the secure session cookie boundary', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(authApi.signIn({ email: 'player@example.com', password: 'password123' }))
      .resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/sign-in', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ email: 'player@example.com', password: 'password123' }),
    }));
  });

  it('updates a recovered password without exposing a Supabase browser client', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await authApi.updatePassword('replacement123');
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/update-password', expect.objectContaining({
      credentials: 'include',
      body: JSON.stringify({ password: 'replacement123' }),
    }));
  });

  it('maps malformed or unavailable responses to a safe result', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    await expect(authApi.signOut()).resolves.toEqual({ ok: false, code: 'unavailable' });
  });
});
