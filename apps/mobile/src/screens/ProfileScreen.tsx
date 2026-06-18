import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { colors, radius, spacing } from '../theme';

export function ProfileScreen() {
  const { user, logout, isAdmin } = useAuth();
  if (!user) return null;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
      </View>
      <Text style={styles.name}>{user.name}</Text>
      <Text style={styles.email}>{user.email}</Text>
      {isAdmin && <Text style={styles.adminBadge}>ADMIN</Text>}

      <View style={styles.card}>
        <Row icon="notifications" label="Notification alerts" value={user.notifications_consent ? 'Enabled' : 'Off'} />
        <Row icon="shield-checkmark" label="Account type" value={isAdmin ? 'Administrator' : 'Guest'} />
      </View>

      <Button title="Sign out" variant="danger" onPress={logout} />
    </ScrollView>
  );
}

function Row({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing(3), alignItems: 'center' },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing(2),
  },
  avatarText: { color: colors.white, fontSize: 34, fontWeight: '800' },
  name: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: spacing(1.5) },
  email: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  adminBadge: {
    marginTop: spacing(1),
    color: colors.white,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.sm,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  card: {
    alignSelf: 'stretch',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(1),
    marginVertical: spacing(3),
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5), padding: spacing(1.5) },
  rowLabel: { flex: 1, color: colors.text, fontSize: 15 },
  rowValue: { color: colors.textMuted, fontWeight: '600' },
});
