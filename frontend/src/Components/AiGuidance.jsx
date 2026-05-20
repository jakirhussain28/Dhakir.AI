import { useState, useEffect } from 'react';
import { IoSend, IoClose, IoShieldCheckmark } from "react-icons/io5";
import { LuHistory, LuLoaderCircle } from "react-icons/lu";
import { IoIosArrowForward, IoMdArrowRoundForward } from "react-icons/io";
import { logAnalyticsEvent } from '../firebase';
import { getUserData, setUserData, USER_KEYS } from '../utils/userDb';
import { isAuthenticated } from '../utils/auth';
import { generateQuranGuidance } from '../utils/guidance';

const MAX_HISTORY = 20;

const PLACEHOLDERS = [
    "How are you?",
    "Share what's on your mind, I am listening…",
    "I am feeling happy today…",
    "I need guidance on forgiving someone…",
    "I feel grateful but don't know how to express it…",
    "I am feeling lonely and lost…",
    "I wish I had more patience…",
    "I'm struggling with anxiety…",
    "I am feeling blessed…",
    "I'm going through a difficult time…",
    "I wish I had more strength…",
    "I'm looking for hope and clarity…",
    "I want to be a better person…",
];

/* ── helpers: load/save AI guidance history from/to the active user DB ── */
async function loadHistory() {
    try {
        const data = await getUserData(USER_KEYS.AI_HISTORY, isAuthenticated());
        return Array.isArray(data) ? data : [];
    } catch { return []; }
}
function saveHistory(items) {
    setUserData(USER_KEYS.AI_HISTORY, items.slice(0, MAX_HISTORY), isAuthenticated());
}

export default function AiGuidance({ isLight, onGoToVerse }) {
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState(null);
    const [error, setError] = useState(null);
    const [placeholderIdx, setPlaceholderIdx] = useState(0);
    const [placeholderVisible, setPlaceholderVisible] = useState(true);
    const [isFocused, setIsFocused] = useState(false);
    const [answeredPrompt, setAnsweredPrompt] = useState(null);

    /* ── history state ── */
    const [history, setHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [expandedIdx, setExpandedIdx] = useState(null);
    const [showAuthOverlay, setShowAuthOverlay] = useState(false);

    // Load history from IndexedDB on mount
    useEffect(() => {
        let cancelled = false;
        loadHistory().then(data => {
            if (!cancelled) setHistory(data);
        });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        const id = setInterval(() => {
            setPlaceholderVisible(false);
            setTimeout(() => {
                setPlaceholderIdx(i => (i + 1) % PLACEHOLDERS.length);
                setPlaceholderVisible(true);
            }, 400);
        }, 3000);
        return () => clearInterval(id);
    }, []);

    /* ── persist a new entry ── */
    const pushHistory = (entry) => {
        setHistory(prev => {
            const next = [entry, ...prev].slice(0, MAX_HISTORY);
            saveHistory(next);
            return next;
        });
    };

    const handleSend = async () => {
        const trimmed = prompt.trim();
        if (!trimmed || loading) return;
        if (response && trimmed === answeredPrompt) return;

        // Check puter authentication before proceeding
        const puterAuth = window.puter?.auth;
        if (!puterAuth || !puterAuth.isSignedIn || !(await puterAuth.isSignedIn())) {
            setShowAuthOverlay(true);
            return;
        }

        setLoading(true);
        setError(null);
        setResponse(null);
        setShowHistory(false);

        logAnalyticsEvent('ai_guidance_query', { prompt_length: trimmed.length });

        try {
            const json = await generateQuranGuidance(trimmed);
            const data = json.data ?? json;
            setResponse(data);
            setAnsweredPrompt(trimmed);

            logAnalyticsEvent('ai_guidance_response', {
                chapter_number: data.chapter_number,
                verse_number: data.verse_number,
            });

            /* save to history */
            pushHistory({
                prompt: trimmed,
                description: data.description,
                chapter_number: data.chapter_number,
                verse_number: data.verse_number,
                timestamp: Date.now(),
            });
        } catch (err) {
            setError(err.message || 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    /* ── style tokens ── */
    const boxBg = isLight
        ? 'bg-white border border-stone-200 shadow-sm'
        : 'bg-[#222426] border border-white/10 shadow-md';
    const inputBg = isLight
        ? 'bg-stone-100 text-stone-800 placeholder-stone-400'
        : 'bg-[#111214] text-gray-200 placeholder-gray-600';

    const btnBase = `w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200`;
    const sendActive = isLight
        ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm hover:shadow-emerald-200 hover:shadow-md active:scale-95'
        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm active:scale-95';
    const historyBtn = isLight
        ? 'bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-stone-700 active:scale-95'
        : 'bg-[#2d2f33] hover:bg-[#383b3f] text-gray-500 hover:text-gray-300 active:scale-95';

    const hasText = prompt.trim().length > 0;
    const isAlreadyAnswered = response && prompt.trim() === answeredPrompt;
    const showSend = (hasText && !isAlreadyAnswered) || loading;
    const canSend = showSend && !loading;

    return (
        <div className={`w-full max-w-sm sm:max-w-2xl rounded-2xl p-3 pb-2 flex flex-col gap-3 relative overflow-hidden ${boxBg} ${showAuthOverlay ? 'min-h-[220px]' : ''}`}>

            {/* ── Puter Auth Overlay ── */}
            {showAuthOverlay && (
                <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl"
                    style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
                    {/* Backdrop */}
                    <div className={`absolute inset-0 rounded-2xl ${isLight ? 'bg-white/80' : 'bg-black/70'}`} />
                    {/* Content */}
                    <div className="relative flex flex-col items-center gap-4 px-6 py-5 text-center">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isLight ? 'bg-emerald-100' : 'bg-emerald-900/40'}`}>
                            <IoShieldCheckmark className={`w-6 h-6 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <h3 className={`text-sm font-semibold ${isLight ? 'text-stone-800' : 'text-gray-100'}`}>
                                Authentication Required
                            </h3>
                            <p className={`text-xs leading-relaxed max-w-[260px] ${isLight ? 'text-stone-500' : 'text-gray-400'}`}>
                                You'll be redirected to <strong className={isLight ? 'text-stone-700' : 'text-gray-200'}>puter.com</strong> to sign in for the AI service.
                            </p>
                        </div>
                        <div className="flex items-center gap-2.5">
                            <button
                                onClick={() => setShowAuthOverlay(false)}
                                className={`text-xs font-medium px-4 py-2 rounded-xl transition-all duration-200 active:scale-95
                                    ${isLight
                                        ? 'bg-stone-100 hover:bg-stone-200 text-stone-600'
                                        : 'bg-white/10 hover:bg-white/15 text-gray-300'
                                    }`}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    try {
                                        await window.puter.auth.signIn();
                                        setShowAuthOverlay(false);
                                    } catch (e) {
                                        console.error('Puter sign-in failed:', e);
                                    }
                                }}
                                className={`text-xs font-semibold px-4 py-2 rounded-xl transition-all duration-200 active:scale-95
                                    ${isLight
                                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm hover:shadow-emerald-200 hover:shadow-md'
                                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                                    }`}
                            >
                                Proceed
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Input row ── */}
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <input
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        disabled={loading}
                        className={`w-full rounded-xl px-4 py-2.5 text-sm outline-none border-none ring-0 transition-all duration-200 ${inputBg} ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
                    />
                    {!prompt && (
                        <span
                            aria-hidden="true"
                            style={{
                                transition: 'opacity 400ms ease, transform 400ms ease',
                                opacity: placeholderVisible && !isFocused ? 1 : 0,
                                transform: placeholderVisible && !isFocused ? 'translateY(0)' : 'translateY(-4px)',
                            }}
                            className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm select-none ${isLight ? 'text-stone-500' : 'text-gray-400'}`}
                        >
                            {PLACEHOLDERS[placeholderIdx]}
                        </span>
                    )}
                </div>

                {/* Dynamic button: History ↔ Send */}
                {showSend ? (
                    <button
                        onClick={handleSend}
                        disabled={!canSend}
                        aria-label="Send"
                        className={`${btnBase} ${canSend ? sendActive : isLight ? 'bg-stone-200 text-stone-400 cursor-not-allowed' : 'bg-[#222426] text-gray-600 cursor-not-allowed'}`}
                    >
                        {loading ? (
                            <LuLoaderCircle className="w-5 h-5 animate-spin" />
                        ) : (
                            <IoSend className="w-4.5 h-4.5" />
                        )}
                    </button>
                ) : (
                    <button
                        onClick={() => { setShowHistory(h => !h); setExpandedIdx(null); }}
                        aria-label="History"
                        className={`${btnBase} ${showHistory ? (isLight ? 'bg-emerald-100 text-emerald-600' : 'bg-emerald-900/30 text-emerald-400') : historyBtn}`}
                    >
                        <LuHistory className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* ── History overlay ── */}
            {showHistory && (
                <div
                    className={`rounded-xl overflow-hidden flex flex-col transition-all duration-200
                        ${isLight ? 'bg-stone-50 border border-stone-100' : 'bg-[#111214] border border-white/10'}`}
                    style={{ maxHeight: '280px' }}
                >
                    {/* Header */}
                    <div className={`flex items-center justify-between px-3.5 py-2.5 border-b ${isLight ? 'border-stone-200' : 'border-white/10'}`}>
                        <span className={`text-xs font-semibold uppercase tracking-wide ${isLight ? 'text-stone-500' : 'text-gray-500'}`}>
                            Recent Questions
                        </span>
                        <button
                            onClick={() => setShowHistory(false)}
                            aria-label="Close history"
                            className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${isLight ? 'hover:bg-stone-200 text-stone-400' : 'hover:bg-white/5 text-gray-500'}`}
                        >
                            <IoClose className="w-4 h-4" />
                        </button>
                    </div>

                    {/* List */}
                    <div className="overflow-y-auto custom-scrollbar" style={{ maxHeight: '240px' }}>
                        {history.length === 0 ? (
                            <p className={`text-xs text-center py-6 ${isLight ? 'text-stone-400' : 'text-gray-600'}`}>
                                No history yet — ask a question to get started!
                            </p>
                        ) : (
                            history.map((item, idx) => {
                                const isExpanded = expandedIdx === idx;
                                return (
                                    <div key={item.timestamp + idx} className={`border-b last:border-b-0 ${isLight ? 'border-stone-100' : 'border-white/10'}`}>
                                        {/* Question row */}
                                        <button
                                            onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                                            className={`w-full text-left px-3.5 py-2.5 flex items-center gap-2 transition-colors
                                                ${isLight ? 'hover:bg-stone-100' : 'hover:bg-white/5'}`}
                                        >
                                            <IoIosArrowForward
                                                className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''} ${isLight ? 'text-stone-400' : 'text-gray-600'}`}
                                            />
                                            <span className={`text-sm truncate ${isLight ? 'text-stone-700' : 'text-gray-300'}`}>
                                                {item.prompt}
                                            </span>
                                            <span className={`ml-auto text-[10px] shrink-0 font-mono ${isLight ? 'text-stone-400' : 'text-gray-600'}`}>
                                                {item.chapter_number}:{item.verse_number}
                                            </span>
                                        </button>

                                        {/* Expanded detail */}
                                        {isExpanded && (
                                            <div className={`px-3.5 pb-3 pt-1 flex flex-col gap-2.5 ${isLight ? 'bg-stone-100/60' : 'bg-white/[0.02]'}`}>
                                                <p className={`text-xs leading-relaxed ${isLight ? 'text-stone-600' : 'text-gray-400'}`}>
                                                    {item.description}
                                                </p>
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-md ${isLight ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-900/20 text-emerald-400'}`}>
                                                        Chapter {item.chapter_number} : Verse {item.verse_number}
                                                    </span>
                                                    <button
                                                        onClick={() => {
                                                            logAnalyticsEvent('ai_go_to_verse', {
                                                                chapter_number: item.chapter_number,
                                                                verse_number: item.verse_number,
                                                            });
                                                            onGoToVerse?.(item.chapter_number, item.verse_number);
                                                        }}
                                                        className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all duration-200 active:scale-95
                                                            ${isLight
                                                                ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm'
                                                                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                                                            }`}
                                                    >
                                                        Go to Verse
                                                        <IoMdArrowRoundForward />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* ── Response area ── */}
            {(response || error) && (
                <div className={`rounded-xl p-3.5 flex flex-col gap-3 ${isLight ? 'bg-stone-50 border border-stone-100' : 'bg-[#111214] border border-white/10'}`}>
                    {error && (
                        <p className="text-xs text-red-500">{error}</p>
                    )}
                    {response && (
                        <>
                            <p className={`text-sm leading-relaxed ${isLight ? 'text-stone-700' : 'text-gray-300'}`}>
                                {response.description}
                            </p>
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span className={`text-[11px] font-mono font-medium px-2 py-1 rounded-lg ${isLight ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-900/20 text-emerald-400'}`}>
                                    Chapter {response.chapter_number} : Verse {response.verse_number}
                                </span>
                                <button
                                    onClick={() => {
                                        logAnalyticsEvent('ai_go_to_verse', {
                                            chapter_number: response.chapter_number,
                                            verse_number: response.verse_number,
                                        });
                                        onGoToVerse?.(response.chapter_number, response.verse_number);
                                    }}
                                    className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all duration-200 active:scale-95
                                        ${isLight
                                            ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm hover:shadow-emerald-200'
                                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                                        }`}
                                >
                                    Go to Verse
                                    <IoMdArrowRoundForward />
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}
            <span className={`text-[10px] text-right mr-2 ${isLight ? 'text-stone-400' : 'text-white/30'}`}>AI Powered by Puter.com</span>
        </div>
    );
}
