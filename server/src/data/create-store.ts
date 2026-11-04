import type { Store } from './store';
import { MemoryStore } from './memory-store';
import { SupabaseStore } from './supabase-store';

export function createStore(): Store {
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (url && secretKey) {
    return new SupabaseStore(url, secretKey);
  }

  return new MemoryStore();
}