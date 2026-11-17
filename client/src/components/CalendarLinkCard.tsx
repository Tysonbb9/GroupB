import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CalendarLinkStatus, fetchCalendarLinkStatus, saveCalendarLink } from '../lib/api';
import { theme } from '../theme';

/** "Nov 16", for when the link was saved. */
function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * US-48 (#164): paste a Moodle calendar link once, on the Courses tab.
 *
 * The server checks the link and fetches it once to make sure it gives a
 * calendar before saving it. The link holds a private token, so once saved
 * it is never shown again: the box empties and the card only says it is
 * connected, and when. Replace link takes a new one. The due dates
 * themselves are read in later stories (#165, #166).
 */
export function CalendarLinkCard() {
  const [status, setStatus] = useState<CalendarLinkStatus | null>(null);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchCalendarLinkStatus()
      .then((loaded) => {
        if (!cancelled) setStatus(loaded);
      })
      // If the status cannot be read, offer the box anyway; saving says what went wrong.
      .catch(() => {
        if (!cancelled) setStatus({ saved: false, savedAt: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === null) return null;

  const save = async () => {
    if (text.trim() === '') {
      setProblem('Paste your Moodle calendar link.');
      return;
    }
    setSaving(true);
    setProblem(null);
    try {
      const saved = await saveCalendarLink(text.trim());
      setStatus(saved);
      setText(''); // the link holds a private token, so it does not stay on screen
      setEditing(false);
    } catch (error) {
      setProblem((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const showForm = !status.saved || editing;

  return (
    <View testID="calendar-link" style={styles.card}>
      <View style={styles.top}>
        <Ionicons name="calendar-outline" size={16} color={theme.accent} />
        <Text accessibilityRole="header" style={styles.title}>
          Moodle calendar
        </Text>
      </View>

      {status.saved && status.savedAt !== null && (
        <View style={styles.row}>
          <Text testID="calendar-link-status" style={styles.connected}>
            Connected · saved {shortDate(status.savedAt)}
          </Text>
          {!editing && (
            <Pressable
              testID="calendar-link-replace"
              accessibilityRole="button"
              accessibilityLabel="Replace your Moodle calendar link"
              hitSlop={8}
              onPress={() => {
                setProblem(null);
                setEditing(true);
              }}
            >
              <Text style={styles.link}>Replace link</Text>
            </Pressable>
          )}
        </View>
      )}

      {showForm && (
        <>
          <Text style={styles.help}>
            In Moodle, open Calendar, then Export calendar, and tap Get calendar URL. Paste the link here once.
          </Text>
          <TextInput
            testID="calendar-link-input"
            accessibilityLabel="Moodle calendar link"
            value={text}
            onChangeText={(value) => {
              setText(value);
              setProblem(null);
            }}
            placeholder="https://moodle.calvin.edu/calendar/export_execute.php?…"
            placeholderTextColor={theme.faint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={[styles.input, problem !== null && styles.inputProblem]}
          />
          <View style={styles.row}>
            <Pressable
              testID="calendar-link-save"
              accessibilityRole="button"
              accessibilityLabel="Save the Moodle calendar link"
              accessibilityState={{ disabled: saving }}
              disabled={saving}
              onPress={save}
              style={[styles.button, saving && styles.off]}
            >
              <Text style={styles.buttonText}>{saving ? 'Checking…' : 'Save'}</Text>
            </Pressable>
            {editing && (
              <Pressable
                testID="calendar-link-cancel"
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => {
                  setText('');
                  setProblem(null);
                  setEditing(false);
                }}
              >
                <Text style={styles.cancel}>Cancel</Text>
              </Pressable>
            )}
          </View>
          {problem !== null && (
            <Text testID="calendar-link-problem" accessibilityLiveRegion="polite" style={styles.problem}>
              {problem}
            </Text>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.surface,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.rule,
    padding: theme.space.md,
    gap: theme.space.sm,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: theme.space.xs },
  title: { fontSize: 15, fontWeight: '800', color: theme.ink },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: theme.space.md },
  connected: { fontSize: 13, fontWeight: '600', color: theme.accent },
  link: { fontSize: 13, fontWeight: '700', color: theme.accent },
  help: { fontSize: 12, color: theme.muted, lineHeight: 17 },
  input: {
    borderWidth: 1,
    borderColor: theme.rule,
    borderRadius: theme.radius,
    paddingHorizontal: theme.space.sm,
    paddingVertical: theme.space.xs + 2,
    fontSize: 14,
    color: theme.ink,
    backgroundColor: theme.bg,
  },
  inputProblem: { borderColor: theme.heavy },
  button: { backgroundColor: theme.accent, borderRadius: 999, paddingHorizontal: theme.space.md, paddingVertical: 8 },
  off: { opacity: 0.6 },
  buttonText: { color: theme.surface, fontSize: 14, fontWeight: '700' },
  cancel: { fontSize: 13, color: theme.muted },
  problem: { fontSize: 12, fontWeight: '600', color: theme.heavy },
});
