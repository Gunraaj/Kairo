
import { useState, useEffect, Dispatch, SetStateAction, useRef, useCallback } from 'react';

type StorageEnvelope = { version: number; data: unknown };
type StorageOptions<T> = {
  version: number;
  normalize: (value: unknown) => T;
};

const isEnvelope = (value: unknown): value is StorageEnvelope =>
  typeof value === 'object' && value !== null && 'version' in value && 'data' in value;

export const useLocalStorage = <T,>(
  key: string,
  initialValue: T,
  options: StorageOptions<T>,
): [T, Dispatch<SetStateAction<T>>] => {
  const initialValueRef = useRef(initialValue);
  const optionsRef = useRef(options);

  const readValue = useCallback((raw: string | null) => {
    if (!raw) return initialValueRef.current;
    try {
      const parsed: unknown = JSON.parse(raw);
      return optionsRef.current.normalize(isEnvelope(parsed) ? parsed.data : parsed);
    } catch {
      return initialValueRef.current;
    }
  }, []);

  const [storedValue, setStoredValue] = useState<T>(() => {
    return readValue(window.localStorage.getItem(key));
  });

  const setValue = useCallback<Dispatch<SetStateAction<T>>>((value) => {
    setStoredValue(previous => {
      const next = value instanceof Function ? value(previous) : value;
      const valueToStore = optionsRef.current.normalize(next);
      try {
        window.localStorage.setItem(key, JSON.stringify({
          version: optionsRef.current.version,
          data: valueToStore,
        }));
      } catch {
        // Keep the in-memory state usable when storage is unavailable or full.
      }
      return valueToStore;
    });
  }, []);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key) {
        setStoredValue(readValue(e.newValue));
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key, readValue]);

  return [storedValue, setValue];
};
