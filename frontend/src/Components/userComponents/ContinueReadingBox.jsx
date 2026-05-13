import React from 'react';
import { IoBookOutline } from "react-icons/io5";
import { ActionCard } from '../InitialScreen';

function ContinueReadingBox({ lastChapter, isLight, onContinue }) {
    if (!lastChapter) return null;

    return (
        <div className="w-full sm:w-1/3 min-w-0 flex">
            <ActionCard
                onClick={onContinue}
                isLight={isLight}
                ariaLabel={`Continue reading Surah ${lastChapter.name_simple}`}
                icon={<IoBookOutline />}
                label="Continue Reading"
                subtitle={lastChapter.name_simple}
                accent={false}
            />
        </div>
    );
}

export default ContinueReadingBox;
