import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { FaArrowUp } from "react-icons/fa6";
import { LuLoaderCircle } from "react-icons/lu";
import logo from '/src/assets/logo.svg';
import bismillah from '/src/assets/bismillah.svg';
import ChapterNavigation from './ChapterNavigation';
import VerseCard from './VerseCard';
import SkeletonLoader from './SkeletonLoader';
import { saveLastReadVerse } from './userComponents/ContinueReadingBox';

// NEW: Import Analytics
import { logAnalyticsEvent } from '../firebase';

function VerseList({
  verses,
  loading,
  page,
  setPage,
  totalPages,
  scrollRef,
  theme,
  showTranslation,
  showTransliteration,
  onlyTranslation,
  fontSize,
  onAudioStatusChange,
  registerStopHandler,
  selectedChapter,
  onChapterNavigate,
  onChapterEnd,
  shouldAutoPlay,
  setShouldAutoPlay,
  targetVerse,
  setTargetVerse,
  startPage,
  onLoadPrevious,
  loadingTop,
  bookmarks,
  onToggleBookmark
}) {
  /* AUDIO STATE */
  const [playingVerseKey, setPlayingVerseKey] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);

  // refs
  const audioRef = useRef(null);
  const currentAudioKeyRef = useRef(null);
  const verseRefs = useRef({});
  const versesRef = useRef(verses);

  // scroll preservation
  const prevStartPageRef = useRef(startPage);
  const prevScrollHeightRef = useRef(0);

  // observer
  const observer = useRef();

  // ── READING POSITION TRACKER ──────────────────────────────────────────────
  // Fires whenever a verse card crosses the header zone (~80px from top).
  const readingObserver = useRef(null);
  const lastSavedVerseKey = useRef(null);

  useEffect(() => {
    versesRef.current = verses;
  }, [verses]);

  /* ── READING POSITION OBSERVER SETUP ── */
  useEffect(() => {
    // The scroll container is the root; rootMargin crops a thin band just
    // below the header (≈80px from top, ignoring bottom 85%).
    // Any verse card whose top edge enters this band is the "current" verse.
    readingObserver.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const vk = entry.target.dataset.verseKey;
            if (vk && vk !== lastSavedVerseKey.current) {
              lastSavedVerseKey.current = vk;
              const [chStr, vStr] = vk.split(':');
              saveLastReadVerse(Number(chStr), Number(vStr), selectedChapter?.name_simple);
            }
          }
        }
      },
      {
        root: scrollRef.current,
        // top inset = header height, bottom inset = ignore lower 85% of viewport
        rootMargin: '-80px 0px -85% 0px',
        threshold: 0,
      }
    );

    return () => {
      if (readingObserver.current) readingObserver.current.disconnect();
    };
  }, [scrollRef]);

  // Re-observe all verse cards whenever the list changes
  useEffect(() => {
    const obs = readingObserver.current;
    if (!obs) return;

    // Disconnect previous observations, then re-observe all current refs
    obs.disconnect();
    Object.values(verseRefs.current).forEach((el) => {
      if (el) obs.observe(el);
    });
  }, [verses]);

  /* SCROLL PRESERVATION */
  useLayoutEffect(() => {
    if (startPage < prevStartPageRef.current && scrollRef.current) {
      const newScrollHeight = scrollRef.current.scrollHeight;
      const diff = newScrollHeight - prevScrollHeightRef.current;

      // adjust scroll position
      if (diff > 0) {
        const originalBehavior = scrollRef.current.style.scrollBehavior;
        scrollRef.current.style.scrollBehavior = 'auto';
        scrollRef.current.scrollTop += diff;
        scrollRef.current.style.scrollBehavior = originalBehavior;
      }
    }
    prevStartPageRef.current = startPage;
  }, [verses, startPage, scrollRef]);

  const handleLoadPrevClick = () => {
    if (scrollRef.current) {
      prevScrollHeightRef.current = scrollRef.current.scrollHeight;
    }
    onLoadPrevious();
  };

  /* SCROLL HELPERS */
  const scrollToVerse = (verseKey) => {
    const element = verseRefs.current[verseKey];
    if (element) {
      setTimeout(() => {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  };

  const scrollToTop = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  /* TARGET JUMP WATCHER */
  useEffect(() => {
    if (targetVerse && selectedChapter) {
      const verseKey = `${selectedChapter.id}:${targetVerse.id}`;
      const verseExists = verses.find(v => v.verse_key === verseKey);

      if (verseExists) {
        scrollToVerse(verseKey);
        setTargetVerse(null);
      }
    }
  }, [targetVerse, verses, selectedChapter, setTargetVerse]);

  /* INFINITE SCROLL */
  const lastVerseElementRef = useCallback((node) => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      const target = entries[0];
      if (target.isIntersecting) {
        if (page >= totalPages) return;
        if (verses.length === 0) return;

        // verify last verse
        const lastVerse = verses[verses.length - 1];
        const lastVerseNumber = parseInt(lastVerse.verse_key.split(':')[1], 10);
        const expectedLastVerseNumber = page * 10;

        if (lastVerseNumber !== expectedLastVerseNumber) return;

        setPage(prevPage => prevPage + 1);
      }
    });

    if (node) observer.current.observe(node);
  }, [loading, page, totalPages, verses, setPage]);


  /* AUTO PLAY TRIGGER */
  useEffect(() => {
    if (shouldAutoPlay && verses.length > 0 && !loading && !playingVerseKey) {
      handlePlayPause(verses[0]);
      if (setShouldAutoPlay) setShouldAutoPlay(false);
    }
  }, [verses, loading, shouldAutoPlay, playingVerseKey]);

  /* GLOBAL STOP HANDLER */
  useEffect(() => {
    if (registerStopHandler) {
      registerStopHandler((forceStop = false) => {
        if (forceStop) {
          // stop all audio
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
          }
          setPlayingVerseKey(null);
          setIsPaused(false);
          currentAudioKeyRef.current = null;
          if (onAudioStatusChange) onAudioStatusChange('idle');
          if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "none";
        } else {
          // toggle current audio
          if (audioRef.current) {
            if (audioRef.current.paused) {
              audioRef.current.play();
              setIsPaused(false);
              if (onAudioStatusChange) onAudioStatusChange('playing');
              if (currentAudioKeyRef.current) scrollToVerse(currentAudioKeyRef.current);
            } else {
              audioRef.current.pause();
              setIsPaused(true);
              if (onAudioStatusChange) onAudioStatusChange('paused');
            }
          }
        }
      });
    }
  }, [registerStopHandler, onAudioStatusChange]);

  /* MEDIA SESSION API */
  useEffect(() => {
    if (!playingVerseKey || !selectedChapter || !audioRef.current) return;

    if ('mediaSession' in navigator) {
      // set metadata
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `Verse ${playingVerseKey.split(':')[1]}`,
        artist: `Surah ${selectedChapter.name_simple}`,
        album: 'Al-Quran',
        artwork: [
          { src: logo, sizes: '512x512', type: 'image/svg+xml' },
          { src: logo, sizes: '96x96', type: 'image/svg+xml' }
        ]
      });

      // handlers
      navigator.mediaSession.setActionHandler('play', () => {
        if (audioRef.current) {
          audioRef.current.play();
          setIsPaused(false);
          if (onAudioStatusChange) onAudioStatusChange('playing');
        }
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        if (audioRef.current) {
          audioRef.current.pause();
          setIsPaused(true);
          if (onAudioStatusChange) onAudioStatusChange('paused');
        }
      });

      navigator.mediaSession.setActionHandler('previoustrack', () => {
        const currentIndex = versesRef.current.findIndex(v => v.verse_key === playingVerseKey);
        if (currentIndex > 0) {
          const prevVerse = versesRef.current[currentIndex - 1];
          handlePlayPause(prevVerse);
        }
      });

      navigator.mediaSession.setActionHandler('nexttrack', () => {
        const currentIndex = versesRef.current.findIndex(v => v.verse_key === playingVerseKey);
        if (currentIndex !== -1 && currentIndex < versesRef.current.length - 1) {
          const nextVerse = versesRef.current[currentIndex + 1];
          handlePlayPause(nextVerse);
        } else if (onChapterEnd && selectedChapter.verses_count === versesRef.current.length) {
          onChapterEnd();
        }
      });
    }
  }, [playingVerseKey, selectedChapter, verses]);

  /* PLAY/PAUSE LOGIC */
  const handlePlayPause = (verse) => {
    const verseKey = verse.verse_key;

    //check ref to avoid stale closure
    if (currentAudioKeyRef.current === verseKey) {
      if (audioRef.current) {
        if (audioRef.current.paused) {
          audioRef.current.play();
          setIsPaused(false);
          if (onAudioStatusChange) onAudioStatusChange('playing');
        } else {
          audioRef.current.pause();
          setIsPaused(true);
          if (onAudioStatusChange) onAudioStatusChange('paused');
        }
      }
      return;
    }

    // load new audio
    const relativeUrl = verse.audio?.url;
    if (!relativeUrl) return;

    const audioUrl = relativeUrl.startsWith('http') ? relativeUrl : `https://verses.quran.com/${relativeUrl}`;

    setAudioLoading(true);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    const newAudio = new Audio(audioUrl);
    audioRef.current = newAudio;
    currentAudioKeyRef.current = verseKey; // update ref immediately

    newAudio.play()
      .then(() => {
        setAudioLoading(false);
        setPlayingVerseKey(verseKey);
        setIsPaused(false);
        if (onAudioStatusChange) onAudioStatusChange('playing');
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "playing";

        // --- TRACK PLAY EVENT ---
        logAnalyticsEvent('audio_play', {
          chapter_id: selectedChapter.id,
          verse_key: verseKey
        });
        // ------------------------
      })
      .catch(err => {
        console.error("Audio error:", err);
        setAudioLoading(false);
        setPlayingVerseKey(null);
        setIsPaused(false);
        if (onAudioStatusChange) onAudioStatusChange('idle');
      });

    // on end play next or finish
    newAudio.onended = () => {
      const currentList = versesRef.current;
      const currentIndex = currentList.findIndex((v) => v.verse_key === verse.verse_key);

      if (currentIndex !== -1 && currentIndex < currentList.length - 1) {
        const nextVerse = currentList[currentIndex + 1];
        handlePlayPause(nextVerse);
      }
      else {
        const isEndOfChapter = selectedChapter && (selectedChapter.verses_count === currentList.length);
        if (isEndOfChapter && onChapterEnd) {
          setPlayingVerseKey(null);
          currentAudioKeyRef.current = null;
          onChapterEnd();
        } else {
          setPlayingVerseKey(null);
          currentAudioKeyRef.current = null;
          setIsPaused(false);
          if (onAudioStatusChange) onAudioStatusChange('idle');
        }
      }
    };

    scrollToVerse(verseKey);
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  /* STYLING HELPERS */
  const shouldShowBismillah = () => {
    if (!selectedChapter) return false;
    if (startPage !== 1) return false;
    if (selectedChapter.id === 1 || selectedChapter.id === 9) return false;
    return true;
  };

  const isLight = theme === 'light';
  const triggerIndex = verses.length > 4 ? verses.length - 4 : verses.length - 1;

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto p-4 pt-20 lg:p-6 lg:pt-20 custom-scrollbar"
    >
      <div className="max-w-6xl mx-auto pb-24">

        {/* PREV BUTTON */}
        {startPage > 1 && (
          <div className="flex justify-center mb-6">
            <button
              onClick={handleLoadPrevClick}
              disabled={loadingTop}
              aria-label="Load previous verses"
              className={`
                    flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all
                    ${isLight
                  ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                  : 'bg-emerald-900/20 text-emerald-400 hover:bg-emerald-900/30'
                }
                    ${loadingTop ? 'opacity-70 cursor-not-allowed' : ''}
                  `}
            >
              {loadingTop ? (
                <LuLoaderCircle size={16} className="animate-spin" aria-hidden="true" />
              ) : (
                <FaArrowUp size={16} aria-hidden="true" />
              )}
              {loadingTop ? 'Loading...' : 'Load Previous Verses'}
            </button>
          </div>
        )}

        {/* BISMILLAH HEADER */}
        {shouldShowBismillah() && (
          <div className="flex flex-col items-center justify-center py-8 pb-12 select-none">
            <img
              src={bismillah}
              alt="Bismillahir Rahmanir Raheem"
              className={`
                h-12 md:h-16 w-auto transition-all duration-300 
                ${isLight ? 'brightness-0 opacity-80' : 'brightness-0 invert opacity-90'}
              `}
            />
          </div>
        )}

        {/* VERSE LIST */}
        <div className="space-y-4 mb-4">

          {loading && verses.length === 0 && (
            <>
              {/* skeleton loader */}
              <SkeletonLoader theme={theme} variant="verse" />
              <SkeletonLoader theme={theme} variant="verse" />
              <SkeletonLoader theme={theme} variant="verse" />
              <SkeletonLoader theme={theme} variant="verse" />
            </>
          )}

          {verses.map((verse, index) => {
            const isPlayingVerse = playingVerseKey === verse.verse_key;

            return (
              <VerseCard
                key={verse.verse_key}
                verse={verse}
                theme={theme}
                isPlaying={isPlayingVerse}
                isPaused={isPaused}
                audioLoading={audioLoading}
                bookmarks={bookmarks}
                onToggleBookmark={onToggleBookmark}
                onPlayPause={() => handlePlayPause(verse)}
                fontSize={fontSize}
                showTranslation={showTranslation}
                showTransliteration={showTransliteration}
                onlyTranslation={onlyTranslation}
                // scroll ref hook
                ref={(el) => {
                  verseRefs.current[verse.verse_key] = el;
                  // Tag element with data attribute for the reading-position observer
                  if (el) el.dataset.verseKey = verse.verse_key;
                  if (index === triggerIndex) {
                    lastVerseElementRef(el);
                  }
                }}
              />
            );
          })}
        </div>

        {/* BOTTOM LOADING */}
        <div
          className={`flex items-center justify-center w-full transition-all duration-300 ${loading ? 'h-24 py-4' : 'h-6'}`}
        >
          {loading && verses.length > 0 && (
            <div className={`w-16 h-16 rounded-full flex items-center justify-center animate-pulse ${isLight ? 'bg-stone-300' : 'bg-gray-800'}`}>
              <img src={logo} alt="Loading more verses" className="w-8 h-8 opacity-50" />
            </div>
          )}
        </div>

        {/* CHAPTER NAV */}
        {!loading && page >= totalPages && verses.length > 0 && (
          <ChapterNavigation
            selectedChapter={selectedChapter}
            onNavigate={onChapterNavigate}
            onScrollToTop={scrollToTop}
            theme={theme}
          />
        )}

      </div>
    </div>
  );
}

export default VerseList;