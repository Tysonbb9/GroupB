
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
 * - Password characters are hidden.
 * - Basic validation for empty fields and email format.
 * - A login button with clear feedback.
 * - Styling consistent with the existing app theme.
 * - Navigation to the login page from the Semester screen.
 *
 * Current Scope:
 * This is a frontend-only implementation.
 * No real authentication, API calls, or password storage.
 * Authentication and authorization will be implemented later.
 *
 * Testing:
 * Jest tests are located in:
 * client/src/__tests__/login.test.tsx
 */

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '../theme';

/**
 * US-27: A login screen the student can visit.
 * Authentication has not been implemented, so this screen never claims
 * that entering credentials signs the student in.
 */
export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleLogin = () => {
    if (!email.trim() || !password) {
      setMessage('Please enter your email and password.');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setMessage('Please enter a valid email address.');
    } else {
      setMessage('Sign-in is not connected yet. This is a preview of the login screen.');
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
          <TextInput
            testID="login-password"
            accessibilityLabel="Password"
            style={styles.input}
            placeholder="Enter your password"
            placeholderTextColor={theme.faint}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              setMessage('');
            }}
          />
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

      <Text style={styles.note}>
        Preview only. Account authentication has not been added to Crunch Week yet.
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
