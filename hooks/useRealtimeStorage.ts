import { useState, useEffect, useCallback, useRef } from 'react';

// Key used to store the currently logged-in email/UID
export const SESSION_KEY = 'daily_task_active_session_user';

/**
 * A hook that syncs with localStorage and updates in real-time across tabs.
 * PERFORMANCE OPTIMIZED: Reduces unnecessary JSON parsing and re-renders.
 */
export function useRealtimeStorage<T>(key: string, initialValue: T, globalKey: boolean = false) {
  
  const getStorageKey = useCallback(() => {
    if (globalKey) return key;
    if (typeof window === 'undefined') return `guest_${key}`;
    const currentUser = window.localStorage.getItem(SESSION_KEY);
    const prefix = currentUser ? currentUser.trim() : 'guest';
    return `${prefix}_${key}`;
  }, [key, globalKey]);

  // We store the RAW string value to compare against before parsing.
  // This saves massive CPU on the polling interval.
  const lastRawValue = useRef<string | null>(null);

  // Function to read value safely
  const readValue = useCallback((): T => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const finalKey = getStorageKey();
      const item = window.localStorage.getItem(finalKey);
      
      // Optimization: Update our ref
      lastRawValue.current = item;

      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      return initialValue;
    }
  }, [initialValue, getStorageKey]);

  const [storedValue, setStoredValue] = useState<T>(readValue);
  const isTabVisible = useRef(true);

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      setStoredValue(prev => {
        const valueToStore = value instanceof Function ? value(prev) : value;
        
        if (typeof window !== 'undefined') {
          const finalKey = getStorageKey();
          const stringValue = JSON.stringify(valueToStore);
          
          // Only write if changed (though localStorage usually handles this, React state update needs care)
          if (stringValue !== lastRawValue.current) {
              window.localStorage.setItem(finalKey, stringValue);
              lastRawValue.current = stringValue;
              window.dispatchEvent(new Event('local-storage'));
          }
        }
        return valueToStore;
      });
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, getStorageKey]);

  useEffect(() => {
    // Initial read
    setStoredValue(readValue());

    const handleSync = () => {
        // Optimized Sync: Check raw string first
        const finalKey = getStorageKey();
        const currentRaw = window.localStorage.getItem(finalKey);
        
        if (currentRaw !== lastRawValue.current) {
            setStoredValue(readValue());
        }
    };

    window.addEventListener('storage', handleSync);
    window.addEventListener('local-storage', handleSync);
    window.addEventListener('auth-change', handleSync);

    const handleVisibilityChange = () => {
        isTabVisible.current = document.visibilityState === 'visible';
        if (isTabVisible.current) handleSync();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Adaptive Polling: Only checks strings, doesn't parse JSON unless changed
    const intervalId = setInterval(() => {
      if (isTabVisible.current) {
          handleSync();
      }
    }, 3000); // Increased to 3s for better performance

    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('local-storage', handleSync);
      window.removeEventListener('auth-change', handleSync);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(intervalId);
    };
  }, [readValue, getStorageKey]); 

  return [storedValue, setValue] as const;
}