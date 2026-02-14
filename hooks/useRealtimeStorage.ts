import { useState, useEffect, useCallback, useRef } from 'react';

// Key used to store the currently logged-in email/UID
export const SESSION_KEY = 'daily_task_active_session_user';

/**
 * A hook that syncs with localStorage and updates in real-time across tabs.
 * OPTIMIZED: Uses adaptive polling based on visibility to save resources.
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
  const isTabVisible = useRef(true);

  // Wrap setValue in useCallback to maintain stable reference
  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      setStoredValue(prev => {
        const valueToStore = value instanceof Function ? value(prev) : value;
        
        if (typeof window !== 'undefined') {
          const finalKey = getStorageKey();
          window.localStorage.setItem(finalKey, JSON.stringify(valueToStore));
          // Dispatch manual event for same-tab updates
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
    // Immediate update when key changes
    setStoredValue(readValue());

    const handleSync = () => setStoredValue(readValue());

    // Basic listeners
    window.addEventListener('storage', handleSync);
    window.addEventListener('local-storage', handleSync);
    window.addEventListener('auth-change', handleSync);

    // Visibility handlers to optimize polling
    const handleVisibilityChange = () => {
        isTabVisible.current = document.visibilityState === 'visible';
        if (isTabVisible.current) {
            handleSync(); // Sync immediately when returning to tab
        }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Adaptive Polling
    const intervalId = setInterval(() => {
      // Only poll if tab is visible to save battery/CPU
      if (isTabVisible.current) {
          handleSync();
      }
    }, 2000); // Relaxed polling to 2s for better performance

    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('local-storage', handleSync);
      window.removeEventListener('auth-change', handleSync);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(intervalId);
    };
  }, [readValue]); 

  return [storedValue, setValue] as const;
}