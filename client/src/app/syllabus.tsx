import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { addTasks, extractSyllabusText } from '../lib/api';
import { scanSyllabus } from '../lib/inputs';
import { pickPdf } from '../lib/pick-pdf';
import { checkDraft, Draft, toDraft } from '../lib/review';
import { useSemester } from '../state/semester-store';
import { theme } from '../theme';

/**
 * US-28: paste a course's syllabus text and see the assignments found in it,
 * plus the lines that could not be read.
 *
 * US-30: before anything is added, the student can fix the title, week and
 * hours of each assignment, or remove it. Add to semester checks every one,
 * saves them with POST /tasks, and only then changes the forecast.
 *
 * US-29: Choose PDF sends a syllabus PDF to the server, puts the text that
 * comes back in the text box, and scans it the same way as pasted text.
 */
export default function SyllabusScreen() {
  const { semester, addTasks: addToSemester } = useSemester();
  const [courseId, setCourseId] = useState(semester.courses[0]?.id ?? '');
  const [text, setText] = useState('');
  /** The assignments being reviewed. null until Find assignments is pressed. */
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  /** One message per draft, or null when that draft is fine. */
  const [errors, setErrors] = useState<(string | null)[]>([]);
  /** What happened when the student pressed Add to semester. */
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** A problem reading the PDF, in words the student can act on. */
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const course = semester.courses.find((c) => c.id === courseId);

  /** Scans some syllabus text and shows what was found, ready to review. */
  const findIn = (syllabusText: string) => {
    const result = scanSyllabus(syllabusText, courseId);
    setDrafts(result.tasks.map(toDraft));
    setSkipped(result.skipped);
    setErrors([]);
    setStatus(null);
  };

  const find = () => findIn(text);

  const choosePdf = async () => {
    setPdfError(null);
    const pdf = await pickPdf();
    if (pdf === null) return; // the student cancelled

    setReading(true);
    try {
      const extracted = await extractSyllabusText(pdf);
      setText(extracted.text); // so the student can see, and fix, what was read
      findIn(extracted.text);
    } catch (e) {
      // The server's message says what to do, e.g. "...or paste the syllabus
      // text instead" for a scanned PDF. The text box below is that option.
      setPdfError((e as Error).message);
    } finally {
      setReading(false);
    }
  };

  const chooseCourse = (id: string) => {
    setCourseId(id);
    setDrafts(null);
    setSkipped([]);
    setErrors([]);
    setStatus(null);
  };

  /** Changes one field of one draft. */
  const edit = (index: number, field: keyof Draft, value: string) => {
    setDrafts((current) =>
      current === null ? current : current.map((d, i) => (i === index ? { ...d, [field]: value } : d))
    );
  };

  const remove = (index: number) => {
    setDrafts((current) => (current === null ? current : current.filter((_, i) => i !== index)));
    setErrors((current) => current.filter((_, i) => i !== index));
  };

  const add = async () => {
    if (drafts === null || drafts.length === 0) return;

    // Check every draft first, so the student sees every problem at once.
    const checked = drafts.map(checkDraft);
    setErrors(checked.map((c) => (c.ok ? null : c.error)));
    if (checked.some((c) => !c.ok)) {
      setStatus('Fix the highlighted assignments first.');
      return;
    }

    setSaving(true);
    try {
      const saved = await addTasks(
        checked.map((c) => (c.ok ? { courseId, ...c.value } : null)).filter((t) => t !== null)
      );
      addToSemester(saved);
      setStatus(
        `Added ${saved.length} ${saved.length === 1 ? 'assignment' : 'assignments'} to ${course?.code}.`
      );
      setDrafts(null);
      setSkipped([]);
      setText('');
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.heading}>Course</Text>
      <View style={styles.row}>
        {semester.courses.map((c) => (
          <Pressable
            key={c.id}
            accessibilityRole="button"
            accessibilityLabel={`Choose ${c.code}`}
            onPress={() => chooseCourse(c.id)}
            style={[styles.chip, c.id === courseId && styles.chipOn]}
          >
            <Text style={styles.text}>{c.code}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        testID="syllabus-pdf"
        accessibilityRole="button"
        accessibilityState={{ disabled: reading }}
        disabled={reading}
        onPress={choosePdf}
        style={[styles.button, reading && styles.buttonOff]}
      >
        <Text style={styles.buttonText}>{reading ? 'Reading the PDF…' : 'Choose PDF'}</Text>
      </Pressable>

      {pdfError !== null && (
        <Text testID="syllabus-pdf-error" style={styles.error}>
          {pdfError}
        </Text>
      )}

      <Text style={styles.label}>Or paste the syllabus text:</Text>
      <TextInput
        testID="syllabus-input"
        accessibilityLabel="Syllabus text"
        multiline
        value={text}
        onChangeText={setText}
        placeholder={'Week 4: Lab report (3 hours)\nWeek 7: Midterm 1 (8 hours)'}
        placeholderTextColor={theme.faint}
        style={styles.input}
      />

      <Pressable testID="syllabus-find" accessibilityRole="button" onPress={find} style={styles.button}>
        <Text style={styles.buttonText}>Find assignments</Text>
      </Pressable>

      {drafts !== null && (
        <View style={styles.results}>
          <Text style={styles.heading}>
            Found {drafts.length} {drafts.length === 1 ? 'assignment' : 'assignments'} for {course?.code}
          </Text>

          {drafts.map((draft, i) => (
            <View key={i} style={[styles.draft, errors[i] && styles.draftBad]}>
              <TextInput
                testID={`draft-title-${i}`}
                accessibilityLabel={`Title of assignment ${i + 1}`}
                value={draft.title}
                onChangeText={(v) => edit(i, 'title', v)}
                style={styles.field}
              />
              <View style={styles.row}>
                <Text style={styles.faint}>Week</Text>
                <TextInput
                  testID={`draft-week-${i}`}
                  accessibilityLabel={`Due week of assignment ${i + 1}`}
                  value={draft.week}
                  onChangeText={(v) => edit(i, 'week', v)}
                  keyboardType="number-pad"
                  style={[styles.field, styles.small]}
                />
                <Text style={styles.faint}>Hours</Text>
                <TextInput
                  testID={`draft-hours-${i}`}
                  accessibilityLabel={`Estimated hours of assignment ${i + 1}`}
                  value={draft.hours}
                  onChangeText={(v) => edit(i, 'hours', v)}
                  placeholder="?"
                  keyboardType="decimal-pad"
                  style={[styles.field, styles.small]}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${draft.title || `assignment ${i + 1}`}`}
                  onPress={() => remove(i)}
                >
                  <Text style={styles.link}>Remove</Text>
                </Pressable>
              </View>
              {errors[i] && <Text style={styles.error}>{errors[i]}</Text>}
            </View>
          ))}

          {drafts.length > 0 && (
            <Pressable
            testID="syllabus-add"
            accessibilityRole="button"
            accessibilityState={{ disabled: saving }}
            disabled={saving}
            onPress={add}
            style={[styles.button, saving && styles.buttonOff]}
          >
            <Text style={styles.buttonText}>Add to semester</Text>
          </Pressable>
          )}

          {skipped.length > 0 && (
            <>
              <Text style={styles.heading}>
                Could not read {skipped.length} {skipped.length === 1 ? 'line' : 'lines'}
              </Text>
              {skipped.map((line, i) => (
                <Text key={i} style={styles.faint}>{line}</Text>
              ))}
            </>
          )}
        </View>
      )}

      {status !== null && (
        <Text testID="syllabus-status" style={styles.text}>
          {status}
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: theme.space.md, gap: theme.space.sm },
  heading: { color: theme.ink, fontWeight: '700' },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.space.xs },
  chip: { borderWidth: 1, borderColor: theme.rule, borderRadius: theme.radius, padding: theme.space.xs },
  chipOn: { borderColor: theme.accent },
  text: { color: theme.ink },
  input: { minHeight: 160, backgroundColor: theme.surface, borderWidth:1, borderColor: theme.rule, borderRadius: 14, color: theme.ink, fontSize: 15, lineHeight: 21, padding: theme.space.md, textAlignVertical: 'top',},
  button: { backgroundColor: theme.accent, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: theme.surface, fontSize: 15, fontWeight: '700' },
  buttonOff: { opacity: 0.6 },
  results: { gap: theme.space.sm, marginTop: theme.space.md },
  faint: { color: theme.faint, fontSize: 13 },
  draft: { gap: theme.space.xs, padding: theme.space.sm, borderWidth: 1, borderColor: theme.rule, borderRadius: theme.radius },
  draftBad: { borderColor: theme.heavy },
  field: { borderWidth: 1, borderColor: theme.rule, color: theme.ink, padding: theme.space.xs },
  small: { width: 56 },
  link: { color: theme.accent, fontWeight: '600' },
  error: { color: theme.heavy, fontSize: 13 },
  label: { color: theme.ink, fontSize: 14, fontWeight: '600' },
});
