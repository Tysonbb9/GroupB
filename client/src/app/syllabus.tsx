import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { addTasks, AiReading, extractSyllabusText, getAiStatus, readSyllabusWithAi } from '../lib/api';
import { scanSyllabus } from '../lib/inputs';
import { pickPdf } from '../lib/pick-pdf';
import { checkDraft, Draft, fromReading, toDraft } from '../lib/review';
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
 *
 * Issue #145 (AI screen 1): when the server has an AI (GET /ai/status), Find
 * assignments asks it to read the text instead of the simple scanner. Its
 * answer fills the same boxes, so everything after that is unchanged. A week
 * or hours it could not find start empty. If the AI fails for any reason, the
 * scanner runs instead, so a student always gets a result. The grade weights
 * and policies it found are shown for information only: saving them waits on
 * the course tables (#144).
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

  /** Whether the server has an AI to read syllabi with. False until it says so. */
  const [aiAvailable, setAiAvailable] = useState(false);
  /** The AI is reading right now (about 20 seconds). */
  const [aiBusy, setAiBusy] = useState(false);
  /** What the AI read, kept for the weights and policies. null after a scanner run. */
  const [aiReading, setAiReading] = useState<AiReading | null>(null);
  /** Said when the AI could not be used and the scanner ran instead. */
  const [aiNote, setAiNote] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    getAiStatus().then((available) => {
      if (current) setAiAvailable(available);
    });
    return () => {
      current = false;
    };
  }, []);

  /**
   * Which Find (or PDF) is the current one. A reading can take 20 seconds, and
   * the student may pick another course, another PDF or press Find again
   * meanwhile. Every such action starts a new run, and an answer that arrives
   * for an older run, a result or a failure, is dropped: it must not fill the
   * boxes of the wrong course or overwrite a newer reading.
   */
  const latestRun = useRef(0);

  /** Starts a new run, which makes every run before it stale. */
  const startRun = () => {
    latestRun.current += 1;
    setAiBusy(false); // the run being replaced no longer owns the wait
    return latestRun.current;
  };

  /** Shows what was found in some syllabus text, ready to review. */
  const findIn = async (syllabusText: string, run: number, forCourseId: string) => {
    const stale = () => run !== latestRun.current;
    setStatus(null);
    setErrors([]);
    setAiNote(null);

    if (aiAvailable) {
      setAiBusy(true);
      try {
        const answer = await readSyllabusWithAi(syllabusText);
        if (stale()) return;
        setDrafts(answer.assignments.map(fromReading));
        setSkipped([]);
        setAiReading(answer);
        return;
      } catch {
        if (stale()) return;
        // Whatever went wrong, the student still gets a result from the scanner.
        setAiNote('Reading with AI did not work this time, so the simple scanner was used instead.');
      } finally {
        if (!stale()) setAiBusy(false);
      }
    }

    const result = scanSyllabus(syllabusText, forCourseId);
    setDrafts(result.tasks.map(toDraft));
    setSkipped(result.skipped);
    setAiReading(null);
  };

  const find = () => findIn(text, startRun(), courseId);

  /**
   * Which PDF run holds the "Reading the PDF" state. Only that run may clear
   * it, so an older PDF finishing its AI wait cannot clear the state of a
   * newer PDF still being extracted.
   */
  const readingOwner = useRef(0);

  const choosePdf = async () => {
    setPdfError(null);
    // What the student was looking at when the picker opened. The picker can
    // stay open a long time, so the course is the one chosen now, and the file
    // is dropped if anything newer (another course, another Find) happened
    // while it was open. Cancelling changes nothing, so a reading already in
    // progress carries on.
    const openedAt = latestRun.current;
    const forCourseId = courseId;
    const pdf = await pickPdf();
    if (pdf === null) return; // the student cancelled
    if (latestRun.current !== openedAt) return;

    const run = startRun();
    readingOwner.current = run;
    const release = () => {
      if (readingOwner.current === run) setReading(false);
    };
    setReading(true);
    try {
      const extracted = await extractSyllabusText(pdf);
      if (run !== latestRun.current) return; // the course changed, or a newer run began
      setText(extracted.text); // so the student can see, and fix, what was read
      release(); // the PDF is read. The AI wait, if any, has its own message
      await findIn(extracted.text, run, forCourseId);
    } catch (e) {
      if (run !== latestRun.current) return;
      // The server's message says what to do, e.g. "...or paste the syllabus
      // text instead" for a scanned PDF. The text box below is that option.
      setPdfError((e as Error).message);
    } finally {
      release();
    }
  };

  const chooseCourse = (id: string) => {
    startRun(); // a reading still in flight was for the other course
    setCourseId(id);
    setDrafts(null);
    setSkipped([]);
    setErrors([]);
    setStatus(null);
    setAiReading(null);
    setAiNote(null);
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
    if (drafts === null || drafts.length === 0 || aiBusy) return; // not while a reading is about to replace them

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

      <Pressable
        testID="syllabus-find"
        accessibilityRole="button"
        accessibilityState={{ disabled: aiBusy }}
        disabled={aiBusy}
        onPress={find}
        style={[styles.button, aiBusy && styles.buttonOff]}
      >
        <Text style={styles.buttonText}>{aiBusy ? 'Reading your syllabus…' : 'Find assignments'}</Text>
      </Pressable>

      {aiBusy && (
        <Text testID="syllabus-ai-wait" accessibilityLiveRegion="polite" style={styles.faint}>
          Reading your syllabus. This takes about 20 seconds.
        </Text>
      )}

      {aiNote !== null && (
        <Text testID="syllabus-ai-note" style={styles.faint}>
          {aiNote}
        </Text>
      )}

      {drafts !== null && (
        <View style={styles.results}>
          <Text style={styles.heading}>
            Found {drafts.length} {drafts.length === 1 ? 'assignment' : 'assignments'} for {course?.code}
          </Text>

          {aiReading !== null && aiReading.dropped > 0 && (
            <Text testID="syllabus-ai-partial" style={styles.error}>
              {`${aiReading.dropped} ${aiReading.dropped === 1 ? 'item' : 'items'} in the AI's answer could not be used, so this list may be incomplete. Check it against your syllabus.`}
            </Text>
          )}

          {drafts.map((draft, i) => (
            <View key={i} style={[styles.draft, (errors[i] || draft.week.trim() === '') && styles.draftBad]}>
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
              {draft.week.trim() === '' && !errors[i] && (
                <Text testID={`draft-week-hint-${i}`} style={styles.faint}>
                  The syllabus does not say which week. Enter it before adding.
                </Text>
              )}
              {errors[i] && <Text style={styles.error}>{errors[i]}</Text>}
            </View>
          ))}

          {aiReading !== null && (aiReading.weights.length > 0 || aiReading.policies.absencesAllowed !== null || aiReading.policies.dropRule !== null) && (
            <View testID="syllabus-ai-extras" style={styles.draft}>
              <Text style={styles.heading}>Also found in the syllabus</Text>
              <Text style={styles.faint}>For your information. These are not saved yet.</Text>
              {aiReading.weights.map((weight, i) => (
                <Text key={i} style={styles.text}>{`${weight.label}: ${weight.percent}%`}</Text>
              ))}
              {aiReading.policies.absencesAllowed !== null && (
                <Text style={styles.text}>{`Absences allowed: ${aiReading.policies.absencesAllowed}`}</Text>
              )}
              {aiReading.policies.dropRule !== null && (
                <Text style={styles.text}>{aiReading.policies.dropRule}</Text>
              )}
            </View>
          )}

          {drafts.length > 0 && (
            <Pressable
            testID="syllabus-add"
            accessibilityRole="button"
            accessibilityState={{ disabled: saving || aiBusy }}
            disabled={saving || aiBusy}
            onPress={add}
            style={[styles.button, (saving || aiBusy) && styles.buttonOff]}
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
