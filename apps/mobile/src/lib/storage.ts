/**
 * Secure token storage. We keep the JWT in the device keychain / keystore via
 * expo-secure-store rather than plain AsyncStorage, so the auth token is
 * encrypted at rest (part of "secure authentication and data handling").
 */
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'concierge.auth.token';

export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function loadToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
