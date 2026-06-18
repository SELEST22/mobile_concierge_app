/**
 * Admin-only screen to compose and send a mass broadcast to every user, and to
 * review / delete previously sent broadcasts.
 *
 * Emergency vs General is chosen with a clear, color-coded toggle (emergency =
 * red / high priority).
 */
import type { BroadcastMessage, BroadcastType } from '@concierge/shared';
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
import { confirmDelete } from '../lib/confirmDelete';
import { colors, radius, spacing } from '../theme';

export function AdminBroadcastScreen() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<BroadcastType>('general');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<BroadcastMessage[]>([]);

  const loadSent = useCallback(async () => {
    try {
      setSent(await api.listBroadcasts());
    } catch {
      /* non-fatal for the composer */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSent();
    }, [loadSent]),
  );

  async function onSend() {
    if (!title.trim() || !message.trim()) {
      Alert.alert('Missing fields', 'Please enter both a title and a message.');
      return;
    }
    const send = async () => {
      setSending(true);
      try {
        await api.createBroadcast({ title: title.trim(), message: message.trim(), type });
        setTitle('');
        setMessage('');
        setType('general');
        await loadSent();
        Alert.alert('Sent', 'Your message was broadcast to all users.');
      } catch (e) {
        Alert.alert('Send failed', e instanceof Error ? e.message : 'Network error');
      } finally {
        setSending(false);
      }
    };

    if (type === 'emergency') {
      Alert.alert(
        'Send emergency alert?',
        'This sends a high-priority pop-up to every user immediately.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Send alert', style: 'destructive', onPress: send },
        ],
      );
    } else {
      send();
    }
  }

  function onDelete(id: number) {
    confirmDelete(async () => {
      try {
        await api.deleteBroadcast(id);
        setSent((prev) => prev.filter((b) => b.id !== id));
      } catch (e) {
        Alert.alert('Delete failed', e instanceof Error ? e.message : 'Network error');
      }
    }, 'Delete broadcast?');
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.section}>New broadcast</Text>

        <View style={styles.typeRow}>
          <TypeButton
            label="General"
            active={type === 'general'}
            onPress={() => setType('general')}
            activeColor={colors.general}
          />
          <TypeButton
            label="Emergency"
            active={type === 'emergency'}
            onPress={() => setType('emergency')}
            activeColor={colors.emergency}
          />
        </View>

        <Field label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Pool closing soon" />
        <Field
          label="Message"
          value={message}
          onChangeText={setMessage}
          placeholder="Write your announcement…"
          multiline
          numberOfLines={4}
          style={styles.multiline}
        />

        <Button
          title={type === 'emergency' ? 'Send emergency alert' : 'Send to all users'}
          onPress={onSend}
          loading={sending}
          variant={type === 'emergency' ? 'danger' : 'primary'}
        />

        <Text style={[styles.section, { marginTop: spacing(4) }]}>Sent broadcasts</Text>
        {sent.length === 0 && <Text style={styles.muted}>Nothing sent yet.</Text>}
        {sent.map((b) => (
          <View key={b.id} style={styles.sentRow}>
            <View style={[styles.dot, { backgroundColor: b.type === 'emergency' ? colors.emergency : colors.general }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.sentTitle}>{b.title}</Text>
              <Text style={styles.sentMeta} numberOfLines={1}>{b.message}</Text>
            </View>
            <Pressable onPress={() => onDelete(b.id)} hitSlop={8}>
              <Text style={styles.delete}>Delete</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function TypeButton({
  label,
  active,
  onPress,
  activeColor,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  activeColor: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.typeBtn,
        { borderColor: active ? activeColor : colors.border, backgroundColor: active ? activeColor : colors.card },
      ]}
    >
      <Text style={[styles.typeBtnText, { color: active ? colors.white : colors.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(2) },
  section: { fontSize: 18, fontWeight: '800', color: colors.navy, marginBottom: spacing(1.5) },
  typeRow: { flexDirection: 'row', gap: spacing(1.5), marginBottom: spacing(2) },
  typeBtn: { flex: 1, paddingVertical: spacing(1.5), borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center' },
  typeBtnText: { fontWeight: '700', fontSize: 15 },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  muted: { color: colors.textMuted },
  sentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(1.5),
    marginBottom: spacing(1),
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  sentTitle: { fontWeight: '700', color: colors.text },
  sentMeta: { color: colors.textMuted, fontSize: 12 },
  delete: { color: colors.emergency, fontWeight: '700', fontSize: 13 },
});
