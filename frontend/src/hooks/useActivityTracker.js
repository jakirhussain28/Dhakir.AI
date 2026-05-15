import { useEffect, useRef, useCallback } from 'react';
import { getUserData, setUserData, USER_KEYS } from '../utils/userDb';

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

// ── Flush interval (seconds) ─────────────────────────────────────────────────
const FLUSH_INTERVAL_MS = 5_000; // flush every 5 seconds

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useActivityTracker
 *
 * Call this from the reading view (e.g. VerseList).
 * It automatically:
 *   1. Counts active seconds while document is focused.
 *   2. Collects verse keys reported via `reportVerseKey(key)`.
 *   3. Every FLUSH_INTERVAL_MS merges + persists to localUserDB → USER_KEYS.ACTIVITIES.
 *
 * Returns:
 *   - reportVerseKey(key: string)  — call when a verse becomes visible
 *   - flushActivity()              — force-flush immediately (call on unmount / nav)
 */
export function useActivityTracker() {
  // Mutable refs to survive across renders without causing re-renders
  const pendingSeconds = useRef(0);
  const pendingKeys = useRef(new Set());
  const isFocused = useRef(document.hasFocus());
  const tickInterval = useRef(null);
  const flushTimer = useRef(null);

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

    // Nothing to save
    if (secs === 0 && keys.size === 0) return;

    // Snapshot & reset
    const date = todayStr();
    const newRanges = mergeKeysToRanges(keys);
    pendingSeconds.current = 0;
    pendingKeys.current = new Set();

    try {
      // Always target localUserDB (isLoggedIn = false)
      const activities = (await getUserData(USER_KEYS.ACTIVITIES, false)) || [];

      // Find today's entry
      const idx = activities.findIndex((a) => a.date === date);
      if (idx !== -1) {
        // Accumulate seconds and merge ranges
        activities[idx].seconds += secs;
        activities[idx].ranges = mergeRangeArrays(activities[idx].ranges || [], newRanges);
      } else {
        activities.push({ date, seconds: secs, ranges: newRanges });
      }

      await setUserData(USER_KEYS.ACTIVITIES, activities, false);
    } catch (err) {
      console.error('[ActivityTracker] flush failed:', err);
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
    };
  }, [flushActivity]);

  // ── Public: report a visible verse key ─────────────────────────────────────
  const reportVerseKey = useCallback((key) => {
    if (key) pendingKeys.current.add(key);
  }, []);

  return { reportVerseKey, flushActivity };
}
