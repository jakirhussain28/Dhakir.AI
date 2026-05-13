import { useState, useEffect } from 'react';
import { isAuthenticated } from '../utils/auth';
import { fetchCurrentStreakDays } from '../utils/api';
import { getUserData, USER_KEYS } from '../utils/userDb';

/**
 * @returns {{ streakDays: number, loading: boolean }}
 */
export function useStreakDays() {
  const [streakDays, setStreakDays] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!isAuthenticated()) {
        // Not logged in — fall back to local streak (stored in localUserDB)
        const local = await getUserData(USER_KEYS.STREAK_DAYS, false);
        if (!cancelled) setStreakDays(typeof local === 'number' ? local : 0);
        return;
      }

      // Authenticated — fetch from the Quran Foundation API
      setLoading(true);
      try {
        const days = await fetchCurrentStreakDays();
        if (!cancelled) setStreakDays(days);
      } catch (err) {
        console.error('Failed to fetch streak days:', err);
        // Keep current value (0) on error
      } finally {
        if (!cancelled) setLoading(false);
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
