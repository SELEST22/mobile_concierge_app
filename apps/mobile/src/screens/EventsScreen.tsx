/**
 * Events home.
 *
 * - Everyone: "My events" (the events they've joined) + a "Scan QR to join"
 *   button. Joining an event is how a user starts receiving that event's
 *   targeted broadcasts.
 * - Admins also get a "Create event" form and a list of all events with member
 *   counts and a button to show each event's QR for people to scan.
 */
import { Ionicons } from '@expo/vector-icons';
import type { Event } from '@concierge/shared';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { EventsStackParams } from '../navigation/EventsStack';
import { colors, radius, spacing } from '../theme';

type Nav = NativeStackNavigationProp<EventsStackParams, 'EventsHome'>;

export function EventsScreen() {
  const navigation = useNavigation<Nav>();
  const { isAdmin } = useAuth();
  const [myEvents, setMyEvents] = useState<Event[]>([]);
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const mine = await api.listMyEvents();
      setMyEvents(mine);
      if (isAdmin) setAllEvents(await api.listEvents());
    } catch (e) {
      Alert.alert('Could not load events', e instanceof Error ? e.message : 'Network error');
    }
  }, [isAdmin]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function onCreate() {
    if (!newName.trim()) {
      Alert.alert('Name required', 'Give the event a name.');
      return;
    }
    setCreating(true);
    try {
      const event = await api.createEvent({ name: newName.trim() });
      setNewName('');
      await load();
      navigation.navigate('EventQr', { event }); // show its QR right away
    } catch (e) {
      Alert.alert('Could not create event', e instanceof Error ? e.message : 'Network error');
    } finally {
      setCreating(false);
    }
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Button
        title="Scan QR to join an event"
        onPress={() => navigation.navigate('ScanEvent')}
      />

      <Text style={styles.section}>My events</Text>
      {myEvents.length === 0 && (
        <Text style={styles.muted}>You haven't joined any events yet. Scan a QR to join one.</Text>
      )}
      {myEvents.map((e) => (
        <View key={e.id} style={styles.row}>
          <Ionicons name="ticket-outline" size={22} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{e.name}</Text>
            {!!e.description && <Text style={styles.muted}>{e.description}</Text>}
          </View>
          <View style={styles.joinedPill}>
            <Text style={styles.joinedText}>Joined</Text>
          </View>
        </View>
      ))}

      {isAdmin && (
        <>
          <Text style={styles.section}>Create event (admin)</Text>
          <Field label="Event name" value={newName} onChangeText={setNewName} placeholder="e.g. Rooftop Party" />
          <Button title="Create & show QR" onPress={onCreate} loading={creating} />

          <Text style={styles.section}>All events</Text>
          {allEvents.length === 0 && <Text style={styles.muted}>No events yet.</Text>}
          {allEvents.map((e) => (
            <Pressable
              key={e.id}
              style={styles.row}
              onPress={() => navigation.navigate('EventQr', { event: e })}
            >
              <Ionicons name="qr-code-outline" size={22} color={colors.navy} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{e.name}</Text>
                <Text style={styles.muted}>
                  Code {e.code} · {e.member_count ?? 0} member{(e.member_count ?? 0) === 1 ? '' : 's'}
                </Text>
              </View>
              <Text style={styles.showQr}>Show QR</Text>
            </Pressable>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(2) },
  section: { fontSize: 18, fontWeight: '800', color: colors.navy, marginTop: spacing(3), marginBottom: spacing(1.5) },
  muted: { color: colors.textMuted, fontSize: 13 },
  row: {
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
  rowTitle: { fontWeight: '700', color: colors.text, fontSize: 15 },
  joinedPill: { backgroundColor: colors.success, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  joinedText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  showQr: { color: colors.primary, fontWeight: '700', fontSize: 13 },
});
