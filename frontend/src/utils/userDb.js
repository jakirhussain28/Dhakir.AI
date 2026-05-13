// src/utils/userDb.js
//
// Isolated IndexedDB storage for local vs. authenticated (QF) user data.
//
// Two completely separate IndexedDB databases:
//   1. localUserDB  — used when the app runs locally (no login)
//   2. qfUserDB     — used when the user is logged in via Quran Foundation OAuth
//
// Each database stores the same object stores:
//   • userData  — key-value pairs for bookmarks, last read, streaks, history, etc.
//
// The active database is selected at runtime based on isAuthenticated().
// Switching auth state automatically switches which DB is read/written,
// so local data never leaks into the authenticated session and vice-versa.

const LOCAL_DB_NAME = 'localUserDB';
const QF_DB_NAME    = 'qfUserDB';
const DB_VERSION    = 1;

const STORE_NAME = 'userData';

// ── Keys used in the userData store ────────────────────────────────────────
export const USER_KEYS = {
  BOOKMARKS:       'bookmarks',         // Array of local bookmark objects
  LAST_CHAPTER:    'lastChapter',       // The last chapter object selected
  LAST_PAGE:       'lastPage',          // { chapterId, page }
  LAST_READ_VERSE: 'lastReadVerse',     // { chapterId, verseNumber }
  STREAK_DAYS:     'streakDays',        // number
  AI_HISTORY:      'aiGuidanceHistory', // Array of guidance history entries
  PROFILE:         'profile',           // User profile data
};

// ── Internal: open a named IndexedDB ──────────────────────────────────────
const openNamedDB = (dbName) => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, DB_VERSION);

    request.onerror = (event) =>
      reject(`IndexedDB error (${dbName}): ${event.target.error}`);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
  });
};

// ── Public: open the correct DB based on auth state ───────────────────────
// Accepts a boolean so callers can pass the result of isAuthenticated().
const openUserDB = (isLoggedIn) => {
  const dbName = isLoggedIn ? QF_DB_NAME : LOCAL_DB_NAME;
  return openNamedDB(dbName);
};

// ── CRUD helpers ──────────────────────────────────────────────────────────

/**
 * Read a value from the active user DB.
 * @param {string} key    — one of USER_KEYS.*
 * @param {boolean} isLoggedIn — pass isAuthenticated()
 * @returns {Promise<any|null>}
 */
export const getUserData = async (key, isLoggedIn) => {
  try {
    const db = await openUserDB(isLoggedIn);
    return new Promise((resolve, reject) => {
      const tx    = db.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req   = store.get(key);
      req.onsuccess = () => resolve(req.result?.value ?? null);
      req.onerror   = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`[userDb] getUserData(${key}) failed:`, err);
    return null;
  }
};

/**
 * Write a value to the active user DB.
 * @param {string} key    — one of USER_KEYS.*
 * @param {any}    value  — the data to persist
 * @param {boolean} isLoggedIn — pass isAuthenticated()
 * @returns {Promise<boolean>}
 */
export const setUserData = async (key, value, isLoggedIn) => {
  try {
    const db = await openUserDB(isLoggedIn);
    return new Promise((resolve, reject) => {
      const tx    = db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req   = store.put({ key, value });
      req.onsuccess = () => resolve(true);
      req.onerror   = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`[userDb] setUserData(${key}) failed:`, err);
    return false;
  }
};

/**
 * Delete a value from the active user DB.
 * @param {string} key    — one of USER_KEYS.*
 * @param {boolean} isLoggedIn
 * @returns {Promise<boolean>}
 */
export const deleteUserData = async (key, isLoggedIn) => {
  try {
    const db = await openUserDB(isLoggedIn);
    return new Promise((resolve, reject) => {
      const tx    = db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req   = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror   = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`[userDb] deleteUserData(${key}) failed:`, err);
    return false;
  }
};

// ── One-time migration helper ─────────────────────────────────────────────
// Migrates legacy localStorage keys into localUserDB so existing local users
// don't lose their data.  Runs once — sets a flag so it never repeats.

const MIGRATION_FLAG = 'userDb_migrated_v1';

export const migrateFromLocalStorage = async () => {
  if (localStorage.getItem(MIGRATION_FLAG)) return; // already done

  const isLoggedIn = false; // migration always targets localUserDB

  try {
    // Bookmarks
    const bookmarksRaw = localStorage.getItem('app-bookmarks');
    if (bookmarksRaw) {
      const bookmarks = JSON.parse(bookmarksRaw);
      if (Array.isArray(bookmarks) && bookmarks.length > 0) {
        await setUserData(USER_KEYS.BOOKMARKS, bookmarks, isLoggedIn);
      }
    }

    // Last chapter
    const lastChapterRaw = localStorage.getItem('app-lastChapter');
    if (lastChapterRaw) {
      await setUserData(USER_KEYS.LAST_CHAPTER, JSON.parse(lastChapterRaw), isLoggedIn);
    }

    // Last page
    const lastPageRaw = localStorage.getItem('app-lastPage');
    if (lastPageRaw) {
      await setUserData(USER_KEYS.LAST_PAGE, JSON.parse(lastPageRaw), isLoggedIn);
    }

    // Last read verse
    const lastReadRaw = localStorage.getItem('app-lastReadVerse');
    if (lastReadRaw) {
      await setUserData(USER_KEYS.LAST_READ_VERSE, JSON.parse(lastReadRaw), isLoggedIn);
    }

    // Local streak days
    const streakRaw = localStorage.getItem('local_streak_days');
    if (streakRaw) {
      await setUserData(USER_KEYS.STREAK_DAYS, parseInt(streakRaw, 10), isLoggedIn);
    }

    // AI guidance history
    const historyRaw = localStorage.getItem('ai_guidance_history');
    if (historyRaw) {
      const history = JSON.parse(historyRaw);
      if (Array.isArray(history) && history.length > 0) {
        await setUserData(USER_KEYS.AI_HISTORY, history, isLoggedIn);
      }
    }

    // Mark done — but don't delete old keys yet (safe rollback window)
    localStorage.setItem(MIGRATION_FLAG, '1');
    console.log('[userDb] Legacy localStorage data migrated to localUserDB.');
  } catch (err) {
    console.error('[userDb] Migration failed:', err);
  }
};
