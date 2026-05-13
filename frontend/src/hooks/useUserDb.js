// src/hooks/useUserDb.js
//
// React hook that gives components reactive access to the active user DB
// (localUserDB when not authenticated, qfUserDB when logged in).
//
// Usage:
//   const { get, set, del, loading } = useUserDb(isLoggedIn);
//   const bookmarks = await get(USER_KEYS.BOOKMARKS);
//   await set(USER_KEYS.BOOKMARKS, updatedList);

import { useCallback, useRef } from 'react';
import { getUserData, setUserData, deleteUserData } from '../utils/userDb';

/**
 * Thin convenience hook — binds the isLoggedIn flag so callers don't need
 * to pass it on every call.
 *
 * @param {boolean} isLoggedIn — pass the current auth state
 */
export function useUserDb(isLoggedIn) {
  // Keep a stable reference to the latest isLoggedIn value
  const authRef = useRef(isLoggedIn);
  authRef.current = isLoggedIn;

  const get = useCallback(
    (key) => getUserData(key, authRef.current),
    []
  );

  const set = useCallback(
    (key, value) => setUserData(key, value, authRef.current),
    []
  );

  const del = useCallback(
    (key) => deleteUserData(key, authRef.current),
    []
  );

  return { get, set, del };
}
