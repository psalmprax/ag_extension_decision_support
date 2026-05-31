import { useState, useEffect } from 'react';

/**
 * A hook for persisting state to browser.storage.local
 * @param key The key to use in storage
 * @param initialValue The initial value to use if none is found in storage
 */
export function usePersistence<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from storage on mount
  useEffect(() => {
    if (browser?.storage?.local) {
      browser.storage.local.get([key])
        .then((result: Record<string, any>) => {
          if (result?.[key] !== undefined) {
            setStoredValue(result[key] as T);
          }
          setIsLoaded(true);
        })
        .catch((error: any) => {
          console.error(`Error getting browser.storage.local for key "${key}":`, error);
          setIsLoaded(true);
        });
    } else {
      setIsLoaded(true);
    }
  }, [key]);

  // Update storage when value changes
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = typeof value === 'function' ? (value as Function)(storedValue) : value;
      setStoredValue(valueToStore);
      if (browser?.storage?.local) {
        browser.storage.local.set({ [key]: valueToStore }).catch((error: any) => {
          console.error(`Error setting browser.storage.local for key "${key}":`, error);
        });
      }
    } catch (error) {
      console.error(`Error setting browser.storage.local for key "${key}":`, error);
    }
  };

  return [storedValue, setValue, isLoaded] as const;
}
