import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireUser } from './supabaseServer';

const createClient = (claims: unknown, error: Error | null = null): SupabaseClient => ({
  auth: {
    getClaims: vi.fn().mockResolvedValue({ data: claims, error }),
    getUser: vi.fn(() => { throw new Error('requireUser must not call the remote getUser endpoint'); }),
  },
} as unknown as SupabaseClient);

describe('requireUser', () => {
  it('returns the verified subject from cached JWT claims without calling getUser', async () => {
    const user = await requireUser(createClient({ claims: { sub: 'player-1' } }));

    expect(user).toEqual({ id: 'player-1' });
  });

  it('rejects missing or invalid verified claims', async () => {
    await expect(requireUser(createClient({ claims: {} }))).resolves.toBeNull();
    await expect(requireUser(createClient(null, new Error('invalid token')))).resolves.toBeNull();
  });
});
