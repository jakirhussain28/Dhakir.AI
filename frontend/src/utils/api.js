// src/utils/api.js

const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const BASE_URL = `${BACKEND_URL}/content/api/v4`;

export const API_CONFIG = {
  translationId: 20,          // Sahih International
  transliterationId: 57,      // English Transliteration (Added this)
  scriptType: 'text_uthmani', // Options: text_uthmani, text_imlaei, text_indopak
  audioId: 7                  // Mishari Rashid Al-Afasy
};

// HELPER: Clean text
const cleanVerseData = (data, scriptType) => {
  if (!data || !data.verses) return data;

  const cleanVerses = data.verses.map(verse => {
    // 1. Fix Arabic Script
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

// API: User APIs (Requires Authentication)
export const fetchUserApi = async (endpoint, options = {}) => {
  const token = localStorage.getItem('access_token');
  if (!token) {
    throw new Error("No access token found. User must be logged in.");
  }

  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`,
    'Content-Type': options.body instanceof FormData ? undefined : 'application/json'
  };

  // Remove Content-Type if it's undefined (fetch sets it automatically for FormData)
  if (headers['Content-Type'] === undefined) {
    delete headers['Content-Type'];
  }

  const res = await fetch(`https://prelive-api.quran.foundation${endpoint}`, {
    ...options,
    headers
  });

  if (!res.ok) {
    throw new Error(`API request failed with status: ${res.status}`);
  }

  // Handle empty responses
  if (res.status === 204) return null;
  return res.json();
};