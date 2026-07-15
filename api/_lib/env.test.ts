import { describe, expect, it } from 'vitest';
import { getServerEnv } from './env';

describe('getServerEnv', () => {
  it('requires every server-only configuration value', () => {
    expect(() => getServerEnv({
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
      APP_ORIGIN: 'https://royalstory.example',
    })).toThrow('SUPABASE_SERVICE_ROLE_KEY is required');
  });

  it('rejects malformed or insecure public origins', () => {
    expect(() => getServerEnv({
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      APP_ORIGIN: 'not-a-url',
    })).toThrow('APP_ORIGIN must be an absolute HTTPS URL');
  });

  it('returns validated configuration without changing the supplied values', () => {
    expect(getServerEnv({
      SUPABASE_URL: 'https://project.supabase.co/',
      SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      APP_ORIGIN: 'https://royalstory.example/path',
    })).toEqual({
      supabaseUrl: 'https://project.supabase.co',
      supabasePublishableKey: 'publishable-key',
      supabaseServiceRoleKey: 'service-role-key',
      appOrigin: 'https://royalstory.example',
    });
  });
});
