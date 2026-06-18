import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { useAuth } from '../context/AuthContext';
import type { AuthStackParams } from '../navigation/RootNavigator';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<AuthStackParams, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      await login({ email: email.trim(), password });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
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
        <Text style={styles.brand}>Mobile Concierge</Text>
        <Text style={styles.subtitle}>Sign in to reach your concierge & security team.</Text>

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
          placeholder="••••••••"
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Button title="Sign in" onPress={onSubmit} loading={loading} />
        <View style={{ height: spacing(1.5) }} />
        <Button
          title="Create an account"
          variant="ghost"
          onPress={() => navigation.navigate('Register')}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(3), paddingTop: spacing(8) },
  brand: { fontSize: 30, fontWeight: '800', color: colors.navy },
  subtitle: { fontSize: 15, color: colors.textMuted, marginTop: 6, marginBottom: spacing(3) },
  error: { color: colors.emergency, marginBottom: spacing(1.5), fontWeight: '600' },
});
