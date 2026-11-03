import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { scanSyllabus, ScanResult } from '../lib/inputs';
import { useSemester } from '../state/semester-store';
import { theme } from '../theme';

/**
 * US-28: paste a course's syllabus text and see the assignments found in it,
 * plus the lines that could not be read. Nothing is added to the semester here.
 */
export default function SyllabusScreen() {
  const { semester } = useSemester();
  const [courseId, setCourseId] = useState(semester.courses[0]?.id ?? '');
  const [text, setText] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);
  const course = semester.courses.find((c) => c.id === courseId);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.heading}>Course</Text>
      <View style={styles.row}>
        {semester.courses.map((c) => (
          <Pressable
            key={c.id}
            accessibilityRole="button"
            accessibilityLabel={`Choose ${c.code}`}
            onPress={() => {
              setCourseId(c.id);
              setResult(null);
            }}
            style={[styles.chip, c.id === courseId && styles.chipOn]}
          >
            <Text style={styles.text}>{c.code}</Text>
          </Pressable>
        ))}
      </View>

      {/* TODO 2: the text box */}
      <TextInput
        testID="syllabus-input"
        multiline
        value={text}
        onChangeText={setText}
        placeholder="Week 7: Midterm 1 (8 hours)"
        style={styles.input}
      />

      {/* TODO 3: the Find assignments button */}

      <Pressable
        testID="syllabus-find"
        accessibilityRole="button"
        onPress={() => setResult(scanSyllabus(text, courseId))}
        style={styles.button}
      >
        <Text style={styles.text}>Find assignments</Text>
      </Pressable>

      {/* TODO 4: the results */}

      {result !== null && (
        <View style={styles.results}>
          <Text style={styles.heading}>
            Found {result.tasks.length} {result.tasks.length === 1 ? 'assignment' : 'assignments'} for {course?.code}
          </Text>

          {result.tasks.map((task, i) => (
            <View key={i}>
              <Text style={styles.text}>{task.title}</Text>
              <Text style={styles.faint}>
                Week {task.dueWeek} · {task.estimatedHours === null ? 'no estimate' : `${task.estimatedHours} h`}
              </Text>
            </View>
          ))}

          {result.skipped.length > 0 && (
            <>
              <Text style={styles.heading}>
                Could not read {result.skipped.length} {result.skipped.length === 1 ? 'line' : 'lines'}
              </Text>
              {result.skipped.map((line, i) => (
                <Text key={i} style={styles.faint}>{line}</Text>
              ))}
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: theme.space.md, gap: theme.space.sm },
  heading: { color: theme.ink, fontWeight: '700' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.xs },
  chip: { borderWidth: 1, borderColor: theme.rule, borderRadius: theme.radius, padding: theme.space.xs },
  chipOn: { borderColor: theme.accent },
  text: { color: theme.ink },
  input: { minHeight: 120, borderWidth: 1, borderColor: theme.rule, color: theme.ink, padding: theme.space.sm },
  button: { backgroundColor: theme.surface, padding: theme.space.sm, borderRadius: theme.radius },
  results: {gap: theme.space.sm, marginTop: theme.space.md},
  faint: {color:theme.faint, fontSize:13},
});