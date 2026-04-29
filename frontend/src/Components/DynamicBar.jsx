import { useState, useEffect, useRef } from 'react';
import ChapterDropdown from './ChapterDropdown';
import VerseDropdown from './VerseDropdown';
import { HiOutlineInformationCircle } from "react-icons/hi2";
import { LuSettings } from "react-icons/lu";

function DynamicBar({ chapters, selectedChapter, onSelect, onVerseJump, isMobileMenuOpen, onInfoClick, onSettingsClick }) {
  const [isChapterView, setIsChapterView] = useState(false);
  const [isVerseView, setIsVerseView] = useState(false);

  const barRef = useRef(null);
  const isExpanded = isChapterView || isVerseView;

  useEffect(() => {
    function handleClickOutside(event) {
      if (isExpanded && barRef.current && !barRef.current.contains(event.target)) {
        setIsChapterView(false);
        setIsVerseView(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isExpanded]);

  const handleMouseEnter = () => {
    if (window.innerWidth >= 1024 && !isVerseView) setIsChapterView(true);
  };

  const handleMouseLeave = () => {
    if (window.innerWidth >= 1024) {
      setIsChapterView(false);
      setIsVerseView(false);
    }
  };

  const toggleChapterView = (e) => {
    if (e.target.closest('.verse-trigger') || e.target.closest('.mobile-nav-btn')) return;
    if (isVerseView) {
      setIsVerseView(false);
      setIsChapterView(true);
    } else {
      setIsChapterView(!isChapterView);
    }
  };

  const toggleVerseView = (e) => {
    e.stopPropagation();
    if (isChapterView) {
      setIsChapterView(false);
      setIsVerseView(true);
    } else {
      setIsVerseView(!isVerseView);
    }
  };

  const handleSelectInternal = (chapter) => {
    onSelect(chapter);
    setIsChapterView(false);
  };

  const handleVerseSelect = (verseNum) => {
    onVerseJump(verseNum);
    setIsVerseView(false);
  };

  return (
    <div
      ref={barRef}
      className="relative z-50 flex flex-col items-center justify-center h-10 md:h-11 w-full"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={(e) => {
        if (window.innerWidth < 1024 && !isMobileMenuOpen) toggleChapterView(e);
      }}
    >
      <div className={`
        absolute top-0 left-1/2 -translate-x-1/2
        bg-[#1a1b1d] border shadow-2xl transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1.0)]
        
        ${isExpanded
          ? 'w-[96vw] md:w-[500px] border-white/10 rounded-3xl max-h-[65vh] overflow-hidden flex flex-col'
          : 'w-full md:w-[500px] border-white/10 hover:border-white/20 rounded-[20px] md:rounded-[22px] max-h-11 md:max-h-11 overflow-visible'
        }
      `}>

        {/* HEADER BAR */}
        <div className="h-10 md:h-10.5 w-full cursor-pointer shrink-0 relative z-20 bg-[#1a1b1d] rounded-[20px]">

          {/* DEFAULT VIEW (CHAPTER INFO) */}
          <div className={`
            absolute md:relative inset-0 md:inset-auto h-full w-full
            flex items-center gap-2 md:justify-between min-w-0 px-3
            transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
            ${isMobileMenuOpen
              ? 'opacity-0 scale-95 pointer-events-none md:opacity-100 md:scale-100 md:pointer-events-auto'
              : 'opacity-100 scale-100 pointer-events-auto'}
          `}>
            {selectedChapter ? (
              <>
                {/* ENGLISH NAME */}
                <span className={`
                  text-gray-200 font-medium text-sm md:text-base z-10 truncate transition-all duration-300
                  flex-1 text-left md:flex-none
                  ${isExpanded ? 'md:max-w-[35%]' : 'md:max-w-[40%]'} 
                `}>
                  {selectedChapter.name_simple}
                </span>

                {/* ARABIC NAME */}
                <span className={`
                   font-arabic text-xl text-emerald-500 pb-1 leading-none select-none pointer-events-none
                   shrink-0 block mt-1 md:mt-0
                   md:absolute md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:text-xl
                `}>
                  {selectedChapter.name_arabic}
                </span>

                {/* VERSE TRIGGER */}
                <div className="relative z-50">
                  <button
                    onClick={toggleVerseView}
                    className={`
                      verse-trigger flex items-center justify-center bg-[#2A2B2D] text-gray-400 rounded-full border 
                      h-7 min-w-7 px-1.5 ml-1 shrink-0 md:h-7 md:min-w-7 md:px-3 md:ml-0 transition-colors
                      ${isVerseView ? 'border-emerald-500/50 text-emerald-400 bg-emerald-900/20' : 'border-white/5 hover:bg-[#323335]'}
                    `}
                  >
                    <span className="text-[10px] font-mono md:hidden">
                      {selectedChapter.verses_count}
                    </span>
                    <span className="text-[11px] font-medium hidden md:inline">
                      {selectedChapter.verses_count} Verses
                    </span>
                  </button>
                </div>
              </>
            ) : (
              <span className="text-gray-400 text-sm flex-1 text-center">Select a Chapter</span>
            )}
          </div>

          {/* MOBILE MENU VIEW (HOME & SETTINGS) */}
          <div className={`
            absolute inset-0 h-full w-full px-3 md:hidden
            flex items-center justify-evenly 
            transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
            ${isMobileMenuOpen
              ? 'opacity-100 scale-100 pointer-events-auto'
              : 'opacity-0 scale-105 pointer-events-none'}
          `}>
            <button
              onClick={(e) => { e.stopPropagation(); onInfoClick?.(); }}
              className="mobile-nav-btn flex items-center justify-center gap-2 text-gray-300 hover:text-white transition-colors w-full h-full"
              aria-label="Info"
            >
              <HiOutlineInformationCircle size={22} />
              <span className="text-sm font-medium">Info</span>
            </button>

            <div className="w-[1px] h-5 bg-white/10 shrink-0"></div>

            <button
              onClick={(e) => { e.stopPropagation(); onSettingsClick?.(); }}
              className="mobile-nav-btn flex items-center justify-center gap-2 text-gray-300 hover:text-white transition-colors w-full h-full"
              aria-label="Settings"
            >
              <LuSettings size={18} />
              <span className="text-sm font-medium">Settings</span>
            </button>
          </div>

        </div>

        {/* DROPDOWN CONTENT */}
        <div className={`
          flex-1 overflow-y-auto custom-scrollbar bg-[#1a1b1d]
          border-t border-gray-800/50
          transition-opacity duration-300 delay-75
          ${isExpanded && !isMobileMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible h-0'}
        `}>

          {isChapterView && (
            <ChapterDropdown
              chapters={chapters}
              selectedChapter={selectedChapter}
              onSelect={handleSelectInternal}
            />
          )}

          {isVerseView && selectedChapter && (
            <VerseDropdown
              totalVerses={selectedChapter.verses_count}
              onSelectVerse={handleVerseSelect}
            />
          )}

        </div>
      </div>
    </div>
  );
}

export default DynamicBar;