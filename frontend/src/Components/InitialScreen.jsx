import { useState, useEffect } from 'react';
import { IoSend, IoClose, IoBookOutline, IoCloseCircleOutline } from "react-icons/io5";
import { LuHistory } from "react-icons/lu";
import { IoIosArrowForward } from "react-icons/io";
import { IoMdArrowRoundForward } from "react-icons/io";
import { LuLoaderCircle } from "react-icons/lu";
import { logAnalyticsEvent } from '../firebase';
import StreakBox from './userComponents/StreakBox';
import BookmarksBox from './userComponents/BookmarksBox';

/* ── SHARED CARD BUTTON ────────────────────────────────────────── */
export function ActionCard({ onClick, isLight, ariaLabel, icon, label, subtitle, subtitleArabic, accent = false, hideArrow = false }) {
    return (
        <button
            onClick={onClick}
            aria-label={ariaLabel}
            className={`
        w-full group flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all duration-200
        hover:scale-[1.02] active:scale-[0.98] shadow-sm text-left min-w-0
        ${isLight
                    ? accent
                        ? 'bg-white border-stone-100 hover:border-amber-100 hover:shadow-amber-100 hover:shadow-sm'
                        : 'bg-white border-stone-100 hover:border-emerald-200 hover:shadow-emerald-100 hover:shadow-sm'
                    : accent
                        ? 'bg-[#1a1b1d] border-white/5 hover:border-amber-300/30 hover:shadow-amber-900/20 hover:shadow-sm'
                        : 'bg-[#1a1b1d] border-white/5 hover:border-emerald-500/30 hover:shadow-emerald-900/20 hover:shadow-md'
                }
      `}
        >
            {/* Icon blob */}
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors
        ${isLight
                    ? accent ? 'bg-amber-50 group-hover:bg-amber-100/70' : 'bg-emerald-50 group-hover:bg-emerald-100'
                    : accent ? 'bg-amber-900/20 group-hover:bg-amber-900/30' : 'bg-emerald-900/20 group-hover:bg-emerald-900/30'
                }`}
            >
                {icon}
            </div>

            {/* Labels */}
            <div className="min-w-0 flex-1">
                <p className={`text-[10px] font-medium mb-0.5 uppercase tracking-wide ${isLight ? 'text-stone-400' : 'text-gray-500'}`}>
                    {label}
                </p>
                {subtitle && (
                    <p className={`font-semibold text-sm truncate ${isLight ? 'text-stone-800' : 'text-gray-200'}`}>
                        {subtitle}
                    </p>
                )}
                {subtitleArabic && (
                    <p className={`font-arabic text-base leading-none mt-0.5 ${accent
                        ? (isLight ? 'text-amber-600' : 'text-amber-400')
                        : (isLight ? 'text-emerald-600' : 'text-emerald-500')
                        }`}>
                        {subtitleArabic}
                    </p>
                )}
            </div>

            {/* Trailing arrow */}
            {!hideArrow && (
                <IoMdArrowRoundForward className={`w-3.5 h-3.5 shrink-0 transition-transform group-hover:translate-x-0.5
              ${isLight ? 'text-stone-400' : 'text-gray-600'}`} />
            )}
        </button>
    );
}

/* ── AI GUIDANCE BOX ───────────────────────────────────────────── */
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const HISTORY_KEY = 'ai_guidance_history';
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

/* ── helpers ── */
function loadHistory() {
    try {
        const raw = localStorage.getItem(HISTORY_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}
function saveHistory(items) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)));
}

function GuidanceBox({ isLight, onGoToVerse }) {
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState(null);
    const [error, setError] = useState(null);
    const [placeholderIdx, setPlaceholderIdx] = useState(0);
    const [placeholderVisible, setPlaceholderVisible] = useState(true);
    const [isFocused, setIsFocused] = useState(false);
    const [answeredPrompt, setAnsweredPrompt] = useState(null);

    /* ── history state ── */
    const [history, setHistory] = useState(loadHistory);
    const [showHistory, setShowHistory] = useState(false);
    const [expandedIdx, setExpandedIdx] = useState(null);

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

        setLoading(true);
        setError(null);
        setResponse(null);
        setShowHistory(false);

        logAnalyticsEvent('ai_guidance_query', { prompt_length: trimmed.length });

        try {
            const res = await fetch(`${API_BASE}/api/guidance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_input: trimmed }),
            });

            if (!res.ok) throw new Error(`Server error: ${res.status}`);

            const json = await res.json();
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
        <div className={`w-full max-w-sm sm:max-w-2xl rounded-2xl p-4 flex flex-col gap-3 ${boxBg}`}>

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
        </div>
    );
}

/* ── INITIAL SCREEN ────────────────────────────────────────────── */
function InitialScreen({ theme, lastChapter, onContinue, loadingChapters, bookmarks, onGoToBookmark, onRemoveBookmark, onGoToVerse }) {
    const isLight = theme === 'light';

    return (
        <div className="h-full flex flex-col items-center justify-center gap-5 px-4 select-none">

            {/* BOOKMARK BOX */}
            <BookmarksBox bookmarks={bookmarks} isLight={isLight} onGoToBookmark={onGoToBookmark} onRemoveBookmark={onRemoveBookmark} />

            {/* AI GUIDANCE BOX */}
            <GuidanceBox isLight={isLight} onGoToVerse={onGoToVerse} />

            {/* ACTION BUTTONS — side by side */}
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm sm:max-w-2xl">
                {/* CONTINUE READING */}
                {lastChapter && (
                    <div className="w-full sm:w-1/3 min-w-0 flex">
                        <ActionCard
                            onClick={onContinue}
                            isLight={isLight}
                            ariaLabel={`Continue reading Surah ${lastChapter.name_simple}`}
                            icon={<IoBookOutline />}
                            label="Continue Reading"
                            subtitle={lastChapter.name_simple}
                            accent={false}
                        />
                    </div>
                )}

                {/* STREAK BOX */}
                <div className="w-full sm:flex-1 min-w-0 flex">
                    <StreakBox isLight={isLight} />
                </div>
            </div>
        </div>
    );
}

export default InitialScreen;
