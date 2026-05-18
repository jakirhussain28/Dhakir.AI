import { useState, useEffect, useCallback, useRef } from 'react';
import { getUserData, setUserData, USER_KEYS } from '../utils/userDb';
import { ActivityCalculator } from '../utils/Activity_Streak_Calculator';
import { isAuthenticated } from '../utils/auth';
import { fetchActivityDays } from '../utils/api';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Returns today's date as YYYY-MM-DD in the user's local timezone. */
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Convert total seconds into a human-readable string.
 * < 60s  → "X sec"
 * < 3600 → "X min"
 * else   → "Xh Ym"
 */
export const formatReadingTime = (totalSeconds) => {
  if (totalSeconds < 60) return `${totalSeconds} sec`;
  const mins = Math.floor(totalSeconds / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
};

/**
 * Determine the heatmap intensity level from reading seconds.
 *   0 = Missed  (0 seconds)
 *   1 = Light   (1 – 900 seconds, i.e. up to 15 min)
 *   2 = Medium  (901 – 1800 seconds, 15 – 30 min)
 *   3 = Heavy   (> 1800 seconds, 30+ min)
 */
const secondsToLevel = (seconds) => {
  if (!seconds || seconds <= 0) return 0;
  if (seconds <= 900) return 1;   // up to 15 min
  if (seconds <= 1800) return 2;  // 15 – 30 min
  return 3;                        // 30+ min
};

/**
 * Build the 3-month calendar grid arrays from the activities list.
 * Each month grid has 35 slots (7 rows × 5 cols), padded with `null`
 * so the first actual day aligns with the correct weekday row.
 *
 * Returns { months: [{ name, grid }], todaySeconds, streakDays, activities }
 * Each grid cell is either `null` (padding / future) or `{ level, dateKey }`.
 */
export const buildCalendarData = (activities = []) => {
  const now = new Date();
  const activityMap = new Map();
  activities.forEach((a) => activityMap.set(a.date, a.seconds || 0));

  // Build grids for current month, previous month, and two-months-ago
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  const months = [];
  for (let offset = -2; offset <= 0; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const firstDayOfWeek = d.getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = todayStr();

    // Build grid: 7-row × N-col, filled column-first
    const grid = [];

    // Leading nulls for alignment
    for (let i = 0; i < firstDayOfWeek; i++) grid.push(null);

    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      // Only show activity for past days and today — future days are null
      if (dateKey > today) {
        grid.push(null);
      } else {
        const secs = activityMap.get(dateKey) || 0;
        grid.push({ level: secondsToLevel(secs), dateKey });
      }
    }

    // Trailing nulls to fill to a multiple of 7 (complete weeks)
    while (grid.length % 7 !== 0) grid.push(null);

    months.push({ name: monthNames[month], grid });
  }

  // Today's reading seconds
  const todayDate = todayStr();
  const todaySeconds = activityMap.get(todayDate) || 0;

  // Calculate local streak (consecutive days with > 0 seconds, ending today or yesterday)
  let streakDays = 0;
  const checkDate = new Date(now);
  // If today has no activity yet, start checking from yesterday
  if (!activityMap.has(todayDate) || activityMap.get(todayDate) <= 0) {
    checkDate.setDate(checkDate.getDate() - 1);
  }
  for (let i = 0; i < 365; i++) {
    const key = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
    if (activityMap.has(key) && activityMap.get(key) > 0) {
      streakDays++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return { months, todaySeconds, streakDays, activities };
};

/** Merge two arrays of range strings using ActivityCalculator. */
const mergeRangeArrays = (arr1, arr2) => {
  const keys = new Set();
  arr1.forEach(r => ActivityCalculator.expandRange(r).forEach(k => keys.add(k)));
  arr2.forEach(r => ActivityCalculator.expandRange(r).forEach(k => keys.add(k)));
  return ActivityCalculator.compactRanges(Array.from(keys));
};

/** Merge server-side activities with local IndexedDB activities. */
const mergeServerActivities = (localActivities, serverDays) => {
  const today = todayStr();
  const localMap = new Map(localActivities.map(a => [a.date, a]));

  serverDays.forEach(sDay => {
    const date = sDay.date;
    const sSecs = sDay.secondsRead || sDay.seconds || 0;
    const sRanges = sDay.ranges || [];

    if (date === today) {
      // Merge today's ranges and take max seconds to avoid losing active local progress
      const localToday = localMap.get(today) || { date: today, seconds: 0, ranges: [] };
      const mergedRanges = mergeRangeArrays(localToday.ranges || [], sRanges);
      localMap.set(today, {
        date: today,
        seconds: Math.max(localToday.seconds, sSecs),
        ranges: mergedRanges
      });
    } else {
      // Overwrite past days with server truth
      localMap.set(date, {
        date,
        seconds: sSecs,
        ranges: sRanges
      });
    }
  });

  return Array.from(localMap.values());
};

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useLocalActivities
 *
 * Reads the ACTIVITIES array from localUserDB and returns processed data
 * for the StreakBox and ActivityBox components.
 *
 * Returns:
 *   - months: [{ name, grid }] — 3-month calendar data
 *   - todaySeconds: number — total reading seconds today
 *   - streakDays: number — current consecutive streak
 *   - loading: boolean
 *   - refresh(): void — manually trigger a re-read from IndexedDB
 */
export function useLocalActivities() {
  const [data, setData] = useState({
    months: [],
    todaySeconds: 0,
    streakDays: 0,
    activities: [],
  });
  const [loading, setLoading] = useState(true);
  const lastServerFetch = useRef(0);

  const load = useCallback(async () => {
    try {
      await ActivityCalculator.loadChapterNames();
      const loggedIn = isAuthenticated();
      
      // Local-first: load immediately from correct store
      const localActivities = (await getUserData(USER_KEYS.ACTIVITIES, loggedIn)) || [];
      const initialResult = buildCalendarData(localActivities);
      setData(initialResult);

      // Sync-second: background API fetch, throttled to once every 60s
      if (loggedIn) {
        const nowMs = Date.now();
        if (nowMs - lastServerFetch.current > 60_000) {
          lastServerFetch.current = nowMs;

          const now = new Date();
          const fromDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
          const fromStr = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}-01`;

          try {
            const serverDays = await fetchActivityDays(fromStr);
            if (Array.isArray(serverDays) && serverDays.length > 0) {
              const merged = mergeServerActivities(localActivities, serverDays);
              await setUserData(USER_KEYS.ACTIVITIES, merged, true);
              const finalResult = buildCalendarData(merged);
              setData(finalResult);
            }
          } catch (syncErr) {
            console.error('[useLocalActivities] background sync failed:', syncErr);
          }
        }
      }
    } catch (err) {
      console.error('[useLocalActivities] failed to load:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();

    // Refresh every 10 seconds to pick up new flushes from the activity tracker
    const interval = setInterval(load, 10_000);
    return () => clearInterval(interval);
  }, [load]);

  // Also update the streakDays in correct IndexedDB so useStreakDays can read it
  useEffect(() => {
    if (!loading) {
      const loggedIn = isAuthenticated();
      setUserData(USER_KEYS.STREAK_DAYS, data.streakDays, loggedIn).catch(() => { });
    }
  }, [data.streakDays, loading]);

  return { ...data, loading, refresh: load };
}
