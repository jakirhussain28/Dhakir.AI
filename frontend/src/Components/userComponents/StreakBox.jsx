import React from 'react';

function StreakBox({ isLight }) {
    const streakDays = 1;
    const progressPercent = 34;
    const dailyGoal = 10; // minutes

    return (
        <div className={`
            flex items-center justify-between px-4 py-3.5 rounded-2xl border w-full h-full
            ${isLight ? 'bg-white border-stone-200 shadow-sm' : 'bg-[#1a1b1d] border-white/5 shadow-md'}
        `}>
            {/* Left side: Streak */}
            <div className="flex items-center gap-3">
                <div className={`w-[3.25rem] h-10 rounded-xl flex items-center justify-center shrink-0
                    ${isLight ? 'bg-emerald-50' : 'bg-emerald-900/20'}`}
                >
                    <span className={`text-3xl font-semibold ${isLight ? 'text-stone-500' : 'text-gray-300'}`}>
                        {streakDays}
                    </span>
                </div>
                <span className={`text-[12px] font-bold uppercase tracking-wider ${isLight ? 'text-stone-500' : 'text-gray-400'}`}>
                    Day Streak
                </span>
            </div>

            {/* Right side: Goal Progress */}
            <div className="flex flex-col items-end gap-1.5 w-[130px] sm:w-[150px] shrink-0">
                <span className={`text-[12px] font-medium whitespace-nowrap ${isLight ? 'text-stone-600' : 'text-gray-400'}`}>
                    Daily Goal: &nbsp;{dailyGoal} minutes
                </span>
                <div className={`w-full h-3.5 rounded-full overflow-hidden border flex items-center relative
                    ${isLight ? 'border-stone-500 bg-white' : 'border-gray-500 bg-[#1a1b1d]'}`}
                >
                    <div
                        className={`h-full ${isLight ? 'bg-stone-500' : 'bg-gray-500'}`}
                        style={{ width: `${progressPercent}%` }}
                    />
                    {/* <span className={`absolute inset-0 flex items-center text-[10px] font-bold z-10
                        ${isLight ? 'text-stone-600' : 'text-gray-300'}`}
                        style={{
                            left: `${progressPercent}%`,
                            paddingLeft: '6px'
                        }}
                    >
                        {progressPercent}%
                    </span> */}
                </div>
            </div>
        </div>
    );
}

export default StreakBox;
