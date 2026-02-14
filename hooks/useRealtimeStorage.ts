import { useState, useEffect, useCallback } from 'react';

// Key used to store the currently logged-in email/UID
export const SESSION_KEY = 'daily_task_active_session_user';

/**
 * A hook that syncs with localStorage and updates in real-time across tabs.
 */
export function useRealtimeStorage<T>(key: string, initialValue: T, globalKey: boolean = false) {
  
  const getStorageKey = useCallback(() => {
    if (globalKey) return key;

    if (typeof window === 'undefined') return `guest_${key}`;
    const currentUser = window.localStorage.getItem(SESSION_KEY);
    const prefix = currentUser ? currentUser.trim() : 'guest';
    return `${prefix}_${key}`;
  }, [key, globalKey]);

  // Function to read value safely
  const readValue = useCallback((): T => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const finalKey = getStorageKey();
      const item = window.localStorage.getItem(finalKey);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      return initialValue;
    }
  }, [initialValue, getStorageKey]);

  const [storedValue, setStoredValue] = useState<T>(readValue);

  // Wrap setValue in useCallback to maintain stable reference
  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      setStoredValue(prev => {
        const valueToStore = value instanceof Function ? value(prev) : value;
        
        if (typeof window !== 'undefined') {
          const finalKey = getStorageKey();
          window.localStorage.setItem(finalKey, JSON.stringify(valueToStore));
          window.dispatchEvent(new Event('local-storage'));
        }
        return valueToStore;
      });
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, getStorageKey]);

  // Sync when key changes or external updates happen
  useEffect(() => {
    // Immediate update when key changes to prevent stale data
    setStoredValue(readValue());

    const handleSync = () => setStoredValue(readValue());

    window.addEventListener('storage', handleSync);
    window.addEventListener('local-storage', handleSync);
    window.addEventListener('auth-change', handleSync);

    // Poll for session changes to ensure multi-tab consistency
    const interval = setInterval(() => {
      handleSync();
    }, 1000);

    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('local-storage', handleSync);
      window.removeEventListener('auth-change', handleSync);
      clearInterval(interval);
    };
  }, [readValue]); 

  return [storedValue, setValue] as const;
}