import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CalendarChanges } from '../components/CalendarChanges';
import { DraftBlocker, DraftCard, DraftNotice } from '../components/DraftCard';
import {
  addCalendarEvents,
  CalendarChange,
  CalendarProposals,
  fetchCalendarChanges,
  fetchCalendarEvents,
  NewCalendarTask,
} from '../lib/api';
import { checkDraft, Draft } from '../lib/review';
import { useSemester } from '../state/semester-store';
import { theme } from '../theme';

/** One event under review: the draft the student edits, and what it came from. */
type Row = {
  eventId: string;
  draft: Draft;
  /** The course it goes in, or null until the student places it. */
  courseId: string | null;
  alreadyInSemester: boolean;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * US-49 (#165): review the events from a saved Moodle calendar before they
 * become tasks, the same way a syllabus is reviewed (US-30).
 *
 * Each event arrives with its title, its semester week and, when it could
 * be matched, its course. Events that name no course of the student's wait
 * for them to place it. Events carry no hours, so tasks arrive without an
 * estimate unless the student types one (US-13). Nothing is saved until Add.
 *
 * US-50 (#166): above them, deadlines that changed in Moodle since they were
 * added (moved or removed), each waiting for Accept or Keep mine.
 */
export default function CalendarScreen() {
  const { semester, addTasks, replaceTasks, removeTasks } = useSemester();
  const [loaded, setLoaded] = useState<CalendarProposals | null>(null);
  const [changes, setChanges] = useState<CalendarChange[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<(string | null)[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Both read the same calendar; a link that stopped working fails both, with one message.
    Promise.all([fetchCalendarEvents(), fetchCalendarChanges()])
      .then(([result, changed]) => {
        if (cancelled) return;
        setLoaded(result);
        setChanges(changed?.changes ?? []);
        setRows(
          result.proposals.map((p) => ({
            eventId: p.eventId,
            draft: { title: p.title, week: String(p.dueWeek), hours: '' },
            courseId: p.courseId,
            alreadyInSemester: p.alreadyInSemester,
          }))
        );
      })
      .catch((error: Error) => {
        if (!cancelled) setLoadError(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const code = (id: string | null) => semester.courses.find((c) => c.id === id)?.code ?? '';

  const edit = (index: number, field: keyof Draft, value: string) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, draft: { ...row.draft, [field]: value } } : row)));
  const place = (index: number, courseId: string) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, courseId } : row)));
  const remove = (index: number) => {
    setRows((current) => current.filter((_, i) => i !== index));
    setErrors((current) => current.filter((_, i) => i !== index));
  };

  const add = async () => {
    if (rows.length === 0 || saving) return;

    // Check every row first, so the student sees every problem at once.
    const problems: (string | null)[] = [];
    const ready: NewCalendarTask[] = [];
    for (const row of rows) {
      const checked = checkDraft(row.draft);
      if (!checked.ok) problems.push(checked.error);
      else if (row.courseId === null) problems.push('Choose the course this belongs to.');
      else {
        problems.push(null);
        ready.push({ eventId: row.eventId, courseId: row.courseId, ...checked.value });
      }
    }
    setErrors(problems);
    if (ready.length < rows.length) {
      setStatus('Fix the highlighted assignments first.');
      return;
    }

    setSaving(true);
    try {
      const saved = await addCalendarEvents(ready);
      addTasks(saved);
      setStatus(`Added ${plural(saved.length, 'assignment', 'assignments')} from your Moodle calendar.`);
      setRows([]);
      setErrors([]);
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loadError !== null) {
    return (
      <View style={styles.page}>
        <DraftNotice testID="calendar-load-error" error>
          {loadError}
        </DraftNotice>
      </View>
    );
  }

  if (loaded === null) {
    return (
      <View style={[styles.page, styles.center]}>
        <ActivityIndicator color={theme.accent} />
        <Text style={styles.faint}>Reading your Moodle calendar…</Text>
      </View>
    );
  }

  const skipped: string[] = [];
  if (loaded.alreadyAdded > 0) skipped.push(`${plural(loaded.alreadyAdded, 'event was', 'events were')} added before`);
  if (loaded.outsideSemester > 0) skipped.push(`${plural(loaded.outsideSemester, 'event falls', 'events fall')} outside weeks 1 to 15`);

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <CalendarChanges
        changes={changes}
        onSettled={({ tasks, removedTaskIds }) => {
          replaceTasks(tasks);
          removeTasks(removedTaskIds);
        }}
      />

      {rows.length > 0 ? (
        <>
          <View testID="calendar-review-banner" style={styles.banner}>
            <Text style={styles.bannerText}>From your Moodle calendar. Check them before they reach your forecast.</Text>
          </View>
          <Text style={styles.faint}>
            {`Found ${plural(rows.length, 'new assignment', 'new assignments')}. Calendar events have no hours, so add them now or later.`}
          </Text>
        </>
      ) : (
        status === null &&
        changes.length === 0 && (
          <Text testID="calendar-nothing-new" style={styles.text}>
            Nothing new in your Moodle calendar.
          </Text>
        )
      )}
      {skipped.length > 0 && (
        <Text testID="calendar-skipped" style={styles.faint}>
          {`Not shown: ${skipped.join(', and ')}.`}
        </Text>
      )}

      {rows.map((row, i) => (
        <View key={row.eventId} style={styles.row}>
          <View style={styles.courses}>
            <Text style={styles.label}>{row.courseId === null ? 'Which course?' : 'Course'}</Text>
            {semester.courses.map((course) => (
              <Pressable
                key={course.id}
                accessibilityRole="button"
                accessibilityLabel={`Put ${row.draft.title || `assignment ${i + 1}`} in ${course.code}`}
                accessibilityState={{ selected: row.courseId === course.id }}
                onPress={() => place(i, course.id)}
                style={[styles.chip, row.courseId === course.id && styles.chipOn]}
              >
                <Text style={[styles.chipText, row.courseId === course.id && styles.chipTextOn]}>{course.code}</Text>
              </Pressable>
            ))}
          </View>
          <DraftCard
            draft={row.draft}
            index={i}
            error={errors[i]}
            // A notice also marks the card as needing review, so an unplaced
            // event never shows the "ready to add" tick.
            duplicateHint={
              row.courseId === null
                ? 'Choose the course this belongs to, above.'
                : row.alreadyInSemester
                  ? `Already in your semester for ${code(row.courseId)}, week ${row.draft.week}. Remove it unless it is a different assignment.`
                  : undefined
            }
            onChange={(field, value) => edit(i, field, value)}
            onRemove={() => remove(i)}
          />
        </View>
      ))}

      {rows.length > 0 && (
        <>
          <DraftBlocker drafts={rows.map((row) => row.draft)} />
          <Pressable
            testID="calendar-add"
            accessibilityRole="button"
            accessibilityState={{ disabled: saving }}
            disabled={saving}
            onPress={add}
            style={[styles.button, saving && styles.off]}
          >
            <Text style={styles.buttonText}>{saving ? 'Adding…' : 'Add to semester'}</Text>
          </Pressable>
        </>
      )}

      {status !== null && (
        <Text testID="calendar-status" accessibilityLiveRegion="polite" style={styles.text}>
          {status}
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: theme.space.md, gap: theme.space.sm },
  center: { alignItems: 'center', justifyContent: 'center', gap: theme.space.sm, paddingTop: theme.space.xl },
  banner: { backgroundColor: theme.accentSoft, borderRadius: theme.radius, padding: theme.space.sm },
  bannerText: { color: theme.accent, fontWeight: '700' },
  text: { color: theme.ink, fontSize: 14 },
  faint: { color: theme.muted, fontSize: 13 },
  row: { gap: theme.space.xs },
  courses: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.space.xs },
  label: { color: theme.muted, fontSize: 13, fontWeight: '600' },
  chip: { borderWidth: 1, borderColor: theme.rule, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipOn: { borderColor: theme.accent, backgroundColor: theme.accentSoft },
  chipText: { color: theme.muted, fontSize: 12, fontWeight: '600' },
  chipTextOn: { color: theme.accent },
  button: { backgroundColor: theme.accent, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  off: { opacity: 0.6 },
  buttonText: { color: theme.surface, fontSize: 15, fontWeight: '700' },
});
