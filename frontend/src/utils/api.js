// src/utils/api.js
//
// All Quran Foundation API calls go through the backend proxy so that:
//   - Content API: backend injects x-auth-token (client-credentials) + x-client-id
//   - User API:    backend injects x-auth-token (user JWT) + x-client-id
// This avoids CORS issues and keeps credentials out of the browser.
//
// Pre-live OpenAPI spec:
//   https://api-docs.quran.foundation/openAPI/user-related-apis/pre-live/v1.json

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

// ── User API (authenticated) ──────────────────────────────────────────────────
// All calls route through the backend /userapi proxy.
// The backend reads x-forwarded-auth and injects x-auth-token + x-client-id
// per the Quran Foundation User API spec before forwarding to:
//   Pre-live:   https://apis-prelive.quran.foundation/auth/v1/...
//   Production: https://apis.quran.foundation/auth/v1/...

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
// Thin wrappers around fetchUserApi for common pre-live endpoints.
// Paths match the pre-live OpenAPI spec exactly (without the /v1 prefix,
// which the backend proxy prepends automatically).

/** GET /v1/users/profile — get the logged-in user's Quran Foundation profile */
export const fetchUserProfile = () =>
  fetchUserApi('users/profile');

/** PATCH /v1/users/profile — update firstName / lastName / bio etc. */
export const updateUserProfile = (payload) =>
  fetchUserApi('users/profile', {
    method: 'PATCH',
    body: JSON.stringify({ user: payload }),  // spec wraps payload in { user: {...} }
  });