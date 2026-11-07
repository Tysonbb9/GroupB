import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import type { ColorValue } from 'react-native';
import { theme } from '../../theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

type TabIconProps = {
  focused: boolean;
  /**
   * Typed as any colour value, which the icon does not accept. It is always
   * one of the theme's colour strings set in screenOptions below.
   */
  color: ColorValue | null;
  size: number;
  open: IconName;
  closed: IconName;
};

/** A tab's icon: filled while its tab is open, outlined otherwise. */
function TabIcon({ focused, color, size, open, closed }: TabIconProps) {
  return <Ionicons name={focused ? open : closed} color={String(color)} size={size} />;
}

/**
 * Option A (issue #96): the app is split into tabs, one focus per screen,
 * instead of one long scroll. Forecast is home: this week's hours, the
 * 15-week strip and the one thing to act on. This week is the list to work
 * through. Courses holds what used to crowd the first screen.
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
        headerTitleAlign: 'left',
        headerTitleStyle: { fontSize: 26, fontWeight: '700', color: theme.ink },
        sceneStyle: { backgroundColor: theme.bg },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.faint,
        tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.rule },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Forecast',
          tabBarIcon: (props) => <TabIcon {...props} open="stats-chart" closed="stats-chart-outline" />,
        }}
      />
      <Tabs.Screen
        name="week"
        options={{
          title: 'This week',
          tabBarIcon: (props) => <TabIcon {...props} open="checkbox" closed="checkbox-outline" />,
        }}
      />
      <Tabs.Screen
        name="courses"
        options={{
          title: 'Courses',
          tabBarIcon: (props) => <TabIcon {...props} open="school" closed="school-outline" />,
        }}
      />
    </Tabs>
  );
}
