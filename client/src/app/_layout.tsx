import { Stack } from 'expo-router';
import React from 'react';
import { SemesterProvider } from '../state/semester-store';
import { theme } from '../theme';

export default function RootLayout() {
  return (
    <SemesterProvider>
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
