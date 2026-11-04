import { Tabs } from 'expo-router';
import React from 'react';
import { theme } from '../../theme';

/**
 * Option A (issue #96): the app is split into tabs, one focus per screen,
 * instead of one long scroll. Forecast is home: this week's hours, the
 * 15-week strip and the one thing to act on. This week is the list to work
 * through.
 *
 * The routes keep their addresses ("/" and "/week"), because a folder in
 * brackets groups screens without adding to the path.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.bg },
        headerTintColor: theme.ink,
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: theme.bg },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.rule },
        // No icon set is installed yet, so the tabs are labels only.
        tabBarIconStyle: { display: 'none' },
        tabBarLabelStyle: { fontSize: 13, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Forecast' }} />
      <Tabs.Screen name="week" options={{ title: 'This week' }} />
    </Tabs>
  );
}
