import { useEffect, useRef, useCallback } from 'react';
import { getUserData, setUserData, USER_KEYS } from '../utils/userDb';
import { isAuthenticated } from '../utils/auth';
import { postActivityDay } from '../utils/api';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Returns today's date as YYYY-MM-DD in the user's local timezone. */
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Merge a set of "chapter:verse" keys into compact inclusive ranges.
 * Example: ["1:5","1:6","1:7","2:1","2:3"] → ["1:5-1:7","2:1-2:1","2:3-2:3"]
 */
const mergeKeysToRanges = (keys) => {
  if (keys.size === 0) return [];

  // Parse into { chapter, verse } and sort
  const parsed = [...keys]
    .map((k) => {
      const [ch, v] = k.split(':').map(Number);
      return { chapter: ch, verse: v };
    })
    .sort((a, b) => a.chapter - b.chapter || a.verse - b.verse);

  const ranges = [];
  let start = parsed[0];
  let end = parsed[0];

  for (let i = 1; i < parsed.length; i++) {
    const cur = parsed[i];
    // Contiguous if same chapter and next verse
    if (cur.chapter === end.chapter && cur.verse === end.verse + 1) {
      end = cur;
    } else {
      ranges.push(`${start.chapter}:${start.verse}-${end.chapter}:${end.verse}`);
      start = cur;
      end = cur;
    }
  }
  ranges.push(`${start.chapter}:${start.verse}-${end.chapter}:${end.verse}`);
  return ranges;
};

/**
 * Merge two arrays of range strings, de-duplicate, and re-compact.
 * This lets us accumulate across multiple flush cycles in the same day.
 */
const mergeRangeArrays = (existingRanges, newRanges) => {
  const allKeys = new Set();

  const expandRange = (rangeStr) => {
    const [startPart, endPart] = rangeStr.split('-');
    const [sc, sv] = startPart.split(':').map(Number);
    const [ec, ev] = endPart.split(':').map(Number);

    if (sc === ec) {
      for (let v = sv; v <= ev; v++) allKeys.add(`${sc}:${v}`);
    } else {
      // Cross-chapter range: expand start chapter, then end chapter
      // In practice our ranges rarely cross chapters, but handle it
      allKeys.add(`${sc}:${sv}`);
      allKeys.add(`${ec}:${ev}`);
    }
  };

  [...existingRanges, ...newRanges].forEach(expandRange);
  return mergeKeysToRanges(allKeys);
};

// ── Dwell-time threshold (ms) ────────────────────────────────────────────────
// A verse is only counted as "read" if it stays visible for at least this long.
const DWELL_THRESHOLD_MS = 1_000; // 1 second

// ── Flush interval (seconds) ─────────────────────────────────────────────────
const FLUSH_INTERVAL_MS = 5_000; // flush every 5 seconds

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useActivityTracker
 *
 * Call this from the reading view (e.g. VerseList).
 * It automatically:
 *   1. Counts active seconds while document is focused.
 *   2. Collects verse keys reported via `reportVerseVisible` / `reportVerseHidden`
 *      — a verse is only added to the pending set after it has been continuously
 *      visible for ≥ DWELL_THRESHOLD_MS (1 second).
 *   3. Every FLUSH_INTERVAL_MS merges + persists to localUserDB → USER_KEYS.ACTIVITIES.
 *
 * Returns:
 *   - reportVerseVisible(key: string) — call when a verse enters the viewport
 *   - reportVerseHidden(key: string)  — call when a verse leaves the viewport
 *   - flushActivity()                 — force-flush immediately (call on unmount / nav)
 */
export function useActivityTracker() {
  // Mutable refs to survive across renders without causing re-renders
  const pendingSeconds = useRef(0);
  const pendingKeys = useRef(new Set());
  const isFocused = useRef(document.hasFocus());
  const tickInterval = useRef(null);
  const flushTimer = useRef(null);

  // Dwell-time tracking: Map<verseKey, timeoutId>
  // When a verse becomes visible, we start a timer. If it's still visible
  // after DWELL_THRESHOLD_MS, we add it to pendingKeys. If it leaves before
  // the timer fires, we cancel the timer and don't count it.
  const dwellTimers = useRef(new Map());

  // Unsynced data buffer for authenticated user API sync retries
  const unsyncedSeconds = useRef(0);
  const unsyncedKeys = useRef(new Set());

  // ── Second counter ─────────────────────────────────────────────────────────
  useEffect(() => {
    // Tick every 1 second, only counting when tab is focused
    tickInterval.current = setInterval(() => {
      if (isFocused.current) {
        pendingSeconds.current += 1;
      }
    }, 1_000);

    const onFocus = () => { isFocused.current = true; };
    const onBlur = () => { isFocused.current = false; };

    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);

    return () => {
      clearInterval(tickInterval.current);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // ── Flush logic ────────────────────────────────────────────────────────────
  const flushActivity = useCallback(async () => {
    const secs = pendingSeconds.current;
    const keys = pendingKeys.current;

    const loggedIn = isAuthenticated();

    // Reset pending
    if (secs > 0 || keys.size > 0) {
      pendingSeconds.current = 0;
      pendingKeys.current = new Set();

      const date = todayStr();
      const newRanges = mergeKeysToRanges(keys);

      try {
        // Local-first: Save to the correct IndexedDB immediately
        const activities = (await getUserData(USER_KEYS.ACTIVITIES, loggedIn)) || [];
        const idx = activities.findIndex((a) => a.date === date);
        if (idx !== -1) {
          activities[idx].seconds += secs;
          activities[idx].ranges = mergeRangeArrays(activities[idx].ranges || [], newRanges);
        } else {
          activities.push({ date, seconds: secs, ranges: newRanges });
        }
        await setUserData(USER_KEYS.ACTIVITIES, activities, loggedIn);
      } catch (err) {
        console.error('[ActivityTracker] Local write failed:', err);
      }

      // If logged in, queue for server sync
      if (loggedIn) {
        unsyncedSeconds.current += secs;
        keys.forEach(k => unsyncedKeys.current.add(k));
      }
    }

    // Now, if logged in and we have unsynced data, attempt to sync with server
    if (loggedIn && (unsyncedSeconds.current > 0 || unsyncedKeys.current.size > 0)) {
      const syncSecs = unsyncedSeconds.current;
      const syncKeys = new Set(unsyncedKeys.current);
      const syncRanges = mergeKeysToRanges(syncKeys);
      const date = todayStr();

      try {
        await postActivityDay({
          date,
          type: 'QURAN',
          seconds: syncSecs,
          ranges: syncRanges,
          mushafId: 4
        });
        
        // Success! Deduct successfully synced portion from buffer
        unsyncedSeconds.current -= syncSecs;
        syncKeys.forEach(k => unsyncedKeys.current.delete(k));
      } catch (err) {
        console.error('[ActivityTracker] Server sync failed (will retry in next flush):', err);
      }
    }
  }, []);

  // ── Periodic flush ─────────────────────────────────────────────────────────
  useEffect(() => {
    flushTimer.current = setInterval(() => {
      flushActivity();
    }, FLUSH_INTERVAL_MS);

    return () => {
      clearInterval(flushTimer.current);
      // Final flush on unmount
      flushActivity();
      // Clear any pending dwell timers
      for (const timerId of dwellTimers.current.values()) {
        clearTimeout(timerId);
      }
      dwellTimers.current.clear();
    };
  }, [flushActivity]);

  // ── Public: report a verse becoming visible ────────────────────────────────
  // Starts a dwell timer; the verse is only counted after DWELL_THRESHOLD_MS.
  const reportVerseVisible = useCallback((key) => {
    if (!key) return;
    // If there's already a pending timer for this key, don't start another
    if (dwellTimers.current.has(key)) return;

    const timerId = setTimeout(() => {
      pendingKeys.current.add(key);
      dwellTimers.current.delete(key);
    }, DWELL_THRESHOLD_MS);

    dwellTimers.current.set(key, timerId);
  }, []);

  // ── Public: report a verse leaving the viewport ────────────────────────────
  // Cancels the dwell timer if the verse hasn't crossed the threshold yet.
  const reportVerseHidden = useCallback((key) => {
    if (!key) return;
    const timerId = dwellTimers.current.get(key);
    if (timerId !== undefined) {
      clearTimeout(timerId);
      dwellTimers.current.delete(key);
    }
    // If the key was already added to pendingKeys (timer already fired),
    // we keep it — the verse was genuinely read.
  }, []);

  return { reportVerseVisible, reportVerseHidden, flushActivity };
}
