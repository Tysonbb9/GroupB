import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MAX_WEEKLY_HOURS, MIN_WEEKLY_HOURS, parseWeeklyHours } from '../lib/capacity';
import { theme } from '../theme';

type Props = {
  /** The student's allocated time now (hours a week), put in the box to start with. */
  capacity: number;
  /** Keeps the new hours (US-32). Rejects when they could not be kept. */
  onSaveHours: (hours: number) => Promise<void>;
  /** Opens Add a course, the first step to adding a syllabus. */
  onAddCourse: () => void;
  /** Leaves the welcome, from Skip or Later. */
  onClose: () => void;
};

const STEPS = 3;

/**
 * US-47 (#162): the short welcome a new account sees once, right after
 * signing up, and that Help on Forecast opens again.
 *
 * Three steps: what the app does, the hours the student sets aside each
 * week, and adding their first course and its syllabus. Skip leaves at any
 * step. The words are the ones agreed in US-43 (docs/UI_DESIGN.md, "Words
 * we use"): allocated time, heavy week.
 */
export function Welcome({ capacity, onSaveHours, onAddCourse, onClose }: Props) {
  const [step, setStep] = useState(1);
  const [text, setText] = useState(String(capacity));
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const saveHours = async () => {
    const hours = parseWeeklyHours(text);
    if (hours === null) {
      setProblem(`Enter whole hours from ${MIN_WEEKLY_HOURS} to ${MAX_WEEKLY_HOURS}.`);
      return;
    }
    // The same hours again: nothing to keep, just move on.
    if (hours !== capacity) {
      setSaving(true);
      try {
        await onSaveHours(hours);
      } catch {
        setProblem(`Could not save. Your hours are still ${capacity}.`);
        return;
      } finally {
        setSaving(false);
      }
    }
    setStep(3);
  };

  return (
    <View testID="welcome" style={styles.page}>
      <View style={styles.top}>
        <Text testID="welcome-step" style={styles.step}>
          Step {step} of {STEPS}
        </Text>
        {step < STEPS && (
          <Pressable testID="welcome-skip" accessibilityRole="button" hitSlop={10} onPress={onClose}>
            <Text style={styles.link}>Skip</Text>
          </Pressable>
        )}
      </View>

      {step === 1 && (
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.title}>
            Plan your weeks before they get heavy
          </Text>
          <Text style={styles.body}>
            Crunch Week adds up the hours your assignments need, week by week, for the whole semester.
          </Text>
          <Text style={styles.body}>
            It shows your heavy weeks, the ones that need more than your allocated time, and when to start so they fit.
          </Text>
          <Pressable testID="welcome-next" accessibilityRole="button" onPress={() => setStep(2)} style={styles.button}>
            <Text style={styles.buttonText}>Next</Text>
          </Pressable>
        </View>
      )}

      {step === 2 && (
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.title}>
            How many hours do you set aside for schoolwork each week?
          </Text>
          <Text style={styles.body}>This is your allocated time. Count the time outside class. You can change it later on Forecast.</Text>
          <TextInput
            testID="welcome-hours"
            accessibilityLabel="Hours you set aside each week"
            value={text}
            onChangeText={(value) => {
              setText(value);
              setProblem(null);
            }}
            onSubmitEditing={saveHours}
            keyboardType="number-pad"
            returnKeyType="done"
            selectTextOnFocus
            style={[styles.input, problem !== null && styles.inputProblem]}
          />
          {problem !== null ? (
            <Text testID="welcome-hours-problem" style={styles.problem} accessibilityLiveRegion="polite">
              {problem}
            </Text>
          ) : (
            <Text style={styles.help}>
              Whole hours, {MIN_WEEKLY_HOURS} to {MAX_WEEKLY_HOURS}.
            </Text>
          )}
          <Pressable
            testID="welcome-save-hours"
            accessibilityRole="button"
            accessibilityState={{ busy: saving }}
            disabled={saving}
            onPress={saveHours}
            style={styles.button}
          >
            <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save and continue'}</Text>
          </Pressable>
        </View>
      )}

      {step === 3 && (
        <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.title}>
            Add your first course
          </Text>
          <Text style={styles.body}>
            Add a course, then add its syllabus. The app finds the assignments and the week each one is due.
          </Text>
          <Pressable testID="welcome-add-course" accessibilityRole="button" onPress={onAddCourse} style={styles.button}>
            <Text style={styles.buttonText}>Add a course</Text>
          </Pressable>
          <Pressable testID="welcome-later" accessibilityRole="button" hitSlop={10} onPress={onClose}>
            <Text style={styles.later}>Later</Text>
          </Pressable>
          <Text style={styles.help}>You can open this again from the ? on Forecast.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: theme.space.lg, gap: theme.space.lg },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  step: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: theme.muted },
  link: { fontSize: 14, fontWeight: '600', color: theme.accent },
  card: { backgroundColor: theme.surface, padding: theme.space.lg, borderRadius: theme.radius, gap: theme.space.md },
  title: { fontSize: 20, fontWeight: '700', color: theme.ink },
  body: { fontSize: 16, lineHeight: 24, color: theme.muted },
  input: {
    width: 96,
    borderWidth: 1,
    borderColor: theme.rule,
    borderRadius: theme.radius,
    paddingHorizontal: theme.space.sm,
    paddingVertical: theme.space.xs,
    fontSize: 18,
    color: theme.ink,
    backgroundColor: theme.bg,
  },
  inputProblem: { borderColor: theme.heavy },
  help: { fontSize: 12, color: theme.muted },
  problem: { fontSize: 12, fontWeight: '600', color: theme.heavy },
  button: {
    backgroundColor: theme.accent,
    padding: theme.space.md,
    borderRadius: theme.radius,
    minHeight: 48,
    justifyContent: 'center',
  },
  buttonText: { color: theme.surface, fontWeight: '600', fontSize: 16, textAlign: 'center' },
  later: { fontSize: 16, fontWeight: '600', color: theme.accent, textAlign: 'center' },
});
