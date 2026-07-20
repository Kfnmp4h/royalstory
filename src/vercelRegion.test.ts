import { describe, expect, it } from 'vitest';
import vercelConfigSource from '../vercel.json?raw';

describe('Vercel production region', () => {
  it('runs API functions in Dublin near the Supabase eu-west-1 database', () => {
    const config = JSON.parse(vercelConfigSource) as { regions?: string[] };

    expect(config.regions).toEqual(['dub1']);
  });
});
