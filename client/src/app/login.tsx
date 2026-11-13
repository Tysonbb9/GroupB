
/**
 * CRUNCH WEEK — LOGIN SCREEN
 * User Stories: US-27 (Visit Login Screen) / US-19 (Login) / US-20 (Authenticated)
 *
 * The app's front door: it opens on this screen, and signing in opens the
 * tabs (Option A, #96). Log out on Forecast comes back here.
 *
 * - Log in with an email and password, or switch to Create account, which
 *   also asks for a name (docs/LOGIN_DESIGN.md: email and password only).
 * - Password characters are hidden by default, with a Show / Hide control.
 * - Empty fields, an email that does not look valid, and (for a new
 *   account) a password under the server's 8 characters are caught here,
 *   before asking the server.
 * - Anything the server refuses shows the server's own message, such as
 *   "Invalid email or password".
 * - In sample-data mode (no server) any email and password open the app,
 *   and a note under the form says so.
 *
 * Testing: client/src/__tests__/login.test.tsx and login-accounts.test.tsx
 */

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSession } from '../state/session';
import { theme } from '../theme';

/** The server refuses shorter passwords (docs/LOGIN_DESIGN.md), so say so first. */
const MIN_PASSWORD_LENGTH = 8;

type Mode = 'logIn' | 'signUp';

/** What each form says, so the two cannot drift apart. */
const WORDING: Record<
  Mode,
  { title: string; submit: string; busy: string; switchTo: string; missing: string }
> = {
  logIn: {
    title: 'Welcome back',
    submit: 'Log in',
    busy: 'Logging in…',
    switchTo: 'New here? Create an account',
    missing: 'Please enter your email and password.',
  },
  signUp: {
    title: 'Create your account',
    submit: 'Create account',
    busy: 'Creating account…',
    switchTo: 'Already have an account? Log in',
    missing: 'Please enter your name, email and password.',
  },
};

/** The problem with what was typed, before asking the server, or null if there is none. */
function formProblem(mode: Mode, name: string, email: string, password: string): string | null {
  if (!email || !password || (mode === 'signUp' && !name)) return WORDING[mode].missing;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email address.';
  if (mode === 'signUp' && password.length < MIN_PASSWORD_LENGTH) {
    return `Please choose a password of at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

/** US-27 and US-20: the login screen, and the first screen of the app. */
export default function LoginScreen() {
  const session = useSession();
  const [mode, setMode] = useState<Mode>('logIn');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  // The session's notice ("your session has ended") shows until the student starts typing.
  const [noticeRead, setNoticeRead] = useState(false);
  const wording = WORDING[mode];

  /** Every field change clears the old message, so it never describes stale input. */
  const edit = (set: (value: string) => void) => (value: string) => {
    set(value);
    setMessage('');
    setNoticeRead(true);
  };

  const switchMode = () => {
    setMode(mode === 'logIn' ? 'signUp' : 'logIn');
    setMessage('');
  };

  const handleSubmit = async () => {
    if (busy) return;
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    // The password is sent exactly as typed: spaces can be part of it.
    const problem = formProblem(mode, trimmedName, trimmedEmail, password);
    if (problem !== null) {
      setMessage(problem);
      return;
    }
    setBusy(true);
    // On success the root layout sees the session change and opens the app.
    const refusal =
      mode === 'logIn'
        ? await session.signIn(trimmedEmail, password)
        : await session.signUp(trimmedName, trimmedEmail, password);
    setBusy(false);
    if (refusal !== null) setMessage(refusal);
  };

  const notice = noticeRead ? null : session.notice;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.intro}>
        <Text style={styles.brand}>CRUNCH WEEK</Text>
        <Text style={styles.title}>{wording.title}</Text>
        <Text style={styles.subtitle}>Your semester, all in one place.</Text>
      </View>

      {notice ? (
        <Text testID="login-notice" accessibilityLiveRegion="polite" style={styles.message}>
          {notice}
        </Text>
      ) : null}

      <View style={styles.card}>
        {mode === 'signUp' ? (
          <View style={styles.field}>
            <Text style={styles.label}>Your name</Text>
            <TextInput
              testID="login-name"
              accessibilityLabel="Your name"
              style={styles.input}
              placeholder="Sam Student"
              placeholderTextColor={theme.faint}
              autoCapitalize="words"
              autoComplete="name"
              value={name}
              onChangeText={edit(setName)}
            />
          </View>
        ) : null}

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
            onChangeText={edit(setEmail)}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              testID="login-password"
              accessibilityLabel="Password"
              style={[styles.input, styles.passwordInput]}
              placeholder={mode === 'signUp' ? 'At least 8 characters' : 'Enter your password'}
              placeholderTextColor={theme.faint}
              secureTextEntry={!passwordVisible}
              autoCapitalize="none"
              autoComplete={mode === 'signUp' ? 'new-password' : 'password'}
              value={password}
              onChangeText={edit(setPassword)}
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
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={handleSubmit}
          style={[styles.button, busy && styles.buttonBusy]}
        >
          <Text style={styles.buttonText}>{busy ? wording.busy : wording.submit}</Text>
        </Pressable>

        {message ? (
          <Text testID="login-message" accessibilityLiveRegion="polite" style={styles.message}>
            {message}
          </Text>
        ) : null}

        <Pressable
          testID="switch-mode"
          accessibilityRole="button"
          onPress={switchMode}
          style={styles.switchButton}
        >
          <Text style={styles.visibilityText}>{wording.switchTo}</Text>
        </Pressable>
      </View>

      {session.checksPasswords ? null : (
        <Text testID="login-note" style={styles.note}>
          Sample data: any email and password open the app on this device.
        </Text>
      )}
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
  buttonBusy: { opacity: 0.7 },
  buttonText: { color: theme.surface, fontSize: 15, fontWeight: '700' },
  switchButton: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  message: { color: theme.accent, fontSize: 13, lineHeight: 19 },
  note: { color: theme.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
