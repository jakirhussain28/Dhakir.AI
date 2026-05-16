import React, { useState, useEffect } from 'react';
import { IoBookOutline } from "react-icons/io5";
import { ActionCard } from '../InitialScreen';
import { getUserData, setUserData, USER_KEYS } from '../../utils/userDb';
import { isAuthenticated } from '../../utils/auth';
import { fetchReadingSessions, postReadingSession, fetchChapters } from '../../utils/api';
import { fetchWithCache, DB_STORES } from '../../utils/db';

// ── "Local-First, Sync-Second" debounce config ───────────────────────────────
const LOCAL_DEBOUNCE_MS = 1000; // 1 second local save
const DEBOUNCE_MS = 3000; // 3 seconds API sync

// Module-level state shared across all component instances / calls:
let _pendingLocal = null;
let _localTimerId = null;

let _pendingSync = null;   // { chapterId, verseNumber } queued for next POST
let _syncTimerId = null;   // setTimeout id for the flush
let _isSyncing = false;    // prevent concurrent API requests

export async function getLastReadVerse() {
    return getUserData(USER_KEYS.LAST_READ_VERSE, isAuthenticated());
}

export async function flushPendingSave() {
    if (_localTimerId) {
        clearTimeout(_localTimerId);
        _localTimerId = null;
    }
    if (_syncTimerId) {
        clearTimeout(_syncTimerId);
        _syncTimerId = null;
    }
    
    const loggedIn = isAuthenticated();
    const data = _pendingLocal || _pendingSync;
    
    if (data) {
        if (loggedIn) {
            try {
                await postReadingSession(data.chapterId, data.verseNumber);
                await getLastReadVerse(); // trigger side effects if any
                const timestamp = Date.now();
                await setUserData(USER_KEYS.LAST_READ_VERSE, { ...data, timestamp, isSynced: true }, true);
            } catch {
                const timestamp = Date.now();
                await setUserData(USER_KEYS.LAST_READ_VERSE, { ...data, timestamp, isSynced: false }, true);
            }
        } else {
            const timestamp = Date.now();
            await setUserData(USER_KEYS.LAST_READ_VERSE, { ...data, timestamp }, false);
        }
    }

    _pendingLocal = null;
    _pendingSync = null;
}

export function saveLastReadVerse(chapterId, verseNumber, chapterName) {
    const loggedIn = isAuthenticated();

    const stagedData = { chapterId, verseNumber, chapterName };

    if (_localTimerId) clearTimeout(_localTimerId);
    if (_syncTimerId) clearTimeout(_syncTimerId);

    // 1. Debounce local IndexedDB save (1 second)
    _localTimerId = setTimeout(async () => {
        _localTimerId = null;

        _pendingLocal = stagedData;
        if (loggedIn) {
            _pendingSync = { chapterId: stagedData.chapterId, verseNumber: stagedData.verseNumber };
        }

        const data = _pendingLocal;
        if (!data) return;

        try {
            const existing = await getLastReadVerse();
            const timestamp = Date.now();

            const isChanged = !existing ||
                existing.chapterId !== data.chapterId ||
                existing.verseNumber !== data.verseNumber;

            // Always update IndexedDB (either new position or just refresh timestamp)
            await setUserData(USER_KEYS.LAST_READ_VERSE, { ...data, timestamp, isSynced: false }, loggedIn);

            if (!loggedIn) return;

            // If position hasn't changed, cancel the pending API sync
            if (!isChanged) {
                if (_syncTimerId) {
                    clearTimeout(_syncTimerId);
                    _syncTimerId = null;
                    _pendingSync = null;
                }
            }
        } catch (err) {
            console.error('[ContinueReading] Failed to save local position:', err);
        }
    }, LOCAL_DEBOUNCE_MS);

    // 2. Debounce API sync (3 seconds)
    if (loggedIn) {
        _syncTimerId = setTimeout(() => {
            _flushSync();
        }, DEBOUNCE_MS);
    }
}

/** @private Sends the queued position to the API and resets state. */
async function _flushSync() {
    if (_isSyncing) return; // Prevent concurrent requests

    const data = _pendingSync;
    if (!data) return;

    _syncTimerId = null;
    _pendingSync = null;
    _isSyncing = true;

    try {
        await postReadingSession(data.chapterId, data.verseNumber);
        
        // Mark as synced locally
        const existing = await getLastReadVerse();
        if (existing && existing.chapterId === data.chapterId && existing.verseNumber === data.verseNumber) {
            await setUserData(USER_KEYS.LAST_READ_VERSE, { ...existing, isSynced: true }, true);
        }
    } catch (err) {
        // On failure, re-queue so the next scroll event will retry.
        // Don't spam — the next debounce window will handle it.
        console.warn('[ContinueReading] API sync failed, will retry:', err.message);
        if (!_pendingSync) _pendingSync = data;
    } finally {
        _isSyncing = false;
        // If pendingSync got populated while we were syncing, schedule a flush
        if (_pendingSync && !_syncTimerId) {
             _syncTimerId = setTimeout(_flushSync, DEBOUNCE_MS);
        }
    }
}

function ContinueReadingBox({ lastChapter, isLight, onContinue }) {
    const [lastRead, setLastRead] = useState(null);

    // ── Load data on mount ──────────────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;

        (async () => {
            const loggedIn = isAuthenticated();

            // ① Always start with local data (instant, works offline)
            const localData = await getLastReadVerse();
            if (!cancelled && localData) {
                setLastRead(localData);
            }

            // ② If authenticated, pull the latest reading session from the API
            if (loggedIn) {
                // Push any unsynced local data first
                if (localData && localData.isSynced === false && localData.chapterId && localData.verseNumber) {
                    try {
                        await postReadingSession(localData.chapterId, localData.verseNumber);
                        localData.isSynced = true;
                        await setUserData(USER_KEYS.LAST_READ_VERSE, localData, true);
                    } catch (err) {
                        console.warn('[ContinueReading] Failed to sync pending data on mount:', err.message);
                    }
                }
                try {
                    const remote = await fetchReadingSessions();

                    if (cancelled) return;  // component unmounted / strict-mode cleanup

                    if (remote && remote.chapterNumber && remote.verseNumber) {
                        const localTime = localData?.timestamp || 0;
                        const remoteTime = remote.updatedAt || 0;

                        // Only overwrite if the remote data is strictly newer than the local data
                        if (localTime >= remoteTime && localData) {
                            return; // Keep local as main
                        }

                        const remoteData = {
                            chapterId: remote.chapterNumber,
                            verseNumber: remote.verseNumber,
                            timestamp: remoteTime, // Save the remote timestamp
                        };

                        // Resolve chapter name so we can show "Al-Baqarah 2"
                        // instead of "Surah 2 2" when lastChapter prop is null.
                        try {
                            const data = await fetchWithCache(DB_STORES.CHAPTERS, 'all_chapters', fetchChapters);
                            const chaptersList = data?.chapters || data;
                            const ch = chaptersList?.find(
                                c => c.id === remote.chapterNumber
                            );
                            if (ch) remoteData.chapterName = ch.name_simple;
                        } catch { /* non-critical — fallback to "Surah N" */ }

                        // Write remote data back to IndexedDB so future reads
                        // (e.g. App.jsx handleContinueReading) stay in sync.
                        await setUserData(
                            USER_KEYS.LAST_READ_VERSE,
                            remoteData,
                            true // authenticated DB
                        );

                        if (!cancelled) setLastRead(remoteData);
                    }
                } catch (err) {
                    // Silently fall back to local data — it's already displayed
                    console.warn('[ContinueReading] Remote fetch failed:', err.message);
                }
            }
        })();

        return () => { cancelled = true; };
    }, []);

    // If no chapter has ever been selected AND no saved verse exists, hide the box
    if (!lastChapter && !lastRead) return null;

    // Build display text — prefer prop name, then stored name, then fallback
    const chapterName = lastChapter?.name_simple
        || lastRead?.chapterName
        || `Surah ${lastRead?.chapterId}`;
    const verseLabel = lastRead
        ? `${chapterName} ${lastRead.verseNumber}`
        : chapterName;

    return (
        <div className="w-full sm:w-1/3 min-w-0 flex">
            <ActionCard
                onClick={onContinue}
                isLight={isLight}
                ariaLabel={lastRead
                    ? `Continue reading ${chapterName}, Verse ${lastRead.verseNumber}`
                    : `Continue reading ${chapterName}`
                }
                icon={<IoBookOutline />}
                label="Continue Reading"
                subtitle={verseLabel}
                accent={false}
            />
        </div>
    );
}

export default ContinueReadingBox;
