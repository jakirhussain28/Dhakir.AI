import { getUserData, USER_KEYS } from './userDb';
import { getFromDB, DB_STORES } from './db';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Returns today's date as YYYY-MM-DD in the user's local timezone. */
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};



/**
 * Format total seconds as "X minutes Y seconds" (detailed form).
 * @param {number} totalSeconds
 * @returns {string}
 */
export const formatDetailedTime = (totalSeconds) => {
  if (!totalSeconds || totalSeconds <= 0) return '0 seconds';
  // Round total seconds to 1 decimal place 
  const roundedTotal = Math.round(totalSeconds * 10) / 10;
  const mins = Math.floor(roundedTotal / 60);
  const secs = Math.round((roundedTotal % 60) * 10) / 10;
  const parts = [];
  if (mins > 0) parts.push(`${mins} minute${mins !== 1 ? 's' : ''}`);
  if (secs > 0) parts.push(`${secs} second${secs !== 1 ? 's' : ''}`);
  return parts.join(' ');
};

// ──────────────────────────────────────────────────────────────────────────────
// ActivityCalculator
//
// Fetches raw activity data from localUserDB and provides methods to compute
// verse counts, organise ranges, and get per-day breakdowns.
// ──────────────────────────────────────────────────────────────────────────────

export class ActivityCalculator {
  static chapterNamesCache = [];

  static async loadChapterNames() {
    if (this.chapterNamesCache.length > 0) return;
    try {
      const res = await getFromDB(DB_STORES.CHAPTERS, 'all_chapters');
      if (res && res.data && res.data.chapters) {
        const names = [''];
        res.data.chapters.forEach(c => {
          names[c.id] = c.name_simple;
        });
        this.chapterNamesCache = names;
      }
    } catch (e) {
      console.error("Failed to load chapter names from DB", e);
    }
  }

  /** @type {Array<{date:string, seconds:number, ranges:string[]}>} */
  #activities = [];

  /** Fetch raw activities from localUserDB (always local, isLoggedIn = false). */
  async load() {
    this.#activities = (await getUserData(USER_KEYS.ACTIVITIES, false)) || [];
    return this;
  }

  /** Allow injecting data directly (useful for testing). */
  loadFromArray(activities) {
    this.#activities = activities || [];
    return this;
  }

  /** Return the raw activities array. */
  getActivities() {
    return this.#activities;
  }

  // ── Verse count helpers ──────────────────────────────────────────────────

  /**
   * Expand a single range string like "1:5-1:7" into individual verse keys.
   * Only expands within the same chapter. Cross-chapter ranges are treated
   * as two endpoints (edge case; in practice ranges don't cross chapters).
   * @param {string} rangeStr — e.g. "2:1-2:5"
   * @returns {string[]}      — e.g. ["2:1","2:2","2:3","2:4","2:5"]
   */
  static expandRange(rangeStr) {
    if (!rangeStr) return [];
    // Guard: if there's no hyphen, this is already a single verse key (e.g. "1:5")
    if (!rangeStr.includes('-')) return [rangeStr];
    const [startPart, endPart] = rangeStr.split('-');
    if (!endPart) return startPart ? [startPart] : [];
    const [sc, sv] = startPart.split(':').map(Number);
    const [ec, ev] = endPart.split(':').map(Number);

    const keys = [];
    if (sc === ec) {
      for (let v = sv; v <= ev; v++) keys.push(`${sc}:${v}`);
    } else {
      // Cross-chapter: expand each chapter boundary
      // (very rare — the merger keeps ranges within one chapter)
      keys.push(`${sc}:${sv}`);
      keys.push(`${ec}:${ev}`);
    }
    return keys;
  }

  /**
   * Count the total unique verses across all activities (all time).
   * @returns {number}
   */
  totalVerseCount() {
    const unique = new Set();
    for (const act of this.#activities) {
      for (const r of act.ranges || []) {
        ActivityCalculator.expandRange(r).forEach((k) => unique.add(k));
      }
    }
    return unique.size;
  }

  /**
   * Count unique verses for a specific date.
   * @param {string} date — YYYY-MM-DD
   * @returns {number}
   */
  verseCountForDate(date) {
    const entry = this.#activities.find((a) => a.date === date);
    if (!entry) return 0;
    const unique = new Set();
    for (const r of entry.ranges || []) {
      ActivityCalculator.expandRange(r).forEach((k) => unique.add(k));
    }
    return unique.size;
  }

  /**
   * Count unique verses read today.
   * @returns {number}
   */
  todayVerseCount() {
    return this.verseCountForDate(todayStr());
  }

  // ── Range organisers ──────────────────────────────────────────────────────

  /**
   * Return the merged, de-duplicated ranges for a specific date.
   * The ranges come already merged from the tracker, but this method
   * re-normalises them in case multiple flush cycles left overlaps.
   * @param {string} date
   * @returns {string[]} — e.g. ["1:1-1:3","2:5-2:9"]
   */
  organisedRangesForDate(date) {
    const entry = this.#activities.find((a) => a.date === date);
    if (!entry) return [];
    return ActivityCalculator.compactRanges(entry.ranges || []);
  }

  /**
   * Return today's organised ranges.
   * @returns {string[]}
   */
  todayRanges() {
    return this.organisedRangesForDate(todayStr());
  }

  /**
   * Compact an array of range strings: expand → de-dup → re-merge.
   * @param {string[]} ranges
   * @returns {string[]}
   */
  static compactRanges(ranges) {
    if (!ranges || ranges.length === 0) return [];

    const allKeys = new Set();
    for (const r of ranges) {
      ActivityCalculator.expandRange(r).forEach((k) => allKeys.add(k));
    }

    // Sort and merge back into contiguous ranges
    const parsed = [...allKeys]
      .map((k) => {
        const [ch, v] = k.split(':').map(Number);
        return { chapter: ch, verse: v };
      })
      .sort((a, b) => a.chapter - b.chapter || a.verse - b.verse);

    if (parsed.length === 0) return [];

    const result = [];
    let start = parsed[0];
    let end = parsed[0];

    for (let i = 1; i < parsed.length; i++) {
      const cur = parsed[i];
      if (cur.chapter === end.chapter && cur.verse === end.verse + 1) {
        end = cur;
      } else {
        result.push(`${start.chapter}:${start.verse}-${end.chapter}:${end.verse}`);
        start = cur;
        end = cur;
      }
    }
    result.push(`${start.chapter}:${start.verse}-${end.chapter}:${end.verse}`);
    return result;
  }

  /**
   * Convert a compact range like "1:1-1:3" into a human-readable string
   * using Surah names, e.g. "Al-Fatihah 1 - Al-Fatihah 3".
   * @param {string} rangeStr
   * @returns {string}
   */
  static formatRangeHuman(rangeStr) {
    const [startPart, endPart] = rangeStr.split('-');
    const [sc, sv] = startPart.split(':').map(Number);
    const [ec, ev] = endPart.split(':').map(Number);
    const startName = this.chapterNamesCache[sc] || `Chapter ${sc}`;
    const endName = this.chapterNamesCache[ec] || `Chapter ${ec}`;
    return `${startName} ${sv} - ${endName} ${ev}`;
  }

  // ── Per-day summaries ─────────────────────────────────────────────────────

  /**
   * Return a summary for each date: { date, seconds, verseCount, ranges }.
   * @returns {Array<{date:string, seconds:number, verseCount:number, ranges:string[]}>}
   */
  dailySummaries() {
    return this.#activities.map((a) => {
      const ranges = ActivityCalculator.compactRanges(a.ranges || []);
      const unique = new Set();
      for (const r of ranges) {
        ActivityCalculator.expandRange(r).forEach((k) => unique.add(k));
      }
      return {
        date: a.date,
        seconds: a.seconds || 0,
        verseCount: unique.size,
        ranges,
      };
    });
  }

  /**
   * Get today's reading seconds.
   * @returns {number}
   */
  todaySeconds() {
    const entry = this.#activities.find((a) => a.date === todayStr());
    return entry ? entry.seconds || 0 : 0;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// StreakCalculator
//
// Computes the current streak (consecutive days with > 0 reading seconds,
// ending today or yesterday) from the raw activities array.
// ──────────────────────────────────────────────────────────────────────────────

export class StreakCalculator {
  /** @type {Map<string, number>} date → seconds */
  #activityMap = new Map();

  /** Fetch raw activities from localUserDB. */
  async load() {
    const activities = (await getUserData(USER_KEYS.ACTIVITIES, false)) || [];
    this.#activityMap = new Map();
    for (const a of activities) {
      this.#activityMap.set(a.date, a.seconds || 0);
    }
    return this;
  }

  /** Allow injecting data directly (useful for testing). */
  loadFromArray(activities) {
    this.#activityMap = new Map();
    for (const a of (activities || [])) {
      this.#activityMap.set(a.date, a.seconds || 0);
    }
    return this;
  }

  /**
   * Calculate the current streak length in days.
   *
   * Logic:
   * - If today has activity (> 0 seconds), start counting from today.
   * - Otherwise, start counting from yesterday (grace period).
   * - Walk backwards day by day; each day with > 0 seconds adds 1 to streak.
   * - Stop at the first day with 0 seconds.
   *
   * @returns {number}
   */
  currentStreak() {
    const now = new Date();
    const today = todayStr();
    const checkDate = new Date(now);

    // Grace: if today has no activity yet, start from yesterday
    if (!this.#activityMap.has(today) || this.#activityMap.get(today) <= 0) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const key = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
      if (this.#activityMap.has(key) && this.#activityMap.get(key) > 0) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }

  /**
   * Find the longest streak in the entire activity history.
   * @returns {number}
   */
  longestStreak() {
    if (this.#activityMap.size === 0) return 0;

    // Get all dates sorted ascending
    const dates = [...this.#activityMap.keys()].sort();
    if (dates.length === 0) return 0;

    let maxStreak = 0;
    let current = 0;
    let prevDate = null;

    for (const dateStr of dates) {
      if (this.#activityMap.get(dateStr) <= 0) {
        current = 0;
        prevDate = null;
        continue;
      }

      if (prevDate === null) {
        current = 1;
      } else {
        // Check if dateStr is exactly 1 day after prevDate
        const prev = new Date(prevDate + 'T00:00:00');
        const curr = new Date(dateStr + 'T00:00:00');
        const diffMs = curr - prev;
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          current++;
        } else {
          current = 1;
        }
      }
      prevDate = dateStr;
      maxStreak = Math.max(maxStreak, current);
    }
    return maxStreak;
  }

  /**
   * Check if today's reading session qualifies as a "streak day"
   * (i.e., the user has read > 0 seconds today).
   * @returns {boolean}
   */
  isTodayActive() {
    const today = todayStr();
    return this.#activityMap.has(today) && this.#activityMap.get(today) > 0;
  }
}
