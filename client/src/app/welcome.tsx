import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Welcome } from '../components/Welcome';
import { useSemester } from '../state/semester-store';
import { theme } from '../theme';

/**
 * US-47 (#162): the welcome, as its own screen. A new account is sent here
 * once after signing up (see (tabs)/_layout.tsx); Help on Forecast and on
 * the empty screens opens it again.
 */
export default function WelcomeScreen() {
  const router = useRouter();
  const { semester, setWeeklyCapacity } = useSemester();

  // Back to wherever the student came from, or Forecast if there is nowhere.
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Welcome
          capacity={semester.weeklyCapacity}
          onSaveHours={setWeeklyCapacity}
          onAddCourse={() => router.replace('/add-course')}
          onClose={close}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
});
