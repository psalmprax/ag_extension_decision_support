/**
 * localStorage that never throws. Browsers throw on every call when storage is blocked
 * (some private modes, locked-down phones, a full quota), and a throw at start-up leaves
 * the page blank. A blocked read is "nothing saved"; a blocked write lasts for this visit.
 */
function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Reading the property itself throws when storage is disabled outright.
    return null;
  }
}

function warn(action: string, key: string, error: unknown): void {
  console.warn(`[storage] Could not ${action} "${key}":`, error);
}

export const safeStorage = {
  get(key: string): string | null {
    try {
      return storage()?.getItem(key) ?? null;
    } catch (error) {
      warn('read', key, error);
      return null;
    }
  },

  set(key: string, value: string): boolean {
    try {
      const store = storage();
      if (!store) return false;
      store.setItem(key, value);
      return true;
    } catch (error) {
      warn('save', key, error);
      return false;
    }
  },

  remove(key: string): void {
    try {
      storage()?.removeItem(key);
    } catch (error) {
      warn('remove', key, error);
    }
  },

  /** A saved JSON value, or `fallback` when nothing is saved or what is saved is not valid JSON. */
  json<T>(key: string, fallback: T): T {
    const raw = this.get(key);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch (error) {
      warn('parse', key, error);
      return fallback;
    }
  },
};
