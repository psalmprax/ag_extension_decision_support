import { useState, useEffect } from 'react';

/**
 * A hook for persisting state to chrome.storage.local
 * @param key The key to use in storage
 * @param initialValue The initial value to use if none is found in storage
 */
export function usePersistence<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from storage on mount
  useEffect(() => {
    const chromeAPI = (window as any).chrome;
    if (chromeAPI && chromeAPI.storage && chromeAPI.storage.local) {
      chromeAPI.storage.local.get([key], (result: { [key: string]: any }) => {
        if (result[key] !== undefined) {
          setStoredValue(result[key]);
        }
        setIsLoaded(true);
      });
    } else {
      setIsLoaded(true);
    }
  }, [key]);

  // Update storage when value changes
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      const chromeAPI = (window as any).chrome;
      if (chromeAPI && chromeAPI.storage && chromeAPI.storage.local) {
        chromeAPI.storage.local.set({ [key]: valueToStore });
      }
    } catch (error) {
      console.error(`Error setting chrome.storage.local for key "${key}":`, error);
    }
  };

  return [storedValue, setValue, isLoaded] as const;
}
