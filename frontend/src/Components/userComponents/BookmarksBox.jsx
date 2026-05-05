import React from 'react';
import { BsBookmark } from "react-icons/bs";
import { ActionCard } from '../InitialScreen';

function BookmarksBox({ bookmark, isLight, onGoToBookmark }) {
    if (!bookmark) return null;

    return (
        <div className="w-full max-w-sm sm:max-w-2xl">
            <ActionCard
                onClick={onGoToBookmark}
                isLight={isLight}
                ariaLabel={`Bookmark: ${bookmark.verseKey}`}
                icon={<BsBookmark />}
                // label="Bookmarks"
                subtitle={bookmark.chapter?.name_simple}
                accent={true}
                hideArrow={true}
            />
        </div>
    );
}

export default BookmarksBox;
