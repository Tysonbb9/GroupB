import { Stack } from 'expo-router';
import React from 'react';
import { semester as fixture } from '../data/semester';
import { SemesterProvider } from '../state/semester-store';
import { theme } from '../theme';

/**
 * Set EXPO_PUBLIC_USE_FIXTURE=1 (for example in client/.env.local) to run on
 * the hard-coded semester instead of the server. It is a manual switch: when
 * it is off and the server is down, the app says so instead of pretending.
 */
const USE_FIXTURE = process.env.EXPO_PUBLIC_USE_FIXTURE === '1';

export default function RootLayout() {
  return (
    <SemesterProvider initial={USE_FIXTURE ? fixture : undefined}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.bg },
          headerTintColor: theme.ink,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Crunch Week' }} />
        <Stack.Screen name="week" options={{ title: 'This week' }} />
      </Stack>
    </SemesterProvider>
  );
}
