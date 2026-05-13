import React, { useState, useEffect } from 'react';
import { IoBookOutline } from "react-icons/io5";
import { ActionCard } from '../InitialScreen';
import { getUserData, setUserData, USER_KEYS } from '../../utils/userDb';
import { isAuthenticated } from '../../utils/auth';

/**
 * Reads the persisted last-read verse from the active user DB.
 * Shape: { chapterId: number, verseNumber: number }
 *
 * This is an async wrapper — callers that need sync access (like App.jsx)
 * should use getUserData directly.
 */
export async function getLastReadVerse() {
    return getUserData(USER_KEYS.LAST_READ_VERSE, isAuthenticated());
}

/**
 * Persists the current reading position (chapter + verse) to the active user DB.
 */
export function saveLastReadVerse(chapterId, verseNumber) {
    setUserData(USER_KEYS.LAST_READ_VERSE, { chapterId, verseNumber }, isAuthenticated());
}

function ContinueReadingBox({ lastChapter, isLight, onContinue }) {
    const [lastRead, setLastRead] = useState(null);

    // Load from IndexedDB whenever we become visible (user returns to home)
    useEffect(() => {
        let cancelled = false;
        getLastReadVerse().then(data => {
            if (!cancelled) setLastRead(data);
        });
        return () => { cancelled = true; };
    }, []);

    // If no chapter has ever been selected AND no saved verse exists, hide the box
    if (!lastChapter && !lastRead) return null;

    // Build display text
    const chapterName = lastChapter?.name_simple || `Surah ${lastRead?.chapterId}`;
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
