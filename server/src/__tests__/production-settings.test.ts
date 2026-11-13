import { randomBytes } from 'node:crypto';

/**
 * Outside production, a missing login setting uses its development default,
 * so anyone can run the server with no setup. In production
 * (NODE_ENV=production) a default would be wrong without anyone noticing:
 * accounts kept in memory and lost on restart, or a server that thinks it
 * lives at localhost. So there a missing setting stops the server at startup.
 */

const NAMES = ['NODE_ENV', 'DATABASE_URL', 'BETTER_AUTH_SECRET', 'BETTER_AUTH_URL', 'CLIENT_ORIGIN'];

let saved: Record<string, string | undefined>;
beforeEach(() => {
  saved = Object.fromEntries(NAMES.map((name) => [name, process.env[name]]));
});
afterEach(() => {
  for (const name of NAMES) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
});

/** A fresh copy of auth.ts, loaded with only these settings. */
function loadAuth(env: Record<string, string>): typeof import('../auth') {
  for (const name of NAMES) delete process.env[name];
  Object.assign(process.env, env);
  let auth!: typeof import('../auth');
  jest.isolateModules(() => {
    auth = require('../auth');
  });
  return auth;
}

/** Everything production needs. No password in the URL, so TP-44 stays happy. */
const PRODUCTION = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://localhost/crunchweek',
  BETTER_AUTH_SECRET: randomBytes(32).toString('hex'),
  BETTER_AUTH_URL: 'https://api.example.com',
  CLIENT_ORIGIN: 'https://app.example.com',
};

describe('outside production', () => {
  it('runs with no settings, on the development defaults', () => {
    expect(loadAuth({ NODE_ENV: 'development' }).CLIENT_ORIGIN).toBe('http://localhost:8081');
  });

  it('treats a setting left empty in .env as missing', () => {
    expect(loadAuth({ NODE_ENV: 'development', CLIENT_ORIGIN: '' }).CLIENT_ORIGIN).toBe('http://localhost:8081');
  });
});

describe('in production', () => {
  it('starts when every setting is there', () => {
    expect(loadAuth(PRODUCTION).CLIENT_ORIGIN).toBe('https://app.example.com');
  });

  it.each(['DATABASE_URL', 'BETTER_AUTH_URL', 'CLIENT_ORIGIN'])('stops when %s is missing', (name) => {
    const { [name as keyof typeof PRODUCTION]: _left, ...rest } = PRODUCTION;
    expect(() => loadAuth(rest)).toThrow(`${name} must be set in production`);
  });

  it.each(['DATABASE_URL', 'BETTER_AUTH_URL', 'CLIENT_ORIGIN'])('stops when %s is empty', (name) => {
    expect(() => loadAuth({ ...PRODUCTION, [name]: '' })).toThrow(`${name} must be set in production`);
  });
});
