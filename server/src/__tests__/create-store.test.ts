import { createStore } from '../data/create-store';
import { MemoryStore } from '../data/memory-store';
import { SupabaseStore } from '../data/supabase-store';

describe('createStore configuration', () => {
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SECRET_KEY;

  afterEach(() => {
    if (originalUrl === undefined) {
      delete process.env.SUPABASE_URL;
    } else {
      process.env.SUPABASE_URL = originalUrl;
    }

    if (originalKey === undefined) {
      delete process.env.SUPABASE_SECRET_KEY;
    } else {
      process.env.SUPABASE_SECRET_KEY = originalKey;
    }
  });

  test('uses MemoryStore when neither credential exists', () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SECRET_KEY;

    expect(createStore()).toBeInstanceOf(MemoryStore);
  });

  test('uses SupabaseStore when both credentials exist', () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SECRET_KEY = 'test-secret-key';

    expect(createStore()).toBeInstanceOf(SupabaseStore);
  });

  test('rejects a URL without a secret key', () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    delete process.env.SUPABASE_SECRET_KEY;

    expect(() => createStore()).toThrow(
      'Incomplete Supabase configuration'
    );
  });

  test('rejects a secret key without a URL', () => {
    delete process.env.SUPABASE_URL;
    process.env.SUPABASE_SECRET_KEY = 'test-secret-key';

    expect(() => createStore()).toThrow(
      'Incomplete Supabase configuration'
    );
  });
});
