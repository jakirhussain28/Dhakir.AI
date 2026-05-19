import { useState, useEffect, useRef } from 'react';
import { IoMdArrowRoundForward } from "react-icons/io";
import StreakBox from './userComponents/StreakBox';
import BookmarksBox from './userComponents/BookmarksBox';
import ContinueReadingBox from './userComponents/ContinueReadingBox';
import Footer from './Footer';
import AiGuidance from './AiGuidance';

/* ── SHARED CARD BUTTON ────────────────────────────────────────── */
export function ActionCard({ onClick, isLight, ariaLabel, icon, label, subtitle, subtitleArabic, accent = false, hideArrow = false }) {
    return (
        <button
            onClick={onClick}
            aria-label={ariaLabel}
            className={`
        w-full group flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all duration-200
        hover:scale-[1.02] active:scale-[0.98] shadow-sm text-left min-w-0
        ${isLight
                    ? accent
                        ? 'bg-white border-stone-100 hover:border-amber-100 hover:shadow-amber-100 hover:shadow-sm'
                        : 'bg-white border-stone-100 hover:border-emerald-200 hover:shadow-emerald-100 hover:shadow-sm'
                    : accent
                        ? 'bg-[#1a1b1d] border-white/5 hover:border-amber-300/30 hover:shadow-amber-900/20 hover:shadow-sm'
                        : 'bg-[#1a1b1d] border-white/5 hover:border-emerald-500/30 hover:shadow-emerald-900/20 hover:shadow-md'
                }
      `}
        >
            {/* Icon blob */}
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors
        ${isLight
                    ? accent ? 'bg-amber-50 group-hover:bg-amber-100/70' : 'bg-emerald-50 group-hover:bg-emerald-100'
                    : accent ? 'bg-amber-900/20 group-hover:bg-amber-900/30' : 'bg-emerald-900/20 group-hover:bg-emerald-900/30'
                }`}
            >
                {icon}
            </div>

            {/* Labels */}
            <div className="min-w-0 flex-1">
                <p className={`text-[10px] font-medium mb-0.5 uppercase tracking-wide ${isLight ? 'text-stone-400' : 'text-gray-500'}`}>
                    {label}
                </p>
                {subtitle && (
                    <p className={`font-semibold text-sm truncate ${isLight ? 'text-stone-800' : 'text-gray-200'}`}>
                        {subtitle}
                    </p>
                )}
                {subtitleArabic && (
                    <p className={`font-arabic text-base leading-none mt-0.5 ${accent
                        ? (isLight ? 'text-amber-600' : 'text-amber-400')
                        : (isLight ? 'text-emerald-600' : 'text-emerald-500')
                        }`}>
                        {subtitleArabic}
                    </p>
                )}
            </div>

            {/* Trailing arrow */}
            {!hideArrow && (
                <IoMdArrowRoundForward className={`w-3.5 h-3.5 shrink-0 transition-transform group-hover:translate-x-0.5
              ${isLight ? 'text-stone-400' : 'text-gray-600'}`} />
            )}
        </button>
    );
}

/* ── INITIAL SCREEN ────────────────────────────────────────────── */
function InitialScreen({ theme, lastChapter, onContinue, loadingChapters, isLoggedIn, bookmarks, onGoToBookmark, onRemoveBookmark, onGoToVerse, onOpenActivity }) {
    const isLight = theme === 'light';
    const [isFooterVisible, setIsFooterVisible] = useState(false);
    const isFooterVisibleRef = useRef(false);
    const isScrollingRef = useRef(false);
    const scrollEndTimeoutRef = useRef(null);
    const lastScrollY = useRef(0);
    const containerRef = useRef(null);
    const footerTimeoutRef = useRef(null);

    const showFooterTemporarily = () => {
        setIsFooterVisible(true);
        isFooterVisibleRef.current = true;
        if (footerTimeoutRef.current) clearTimeout(footerTimeoutRef.current);
        footerTimeoutRef.current = setTimeout(() => {
            setIsFooterVisible(false);
            isFooterVisibleRef.current = false;
        }, 3000);
    };

    const hideFooter = () => {
        setIsFooterVisible(false);
        isFooterVisibleRef.current = false;
        if (footerTimeoutRef.current) clearTimeout(footerTimeoutRef.current);
    };

    useEffect(() => {
        return () => {
            if (footerTimeoutRef.current) clearTimeout(footerTimeoutRef.current);
            if (scrollEndTimeoutRef.current) clearTimeout(scrollEndTimeoutRef.current);
        };
    }, []);

    const handleScrollEvent = (diff) => {
        if (Math.abs(diff) > 5) {
            if (!isScrollingRef.current) {
                // New scroll action started
                isScrollingRef.current = true;
                // Scrolling in either direction (up or down) hides the footer if it's already visible,
                // or shows it temporarily if it's currently hidden.
                if (isFooterVisibleRef.current) {
                    hideFooter();
                } else {
                    showFooterTemporarily();
                }
            }

            // Detect when scrolling stops
            if (scrollEndTimeoutRef.current) clearTimeout(scrollEndTimeoutRef.current);
            scrollEndTimeoutRef.current = setTimeout(() => {
                isScrollingRef.current = false;
            }, 150);
        }
    };

    const handleScroll = () => {
        if (!containerRef.current) return;
        const currentScrollY = containerRef.current.scrollTop;
        const diff = currentScrollY - lastScrollY.current;
        handleScrollEvent(diff);
        lastScrollY.current = currentScrollY;
    };

    // Trackpad / Mouse Wheel Support
    const handleWheel = (e) => {
        handleScrollEvent(e.deltaY);
    };

    // Touch Support
    const touchStartY = useRef(0);
    const lastTouchY = useRef(0);

    const handleTouchStart = (e) => {
        touchStartY.current = e.touches[0].clientY;
        lastTouchY.current = e.touches[0].clientY;
    };
    const handleTouchMove = (e) => {
        const currentTouchY = e.touches[0].clientY;
        const diff = lastTouchY.current - currentTouchY; // Positive = scrolling down
        handleScrollEvent(diff);
        lastTouchY.current = currentTouchY;
    };

    return (
        <div 
            ref={containerRef}
            onScroll={handleScroll}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            className="h-full w-full overflow-y-auto flex flex-col items-center gap-5 px-4 select-none relative custom-scrollbar"
        >
            {/* Inner wrapper to maintain centering but allow scroll space */}
            <div className="flex-1 flex flex-col items-center justify-center w-full gap-5 min-h-full py-12">
                {/* BOOKMARK BOX */}
                <BookmarksBox bookmarks={bookmarks} isLight={isLight} isLoggedIn={isLoggedIn} onGoToBookmark={onGoToBookmark} onRemoveBookmark={onRemoveBookmark} />

                {/* AI GUIDANCE BOX */}
                <AiGuidance isLight={isLight} onGoToVerse={onGoToVerse} />

                {/* ACTION BUTTONS — side by side */}
                <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm sm:max-w-2xl mb-8">
                    {/* CONTINUE READING */}
                    <ContinueReadingBox
                        lastChapter={lastChapter}
                        isLight={isLight}
                        onContinue={onContinue}
                    />

                    {/* STREAK BOX */}
                    <div className="w-full sm:flex-1 min-w-0 flex">
                        <StreakBox isLight={isLight} onClick={onOpenActivity} />
                    </div>
                </div>
            </div>

            {/* FOOTER */}
            <Footer isVisible={isFooterVisible} />
        </div>
    );
}

export default InitialScreen;
