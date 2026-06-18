/**
 * Renders a single broadcast in the user's inbox / archive.
 *
 * Emergency messages are visually highlighted (red accent + badge) per the
 * CEO's priority requirement. Actions adapt to context: the inbox can archive,
 * the archive can only delete. Both archive and delete are surfaced here; the
 * destructive delete confirmation lives in the parent screen.
 */
import { Ionicons } from '@expo/vector-icons';
import type { UserMessage } from '@concierge/shared';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

interface Props {
  message: UserMessage;
  onPress?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
}

function formatDate(iso: string): string {
  // The API returns ISO 8601 timestamps (e.g. "2026-06-18T04:22:23.215Z").
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function MessageCard({ message, onPress, onArchive, onDelete }: Props) {
  const isEmergency = message.type === 'emergency';
  const unread = !message.read_at;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        isEmergency && styles.cardEmergency,
        { backgroundColor: isEmergency ? colors.emergencyBg : colors.card },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={[styles.badge, { backgroundColor: isEmergency ? colors.emergency : colors.general }]}>
          {isEmergency && <Ionicons name="warning" size={12} color={colors.white} />}
          <Text style={styles.badgeText}>{isEmergency ? 'EMERGENCY' : 'GENERAL'}</Text>
        </View>
        {unread && <View style={styles.unreadDot} />}
      </View>

      <Text style={styles.title}>{message.title}</Text>
      <Text style={styles.body}>{message.message}</Text>
      <Text style={styles.date}>{formatDate(message.created_at)}</Text>

      <View style={styles.actions}>
        {onArchive && (
          <Pressable onPress={onArchive} hitSlop={8} style={styles.actionBtn}>
            <Ionicons name="archive-outline" size={18} color={colors.textMuted} />
            <Text style={styles.actionText}>Archive</Text>
          </Pressable>
        )}
        {onDelete && (
          <Pressable onPress={onDelete} hitSlop={8} style={styles.actionBtn}>
            <Ionicons name="trash-outline" size={18} color={colors.emergency} />
            <Text style={[styles.actionText, { color: colors.emergency }]}>Delete</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: spacing(2),
    marginBottom: spacing(1.5),
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardEmergency: { borderColor: colors.emergency, borderLeftWidth: 5 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  title: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: spacing(1) },
  body: { fontSize: 14, color: colors.textMuted, marginTop: 4, lineHeight: 20 },
  date: { fontSize: 12, color: colors.textMuted, marginTop: spacing(1) },
  actions: { flexDirection: 'row', gap: spacing(3), marginTop: spacing(1.5) },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
});
