import { useState, useEffect, useCallback, useRef } from 'react';

// Key used to store the currently logged-in email/UID
export const SESSION_KEY = 'daily_task_active_session_user';

/**
 * A hook that syncs with localStorage and updates in real-time across tabs.
 */
export function useRealtimeStorage<T>(key: string, initialValue: T, globalKey: boolean = false) {
  
  // Helper to determine the actual storage key based on login session
  const getStorageKey = useCallback(() => {
    if (globalKey) return key;
    if (typeof window === 'undefined') return `guest_${key}`;
    
    // Get current user ID from session
    const currentUser = window.localStorage.getItem(SESSION_KEY);
    const prefix = currentUser ? currentUser.trim() : 'guest';
    return `${prefix}_${key}`;
  }, [key, globalKey]);

  // We store the RAW string value to compare against before parsing.
  const lastRawValue = useRef<string | null>(null);
  
  // Use a ref to hold the initial value so it doesn't trigger effect re-runs
  const initialValueRef = useRef(initialValue);

  // Function to read value safely
  const readValue = useCallback((): T => {
    if (typeof window === 'undefined') return initialValueRef.current;
    try {
      const finalKey = getStorageKey();
      const item = window.localStorage.getItem(finalKey);
      
      // Update our ref for comparison later
      lastRawValue.current = item;

      return item ? JSON.parse(item) : initialValueRef.current;
    } catch (error) {
      console.warn('Error reading from storage:', error);
      return initialValueRef.current;
    }
  }, [getStorageKey]); // Removed initialValue from deps

  const [storedValue, setStoredValue] = useState<T>(readValue);
  const isTabVisible = useRef(true);

  // Function to set value
  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      setStoredValue(prev => {
        const valueToStore = value instanceof Function ? value(prev) : value;
        
        if (typeof window !== 'undefined') {
          const finalKey = getStorageKey();
          const stringValue = JSON.stringify(valueToStore);
          
          // Only write to localStorage if string value actually changed
          if (stringValue !== lastRawValue.current) {
              window.localStorage.setItem(finalKey, stringValue);
              lastRawValue.current = stringValue;
              // Dispatch event for other hooks
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
    // 1. Initial read on mount/key change
    setStoredValue(readValue());

    // 2. Event handler for sync
    const handleSync = (e?: Event) => {
        // Always re-read on auth-change because the KEY PREFIX has likely changed (guest -> user)
        if (e?.type === 'auth-change') {
            setStoredValue(readValue());
            return;
        }

        const finalKey = getStorageKey();
        const currentRaw = window.localStorage.getItem(finalKey);
        
        // Update if the raw value in storage is different from what we last saw
        if (currentRaw !== lastRawValue.current) {
            setStoredValue(readValue());
        }
    };

    // 3. Listeners
    window.addEventListener('storage', handleSync);
    window.addEventListener('local-storage', handleSync);
    window.addEventListener('auth-change', handleSync);

    const handleVisibilityChange = () => {
        isTabVisible.current = document.visibilityState === 'visible';
        if (isTabVisible.current) handleSync();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 4. Polling fallback (checks every 3s if tab is visible)
    const intervalId = setInterval(() => {
      if (isTabVisible.current) {
          handleSync();
      }
    }, 3000); 

    // 5. Cleanup
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