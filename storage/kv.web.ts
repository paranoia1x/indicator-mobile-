import type { KV } from './kv';

/**
 * Web fallback (development preview / screenshots only — this is a mobile app).
 * Uses localStorage with a namespaced prefix; falls back to memory if unavailable.
 */
const PREFIX = 'indicator-mobile:';
const mem = new Map<string, string>();
const ls = (): Storage | null => {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
};

export const kv: KV = {
  async getItem(k) {
    const s = ls();
    return s ? s.getItem(PREFIX + k) : (mem.get(k) ?? null);
  },
  async setItem(k, v) {
    const s = ls();
    if (s) {
      try {
        s.setItem(PREFIX + k, v);
        return;
      } catch {
        /* quota — fall through to memory */
      }
    }
    mem.set(k, v);
  },
  async removeItem(k) {
    ls()?.removeItem(PREFIX + k);
    mem.delete(k);
  },
  async getAllKeys() {
    const s = ls();
    const keys = s ? Object.keys(s).filter((k) => k.startsWith(PREFIX)).map((k) => k.slice(PREFIX.length)) : [];
    return [...new Set([...keys, ...mem.keys()])];
  },
  async clear() {
    const s = ls();
    if (s) for (const k of Object.keys(s)) if (k.startsWith(PREFIX)) s.removeItem(k);
    mem.clear();
  },
};
