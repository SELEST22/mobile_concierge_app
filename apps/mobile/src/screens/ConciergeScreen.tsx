/**
 * Concierge / security request screen (basic in this pass).
 *
 * Lets a guest raise a request and see the status of their previous ones.
 * Next pass: realtime chat, QR-linked location, admin handling queue.
 */
import type { ConciergeCategory, ConciergeRequest } from '@concierge/shared';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { api } from '../lib/api';
import { colors, radius, spacing } from '../theme';

const CATEGORIES: { key: ConciergeCategory; label: string }[] = [
  { key: 'concierge', label: 'Concierge' },
  { key: 'security', label: 'Security' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'other', label: 'Other' },
];

export function ConciergeScreen() {
  const [category, setCategory] = useState<ConciergeCategory>('concierge');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState<ConciergeRequest[]>([]);

  const load = useCallback(async () => {
    try {
      setRequests(await api.listMyConciergeRequests());
    } catch {
      /* ignore */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function onSubmit() {
    if (!details.trim()) {
      Alert.alert('Add details', 'Please describe what you need.');
      return;
    }
    setSubmitting(true);
    try {
      await api.createConciergeRequest({ category, details: details.trim() });
      setDetails('');
      await load();
      Alert.alert('Request sent', 'Your concierge team has been notified.');
    } catch (e) {
      Alert.alert('Could not send', e instanceof Error ? e.message : 'Network error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.section}>Request a service</Text>

        <View style={styles.cats}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c.key}
              onPress={() => setCategory(c.key)}
              style={[styles.cat, category === c.key && styles.catActive]}
            >
              <Text style={[styles.catText, category === c.key && styles.catTextActive]}>{c.label}</Text>
            </Pressable>
          ))}
        </View>

        <Field
          label="How can we help?"
          value={details}
          onChangeText={setDetails}
          placeholder="Describe your request…"
          multiline
          numberOfLines={4}
          style={styles.multiline}
        />
        <Button title="Send request" onPress={onSubmit} loading={submitting} />

        <Text style={[styles.section, { marginTop: spacing(4) }]}>My requests</Text>
        {requests.length === 0 && <Text style={styles.muted}>No requests yet.</Text>}
        {requests.map((r) => (
          <View key={r.id} style={styles.reqRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.reqCat}>{r.category.toUpperCase()}</Text>
              <Text style={styles.reqDetails} numberOfLines={2}>{r.details}</Text>
            </View>
            <Text style={[styles.status, statusStyle(r.status)]}>{r.status.replace('_', ' ')}</Text>
          </View>
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function statusStyle(status: ConciergeRequest['status']) {
  switch (status) {
    case 'resolved':
      return { color: colors.success };
    case 'cancelled':
      return { color: colors.textMuted };
    case 'in_progress':
      return { color: colors.primary };
    default:
      return { color: colors.emergency };
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(2) },
  section: { fontSize: 18, fontWeight: '800', color: colors.navy, marginBottom: spacing(1.5) },
  cats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1), marginBottom: spacing(2) },
  cat: {
    paddingHorizontal: spacing(1.5),
    paddingVertical: 8,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  catText: { color: colors.textMuted, fontWeight: '600' },
  catTextActive: { color: colors.white },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  muted: { color: colors.textMuted },
  reqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(1.5),
    marginBottom: spacing(1),
    gap: spacing(1),
  },
  reqCat: { fontSize: 11, fontWeight: '800', color: colors.textMuted, letterSpacing: 0.5 },
  reqDetails: { color: colors.text, marginTop: 2 },
  status: { fontWeight: '700', fontSize: 12, textTransform: 'capitalize' },
});
