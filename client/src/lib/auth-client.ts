import { expoClient, getCookie, getSetCookie, hasBetterAuthCookies, storageAdapter } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { serverBaseUrl } from './api';
import { Auth, createServerAuth, unavailableAuth } from './auth';

/**
 * The real Better Auth client, set up as docs/LOGIN_DESIGN.md says. This is
 * the only file that imports Better Auth; lib/auth.ts holds the rules.
 */

/** Matches the scheme in app.json, which Better Auth uses for links back into the app. */
const SCHEME = 'crunchweek';
/** Every key the session is saved under in SecureStore starts with this. */
const STORAGE_PREFIX = 'crunchweek';

/** What Better Auth's Expo plugin needs to save the session: SecureStore, or a stand-in. */
export type SessionStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
};

/**
 * Makes a Better Auth client for our server. Tests pass their own storage
 * and network; the app passes SecureStore and the real fetch.
 */
export function createCrunchWeekAuthClient(
  baseURL: string,
  storage: SessionStorage,
  fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
) {
  const cookies = storageAdapter(storage);
  const client = createAuthClient({
    baseURL,
    fetchOptions: fetchImpl ? { customFetchImpl: fetchImpl } : undefined,
    plugins: [expoClient({ scheme: SCHEME, storagePrefix: STORAGE_PREFIX, storage })],
  });
  return {
    signIn: client.signIn, signUp: client.signUp, signOut: client.signOut,
    getSession: client.getSession, getCookie: client.getCookie,
    receiveCookie: (header: string, sentCookie: string) => {
      if (!sentCookie || !hasBetterAuthCookies(header, 'better-auth')) return;
      const key = `${STORAGE_PREFIX}_cookie`, current = cookies.getItem(key);
      // Check and write together, so a late response cannot undo logout or
      // replace a newer sign-in. Expo owns parsing, expiry and storage chunks.
      if (getCookie(current) !== sentCookie) return;
      cookies.setItem(key, getSetCookie(header, current ?? undefined));
    },
  };
}

/**
 * Signing in with the server at `serverAddress()`. Working out that address
 * can fail (a release build with no EXPO_PUBLIC_API_URL); the app then still
 * opens, and Log in says what is wrong.
 */
export function createAppAuth(
  serverAddress: () => string,
  storage: SessionStorage,
  isWeb: boolean
): Auth {
  let address: string;
  try {
    address = serverAddress();
  } catch (error) {
    return unavailableAuth(error instanceof Error ? error.message : String(error));
  }
  return createServerAuth(createCrunchWeekAuthClient(address, storage), { serverAddress: address, isWeb });
}

let serverAuthForApp: Auth | null = null;

/** Signing in with our server, for the app: made once, so every screen shares one session. */
export function serverAuth(): Auth {
  serverAuthForApp ??= createAppAuth(serverBaseUrl, SecureStore, Platform.OS === 'web');
  return serverAuthForApp;
}
