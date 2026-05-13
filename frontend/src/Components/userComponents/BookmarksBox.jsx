import { useState, useRef, useEffect } from 'react';
import { BsBookmark } from "react-icons/bs";
import { IoCloseCircleOutline } from "react-icons/io5";

function BookmarkPill({ bookmark, isLight, onGoToBookmark, onRemoveBookmark }) {
    const [isHoveringVerse, setIsHoveringVerse] = useState(false);

    const pillBg = isLight
        ? 'bg-white border-amber-200/70 hover:border-amber-300/80 shadow-sm hover:shadow'
        : 'bg-[#1a1b1d] border-amber-700/30 hover:border-amber-600/50 shadow-md';

    const textColor = isLight ? 'text-stone-700' : 'text-gray-200';
    const verseColor = isLight ? 'text-stone-400' : 'text-gray-500';

    return (
        <div
            className={`relative z-10 flex flex-col sm:flex-row items-center justify-center gap-0 sm:gap-3 px-4 py-1.5 sm:px-3.5 sm:py-1.5 rounded-2xl sm:rounded-full border cursor-pointer shrink-0 transition-all duration-200 hover:scale-[1.08] hover:z-50 ${pillBg}`}
            onClick={() => onGoToBookmark(bookmark)}
        >
            <span className={`text-sm font-semibold ${textColor}`}>
                {bookmark.chapter?.name_simple}
            </span>
            <div
                className="flex items-center justify-center min-w-[32px] h-4 sm:h-5 mt-0.5 sm:mt-0"
                onPointerEnter={(e) => {
                    if (e.pointerType === 'mouse') setIsHoveringVerse(true);
                }}
                onPointerLeave={(e) => {
                    if (e.pointerType === 'mouse') setIsHoveringVerse(false);
                }}
                onClick={(e) => {
                    if (isHoveringVerse) {
                        e.stopPropagation();
                        onRemoveBookmark(bookmark.verseKey);
                    }
                }}
                title={isHoveringVerse ? "Remove Bookmark" : undefined}
            >
                {isHoveringVerse ? (
                    <IoCloseCircleOutline className={`w-6 h-6 transition-colors ${isLight ? 'text-stone-400' : 'text-gray-200'}`} />
                ) : (
                    <span className={`text-[13px] font-mono font-medium ${verseColor}`}>
                        {bookmark.verseKey}
                    </span>
                )}
            </div>
        </div>
    );
}

function BookmarksBox({ bookmarks, isLight, isLoggedIn, onGoToBookmark, onRemoveBookmark }) {
    const [isHovered, setIsHovered] = useState(false);
    const boxRef = useRef(null);
    const scrollContainerRef = useRef(null);

    useEffect(() => {
        const boxEl = boxRef.current;
        const scrollEl = scrollContainerRef.current;
        if (!boxEl || !scrollEl) return;

        const handleWheel = (e) => {
            if (e.deltaY === 0) return;
            
            // Prevent page from scrolling vertically
            e.preventDefault();
            
            // Scroll horizontally instead
            scrollEl.scrollLeft += e.deltaY;
        };

        // passive: false is necessary to call preventDefault
        boxEl.addEventListener('wheel', handleWheel, { passive: false });
        
        return () => {
            boxEl.removeEventListener('wheel', handleWheel);
        };
    }, [bookmarks]);

    if (!bookmarks || bookmarks.length === 0) return null;

    const containerBg = isLight
        ? 'bg-white border-stone-100 shadow-sm'
        : 'bg-[#1a1b1d] border-white/5 shadow-md';

    const iconBg = isLight ? 'bg-amber-50' : 'bg-amber-900/20';

    return (
        <div
            ref={boxRef}
            className={`w-full max-w-sm sm:max-w-2xl flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all duration-300 ${containerBg}`}
        >
            {/* Icon blob / Collection Label */}
            <div
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className={`flex items-center h-9 rounded-xl transition-all duration-500 ease-in-out ${iconBg} ${isLoggedIn && isHovered ? 'pr-3.5 max-w-[200px]' : 'max-w-[36px] w-9'}`}
            >
                <div className="w-9 h-9 flex items-center justify-center shrink-0">
                    <BsBookmark className={isLight ? 'text-stone-600' : 'text-white-400'} size={18} />
                </div>
                <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isLoggedIn && isHovered ? 'max-w-[120px] opacity-100' : 'max-w-0 opacity-0'}`}>
                    <div className="flex flex-col justify-center -space-y-0.5">
                        <span className={`text-[9px] font-bold uppercase tracking-wider ${isLight ? 'text-stone-500' : 'text-gray-400'}`}>
                            Collection
                        </span>
                        <span className={`text-[9px] font-black uppercase tracking-widest ${isLight ? 'text-stone-700' : 'text-gray-200'}`}>
                            Favorites
                        </span>
                    </div>
                </div>
            </div>

            {/* Bookmarks list */}
            <div 
                ref={scrollContainerRef}
                className="flex-1 flex items-center gap-2.5 overflow-x-auto no-scrollbar py-1.5 -my-1.5 px-1.5"
            >
                {[...bookmarks].reverse().map((bookmark) => (
                    <BookmarkPill
                        key={bookmark.verseKey}
                        bookmark={bookmark}
                        isLight={isLight}
                        onGoToBookmark={onGoToBookmark}
                        onRemoveBookmark={onRemoveBookmark}
                    />
                ))}
            </div>
        </div>
    );
}

export default BookmarksBox;
