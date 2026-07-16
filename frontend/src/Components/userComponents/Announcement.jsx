import React, { useState, useEffect } from 'react';

const IS_ANNOUNCEMENT_ENABLED = true; // key to enable/disable
const ANNOUNCEMENT_KEY = 'dhakir_announcement_closed_at';
const HIDE_DURATION_MS = 48 * 60 * 60 * 1000; // 48 hours
// const HIDE_DURATION_MS = 1000; // check

const Announcement = () => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (!IS_ANNOUNCEMENT_ENABLED) return;
        const closedAt = localStorage.getItem(ANNOUNCEMENT_KEY);
        if (closedAt) {
            if (Date.now() - parseInt(closedAt, 10) < HIDE_DURATION_MS) return;
            localStorage.removeItem(ANNOUNCEMENT_KEY);
        }
        setIsVisible(true);
    }, []);

    if (!IS_ANNOUNCEMENT_ENABLED || !isVisible) return null;

    return (
        <div className="w-full bg-[#111111] border-b border-white/5 py-2.5 px-4 flex items-center justify-between flex-shrink-0 z-[500]">
            <div className="flex-1 text-center text-gray-300 text-[11px] sm:text-xs font-medium tracking-wide">
                Upcoming Update for Logged in Mode: AI Guidance queries and answers will be saved in your User Account Notes section.
            </div>
            <button
                onClick={() => {
                    setIsVisible(false);
                    localStorage.setItem(ANNOUNCEMENT_KEY, Date.now().toString());
                }}
                className="flex-shrink-0 ml-4 text-gray-400 hover:text-white transition-colors p-1 relative group"
                aria-label="Close announcement"
            >
                <span className="text-xl font-bold leading-none">&times;</span>
                <span className="absolute right-full top-1/2 -translate-y-1/2 mr-2 pointer-events-none 
                                 opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 
                                 transition-all duration-150 ease-out whitespace-nowrap 
                                 bg-neutral-800 border border-white/10 text-gray-200 text-[10px] sm:text-xs 
                                 py-1 px-2.5 rounded-lg shadow-lg z-[600]">
                    Snooze for 48 hours
                </span>
            </button>
        </div>
    );
};

export default Announcement;