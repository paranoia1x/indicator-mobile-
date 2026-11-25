import * as SecureStore from 'expo-secure-store';

/**
 * Secrets (e.g. the optional backend access token) are stored ONLY in the OS keychain /
 * keystore via expo-secure-store — never in SQLite, AsyncStorage, logs or source code.
 */
const OPTS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const KEY_RE = /^[\w.-]{1,64}$/;

export const secure = {
  available: true,
  async get(key: string): Promise<string | null> {
    if (!KEY_RE.test(key)) throw new Error('Invalid secure key');
    return SecureStore.getItemAsync(key, OPTS);
  },
  async set(key: string, value: string): Promise<void> {
    if (!KEY_RE.test(key)) throw new Error('Invalid secure key');
    if (value.length > 2048) throw new Error('Secret too long');
    await SecureStore.setItemAsync(key, value, OPTS);
  },
  async remove(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key, OPTS);
  },
};

export const SECURE_KEYS = { backendToken: 'backend.token' } as const;
