function VerseDropdown({ totalVerses, onSelectVerse }) {
  /* GENERATE NUMBERS */
  const verseNumbers = Array.from({ length: totalVerses }, (_, i) => i + 1);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="px-4 py-3 border-b border-gray-800/50 text-xs font-medium text-gray-500 uppercase tracking-wider">
        Select Verse
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
        {/* GRID LAYOUT */}
        <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-2">
          {verseNumbers.map((num) => (
            <button
              key={num}
              onClick={(e) => {
                e.stopPropagation();
                onSelectVerse(num);
              }}
              className="
                flex items-center justify-center h-10 rounded-lg text-sm font-mono transition-all duration-200
                border border-white/5 bg-white/5 text-gray-400 
                hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-400
                active:scale-95
              "
            >
              {num}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default VerseDropdown;