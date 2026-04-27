import { useEffect, useRef } from 'react';

function ChapterDropdown({ chapters, selectedChapter, onSelect }) {
  const selectedRef = useRef(null);

  // AUTO SCROLL 
  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({
        behavior: 'auto', //  'auto', 'smooth' 
        block: 'start',  //  'start', 'center', 'end', 'nearest'
      });
    }
  }, []);

  return (
    <ul className="p-2 space-y-1">
      {/* RENDER LIST */}
      {chapters.map((chapter) => {
        const isSelected = selectedChapter?.id === chapter.id;
        
        return (
          <li 
            key={chapter.id}
            ref={isSelected ? selectedRef : null} // attach ref if active
          >
            {/* CHAPTER BUTTON */}
            <button
              onClick={(e) => {
                e.stopPropagation(); 
                onSelect(chapter);
              }}
              className={`
                w-full flex items-center justify-between p-1 py-2 rounded-xl transition-all duration-200 group text-left 
                ${isSelected 
                  ? 'bg-emerald-900/20 text-emerald-400' 
                  : 'hover:bg-[rgb(37,38,40)] text-gray-300'
                }
              `}
            >
              {/* LEFT: number and names */}
              <div className="flex items-center gap-4 min-w-0">
                {/* badge */}
                <span className={`
                  text-[10px] font-mono w-7 h-8 flex items-center justify-center rounded-full shrink-0
                  ${isSelected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-500'}
                `}>
                  {chapter.id}
                </span>
                
                {/* names */}
                <div className="flex flex-col items-start">
                  <span className={`text-sm font-medium truncate ${isSelected ? 'text-emerald-400' : 'text-gray-200'}`}>
                    {chapter.name_simple}
                  </span>
                  <span className={`font-arabic text-md mt-0.5 ${isSelected ? 'text-emerald-500/80' : 'text-gray-500 group-hover:text-gray-400'}`}>
                    {chapter.name_arabic}
                  </span>
                </div>
              </div>

              {/* CENTER: TRANSLATION (DESKTOP) */}
              <div className="hidden md:block flex-1 text-center px-4">
                <span className={`text-sm font-medium ${isSelected ? 'text-emerald-400' : 'text-gray-200'}`}>
                  {chapter.translated_name.name}
                </span>
              </div>

              {/* RIGHT: MOBILE INFO & VERSES */}
              <div className="flex flex-col items-end ml-2 shrink-0">
                
                {/* mobile translation */}
                <span className={`md:hidden text-sm font-medium mb-1 ${isSelected ? 'text-emerald-400' : 'text-gray-200'}`}>
                   {chapter.translated_name.name}
                </span>

                {/* verse count */}
                <span className={`
                  text-[10px] font-mono px-2 py-1 rounded-3xl
                  ${isSelected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-gray-500'}
                `}>
                  {chapter.verses_count} Verses
                </span>
              </div>

            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default ChapterDropdown;