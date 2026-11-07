import { Stack } from 'expo-router';
import React from 'react';
import { semester as fixture } from '../data/semester';
import { SemesterProvider } from '../state/semester-store';
import { SessionProvider, useSession } from '../state/session';
import { theme } from '../theme';

/**
 * Set EXPO_PUBLIC_USE_FIXTURE=1 (for example in client/.env.local) to run on
 * the hard-coded semester instead of the server. It is a manual switch: when
 * it is off and the server is down, the app says so instead of pretending.
 */
const USE_FIXTURE = process.env.EXPO_PUBLIC_USE_FIXTURE === '1';

/**
 * Log in is the front door. Until the student signs in, only the Log in
 * screen exists; after, only the app does, and Stack.Protected sends them to
 * whichever side is open. The semester loads only after signing in, so a
 * server that is down never hides the Log in screen.
 */
function RootNavigator() {
  const { email } = useSession();
  const signedIn = email !== null;

  const stack = (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.bg },
        headerTintColor: theme.ink,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.bg },
      }}
    >
      <Stack.Protected guard={signedIn}>
        {/* The tabs draw their own headers, so the stack's is hidden there. */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="syllabus" options={{ title: 'Add a Syllabus' }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );

  if (!signedIn) return stack;
  return <SemesterProvider initial={USE_FIXTURE ? fixture : undefined}>{stack}</SemesterProvider>;
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <RootNavigator />
    </SessionProvider>
  );
}
