import { useEffect } from 'react';
// import { Settings } from 'lucide-react';
import { LuSettings } from "react-icons/lu";


function SettingsModal({
  isOpen,
  onClose,
  theme,
  setTheme,
  showTranslation,
  setShowTranslation,
  showTransliteration,
  setShowTransliteration,
  onlyTranslation,
  setOnlyTranslation,
  fontSize,
  setFontSize
}) {
  /* LOCK SCROLL */
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'; // prevent bg scroll
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

  const fontSizes = [1, 2, 3, 4, 5];
  const isLight = theme === 'light';

  /* STYLES CONFIG */
  const modalBase = isLight
    ? 'bg-white border-stone-400 shadow-xl'
    : 'bg-[#121212] border-gray-500 shadow-2xl';

  const rowBase = isLight
    ? 'bg-stone-100'
    : 'bg-[#192516]';

  const textActive = isLight ? 'text-stone-800' : 'text-gray-200';
  const textInactive = isLight ? 'text-stone-400' : 'text-gray-500';
  const labelColor = isLight ? 'text-stone-500' : 'text-gray-400';
  const toggleTrack = isLight ? 'bg-stone-300' : 'bg-[#3e3e3e]';
  const sliderDotInactive = isLight ? 'bg-stone-400 hover:bg-stone-500' : 'bg-gray-500 hover:bg-gray-400';

  return (
    /* BACKDROP */
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/20 backdrop-blur-[2px] animate-in fade-in duration-200"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      {/* MODAL CARD */}
      <div
        className={`w-[90%] max-w-[380px] rounded-4xl p-5 sm:p-6 relative transition-colors duration-300 border ${modalBase}`}
        onClick={(e) => e.stopPropagation()}
      >

        {/* GEAR ICON */}
        <div className="flex justify-end mb-2">
          <LuSettings className={`w-6 h-6 sm:w-7 sm:h-7 transition-colors ${isLight ? 'text-stone-400' : 'text-gray-400'}`} aria-hidden="true" />
        </div>

        <div className="space-y-4 sm:space-y-5">

          {/* THEME */}
          <div className={`${rowBase} rounded-3xl h-16 sm:h-20 px-4 sm:px-6 flex items-center justify-between gap-2 transition-colors duration-300`}>
            <span className={`text-sm sm:text-base font-medium whitespace-nowrap transition-colors ${theme === 'night' ? textActive : textInactive}`}>
              Night Sky
            </span>
            <button
              onClick={() => setTheme(theme === 'night' ? 'light' : 'night')}
              aria-label={`Switch to ${theme === 'night' ? 'Light' : 'Night'} Mode`}
              className={`relative w-14 h-7 sm:w-16 sm:h-8 rounded-full flex items-center px-1 transition-colors focus:outline-none shrink-0 ${toggleTrack}`}
            >
              <div className={`
                w-5 h-5 sm:w-6 sm:h-6 rounded-full shadow-sm transform transition-transform duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1.0)]
                ${theme === 'light'
                  ? 'translate-x-7 sm:translate-x-8 bg-emerald-500'
                  : 'translate-x-0 bg-[#1c1b1b]'
                }
              `}></div>
            </button>
            <span className={`text-sm sm:text-base font-medium whitespace-nowrap transition-colors ${theme === 'light' ? textActive : textInactive}`}>
              Heaven Light
            </span>
          </div>

          {/* SAHIH TRANSLATION */}
          <div className={`${rowBase} rounded-3xl h-16 sm:h-20 px-4 sm:px-6 flex items-center justify-between transition-colors duration-300`}>
            <span className={`text-sm sm:text-base font-medium ${labelColor}`}>Sahih Translation</span>

            <button
              onClick={() => setShowTranslation(!showTranslation)}
              disabled={onlyTranslation}
              aria-label={showTranslation ? "Hide Translation" : "Show Translation"}
              aria-disabled={onlyTranslation}
              className={`
                ${toggleTrack} rounded-full p-1 flex items-center relative h-8 w-20 sm:h-8 sm:w-24 shrink-0 
                transition-all focus:outline-none 
                ${onlyTranslation ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <div className={`
                 absolute top-1 bottom-1 w-[calc(50%-4px)] bg-emerald-500 rounded-full transition-transform duration-200 ease-out z-0
                 ${showTranslation ? 'translate-x-full left-1' : 'translate-x-0 left-1'}
               `}></div>
              <span className={`flex-1 text-[10px] sm:text-xs font-bold z-10 text-center transition-colors ${!showTranslation ? 'text-white' : (isLight ? 'text-stone-500' : 'text-gray-400')}`}>
                Off
              </span>
              <span className={`flex-1 text-[10px] sm:text-xs font-bold z-10 text-center transition-colors ${showTranslation ? 'text-white' : (isLight ? 'text-stone-500' : 'text-gray-400')}`}>
                On
              </span>
            </button>
          </div>

          {/* TRANSLITERATION (UPDATED) */}
          <div className={`${rowBase} rounded-3xl h-16 sm:h-20 px-4 sm:px-6 flex items-center justify-between transition-colors duration-300`}>
            <span className={`text-sm sm:text-base font-medium ${labelColor}`}>Transliteration</span>

            <button
              onClick={() => setShowTransliteration(!showTransliteration)}
              disabled={onlyTranslation}
              aria-label={showTransliteration ? "Hide Transliteration" : "Show Transliteration"}
              aria-disabled={onlyTranslation}
              className={`
                ${toggleTrack} rounded-full p-1 flex items-center relative h-8 w-20 sm:h-8 sm:w-24 shrink-0 
                transition-all focus:outline-none
                ${onlyTranslation ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <div className={`
                 absolute top-1 bottom-1 w-[calc(50%-4px)] bg-emerald-500 rounded-full transition-transform duration-200 ease-out z-0
                 ${showTransliteration ? 'translate-x-full left-1' : 'translate-x-0 left-1'}
               `}></div>
              <span className={`flex-1 text-[10px] sm:text-xs font-bold z-10 text-center transition-colors ${!showTransliteration ? 'text-white' : (isLight ? 'text-stone-500' : 'text-gray-400')}`}>
                Off
              </span>
              <span className={`flex-1 text-[10px] sm:text-xs font-bold z-10 text-center transition-colors ${showTransliteration ? 'text-white' : (isLight ? 'text-stone-500' : 'text-gray-400')}`}>
                On
              </span>
            </button>
          </div>

          {/* ONLY TRANSLATION */}
          <div className={`${rowBase} rounded-3xl h-16 sm:h-20 px-4 sm:px-6 flex items-center justify-between transition-colors duration-300`}>
            <span className={`text-sm sm:text-base font-medium ${labelColor}`}>Only Translation</span>

            <button
              onClick={() => setOnlyTranslation(!onlyTranslation)}
              aria-label={onlyTranslation ? "Show Arabic and Translation" : "Show Only Translation"}
              className={`${toggleTrack} rounded-full p-1 flex items-center relative h-8 w-20 sm:h-8 sm:w-24 shrink-0 transition-colors focus:outline-none cursor-pointer`}
            >
              <div className={`
                 absolute top-1 bottom-1 w-[calc(50%-4px)] bg-emerald-500 rounded-full transition-transform duration-200 ease-out z-0
                 ${onlyTranslation ? 'translate-x-full left-1' : 'translate-x-0 left-1'}
               `}></div>
              <span className={`flex-1 text-[10px] sm:text-xs font-bold z-10 text-center transition-colors ${!onlyTranslation ? 'text-white' : (isLight ? 'text-stone-500' : 'text-gray-400')}`}>
                Off
              </span>
              <span className={`flex-1 text-[10px] sm:text-xs font-bold z-10 text-center transition-colors ${onlyTranslation ? 'text-white' : (isLight ? 'text-stone-500' : 'text-gray-400')}`}>
                On
              </span>
            </button>
          </div>

          {/* FONT SIZE */}
          <div className={`${rowBase} rounded-3xl h-20 sm:h-24 px-4 sm:px-6 flex flex-col justify-center transition-colors duration-300`}>
            <span className={`text-sm sm:text-base font-medium mb-2 sm:mb-3 ${labelColor}`}>Font Size</span>

            <div className="flex items-center gap-3 sm:gap-4">
              <span className={`text-xs font-medium ${textInactive}`}>A</span>

              <div className={`flex-1 relative h-3 rounded-full flex items-center justify-between px-1 transition-colors ${toggleTrack}`}>
                {fontSizes.map((step) => (
                  <button
                    key={step}
                    onClick={() => setFontSize(step)}
                    aria-label={`Set font size to level ${step}`}
                    className={`
                      w-3 h-3 sm:w-4 sm:h-4 rounded-full z-10 transition-all duration-200 focus:outline-none relative
                      ${fontSize === step
                        ? 'bg-emerald-500 scale-150 shadow-lg'
                        : sliderDotInactive
                      }
                    `}
                  >
                  </button>
                ))}
              </div>

              <span className={`text-lg sm:text-xl font-medium ${textInactive}`}>A</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default SettingsModal;