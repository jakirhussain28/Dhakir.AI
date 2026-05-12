import { useState, useEffect, useRef } from 'react';
import { FaRegCircle, FaCircle } from "react-icons/fa";
import { isAuthenticated } from '../../utils/auth';

function ActivityBox({ isLight }) {
    const [isLoggedIn, setIsLoggedIn] = useState(isAuthenticated());
    const scrollRef = useRef(null);
    const streakDays = 1;
    const todaysReading = 23; // minutes

    useEffect(() => {
        const checkAuth = () => setIsLoggedIn(isAuthenticated());
        window.addEventListener('storage', checkAuth);

        // Auto-scroll to the right calendar
        if (scrollRef.current) {
            scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
        }

        return () => window.removeEventListener('storage', checkAuth);
    }, []);

    // Helper to get exact colors based on the tier and theme
    const getColorClass = (level) => {
        if (level === null) return 'bg-transparent';
        if (isLight) {
            switch (level) {
                case 0: return 'bg-stone-200'; // Missed
                case 1: return 'bg-[#bbf7d0]'; // Read something - 15mins
                case 2: return 'bg-[#4ade80]'; // 16 - 35mins
                case 3: return 'bg-[#166534]'; // > 35mins
                default: return 'bg-transparent';
            }
        } else {
            switch (level) {
                case 0: return 'bg-white/10';  // Missed
                case 1: return 'bg-[#064e3b]'; // Read something - 15mins
                case 2: return 'bg-[#22c55e]/90'; // 16 - 35mins
                case 3: return 'bg-[#86efac]'; // > 35mins
                default: return 'bg-transparent';
            }
        }
    };

    // MOCK DATA
    const month1 = [
        null, null, null, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, null, null, null, null
    ];

    const month2 = [
        null, null, null, null, null, null, 0,
        0, 3, 0, 0, 0, 0, 0,
        0, 0, 0, 1, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, null, null, null
    ];

    const month3 = [
        null, null, null, null, 0, 0, 0,
        0, 3, 3, 0, 0, 0, 0,
        0, 1, 2, 2, 0, 0, 0,
        0, 0, 0, 0, 0, 1, 0,
        0, 0, 0, null, null, null, null
    ];

    const renderGrid = (data) => (
        <div className="grid grid-rows-7 grid-flow-col gap-1 sm:gap-1.5 md:gap-[9px]">
            {data.map((level, i) => (
                <div
                    key={i}
                    className={`w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-[21px] md:h-[21px] rounded-[2px] sm:rounded-[3px] md:rounded-[4.5px] ${getColorClass(level)}`}
                />
            ))}
        </div>
    );

    const DayLabels = ({ align }) => (
        <div className={`grid grid-rows-7 gap-1 sm:gap-1.5 md:gap-[9px] text-[9px] sm:text-[10px] md:text-[15px] mt-[24px] sm:mt-[28px] md:mt-[42px]
            ${isLight ? 'text-stone-400' : 'text-gray-500'} 
            ${align === 'right' ? 'text-left pl-1.5 md:pl-[9px]' : 'text-right pr-1.5 md:pr-[9px]'}`}
        >
            <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
        </div>
    );

    return (
        <div className="flex flex-col gap-4 md:gap-6 w-full">
            {/* Upper Section: Streak & Today's Reading */}
            <div className={`
                flex items-center justify-between px-4 py-3.5 md:px-6 md:py-[21px] rounded-2xl md:rounded-[24px] border w-full
                ${isLight ? 'bg-white border-stone-200 shadow-sm' : 'bg-[#1a1b1d] border-white/5 shadow-md'}
            `}>
                <div className="flex items-center gap-3 md:gap-[18px]">
                    <div className={`w-[3.25rem] h-10 md:w-[78px] md:h-[60px] rounded-xl md:rounded-[18px] flex items-center justify-center shrink-0
                        ${isLight ? 'bg-emerald-50' : 'bg-emerald-900/20'}`}
                    >
                        <span className={`text-3xl md:text-[45px] font-semibold ${isLight ? 'text-stone-500' : 'text-gray-300'}`}>
                            {streakDays}
                        </span>
                    </div>
                    <div className="flex flex-col shrink-0">
                        <span className={`text-[12px] md:text-[18px] font-bold uppercase tracking-wider ${isLight ? 'text-stone-500' : 'text-gray-400'}`}>
                            Day Streak
                        </span>
                        <div className={`flex items-center gap-1 md:gap-[6px] text-[11px] md:text-[16px] font-medium leading-none mt-0.5 md:mt-[3px] ${isLight ? 'text-stone-400' : 'text-gray-500'}`}>
                            {isLoggedIn ? (
                                <> <FaCircle className="w-2.5 h-2.5 md:w-[15px] md:h-[15px]" /> <span>logged in</span> </>
                            ) : (
                                <> <FaRegCircle className="w-2.5 h-2.5 md:w-[15px] md:h-[15px]" /> <span>local</span> </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center flex-1 justify-end ml-2 md:ml-3">
                    <span className={`text-[12px] sm:text-sm md:text-[21px] font-medium text-right ${isLight ? 'text-stone-500' : 'text-gray-400'}`}>
                        Today's Reading: {todaysReading} mins
                    </span>
                </div>
            </div>

            {/* Lower Section: Calendar Heatmap */}
            <div className={`
                p-3 sm:p-4 md:p-6 rounded-2xl md:rounded-[24px] border w-full
                ${isLight ? 'bg-[#f8f9fa] border-stone-200/50 shadow-inner' : 'bg-[#1c211c] border-white/5 shadow-inner'}
            `}>
                <div ref={scrollRef} className="overflow-x-auto pb-1 scrollbar-hide">
                    <div className="flex items-start min-w-max justify-center">
                        <DayLabels align="left" />

                        <div className="flex gap-3 sm:gap-4 md:gap-6 px-1 sm:px-2 md:px-3">
                            {/* Month 1 */}
                            <div className="flex flex-col items-center">
                                <div className={`text-[9px] sm:text-[10px] md:text-[15px] font-medium px-2.5 py-0.5 md:px-[15px] md:py-[3px] rounded-md md:rounded-lg mb-2 sm:mb-2.5 md:mb-[15px]
                                    ${isLight ? 'bg-stone-200 text-stone-500' : 'bg-white/10 text-gray-400'}`}>
                                    March
                                </div>
                                {renderGrid(month1)}
                            </div>

                            {/* Month 2 */}
                            <div className="flex flex-col items-center">
                                <div className={`text-[9px] sm:text-[10px] md:text-[15px] font-medium px-2.5 py-0.5 md:px-[15px] md:py-[3px] rounded-md md:rounded-lg mb-2 sm:mb-2.5 md:mb-[15px]
                                    ${isLight ? 'bg-stone-200 text-stone-500' : 'bg-white/10 text-gray-400'}`}>
                                    April
                                </div>
                                {renderGrid(month2)}
                            </div>

                            {/* Month 3 */}
                            <div className="flex flex-col items-center">
                                <div className={`text-[9px] sm:text-[10px] md:text-[15px] font-medium px-2.5 py-0.5 md:px-[15px] md:py-[3px] rounded-md md:rounded-lg mb-2 sm:mb-2.5 md:mb-[15px]
                                    ${isLight ? 'bg-stone-200 text-stone-500' : 'bg-white/10 text-gray-400'}`}>
                                    This Month
                                </div>
                                {renderGrid(month3)}
                            </div>
                        </div>

                        <DayLabels align="right" />
                    </div>
                </div>

                {/* Legend */}
                <div className={`flex justify-end items-center gap-1.5 sm:gap-2 md:gap-3 mt-3 sm:mt-4 md:mt-6 text-[9px] sm:text-[10px] md:text-[15px] pr-1 md:pr-1.5
                    ${isLight ? 'text-stone-500' : 'text-gray-400'}`}>
                    <span>Missed</span>
                    <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-[18px] md:h-[18px] rounded-[2px] md:rounded-[3px] ${getColorClass(0)}`} />
                    <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-[18px] md:h-[18px] rounded-[2px] md:rounded-[3px] ${getColorClass(1)}`} />
                    <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-[18px] md:h-[18px] rounded-[2px] md:rounded-[3px] ${getColorClass(2)}`} />
                    <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-[18px] md:h-[18px] rounded-[2px] md:rounded-[3px] ${getColorClass(3)}`} />
                    <span>Dedicated</span>
                </div>
            </div>
        </div>
    );
}

export default ActivityBox;