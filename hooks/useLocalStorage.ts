
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

  const latestRef = useRef(storedValue);

  const setValue = useCallback<Dispatch<SetStateAction<T>>>((value) => {
    const next = value instanceof Function ? value(latestRef.current) : value;
    const valueToStore = optionsRef.current.normalize(next);
    latestRef.current = valueToStore;
    setStoredValue(valueToStore);
    try {
      window.localStorage.setItem(key, JSON.stringify({
        version: optionsRef.current.version,
        data: valueToStore,
      }));
    } catch {
      // Keep the in-memory state usable when storage is unavailable or full.
    }
  }, [key]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key) {
        const incoming = readValue(e.newValue);
        latestRef.current = incoming;
        setStoredValue(incoming);
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key, readValue]);

  return [storedValue, setValue];
};
