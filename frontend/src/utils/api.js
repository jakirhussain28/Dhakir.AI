const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const BASE_URL = `${BACKEND_URL}/content/api/v4`;

export const API_CONFIG = {
  translationId: 20,          // Sahih International
  transliterationId: 57,      // English Transliteration
  scriptType: 'text_uthmani', // Options: text_uthmani, text_imlaei, text_indopak
  audioId: 7                  // Mishari Rashid Al-Afasy
};

// HELPER: Clean verse text
const cleanVerseData = (data, scriptType) => {
  if (!data || !data.verses) return data;

  const cleanVerses = data.verses.map(verse => {
    // Fix Arabic Script diacritics
    if (verse[scriptType]) {
      let text = verse[scriptType];
      text = text.replace(/\u0652/g, '\u06e1'); 
      text = text.replace(/\u06df/g, '\u0652'); 
      text = text.replace(/\u0629\u064d\u06ed/g, '\u0629\u06ed\u0650'); // 104:9, 80:14 or same 
      text = text.replace(/\u0651\u064c\u06e2/g, '\u0651\u064f\u06e2'); //2:18 or same
      text = text.replace(/\u0645\u064d\u06ed/g, '\u0645\u0650\u06ed');  //80:16 or same , middle meem changes to end meem, due to calt in font design
      text = text.replace(/\u064c\u06e2/g, '\u064f\u06e2'); //2:19, 2:68, 2:88 or same
      text = text.replace(/\u064d\u06ed/g, '\u06ed\u0650');

      // text = text.replace(/\u06ed/g, '\u202f\u06ed'); // ARABIC SMALL LOW MEEM
      // text = text.replace(/\u06e2/g, '\u202f\u06e2'); // ARABIC SMALL HIGH MEEM ISOLATED FORM

      verse[scriptType] = text;
    }

    // 2. Clean Translations & Transliteration
    if (verse.translations) {
      verse.translations = verse.translations.map(t => {
        let text = t.text;
        text = text.replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, '');
        text = text.replace(/\s+/g, ' ').trim();
        return { ...t, text };
      });
    }

    return verse;
  });

  return { ...data, verses: cleanVerses };
};

// API: Fetch All Chapters
export const fetchChapters = async () => {
  const res = await fetch(`${BASE_URL}/chapters?language=en`);
  if (!res.ok) throw new Error("Failed to fetch chapters");
  return res.json();
};

// API: Fetch Verses
export const fetchVerses = async (chapterId, page) => {
  const { translationId, transliterationId, scriptType, audioId } = API_CONFIG;
  
  // We request BOTH translation and transliteration here (e.g., "20,57")
  const params = new URLSearchParams({
    language: 'en',
    words: 'false',
    translations: `${translationId},${transliterationId}`, 
    audio: audioId,
    fields: scriptType,
    page: page,
    per_page: 10
  });

  const res = await fetch(`${BASE_URL}/verses/by_chapter/${chapterId}?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch verses");
  
  const rawData = await res.json();
  
  return cleanVerseData(rawData, scriptType);
};

/**
 * Generic authenticated User API request through the backend proxy.
 * @param {string} endpoint - path relative to /v1, e.g. "bookmarks" or "users/profile"
 * @param {RequestInit} options - fetch options (method, body, etc.)
 */
export const fetchUserApi = async (endpoint, options = {}) => {
  const token = localStorage.getItem('access_token');
  if (!token) {
    throw new Error("No access token found. User must be logged in.");
  }

  // Strip leading slash so the URL /userapi/<path> is always correct
  const path = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;

  const headers = {
    'x-forwarded-auth': token,  // Backend re-injects this as x-auth-token + x-client-id
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const res = await fetch(`${BACKEND_URL}/userapi/${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`User API request failed (${res.status}): ${errText}`);
  }

  // Handle empty responses
  if (res.status === 204) return null;
  return res.json();
};

// ── User API Helpers ──────────────────────────────────────────────────────────

/** GET /v1/users/profile — get the logged-in user's Quran Foundation profile */
export const fetchUserProfile = () =>
  fetchUserApi('users/profile');

/** PUT /v1/users/profile — update firstName / lastName / bio etc. */
export const updateUserProfile = (payload) =>
  fetchUserApi('users/profile', {
    method: 'PUT',
    body: JSON.stringify({ user: payload }),  // spec wraps payload in { user: {...} }
  });

// ── Collection Bookmarks (Favorites / __default__) ───────────────────────────
/**
 * GET /v1/collections/__default__  — fetch all bookmarks in the Favorites collection.
 * Paginates automatically (cursor-based, max 20 per page) until all items are fetched.
 * Returns an array of bookmark objects: { id, type, key, verseNumber, createdAt, ... }
 */
export const fetchCollectionBookmarks = async () => {
  let allBookmarks = [];
  let cursor = null;
  let hasNext = true;

  while (hasNext) {
    const params = new URLSearchParams({ first: '20', sortBy: 'recentlyAdded' });
    if (cursor) params.set('after', cursor);

    const res = await fetchUserApi(`collections/__default__?${params.toString()}`);

    const bookmarks = res?.data?.bookmarks || res?.data || [];
    if (Array.isArray(bookmarks)) {
      allBookmarks = [...allBookmarks, ...bookmarks];
    }

    const pagination = res?.pagination || {};
    hasNext = pagination.hasNextPage === true;
    cursor = pagination.endCursor || null;

    // Safety: break if no cursor to avoid infinite loop
    if (!cursor) hasNext = false;
  }

  return allBookmarks;
};

/**
 * POST /v1/collections/__default__/bookmarks  — add an ayah bookmark to Favorites.
 * @param {number} chapterNumber - surah number (1-114)
 * @param {number} verseNumber   - verse number within the surah
 */
export const addCollectionBookmark = (chapterNumber, verseNumber) =>
  fetchUserApi('collections/__default__/bookmarks', {
    method: 'POST',
    body: JSON.stringify({
      key: chapterNumber,
      verseNumber,
      type: 'ayah',
      mushafId: 4,
    }),
  });

/**
 * DELETE /v1/collections/__default__/bookmarks/:bookmarkId — remove a bookmark from Favorites by its ID.
 * @param {string} bookmarkId - the API bookmark ID (e.g. "cmp1cux9t0005mp3fb8zo4k67")
 */
export const deleteCollectionBookmark = (bookmarkId) =>
  fetchUserApi(`collections/__default__/bookmarks/${bookmarkId}`, {
    method: 'DELETE',
  });

// ── Streaks ──────────────────────────────────────────────────────────────────

export const fetchCurrentStreakDays = async () => {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const res = await fetchUserApi('streaks/current-streak-days?type=QURAN', {
    headers: { 'x-timezone': timezone },
  });
  // API shape: { success: true, data: { days: N } }
  return res?.data?.days ?? 0;
};

// ── Reading Sessions ─────────────────────────────────────────────────────────

export const fetchReadingSessions = async () => {
  const res = await fetchUserApi('reading-sessions?first=1');
  // API shape: { success: true, data: [{ chapterNumber, verseNumber, updatedAt, ... }] }
  const sessions = res?.data;
  if (Array.isArray(sessions) && sessions.length > 0) {
    return {
      chapterNumber: sessions[0].chapterNumber,
      verseNumber: sessions[0].verseNumber,
      updatedAt: sessions[0].updatedAt ? new Date(sessions[0].updatedAt).getTime() : 0,
    };
  }
  return null;
};

/**
 * POST /v1/reading-sessions — track or update the user's latest reading position.
 * @param {number} chapterNumber — Surah number (1-114)
 * @param {number} verseNumber   — Ayah number within the chapter
 */
export const postReadingSession = (chapterNumber, verseNumber) =>
  fetchUserApi('reading-sessions', {
    method: 'POST',
    body: JSON.stringify({ chapterNumber, verseNumber }),
  });

// ── Activity Days ────────────────────────────────────────────────────────────

/**
 * GET /v1/activity-days — fetch activity days, paginating automatically.
 * @param {string} [from] — YYYY-MM-DD start date (inclusive)
 * @param {string} [to] — YYYY-MM-DD end date (inclusive)
 */
export const fetchActivityDays = async (from, to) => {
  let allActivities = [];
  let cursor = null;
  let hasNext = true;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  while (hasNext) {
    const params = new URLSearchParams({ type: 'QURAN', first: '20' });
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (cursor) params.set('after', cursor);

    const res = await fetchUserApi(`activity-days?${params.toString()}`, {
      headers: { 'x-timezone': timezone },
    });

    // QF API may return { data: [...] } or { data: { activityDays: [...] } }
    const rawData = res?.data;
    let activities = [];
    if (Array.isArray(rawData)) {
      activities = rawData;
    } else if (rawData && Array.isArray(rawData.activityDays)) {
      activities = rawData.activityDays;
    } else if (rawData && typeof rawData === 'object') {
      // Fallback: pick the first array-valued property
      const firstArr = Object.values(rawData).find(v => Array.isArray(v));
      if (firstArr) activities = firstArr;
    }

    console.log('[fetchActivityDays] page response shape:', JSON.stringify(res).slice(0, 400));
    console.log('[fetchActivityDays] extracted activities count:', activities.length);

    allActivities = [...allActivities, ...activities];

    const pagination = res?.pagination || {};
    hasNext = pagination.hasNextPage === true;
    cursor = pagination.endCursor || null;

    if (!cursor) hasNext = false;
  }

  return allActivities;
};

/**
 * POST /v1/activity-days — add or update activity day.
 * @param {Object} payload — activity payload containing date, type, seconds, ranges, mushafId
 */
export const postActivityDay = (payload) => {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return fetchUserApi('activity-days', {
    method: 'POST',
    headers: { 'x-timezone': timezone },
    body: JSON.stringify(payload),
  });
};