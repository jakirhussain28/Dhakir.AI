import { useState, useEffect } from 'react';
import { isAuthenticated } from '../utils/auth';
import { fetchCurrentStreakDays } from '../utils/api';
import { getUserData, setUserData, USER_KEYS } from '../utils/userDb';

/**
 * @returns {{ streakDays: number, loading: boolean }}
 */
export function useStreakDays() {
  const [streakDays, setStreakDays] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const loggedIn = isAuthenticated();

      // Local-first: load immediately from the correct database
      const cached = await getUserData(USER_KEYS.STREAK_DAYS, loggedIn);
      if (!cancelled) {
        setStreakDays(typeof cached === 'number' ? cached : 0);
      }

      if (loggedIn) {
        // Sync-second: fetch from API and update qfUserDB in background
        setLoading(true);
        try {
          const days = await fetchCurrentStreakDays();
          if (!cancelled) {
            setStreakDays(days);
            await setUserData(USER_KEYS.STREAK_DAYS, days, true);
          }
        } catch (err) {
          console.error('Failed to fetch streak days:', err);
        } finally {
          if (!cancelled) setLoading(false);
        }
      }
    };

    load();

    // Re-check when auth state changes (login / logout from another tab)
    const onStorageChange = () => load();
    window.addEventListener('storage', onStorageChange);

    return () => {
      cancelled = true;
      window.removeEventListener('storage', onStorageChange);
    };
  }, []);

  return { streakDays, loading };
}
