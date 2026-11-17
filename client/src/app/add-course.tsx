import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { CatalogCourse, createCourse, enrollInCourse, searchCatalog } from '../lib/api';
import { Course } from '../lib/types';
import { useSemester } from '../state/semester-store';
import { theme } from '../theme';

export default function AddCourseScreen() {
  if (process.env.EXPO_PUBLIC_USE_FIXTURE === '1') {
    return <Text style={styles.note}>Adding courses needs a server connection. Sample data cannot be changed here.</Text>;
  }
  return <CourseSearch />;
}

function CourseSearch() {
  const router = useRouter();
  const { addCourse } = useSemester();
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<CatalogCourse[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [existing, setExisting] = useState<Course | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const version = useRef(0);
  const locked = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    const current = version.current;
    let cancelled = false;
    if (!query.trim() || creating) return;
    const timer = setTimeout(() => {
      searchCatalog(query.trim()).then((courses) => {
        if (!cancelled && mounted.current && version.current === current) setMatches(courses);
      }).catch((e: Error) => {
        if (!cancelled && mounted.current && version.current === current) setError(e.message);
      }).finally(() => {
        if (!cancelled && mounted.current && version.current === current) setSearching(false);
      });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, creating]);

  function changeQuery(text: string) {
    version.current++;
    setQuery(text);
    setMatches([]);
    setExisting(null);
    setError(null);
    setSearching(Boolean(text.trim()));
  }

  async function save(action: () => Promise<Course | null>) {
    if (locked.current) return;
    locked.current = true;
    version.current++;
    setSearching(false);
    setBusy(true);
    setError(null);
    try {
      const course = await action();
      if (course && mounted.current) {
        addCourse(course);
        router.back();
      }
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : 'Could not save the course');
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  function join(course: Course) {
    void save(() => enrollInCourse(course.id));
  }
  function courseRow(course: Course, enrolled = false) {
    return (
      <Pressable key={course.id} accessibilityRole="button" accessibilityLabel={'Join ' + course.code}
        accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => join(course)} style={styles.card}>
        <Text style={styles.code}>{course.code}</Text>
        <Text style={styles.text}>{course.name}</Text>
        <Text style={styles.note}>{enrolled ? 'Already yours' : 'Join'}</Text>
      </Pressable>
    );
  }

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      {!creating ? <>
        <Text style={styles.text}>Find a course by code or name, then choose one to join.</Text>
        <TextInput accessibilityLabel="Search courses" placeholder="Course code or name" value={query}
          editable={!busy} onChangeText={changeQuery} style={styles.input} autoCorrect={false} />
        {searching && <Text accessibilityRole="status" style={styles.note}>Searching...</Text>}
        {matches.map((course) => courseRow(course, course.enrolled))}
        {!searching && query.trim() !== '' && matches.length === 0 && !error &&
          <Text style={styles.note}>No matching courses.</Text>}
        <Pressable accessibilityRole="button" disabled={busy} style={styles.button}
          onPress={() => {
            version.current++;
            setSearching(false);
            setError(null);
            setCode(query.trim());
            setName('');
            setCreating(true);
          }}>
          <Text style={styles.buttonText}>Create a new course</Text>
        </Pressable>
      </> : <>
        <Text style={styles.text}>Create a course only if it is not already in the catalog.</Text>
        {existing ? <>
          <Text style={styles.text}>That code already exists. Join this course?</Text>
          {courseRow(existing)}
        </> : <>
          <TextInput accessibilityLabel="Course code" placeholder="Course code" value={code}
            onChangeText={setCode} editable={!busy} autoCorrect={false} style={styles.input} />
          <TextInput accessibilityLabel="Course name" placeholder="Course name" value={name}
            onChangeText={setName} editable={!busy} style={styles.input} />
          <Text style={styles.note}>Code: up to 40 characters. Name: up to 200 characters.</Text>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || !code.trim() || !name.trim() }}
            disabled={busy || !code.trim() || !name.trim()} style={styles.button}
            onPress={() => void save(async () => {
              const result = await createCourse({ code: code.trim(), name: name.trim() });
              if (result.created) return result.course;
              if (mounted.current) setExisting(result.course);
              return null;
            })}>
            <Text style={styles.buttonText}>Save course</Text>
          </Pressable>
        </>}
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => {
          version.current++;
          setCreating(false);
          setExisting(null);
          setError(null);
          setSearching(Boolean(query.trim()));
        }}><Text style={styles.note}>Back to search</Text></Pressable>
      </>}
      {busy && <Text accessibilityRole="status" style={styles.note}>Saving course...</Text>}
      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: theme.space.md, gap: theme.space.md, paddingBottom: theme.space.xl },
  text: { color: theme.ink, fontSize: 16 },
  note: { color: theme.muted, fontSize: 14, padding: theme.space.sm },
  code: { color: theme.ink, fontSize: 17, fontWeight: '800' },
  input: { color: theme.ink, backgroundColor: theme.surface, borderColor: theme.rule, borderWidth: 1,
    borderRadius: theme.radius, padding: 12, fontSize: 16 },
  card: { backgroundColor: theme.surface, padding: theme.space.md, borderRadius: theme.radius, gap: 4 },
  button: { backgroundColor: theme.accent, borderRadius: theme.radius, padding: 14, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  error: { color: theme.heavy, fontSize: 16 },
});
