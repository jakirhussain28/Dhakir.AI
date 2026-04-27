
const SkeletonLoader = ({ theme, variant = 'verse' }) => {
  const isLight = theme === 'light';
  const bgBase = isLight ? 'bg-white border-stone-200' : 'bg-[#1a1b1d] border-white/5';
  const shimmer = isLight ? 'bg-stone-200' : 'bg-gray-800';

  if (variant === 'info') {
    return (
      <div className="space-y-6 animate-pulse max-w-4xl mx-auto">
        {/* Title */}
        <div className={`h-8 w-1/3 rounded-lg ${shimmer}`}></div>
        
        {/* Paragraph Lines */}
        <div className="space-y-3">
          <div className={`h-4 w-full rounded ${shimmer}`}></div>
          <div className={`h-4 w-full rounded ${shimmer}`}></div>
          <div className={`h-4 w-5/6 rounded ${shimmer}`}></div>
        </div>

        {/* Second Section Header */}
        <div className={`h-8 w-1/4 rounded-lg mt-8 ${shimmer}`}></div>
        
        {/* Large Block */}
        <div className={`h-32 w-full rounded-lg ${shimmer}`}></div>
      </div>
    );
  }

  // Default: Verse Variant
  return (
    <div className={`rounded-2xl border p-4 lg:p-6 flex flex-col md:flex-row gap-4 animate-pulse ${bgBase}`}>
      {/* Side Column (Desktop) */}
      <div className={`hidden md:block w-20 h-full rounded-lg ${shimmer} opacity-20`}></div>
      
      {/* Content Area */}
      <div className="flex-1 space-y-6">
        {/* Verse Text Area */}
        <div className={`h-8 w-3/4 ml-auto rounded-lg ${shimmer} opacity-30`}></div>
        <div className={`h-6 w-1/2 ml-auto rounded-lg ${shimmer} opacity-20`}></div>
        
        {/* Translation Area */}
        <div className={`h-4 w-full rounded-lg ${shimmer} opacity-10 mt-8`}></div>
        <div className={`h-4 w-5/6 rounded-lg ${shimmer} opacity-10`}></div>
      </div>
    </div>
  );
};

export default SkeletonLoader;