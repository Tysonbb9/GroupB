import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useOptionalSession } from '../state/session';
import { theme } from '../theme';

/** What a screen reader says for either button: the action and who is signed in. */
function logOutLabel(email: string | null): string {
  return email ? `Log out ${email}` : 'Log out';
}

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
      accessibilityLabel={logOutLabel(session.email)}
      hitSlop={10}
      onPress={session.signOut}
    >
      <Ionicons name="log-out-outline" size={26} color={theme.accent} />
    </Pressable>
  );
}

/**
 * The same action as a line of text, for the loading and error screens.
 * They replace the whole app until the semester arrives, so without this a
 * student whose semester never loads could not sign out or switch email.
 */
export function LogOutLink() {
  const session = useOptionalSession();
  if (session === null) return null;

  return (
    <Pressable
      testID="log-out"
      accessibilityRole="button"
      accessibilityLabel={logOutLabel(session.email)}
      hitSlop={10}
      onPress={session.signOut}
    >
      <Text style={styles.link}>Log out</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { fontSize: 14, fontWeight: '600', color: theme.accent },
});
