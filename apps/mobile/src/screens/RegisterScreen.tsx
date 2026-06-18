import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
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
import { useAuth } from '../context/AuthContext';
import type { AuthStackParams } from '../navigation/RootNavigator';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<AuthStackParams, 'Register'>;

export function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // CEO requirement: users must agree to receive mass-notification pop-ups
  // when they create an account. Sign-up is blocked until this is checked.
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    if (!consent) {
      setError('You must agree to receive notifications to create an account.');
      return;
    }
    setLoading(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        notificationsConsent: true,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create your account</Text>

        <Field label="Full name" value={name} onChangeText={setName} placeholder="Jane Doe" />
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@example.com"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="At least 6 characters"
        />

        <Pressable
          style={styles.consentRow}
          onPress={() => setConsent((c) => !c)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consent }}
        >
          <View style={[styles.checkbox, consent && styles.checkboxOn]}>
            {consent && <Ionicons name="checkmark" size={16} color={colors.white} />}
          </View>
          <Text style={styles.consentText}>
            I agree to receive important notifications and emergency alerts from SELEST Security as
            pop-ups in this app.
          </Text>
        </Pressable>

        {error && <Text style={styles.error}>{error}</Text>}

        <Button title="Create account" onPress={onSubmit} loading={loading} disabled={!consent} />
        <View style={{ height: spacing(1.5) }} />
        <Button title="Back to sign in" variant="ghost" onPress={() => navigation.goBack()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(3), paddingTop: spacing(6) },
  title: { fontSize: 26, fontWeight: '800', color: colors.navy, marginBottom: spacing(3) },
  consentRow: {
    flexDirection: 'row',
    gap: spacing(1.5),
    alignItems: 'flex-start',
    backgroundColor: colors.generalBg,
    padding: spacing(1.5),
    borderRadius: radius.md,
    marginBottom: spacing(2),
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.primary },
  consentText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 19 },
  error: { color: colors.emergency, marginBottom: spacing(1.5), fontWeight: '600' },
});
