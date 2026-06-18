/**
 * Shows a single event's QR code full-screen so others can scan it to join.
 * Reached from the admin event list (and right after creating an event).
 */
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { QrCode } from '../components/QrCode';
import type { EventsStackParams } from '../navigation/EventsStack';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<EventsStackParams, 'EventQr'>;

export function EventQrScreen({ route }: Props) {
  const { event } = route.params;
  return (
    <View style={styles.container}>
      <Text style={styles.name}>{event.name}</Text>
      <Text style={styles.hint}>Have guests scan this code to join the event.</Text>

      <View style={styles.qrCard}>
        <QrCode value={event.qr_payload} size={240} />
      </View>

      <Text style={styles.codeLabel}>Or enter code manually</Text>
      <Text style={styles.code}>{event.code}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, alignItems: 'center', padding: spacing(3) },
  name: { fontSize: 24, fontWeight: '800', color: colors.navy, marginTop: spacing(2), textAlign: 'center' },
  hint: { fontSize: 14, color: colors.textMuted, marginTop: 6, marginBottom: spacing(3), textAlign: 'center' },
  qrCard: {
    backgroundColor: colors.white,
    padding: spacing(3),
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  codeLabel: { fontSize: 13, color: colors.textMuted, marginTop: spacing(3) },
  code: { fontSize: 32, fontWeight: '800', letterSpacing: 4, color: colors.text, marginTop: 6 },
});
