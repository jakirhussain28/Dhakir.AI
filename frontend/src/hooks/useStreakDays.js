// src/hooks/useStreakDays.js
//
// Shared hook consumed by both StreakBox and ActivityBox so they
// display the same streak-days value without duplicating fetch logic.
//
// For authenticated users it calls GET /v1/streaks/current-streak-days?type=QURAN
// through the backend proxy.  For local (unauthenticated) users it
// falls back to the locally-persisted streak value (defaults to 0).

import { useState, useEffect } from 'react';
import { isAuthenticated } from '../utils/auth';
import { fetchCurrentStreakDays } from '../utils/api';

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
        // Not logged in — fall back to local streak (stored in localStorage)
        const local = parseInt(localStorage.getItem('local_streak_days') || '0', 10);
        if (!cancelled) setStreakDays(local);
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
