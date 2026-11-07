
/**
 * CRUNCH WEEK — LOGIN SCREEN
 * User Stories: US-27 (Visit Login Screen) / US-19 (Login)
 *
 * GitHub Brief:
 * Create a simple, accessible login screen for the Crunch Week app.
 * The screen should follow the existing application's design
 * and allow students to enter their email and password.
 *
 * Implemented Features:
 * - Email and password input fields.
 * - Password characters are hidden by default, with an optional Show / Hide control.
 * - Basic validation for empty fields and email format.
 * - A login button with clear feedback.
 * - Styling consistent with the existing app theme.
 * - The app's front door: it opens on this screen, and signing in opens the
 *   tabs (Option A, #96). Log out on Forecast comes back here.
 *
 * Current Scope:
 * This is a frontend-only implementation.
 * No real authentication, API calls, or password storage: any valid-looking
 * email and password sign in for as long as the app is open (state/session).
 * Authentication and authorization will be implemented later.
 *
 * Testing:
 * Jest tests are located in:
 * client/src/__tests__/login.test.tsx
 */

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSession } from '../state/session';
import { theme } from '../theme';

/**
 * US-27: the login screen, and the first screen of the app.
 * There are no accounts yet, so the note under the form says that any email
 * and password open the app, rather than pretending to check them.
 */
export default function LoginScreen() {
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [message, setMessage] = useState('');

  const handleLogin = () => {
    if (!email.trim() || !password) {
      setMessage('Please enter your email and password.');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setMessage('Please enter a valid email address.');
    } else {
      // The root layout sees the session change and opens the app.
      signIn(email.trim());
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.intro}>
        <Text style={styles.brand}>CRUNCH WEEK</Text>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Your semester, all in one place.</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.field}>
          <Text style={styles.label}>Email address</Text>
          <TextInput
            testID="login-email"
            accessibilityLabel="Email address"
            style={styles.input}
            placeholder="you@school.edu"
            placeholderTextColor={theme.faint}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              setMessage('');
            }}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              testID="login-password"
              accessibilityLabel="Password"
              style={[styles.input, styles.passwordInput]}
              placeholder="Enter your password"
              placeholderTextColor={theme.faint}
              secureTextEntry={!passwordVisible}
              autoCapitalize="none"
              autoComplete="password"
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                setMessage('');
              }}
            />
            {/* Keep the password hidden by default; this control only changes visibility. */}
            <Pressable
              testID="toggle-password-visibility"
              accessibilityRole="button"
              accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
              onPress={() => setPasswordVisible((visible) => !visible)}
              style={styles.visibilityButton}
            >
              <Text style={styles.visibilityText}>{passwordVisible ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>
        </View>

        <Pressable
          testID="login-submit"
          accessibilityRole="button"
          onPress={handleLogin}
          style={styles.button}
        >
          <Text style={styles.buttonText}>Log in</Text>
        </Pressable>

        {message ? (
          <Text testID="login-message" accessibilityLiveRegion="polite" style={styles.message}>
            {message}
          </Text>
        ) : null}
      </View>

      <Text testID="login-note" style={styles.note}>
        No accounts yet: any email and password open the app on this device. Real sign-in comes
        later.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: theme.space.lg,
    gap: theme.space.lg,
  },
  intro: { gap: theme.space.xs },
  brand: { color: theme.accent, fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  title: { color: theme.ink, fontSize: 28, fontWeight: '700' },
  subtitle: { color: theme.muted, fontSize: 14 },
  card: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.rule,
    borderRadius: theme.radius,
    padding: theme.space.lg,
    gap: theme.space.md,
  },
  field: { gap: theme.space.sm },
  label: { color: theme.ink, fontSize: 14, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: theme.rule,
    borderRadius: theme.radius,
    color: theme.ink,
    backgroundColor: theme.surface,
    paddingHorizontal: theme.space.md,
    paddingVertical: 12,
    fontSize: 16,
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space.sm },
  passwordInput: { flex: 1 },
  visibilityButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: theme.space.sm,
    borderRadius: theme.radius,
  },
  visibilityText: { color: theme.accent, fontWeight: '700', fontSize: 14 },
  button: {
    backgroundColor: theme.accent,
    borderRadius: theme.radius,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: theme.surface, fontSize: 15, fontWeight: '700' },
  message: { color: theme.accent, fontSize: 13, lineHeight: 19 },
  note: { color: theme.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
