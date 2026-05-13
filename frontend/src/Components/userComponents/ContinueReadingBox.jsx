import React, { useState, useEffect } from 'react';
import { IoBookOutline } from "react-icons/io5";
import { ActionCard } from '../InitialScreen';
import { getUserData, setUserData, USER_KEYS } from '../../utils/userDb';
import { isAuthenticated } from '../../utils/auth';
import { fetchReadingSessions, postReadingSession, fetchChapters } from '../../utils/api';

// ── "Local-First, Sync-Second" debounce config ───────────────────────────────
const SYNC_INTERVAL_MS = 30_000; // 30 seconds

// Module-level state shared across all component instances / calls:
let _pendingSync = null;   // { chapterId, verseNumber } queued for next POST
let _syncTimerId = null;   // setTimeout id for the flush
let _lastSyncTime = 0;      // Date.now() of last successful POST

export async function getLastReadVerse() {
    return getUserData(USER_KEYS.LAST_READ_VERSE, isAuthenticated());
}


export function saveLastReadVerse(chapterId, verseNumber) {
    // Always write to local IndexedDB first (never blocks, never throws)
    const loggedIn = isAuthenticated();
    setUserData(USER_KEYS.LAST_READ_VERSE, { chapterId, verseNumber }, loggedIn);

    // If NOT authenticated, we're done — local storage is the source of truth
    if (!loggedIn) return;

    // Queue this position for the next API sync
    _pendingSync = { chapterId, verseNumber };

    // If a flush is already scheduled, don't schedule another — the existing
    // timer will pick up the latest _pendingSync value when it fires.
    if (_syncTimerId) return;

    const elapsed = Date.now() - _lastSyncTime;

    if (elapsed >= SYNC_INTERVAL_MS) {
        // Enough time has passed — flush immediately
        _flushSync();
    } else {
        // Schedule a flush for the remainder of the interval
        _syncTimerId = setTimeout(_flushSync, SYNC_INTERVAL_MS - elapsed);
    }
}

/** @private Sends the queued position to the API and resets state. */
async function _flushSync() {
    _syncTimerId = null;

    const data = _pendingSync;
    if (!data) return;
    _pendingSync = null;

    try {
        await postReadingSession(data.chapterId, data.verseNumber);
        _lastSyncTime = Date.now();
    } catch (err) {
        // On failure, re-queue so the next scroll event will retry.
        // Don't spam — the next debounce window will handle it.
        console.warn('[ContinueReading] API sync failed, will retry:', err.message);
        if (!_pendingSync) _pendingSync = data;
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
                try {
                    const remote = await fetchReadingSessions();

                    if (cancelled) return;  // component unmounted / strict-mode cleanup

                    if (remote && remote.chapterNumber && remote.verseNumber) {
                        const remoteData = {
                            chapterId: remote.chapterNumber,
                            verseNumber: remote.verseNumber,
                        };

                        // Resolve chapter name so we can show "Al-Baqarah 2"
                        // instead of "Surah 2 2" when lastChapter prop is null.
                        try {
                            const chaptersRes = await fetchChapters();
                            const ch = chaptersRes?.chapters?.find(
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
