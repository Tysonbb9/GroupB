import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable } from 'react-native';
import { useOptionalSession } from '../state/session';
import { theme } from '../theme';

/**
 * Signs the student out, which takes them back to the Log in screen (the
 * root layout only shows the app to someone signed in). Draws nothing when
 * the screen is shown without a session, as it is in tests and previews.
 */
export function LogOutButton() {
  const session = useOptionalSession();
  if (session === null) return null;

  return (
    <Pressable
      testID="log-out"
      accessibilityRole="button"
      accessibilityLabel={session.email ? `Log out ${session.email}` : 'Log out'}
      hitSlop={10}
      onPress={session.signOut}
    >
      <Ionicons name="log-out-outline" size={26} color={theme.accent} />
    </Pressable>
  );
}
