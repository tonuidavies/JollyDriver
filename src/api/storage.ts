import * as SecureStore from 'expo-secure-store';

/**
 * Thin token storage over expo-secure-store. Keys are namespaced.
 * Kept async and isolated so it can be swapped (e.g. for AsyncStorage) easily.
 */
const ACCESS = 'jolly.access_token';
const REFRESH = 'jolly.refresh_token';
const EXPIRES = 'jolly.access_expires_at'; // epoch ms

export type StoredTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

export async function saveTokens(t: StoredTokens): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS, t.accessToken),
    SecureStore.setItemAsync(REFRESH, t.refreshToken),
    SecureStore.setItemAsync(EXPIRES, String(t.expiresAt)),
  ]);
}

export async function loadTokens(): Promise<StoredTokens | null> {
  const [accessToken, refreshToken, expiresRaw] = await Promise.all([
    SecureStore.getItemAsync(ACCESS),
    SecureStore.getItemAsync(REFRESH),
    SecureStore.getItemAsync(EXPIRES),
  ]);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken, expiresAt: Number(expiresRaw) || 0 };
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS),
    SecureStore.deleteItemAsync(REFRESH),
    SecureStore.deleteItemAsync(EXPIRES),
  ]);
}
