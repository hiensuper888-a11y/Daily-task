import { useState, useEffect, useCallback } from 'react';

// Key used to store the currently logged-in email
export const SESSION_KEY = 'daily_task_active_session_user';

/**
 * A hook that syncs with localStorage and updates in real-time across tabs.
 * It automatically prefixes keys with the current user's email to ensure data separation,
 * UNLESS globalKey is set to true (used for shared group data simulation).
 */
export function useRealtimeStorage<T>(key: string, initialValue: T, globalKey: boolean = false) {
  
  // Helper to determine the prefix (User ID/Email or 'guest')
  const getStorageKey = useCallback(() => {
    if (globalKey) return key; // No prefix for group/shared data

    if (typeof window === 'undefined') return `guest_${key}`;
    const currentUser = window.localStorage.getItem(SESSION_KEY);
    const prefix = currentUser ? currentUser.trim() : 'guest';
    return `${prefix}_${key}`;
  }, [key, globalKey]);

  // Helper to get value from storage
  const readValue = useCallback((): T => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const finalKey = getStorageKey();
      const item = window.localStorage.getItem(finalKey);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  }, [initialValue, getStorageKey, key]);

  const [storedValue, setStoredValue] = useState<T>(readValue);

  // Function to set value and trigger event
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== 'undefined') {
        const finalKey = getStorageKey();
        window.localStorage.setItem(finalKey, JSON.stringify(valueToStore));
        // Dispatch custom events
        window.dispatchEvent(new Event('local-storage'));
      }
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  };

  // Re-read storage when the component mounts or when keys change
  useEffect(() => {
    setStoredValue(readValue());
  }, [readValue]);

  useEffect(() => {
    const handleStorageChange = () => {
      setStoredValue(readValue());
    };

    // Listen for changes from other tabs
    window.addEventListener('storage', handleStorageChange);
    // Listen for changes from the same tab (custom event)
    window.addEventListener('local-storage', handleStorageChange);
    // Listen for auth changes (Login/Logout) to switch data sources immediately
    window.addEventListener('auth-change', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('local-storage', handleStorageChange);
      window.removeEventListener('auth-change', handleStorageChange);
    };
  }, [readValue]);

  return [storedValue, setValue] as const;
}
