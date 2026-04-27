// import { Play, Pause, Loader2 } from 'lucide-react';
import { FaPlay } from "react-icons/fa";
import { FaPause } from "react-icons/fa6";
import { LuLoaderCircle } from "react-icons/lu";


const VerseAudioPlayer = ({
  audioUrl,
  isPlaying,
  isLoading,
  onToggle,
  theme
}) => {
  const isLight = theme === 'light';

  /* THEME COLORS */
  const buttonClass = isLight
    ? 'bg-stone-100 hover:bg-stone-200 text-emerald-600 border-stone-200'
    : 'bg-white/5 hover:bg-white/10 text-emerald-400 border-white/5';

  if (!audioUrl) return null;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      disabled={isLoading}
      aria-label={isPlaying ? "Pause Verse Audio" : "Play Verse Audio"}
      className={`
        relative group flex items-center justify-center 
        w-10 h-10 rounded-full border transition-all duration-300
        ${buttonClass}
        ${isPlaying ? 'scale-120 ring-2 ring-emerald-500/20' : ''}
      `}
    >
      {isLoading ? (
        <LuLoaderCircle size={18} className="animate-spin opacity-80" aria-hidden="true" />
      ) : isPlaying ? (
        <FaPause size={20} className="fill-current" aria-hidden="true" />
      ) : (
        <FaPlay size={18} className="fill-current ml-0.5" aria-hidden="true" />
      )}
    </button>
  );
};

export default VerseAudioPlayer;