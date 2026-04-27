// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAnalytics, logEvent, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);

// Lazily initialised Analytics instance (null until isSupported resolves)
let _analytics = null;

isSupported().then((supported) => {
  if (supported) {
    _analytics = getAnalytics(app);
  }
});

/**
 * Safe wrapper — silently no-ops when Analytics is unavailable
 * (e.g. SSR, ad-blockers, unsupported browsers).
 *
 * @param {string} eventName
 * @param {object} [params]
 */
export function logAnalyticsEvent(eventName, params = {}) {
  if (_analytics) {
    logEvent(_analytics, eventName, params);
  }
}

export { app };