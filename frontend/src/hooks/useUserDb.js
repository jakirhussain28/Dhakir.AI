import { useCallback, useRef } from 'react';
import { getUserData, setUserData, deleteUserData } from '../utils/userDb';

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
