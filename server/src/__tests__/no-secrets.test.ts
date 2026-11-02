import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * TP-44 (risk R6): no Supabase key is in a file git would commit.
 * Supabase 4/7. Runs in CI with every other test, so a committed key turns
 * the pull request red before it is merged.
 */

const repoRoot = path.resolve(__dirname, '../../..');

/** Shapes of real secrets. Each needs a long random tail, so prose about keys does not match. */
const SECRET_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: 'Supabase secret key', pattern: /sb_secret_[A-Za-z0-9_-]{20,}/ },
  // The older anon and service_role keys are JWTs: three base64url parts, the first two starting "eyJ".
  { name: 'JWT (legacy Supabase key)', pattern: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  // A database connection string with a password in it.
  { name: 'Postgres URL with a password', pattern: /postgres(?:ql)?:\/\/[^\s:/@]+:[^\s@]+@/ },
];

/** The names of the patterns found in some text. */
function findSecrets(text: string): string[] {
  return SECRET_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ name }) => name);
}

/** Files git tracks, plus new files it would add (anything not ignored). */
function committableFiles(): string[] {
  const out = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return out.split('\0').filter(Boolean);
}

function isIgnored(file: string): boolean {
  try {
    execFileSync('git', ['check-ignore', '-q', file], { cwd: repoRoot });
    return true;
  } catch {
    return false; // git check-ignore exits 1 when the file is not ignored
  }
}

describe('findSecrets', () => {
  // Built at run time so this file never contains a key-shaped string itself.
  const fakeTail = 'x'.repeat(30);

  it('spots each kind of key', () => {
    expect(findSecrets(`SUPABASE_SECRET_KEY=sb_secret_${fakeTail}`)).toEqual(['Supabase secret key']);
    expect(findSecrets(`key: eyJ${fakeTail}.eyJ${fakeTail}.${fakeTail}`)).toEqual(['JWT (legacy Supabase key)']);
    expect(findSecrets(['postgresql://postgres', 'hunter2@db.example.co:5432/postgres'].join(':'))).toEqual([
      'Postgres URL with a password',
    ]);
  });

  it('ignores the names of keys and talk about them', () => {
    expect(findSecrets('SUPABASE_SECRET_KEY=\nThe secret key starts with sb_secret_.')).toEqual([]);
    expect(findSecrets('https://gyrruunfpwoexoncceel.supabase.co')).toEqual([]);
  });
});

describe('the repository', () => {
  it('has no Supabase key in any file git would commit', () => {
    const found: string[] = [];
    for (const file of committableFiles()) {
      let text: string;
      try {
        text = readFileSync(path.join(repoRoot, file), 'utf8');
      } catch {
        continue; // listed by git but deleted locally
      }
      if (text.includes('\0')) continue; // binary, such as the test PDFs
      for (const name of findSecrets(text)) found.push(`${file}: ${name}`);
    }
    expect(found).toEqual([]);
  });

  it('ignores server/.env, where the keys go', () => {
    expect(isIgnored('server/.env')).toBe(true);
    expect(isIgnored('server/.env.example')).toBe(false);
  });
});
