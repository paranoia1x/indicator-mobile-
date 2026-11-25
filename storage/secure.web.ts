/**
 * Web preview has no OS keychain. Secrets are kept in memory only for the session and are never
 * persisted. (The production app targets iOS/Android, which use expo-secure-store.)
 */
const mem = new Map<string, string>();
export const secure = {
  available: false,
  async get(key: string) {
    return mem.get(key) ?? null;
  },
  async set(key: string, value: string) {
    mem.set(key, value);
  },
  async remove(key: string) {
    mem.delete(key);
  },
};
export const SECURE_KEYS = { backendToken: 'backend.token' } as const;
