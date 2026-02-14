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

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== 'undefined') {
        const finalKey = getStorageKey();
        window.localStorage.setItem(finalKey, JSON.stringify(valueToStore));
        window.dispatchEvent(new Event('local-storage'));
      }
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  };

  useEffect(() => {
    const handleSync = () => setStoredValue(readValue());

    window.addEventListener('storage', handleSync);
    window.addEventListener('local-storage', handleSync);
    window.addEventListener('auth-change', handleSync);

    // Đặc biệt quan trọng: theo dõi thay đổi SESSION_KEY trực tiếp
    const interval = setInterval(() => {
      const currentKey = getStorageKey();
      const session = window.localStorage.getItem(SESSION_KEY);
      // Nếu session thay đổi, cập nhật lại dữ liệu
      if (session && !currentKey.startsWith(session) && !globalKey) {
        handleSync();
      }
    }, 1000);

    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('local-storage', handleSync);
      window.removeEventListener('auth-change', handleSync);
      clearInterval(interval);
    };
  }, [readValue, getStorageKey, globalKey]);

  return [storedValue, setValue] as const;
}