import React, { useState, useEffect } from 'react';
import { IoBookOutline } from "react-icons/io5";
import { ActionCard } from '../InitialScreen';

const LAST_READ_KEY = 'app-lastReadVerse';

/**
 * Reads the persisted last-read verse from localStorage.
 * Shape: { chapterId: number, verseNumber: number }
 */
export function getLastReadVerse() {
    try {
        const raw = localStorage.getItem(LAST_READ_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

/**
 * Persists the current reading position (chapter + verse).
 */
export function saveLastReadVerse(chapterId, verseNumber) {
    localStorage.setItem(LAST_READ_KEY, JSON.stringify({ chapterId, verseNumber }));
}

function ContinueReadingBox({ lastChapter, isLight, onContinue }) {
    const [lastRead, setLastRead] = useState(getLastReadVerse);

    // Re-read from localStorage whenever we become visible (user returns to home)
    useEffect(() => {
        setLastRead(getLastReadVerse());
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
