// import { ChevronLeft, ChevronRight, ArrowUp } from 'lucide-react';
import { FaArrowUp, FaAngleLeft, FaAngleRight } from "react-icons/fa6";


const ChapterNavigation = ({
  selectedChapter,
  onNavigate,
  onScrollToTop,
  theme
}) => {
  /* VISIBILITY LOGIC */
  const isLight = theme === 'light';
  const currentId = selectedChapter?.id;

  // show/hide based on bounds 1-114
  const showPrev = currentId > 1;
  const showNext = currentId < 114;

  /* BASE STYLES */
  const btnBase = `flex items-center justify-center gap-2 px-4 py-3 md:px-5 rounded-xl transition-all duration-200 font-medium border shrink-0 ${isLight
    ? 'bg-white border-stone-200 text-stone-600 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200'
    : 'bg-[#1a1b1d] border-white/5 text-gray-400 hover:bg-emerald-900/20 hover:text-emerald-400 hover:border-emerald-500/20'
    }`;

  return (
    <div className="flex flex-row items-center justify-between gap-2 md:gap-4 py-6 md:py-4 mt-0">

      {/* PREV BUTTON */}
      <div className="flex-1 flex justify-start">
        {showPrev ? (
          <button
            onClick={() => onNavigate(currentId - 1)}
            className={btnBase}
            title="Previous Chapter"
            aria-label="Previous Chapter"
          >
            <FaAngleLeft size={18} aria-hidden="true" />
            <span className="hidden md:inline">Previous Chapter</span>
          </button>
        ) : <div className="w-12 md:w-24" />} {/* spacer */}
      </div>

      {/* SCROLL TOP */}
      <button
        onClick={onScrollToTop}
        className={`flex items-center justify-center gap-2 px-4 py-3 md:px-6 rounded-full shadow-lg transform hover:-translate-y-1 transition-all shrink-0 ${isLight ? 'bg-stone-200 text-stone-700 hover:bg-stone-300' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        title="Scroll to Top"
        aria-label="Scroll to Top"
      >
        <FaArrowUp size={16} aria-hidden="true" />
        <span className="text-sm font-bold hidden md:inline">Top</span>
      </button>

      {/* NEXT BUTTON */}
      <div className="flex-1 flex justify-end">
        {showNext ? (
          <button
            onClick={() => onNavigate(currentId + 1)}
            className={btnBase}
            title="Next Chapter"
            aria-label="Next Chapter"
          >
            <span className="hidden md:inline">Next Chapter</span>
            <FaAngleRight size={18} aria-hidden="true" />
          </button>
        ) : <div className="w-12 md:w-24" />}
      </div>

    </div>
  );
};

export default ChapterNavigation;