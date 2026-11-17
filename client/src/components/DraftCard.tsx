import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { checkDraft, Draft } from '../lib/review';
import { theme } from '../theme';

/** An icon always accompanies the words, so colour never carries the notice alone. */
export function DraftNotice({ children, testID, error = false }: {
  children: string; testID?: string; error?: boolean;
}) {
  return <View style={styles.notice}>
    <Ionicons name={error ? 'alert-circle-outline' : 'information-circle-outline'} size={18}
      color={error ? theme.heavy : theme.accent} accessible={false} />
    <Text testID={testID} style={[styles.noticeText, error && styles.error]}>{children}</Text>
  </View>;
}

/** A reviewable assignment. The caller still owns all editing and saving. */
export function DraftCard({ draft, index, error, duplicateHint, onChange, onRemove }: {
  draft: Draft; index: number; error?: string | null; duplicateHint?: string;
  onChange: (field: keyof Draft, value: string) => void; onRemove: () => void;
}) {
  const ready = checkDraft(draft).ok && !error && !duplicateHint;
  const number = index + 1;
  return <View style={styles.card}>
    <View style={styles.titleRow}>
      {/* Multiline only so a long title wraps. Return finishes editing, and a pasted
          line break becomes a space, so a title is always saved on one line. */}
      <TextInput testID={`draft-title-${index}`} accessibilityLabel={`Title of assignment ${number}`}
        value={draft.title} onChangeText={(value) => onChange('title', value.replace(/[\r\n]+/g, ' '))}
        multiline submitBehavior="blurAndSubmit" style={[styles.field, styles.title]} />
      <View accessible accessibilityRole="image"
        accessibilityLabel={`Assignment ${number}: ${ready ? 'ready to add' : 'needs review'}`}>
        <Ionicons name={ready ? 'checkmark-circle' : 'alert-circle-outline'} size={24}
          color={ready ? theme.calm : theme.heavy} accessible={false} />
      </View>
    </View>
    <View style={styles.fields}>
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Week</Text>
        <TextInput testID={`draft-week-${index}`} accessibilityLabel={`Due week of assignment ${number}`}
          value={draft.week} onChangeText={(value) => onChange('week', value)} keyboardType="number-pad"
          style={styles.field} />
      </View>
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Hours</Text>
        <TextInput testID={`draft-hours-${index}`} accessibilityLabel={`Estimated hours of assignment ${number}`}
          value={draft.hours} onChangeText={(value) => onChange('hours', value)} placeholder="?"
          placeholderTextColor={theme.faint} keyboardType="decimal-pad" style={styles.field} />
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${draft.title || `assignment ${number}`}`}
        onPress={onRemove} style={styles.remove}>
        <Text style={styles.removeText}>Remove</Text>
      </Pressable>
    </View>
    {duplicateHint && <DraftNotice testID={`draft-duplicate-hint-${index}`}>{duplicateHint}</DraftNotice>}
    {draft.week.trim() === '' && !error && <DraftNotice testID={`draft-week-hint-${index}`}>
      The syllabus does not say which week. Enter it before adding.
    </DraftNotice>}
    {!!error && <DraftNotice error>{error}</DraftNotice>}
  </View>;
}

/** Explains the existing validation gate without changing the Add action. */
export function DraftBlocker({ drafts }: { drafts: Draft[] }) {
  const invalid = drafts.filter((draft) => !checkDraft(draft).ok);
  if (invalid.length === 0) return null;
  const onlyWeeks = invalid.every((draft) => draft.week.trim() === '' && checkDraft({ ...draft, week: '1' }).ok);
  const singular = invalid.length === 1;
  const message = `${invalid.length} ${singular ? 'assignment needs' : 'assignments need'} ${onlyWeeks ? 'a week' : 'fixing'} before ${singular ? 'it' : 'they'} can be added.`;
  return <DraftNotice testID="syllabus-blocker">{message}</DraftNotice>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.rule, borderRadius: 14, padding: theme.space.md, gap: theme.space.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space.sm },
  title: { flex: 1, minWidth: 0, fontSize: 16, fontWeight: '600', textAlignVertical: 'top' },
  fields: { flexDirection: 'row', alignItems: 'flex-end', gap: theme.space.sm },
  fieldGroup: { flex: 1, minWidth: 0, gap: theme.space.xs },
  label: { color: theme.muted, fontSize: 13, fontWeight: '600' },
  field: { minHeight: 44, padding: theme.space.sm, borderWidth: 1, borderColor: theme.rule, borderRadius: theme.radius, backgroundColor: theme.bg, color: theme.ink, fontSize: 16 },
  remove: { minHeight: 44, minWidth: 64, justifyContent: 'center', alignItems: 'center' },
  removeText: { color: theme.accent, fontSize: 14, fontWeight: '600' },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.space.sm, backgroundColor: theme.bg, borderRadius: theme.radius, padding: theme.space.sm },
  noticeText: { flex: 1, color: theme.muted, fontSize: 13, lineHeight: 19 },
  error: { color: theme.heavy },
});
