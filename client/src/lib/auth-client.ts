import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { serverBaseUrl } from './api';
import { Auth, createServerAuth } from './auth';

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
  return createAuthClient({
    baseURL,
    fetchOptions: fetchImpl ? { customFetchImpl: fetchImpl } : undefined,
    plugins: [expoClient({ scheme: SCHEME, storagePrefix: STORAGE_PREFIX, storage })],
  });
}

let serverAuthForApp: Auth | null = null;

/**
 * Signing in with our server, for the app. Made on first use, not when this
 * file loads, because working out the server address can fail (a release
 * build with no EXPO_PUBLIC_API_URL), and that should not stop the app opening.
 */
export function serverAuth(): Auth {
  if (serverAuthForApp === null) {
    const serverAddress = serverBaseUrl();
    serverAuthForApp = createServerAuth(createCrunchWeekAuthClient(serverAddress, SecureStore), {
      serverAddress,
      isWeb: Platform.OS === 'web',
    });
  }
  return serverAuthForApp;
}
