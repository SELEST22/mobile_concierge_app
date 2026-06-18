/**
 * Scans an event QR code (or accepts a manually typed code) and joins the
 * event. After joining, the user starts receiving that event's broadcasts.
 *
 * A manual-entry fallback is included so the flow is testable on simulators /
 * devices without a camera.
 */
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { api } from '../lib/api';
import type { EventsStackParams } from '../navigation/EventsStack';
import { colors, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<EventsStackParams, 'ScanEvent'>;

export function ScanEventScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [manualCode, setManualCode] = useState('');
  const [joining, setJoining] = useState(false);
  // Prevents the camera firing the join repeatedly while one is in flight.
  const handledRef = useRef(false);

  async function join(code: string) {
    if (joining) return;
    setJoining(true);
    try {
      const event = await api.joinEvent(code);
      Alert.alert('Joined', `You've joined "${event.name}". You'll now receive its updates.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Could not join', e instanceof Error ? e.message : 'Invalid code', [
        { text: 'Try again', onPress: () => (handledRef.current = false) },
      ]);
    } finally {
      setJoining(false);
    }
  }

  function onBarcode({ data }: { data: string }) {
    if (handledRef.current) return;
    handledRef.current = true;
    join(data);
  }

  return (
    <View style={styles.container}>
      <View style={styles.cameraBox}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={joining ? undefined : onBarcode}
          />
        ) : (
          <View style={styles.permission}>
            <Text style={styles.permText}>
              {permission ? 'Camera access is needed to scan event QR codes.' : 'Checking camera…'}
            </Text>
            {permission && !permission.granted && (
              <Button title="Allow camera" onPress={requestPermission} />
            )}
          </View>
        )}
        {permission?.granted && <View style={styles.reticle} pointerEvents="none" />}
      </View>

      <Text style={styles.hint}>Point the camera at the event's QR code.</Text>

      <View style={styles.divider}>
        <Text style={styles.dividerText}>or enter the code manually</Text>
      </View>

      <Field
        label="Event code"
        value={manualCode}
        onChangeText={setManualCode}
        autoCapitalize="characters"
        placeholder="e.g. WELCOME1"
      />
      <Button
        title="Join event"
        onPress={() => join(manualCode.trim())}
        loading={joining}
        disabled={!manualCode.trim()}
      />

      {joining && <ActivityIndicator style={{ marginTop: spacing(2) }} color={colors.primary} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing(2) },
  cameraBox: {
    height: 280,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.navy,
    justifyContent: 'center',
  },
  permission: { alignItems: 'center', justifyContent: 'center', padding: spacing(3), gap: spacing(2) },
  permText: { color: colors.white, textAlign: 'center', fontSize: 14 },
  reticle: {
    alignSelf: 'center',
    width: 180,
    height: 180,
    borderWidth: 3,
    borderColor: colors.white,
    borderRadius: radius.lg,
    opacity: 0.9,
  },
  hint: { textAlign: 'center', color: colors.textMuted, marginTop: spacing(1.5), marginBottom: spacing(2) },
  divider: { alignItems: 'center', marginVertical: spacing(1) },
  dividerText: { color: colors.textMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
});
