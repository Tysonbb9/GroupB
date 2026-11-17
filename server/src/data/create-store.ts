import type { Store } from './store';
import { MemoryStore } from './memory-store';
import { SupabaseStore } from './supabase-store';

export function createStore(): Store {
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (Boolean(url) !== Boolean(secretKey)) {
    throw new Error(
      'Incomplete Supabase configuration: both SUPABASE_URL and SUPABASE_SECRET_KEY are required.'
    );
  }

  if (url && secretKey) {
    return new SupabaseStore(url, secretKey);
  }

  return new MemoryStore();
}
