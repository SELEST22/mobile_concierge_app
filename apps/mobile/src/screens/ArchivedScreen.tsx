/**
 * The Archived notifications section (its own tab, per the CEO email).
 *
 * Archived messages never expire — they stay here until the user deletes them.
 * Deleting shows the irreversible-action warning.
 */
import type { UserMessage } from '../lib/types';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { MessageCard } from '../components/MessageCard';
import { api } from '../lib/api';
import { confirmDelete } from '../lib/confirmDelete';
import { colors, spacing } from '../theme';

export function ArchivedScreen() {
  const [messages, setMessages] = useState<UserMessage[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setMessages(await api.listArchivedMessages());
    } catch (e) {
      Alert.alert('Could not load archive', e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

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

  return (
    <View style={styles.container}>
      <FlatList
        data={messages}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
        }
        renderItem={({ item }) => (
          <MessageCard message={item} onDelete={() => onDelete(item.id)} />
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No archived notifications</Text>
              <Text style={styles.emptyText}>Messages you archive from your inbox appear here.</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing(2), flexGrow: 1 },
  empty: { alignItems: 'center', marginTop: spacing(8), paddingHorizontal: spacing(3) },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginTop: 6 },
});
