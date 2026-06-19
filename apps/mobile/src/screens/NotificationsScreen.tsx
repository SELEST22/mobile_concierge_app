/**
 * The user's active notifications/alerts inbox.
 *
 * - Emergency messages sort to the top (server-ordered) and are highlighted.
 * - Emergency alerts that are still unread trigger a pop-up on arrival
 *   (the user consented to these at sign-up).
 * - Users can archive (move to the Archived section) or delete (with an
 *   irreversible-action warning).
 * - Filter chips switch between All / Emergency / General.
 */
import type { BroadcastType, UserMessage } from '../lib/types';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { MessageCard } from '../components/MessageCard';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { confirmDelete } from '../lib/confirmDelete';
import { colors, radius, spacing } from '../theme';

type Filter = 'all' | BroadcastType;

export function NotificationsScreen() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<UserMessage[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  // Remember which emergencies we've already popped so we don't nag on refresh.
  const alertedIds = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const data = await api.listMyMessages();
      setMessages(data);
      popEmergencies(data);
    } catch (e) {
      Alert.alert('Could not load notifications', e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const popEmergencies = useCallback((data: UserMessage[]) => {
    const fresh = data.find((m) => m.type === 'emergency' && !m.read_at && !alertedIds.current.has(m.id));
    if (fresh) {
      alertedIds.current.add(fresh.id);
      Alert.alert(`🚨 ${fresh.title}`, fresh.message, [
        { text: 'Dismiss' },
        { text: 'Mark as read', onPress: () => onMarkRead(fresh.id) },
      ]);
    }
  }, []);

  // Live subscription to the connected event's broadcasts. New (and emergency)
  // messages arrive in real time — the same Firestore stream the web app uses.
  useEffect(() => {
    if (!user?.connectedEventId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = api.subscribeMyMessages(
      user.connectedEventId,
      (data) => {
        setMessages(data);
        popEmergencies(data);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [user?.connectedEventId, popEmergencies]);

  async function onMarkRead(id: string) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, read_at: new Date().toISOString() } : m)));
    try {
      await api.markRead(id);
    } catch {
      load();
    }
  }

  async function onArchive(id: string) {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    try {
      await api.archiveMessage(id);
    } catch {
      load();
    }
  }

  function onDelete(id: string) {
    confirmDelete(async () => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
      try {
        await api.deleteMessage(id);
      } catch {
        load();
      }
    });
  }

  async function onMarkAllRead() {
    setMessages((prev) => prev.map((m) => ({ ...m, read_at: m.read_at ?? new Date().toISOString() })));
    try {
      await api.markAllRead();
    } catch {
      load();
    }
  }

  const visible = filter === 'all' ? messages : messages.filter((m) => m.type === filter);
  const unreadCount = messages.filter((m) => !m.read_at).length;

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <View style={styles.filters}>
          {(['all', 'emergency', 'general'] as Filter[]).map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={[styles.chip, filter === f && styles.chipActive]}
            >
              <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
                {f === 'all' ? 'All' : f === 'emergency' ? 'Emergency' : 'General'}
              </Text>
            </Pressable>
          ))}
        </View>
        {unreadCount > 0 && (
          <Pressable onPress={onMarkAllRead} hitSlop={8}>
            <Text style={styles.markAll}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        data={visible}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
        }
        renderItem={({ item }) => (
          <MessageCard
            message={item}
            onPress={() => !item.read_at && onMarkRead(item.id)}
            onArchive={() => onArchive(item.id)}
            onDelete={() => onDelete(item.id)}
          />
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>You're all caught up</Text>
              <Text style={styles.emptyText}>New alerts from your concierge team will appear here.</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1.5),
  },
  filters: { flexDirection: 'row', gap: spacing(1) },
  chip: {
    paddingHorizontal: spacing(1.5),
    paddingVertical: 6,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  chipTextActive: { color: colors.white },
  markAll: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  list: { padding: spacing(2), paddingTop: 0, flexGrow: 1 },
  empty: { alignItems: 'center', marginTop: spacing(8), paddingHorizontal: spacing(3) },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 6 },
});
