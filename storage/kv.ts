import Storage from 'expo-sqlite/kv-store';

/**
 * Key-value persistence backed by SQLite (expo-sqlite/kv-store) on iOS and Android.
 * Used for app state (zustand persist) and the offline market-data cache.
 */
export interface KV {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getAllKeys(): Promise<string[]>;
  clear(): Promise<void>;
}

export const kv: KV = {
  getItem: (k) => Storage.getItemAsync(k),
  setItem: (k, v) => Storage.setItemAsync(k, v),
  removeItem: async (k) => {
    await Storage.removeItemAsync(k);
  },
  getAllKeys: () => Storage.getAllKeysAsync(),
  clear: async () => {
    await Storage.clearAsync();
  },
};
