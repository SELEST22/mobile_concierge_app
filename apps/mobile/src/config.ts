/**
 * Resolves the backend API URL.
 *
 * In Expo Go on a physical device, `localhost` points at the phone, not your
 * computer — so we reuse the dev-server host (your machine's LAN IP) that Expo
 * already knows about. Override with EXPO_PUBLIC_API_URL when needed.
 */
import Constants from 'expo-constants';

function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv;

  const hostUri = Constants.expoConfig?.hostUri; // e.g. "192.168.1.5:8081"
  const host = hostUri ? hostUri.split(':')[0] : 'localhost';
  return `http://${host}:4000`;
}

export const API_URL = resolveApiUrl();
