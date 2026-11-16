import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSemester } from '../state/semester-store';
import { theme } from '../theme';
import { LogOutButton } from './LogOutButton';
import { ScreenHeader } from './ScreenHeader';

/** A short explanation and the actions that make this screen useful next. */
export function EmptyState({ title, message, children }: {
  title: string;
  message: string;
  children?: React.ReactNode;
}) {
  return <View style={styles.card}>
    <Text accessibilityRole="header" style={styles.title}>{title}</Text>
    <Text style={styles.message}>{message}</Text>
    {children}
  </View>;
}

export function EmptyAction({ label, onPress, busy = false }: {
  label: string;
  onPress: () => void;
  busy?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy, busy }}
    disabled={busy} onPress={onPress} style={styles.button}>
    <Text style={styles.buttonText}>{label}</Text>
  </Pressable>;
}

/** All empty tabs use the same pending request and error from the shared semester. */
export function EmptySemesterScreen({ title, message }: { title: string; message: string }) {
  const { semester, canLoadSample, loadSample, loadingSample, sampleError } = useSemester();
  return <SafeAreaView edges={['top']} style={styles.screen}>
    <ScrollView contentContainerStyle={styles.page}>
      <ScreenHeader title={title} eyebrow={semester.label} right={<LogOutButton />} />
      <EmptyState title="No courses yet" message={message}>
        {canLoadSample && <EmptyAction
          label={loadingSample ? 'Loading sample semester' : 'Try a sample semester'}
          busy={loadingSample} onPress={() => { void loadSample(); }} />}
        {sampleError !== null && <Text accessibilityRole="alert" style={styles.message}>{sampleError}</Text>}
      </EmptyState>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  page: { padding: theme.space.lg, gap: theme.space.lg },
  card: { backgroundColor: theme.surface, padding: theme.space.lg, borderRadius: theme.radius, gap: theme.space.md },
  title: { fontSize: 20, fontWeight: '700', color: theme.ink },
  message: { fontSize: 16, lineHeight: 24, color: theme.muted },
  button: { backgroundColor: theme.accent, padding: theme.space.md, borderRadius: theme.radius, minHeight: 48, justifyContent: 'center' },
  buttonText: { color: theme.surface, fontWeight: '600', fontSize: 16 },
});
