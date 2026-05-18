import React, { useState, useEffect } from 'react';
import { FaRegCircle, FaCircle } from "react-icons/fa";
import { isAuthenticated } from '../../utils/auth';
import { useLocalActivities, formatReadingTime } from '../../hooks/useLocalActivities';

function StreakBox({ isLight, onClick }) {
    const [isLoggedIn, setIsLoggedIn] = useState(isAuthenticated());
    const { streakDays, todaySeconds } = useLocalActivities();
    const dailyGoal = 15; // 15 minutes daily reading goal
    const dailyGoalSeconds = dailyGoal * 60; // 900 seconds

    // Compute progress percent (capped at 100%)
    const progressPercent = Math.min(100, Math.round((todaySeconds / dailyGoalSeconds) * 100));

    useEffect(() => {
        // Simple check for login status change
        const checkAuth = () => setIsLoggedIn(isAuthenticated());
        window.addEventListener('storage', checkAuth);
        return () => window.removeEventListener('storage', checkAuth);
    }, []);

    return (
        <div
            onClick={onClick}
            className={`
            flex items-center justify-between px-4 py-3.5 rounded-2xl border w-full h-full cursor-pointer
            transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]
            ${isLight ? 'bg-white border-stone-200 shadow-sm hover:border-emerald-200 hover:shadow-emerald-100' : 'bg-[#1a1b1d] border-white/5 shadow-md hover:border-emerald-500/30 hover:shadow-emerald-900/20'}
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
                <div className="flex flex-col">
                    <span className={`text-[12px] font-bold uppercase tracking-wider ${isLight ? 'text-stone-500' : 'text-gray-400'}`}>
                        Day Streak
                    </span>
                    <div className={`flex items-center gap-1 text-[11px] font-medium leading-none mt-0.5 ${isLight ? 'text-stone-400' : 'text-gray-500'}`}>
                        {isLoggedIn ? (
                            <>
                                <FaCircle className="w-2.5 h-2.5" />
                                <span>logged in</span>
                            </>
                        ) : (
                            <>
                                <FaRegCircle className="w-2.5 h-2.5" />
                                <span>local</span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Right side: Goal Progress */}
            <div className="flex flex-col items-end gap-1.5 w-[130px] sm:w-[150px] shrink-0">
                <span className={`text-[12px] font-medium whitespace-nowrap ${isLight ? 'text-stone-600' : 'text-gray-400'}`}>
                    {/* {todaySeconds > 0 ? formatReadingTime(todaySeconds) : '0 min'} / {dailyGoal} min */}
                    Daily Reading: {dailyGoal} minutes
                </span>
                <div className={`w-full h-3.5 rounded-full overflow-hidden border flex items-center relative
                    ${isLight ? 'border-stone-500 bg-white' : 'border-gray-500 bg-[#1a1b1d]'}`}
                >
                    <div
                        className={`h-full rounded-full transition-all duration-500 ease-out ${progressPercent >= 100
                            ? (isLight ? 'bg-emerald-500' : 'bg-emerald-400')
                            : (isLight ? 'bg-stone-500' : 'bg-gray-500')
                            }`}
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
            </div>
        </div>
    );
}

export default StreakBox;
