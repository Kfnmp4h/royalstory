import { createClient } from '@supabase/supabase-js';
import { getServerEnv } from './env';
import type { ProfileDatabase, ProfileDatabaseRow } from './profileRepository';

const selectColumns = 'user_id,character_name,normalized_name,created_at,updated_at';

export function createSupabaseProfileDatabase(): ProfileDatabase {
  const env = getServerEnv();
  const client = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  return {
    async findByUserId(userId) {
      const { data, error } = await client
        .from('player_profiles')
        .select(selectColumns)
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data as ProfileDatabaseRow | null;
    },

    async create(userId, characterName) {
      const { data, error } = await client.rpc('create_player_profile', {
        profile_user_id: userId,
        requested_name: characterName,
      });
      if (error) throw error;
      const rows = data as ProfileDatabaseRow[] | null;
      const row = rows?.[0];
      if (!row) throw new Error('Profile creation returned no row.');
      return row;
    },
  };
}
