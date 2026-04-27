import { useEffect, useState } from 'react';
import { IoClose, IoBookOutline } from "react-icons/io5";
import { FaMapMarkerAlt } from "react-icons/fa";
import SkeletonLoader from './SkeletonLoader';

function SurahInfoModal({
  isOpen,
  onClose,
  chapter,
  theme
}) {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const QURAN_API = 'https://api.quran.com/api/v4';

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      fetchInfo();
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen, chapter]);

  const fetchInfo = async () => {
    if (!chapter) return;
    setLoading(true);
    try {
      const res = await fetch(`${QURAN_API}/chapters/${chapter.id}/info?language=en`);
      const data = await res.json();
      if (data.chapter_info) {
        setInfo(data.chapter_info);
      }
    } catch (error) {
      console.error("Failed to load chapter info", error);
    } finally {
      setLoading(false);
    }
  };

  const formatHTML = (htmlContent) => {
    if (!htmlContent) return '';

    let processed = htmlContent;
    const isLight = theme === 'light';

    //DEFINE TAILWIND CLASSES

    // headings
    const h2Classes = `text-2xl md:text-3xl font-bold mt-8 mb-4 leading-tight ${isLight ? 'text-emerald-800' : 'text-emerald-400'}`;
    const h3Classes = `text-xl md:text-2xl font-bold mt-6 mb-3 ${isLight ? 'text-emerald-700' : 'text-emerald-500'}`;

    // text body
    const textBase = `text-base md:text-lg leading-relaxed ${isLight ? 'text-stone-700' : 'text-gray-300'}`;
    const pClasses = `${textBase} mb-4 block`;
    const bClasses = `font-bold ${isLight ? 'text-stone-900' : 'text-white'}`;




    // lists
    const listBase = `pl-5 md:pl-8 mb-6 space-y-2 ${textBase}`; // inherit size/color
    const olClasses = `list-decimal ${listBase}`;
    const ulClasses = `list-disc ${listBase}`;

    // list items
    const liClasses = `pl-1`;

    // quill indent handling
    const indentClasses = `block ml-6 md:ml-10 mt-2 mb-2 ${isLight ? 'text-stone-600' : 'text-gray-400'}`;


    //INJECT CLASSES

    // a. quill indent class replacement
    processed = processed.replace(/class="ql-indent-1"/gi, `class="${indentClasses}"`);

    // b. block elements
    processed = processed.replace(/<h2(.*?)>/gi, `<h2 class="${h2Classes}"$1>`);
    processed = processed.replace(/<h3(.*?)>/gi, `<h3 class="${h3Classes}"$1>`);
    processed = processed.replace(/<p(.*?)>/gi, `<p class="${pClasses}"$1>`);

    // c. lists
    processed = processed.replace(/<ol(.*?)>/gi, `<ol class="${olClasses}"$1>`);
    processed = processed.replace(/<ul(.*?)>/gi, `<ul class="${ulClasses}"$1>`);
    processed = processed.replace(/<li>/gi, `<li class="${liClasses}">`);

    // d. inline elements
    processed = processed.replace(/<(b|strong)(.*?)>/gi, `<strong class="${bClasses}"$2>`);
    processed = processed.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1');

    return processed;
  };

  if (!isOpen || !chapter) return null;

  const isLight = theme === 'light';

  // styles
  const overlayClass = "fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 p-4 md:p-6";
  const modalClass = `w-full md:max-w-6xl max-h-[85vh] rounded-3xl shadow-2xl flex flex-col relative overflow-hidden transition-colors duration-300 ${isLight ? 'bg-white text-stone-800' : 'bg-[#1a1b1d] text-gray-200 border border-white/10'
    }`;
  const headerClass = `px-6 py-5 border-b flex items-center justify-between shrink-0 ${isLight ? 'border-stone-100 bg-white' : 'border-white/5 bg-[#1a1b1d]'
    }`;

  return (
    <div className={overlayClass} onClick={onClose}>
      <div className={modalClass} onClick={(e) => e.stopPropagation()}>

        {/* HEADER */}
        <div className={headerClass}>
          <div>
            <h2 className="text-xl md:text-2xl font-bold flex items-center gap-3">
              <span>Surah {chapter.name_simple}</span>
              <span className={`font-arabic text-2xl mt-1 ${isLight ? 'text-emerald-600' : 'text-emerald-500'}`}>
                {chapter.name_arabic}
              </span>
            </h2>
            <div className="flex items-center gap-3 mt-2">
              <span className={`text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-2 capitalize ${isLight ? 'bg-stone-100 text-stone-600' : 'bg-white/5 text-gray-400'}`}>
                <FaMapMarkerAlt size={14} aria-hidden="true" />
                {chapter.revelation_place}
              </span>
              <span className={`text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-2 ${isLight ? 'bg-stone-100 text-stone-600' : 'bg-white/5 text-gray-400'}`}>
                <IoBookOutline size={14} aria-hidden="true" />
                {chapter.verses_count} Verses
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded-full transition-colors ${isLight ? 'hover:bg-stone-100 text-stone-500' : 'hover:bg-white/5 text-gray-400'}`}
            aria-label="Close Information Modal"
          >
            <IoClose size={24} aria-hidden="true" />
          </button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10">
          {loading ? (
            <SkeletonLoader theme={theme} variant="info" />
          ) : info ? (
            <div className="max-w-none">
              <div dangerouslySetInnerHTML={{ __html: formatHTML(info.text) }} />
              <div className={`mt-8 pt-6 border-t text-xs opacity-50 ${isLight ? 'border-stone-200' : 'border-white/10'}`}>
                Source: {info.source}
              </div>
            </div>
          ) : (
            <div className="text-center opacity-50 py-10">
              Information unavailable for this chapter.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default SurahInfoModal;