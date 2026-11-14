import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { expo } from '@better-auth/expo';
import { Pool } from 'pg';

/**
 * Login (US-21). Better Auth keeps the accounts and sessions and answers the
 * routes under /api/auth (see app.ts and docs/LOGIN_DESIGN.md). Signing in
 * hands the phone a session cookie, which it sends with every request.
 */

const isProduction = process.env.NODE_ENV === 'production';

/**
 * A setting from server/.env. Outside production, a missing one uses the
 * development default, so the server runs with no setup. In production a
 * default would be wrong without anyone noticing, so the server stops at
 * startup instead. A setting left empty in .env arrives as "" and counts as
 * missing.
 */
function setting(name: string, devDefault: string): string {
  const value = process.env[name];
  if (value) return value;
  if (isProduction) throw new Error(`${name} must be set in production (see server/.env.example)`);
  return devDefault;
}

/** Expo Web's address, the only web page allowed to call the server with cookies. */
export const CLIENT_ORIGIN = setting('CLIENT_ORIGIN', 'http://localhost:8081');

/**
 * Where accounts are saved. With DATABASE_URL (Supabase's Postgres) they are
 * saved for good. Without it, while developing, they live in memory, so the
 * server runs with no setup; they disappear on restart. Same idea as
 * createStore().
 */
function authDatabase() {
  const connectionString = setting('DATABASE_URL', '');
  if (connectionString) {
    return new Pool({ connectionString });
  }
  return memoryAdapter({ user: [], session: [], account: [], verification: [] });
}

const DAY = 60 * 60 * 24; // seconds

export const auth = betterAuth({
  database: authDatabase(),
  // Without BETTER_AUTH_SECRET, Better Auth uses a built-in secret in
  // development and tests, and refuses to start in production.
  secret: process.env.BETTER_AUTH_SECRET || undefined,
  baseURL: setting('BETTER_AUTH_URL', `http://localhost:${process.env.PORT || 3000}`),
  // Email and password only. No email check and no forgot-password this
  // sprint, since both need to send email.
  emailAndPassword: { enabled: true },
  session: {
    expiresIn: 30 * DAY,
    updateAge: DAY, // each day the app is used pushes the 30 days back
  },
  // The addresses allowed to sign in: the app (its crunchweek:// links, from
  // client/app.json), Expo Go while developing, and Expo Web.
  trustedOrigins: [
    'crunchweek://',
    ...(isProduction ? [] : ['exp://*/*']),
    CLIENT_ORIGIN,
  ],
  // Better Auth skips its origin check under Jest unless told otherwise.
  // Keep it on, so the tests check the same protection the server runs with.
  advanced: { disableOriginCheck: false },
  plugins: [expo()],
});
