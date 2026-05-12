import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import VerseList from './Components/VerseList';
import Header from './Components/Header';
import InitialScreen from './Components/InitialScreen';
import { fetchWithCache, DB_STORES } from './utils/db';
import { fetchChapters, fetchVerses } from './utils/api';
import { setupTokenRefresh } from './utils/auth';
import brandLogo from './assets/brandLogo.svg';

// IMPORT ANALYTICS
import { logAnalyticsEvent } from './firebase';

const SettingsModal = lazy(() => import('./Components/SettingsModal'));
const SurahInfoModal = lazy(() => import('./Components/SurahInfoModal'));

function App() {
  // HELPERS
  const getInitialBookmarks = () => {
    try {
      const saved = localStorage.getItem('app-bookmarks');
      if (saved) return JSON.parse(saved);
      // Fallback for migration
      const oldSaved = localStorage.getItem('app-bookmark');
      if (oldSaved) {
        const parsed = JSON.parse(oldSaved);
        return parsed ? [parsed] : [];
      }
      return [];
    } catch { return []; }
  };

  // Continue Reading: always uses independently-tracked last chapter/page
  const getInitialChapter = () => {
    try {
      const saved = localStorage.getItem('app-lastChapter');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  };

  const getInitialPage = () => {
    try {
      const chapterSaved = localStorage.getItem('app-lastChapter');
      const pageSaved = localStorage.getItem('app-lastPage');
      if (chapterSaved && pageSaved) {
        const chapter = JSON.parse(chapterSaved);
        const { chapterId, page } = JSON.parse(pageSaved);
        if (chapterId === chapter.id) return page;
      }
    } catch { /* ignore */ }
    return 1;
  };

  // APP STATE
  const [bookmarks, setBookmarks] = useState(getInitialBookmarks);
  const [chapters, setChapters] = useState([]);

  const [selectedChapter, setSelectedChapter] = useState(getInitialChapter);
  const [page, setPage] = useState(getInitialPage);
  const [startPage, setStartPage] = useState(getInitialPage);
  const [verses, setVerses] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [targetVerse, setTargetVerse] = useState(null); // no auto-scroll on load; initial screen handles nav

  const [loadingChapters, setLoadingChapters] = useState(true);
  const [loadingVerses, setLoadingVerses] = useState(false);
  const [loadingTop, setLoadingTop] = useState(false);

  const [audioStatus, setAudioStatus] = useState('idle');
  const stopAudioTrigger = useRef(() => { });
  const [shouldAutoPlay, setShouldAutoPlay] = useState(false);

  const [isHomeView, setIsHomeView] = useState(true); // always start on initial screen
  const [fetchKey, setFetchKey] = useState(0); // bump to force verse refetch
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [userMenuView, setUserMenuView] = useState('menu');
  const [showSplash, setShowSplash] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

  const [theme, setTheme] = useState(() => localStorage.getItem('app-theme') || 'light');

  const [showTranslation, setShowTranslation] = useState(() => {
    const saved = localStorage.getItem('app-showTranslation');
    return saved !== null ? saved === 'true' : true;
  });

  const [showTransliteration, setShowTransliteration] = useState(() => {
    const saved = localStorage.getItem('app-showTransliteration');
    return saved !== null ? saved === 'true' : false;
  });

  const [onlyTranslation, setOnlyTranslation] = useState(() => {
    const saved = localStorage.getItem('app-onlyTranslation');
    return saved !== null ? saved === 'true' : false;
  });

  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem('app-fontSize');
    return saved ? parseInt(saved, 10) : 3;
  });

  // EFFECTS
  useEffect(() => { localStorage.setItem('app-theme', theme); }, [theme]);
  useEffect(() => { localStorage.setItem('app-showTranslation', showTranslation); }, [showTranslation]);
  useEffect(() => { localStorage.setItem('app-showTransliteration', showTransliteration); }, [showTransliteration]);
  useEffect(() => { localStorage.setItem('app-onlyTranslation', onlyTranslation); }, [onlyTranslation]);
  useEffect(() => { localStorage.setItem('app-fontSize', fontSize); }, [fontSize]);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setIsFadingOut(true), 500);
    const removeTimer = setTimeout(() => setShowSplash(false), 800); // 500 + 300 duration
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  // Set up background token refresh
  useEffect(() => {
    setupTokenRefresh();
  }, []);

  // Persist last-read page (scoped to the current chapter)
  useEffect(() => {
    if (selectedChapter) {
      localStorage.setItem('app-lastPage', JSON.stringify({ chapterId: selectedChapter.id, page }));
    }
  }, [selectedChapter, page]);

  useEffect(() => {
    localStorage.setItem('app-bookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  // --- UPDATED ANALYTICS LOGIC ---
  useEffect(() => {
    let title = "DHAKIR";
    let path = '/';
    let chapterName = 'Home';

    // Check if a chapter is actually selected
    if (selectedChapter && !isHomeView) {
      title = `Surah ${selectedChapter.name_simple} | DHAKIR`;
      path = `/surah/${selectedChapter.id}`;
      chapterName = selectedChapter.name_simple;
    }

    document.title = title;

    logAnalyticsEvent('page_view', {
      page_title: title,
      page_path: path,
      chapter_name: chapterName
    });
  }, [selectedChapter, isHomeView]);
  // --------------------------------

  const contentTopRef = useRef(null);

  // 1. FETCH CHAPTERS
  useEffect(() => {
    setLoadingChapters(true);
    fetchWithCache(DB_STORES.CHAPTERS, 'all_chapters', fetchChapters)
      .then(data => {
        const chapterList = data.chapters || data;
        setChapters(chapterList || []);
        setLoadingChapters(false);
      })
      .catch(err => {
        console.error(err);
        setLoadingChapters(false);
      });
  }, []);

  // 2. FETCH VERSES
  useEffect(() => {
    if (!selectedChapter) return;
    const controller = new AbortController();

    if (page === 1 && verses.length === 0 && contentTopRef.current && !targetVerse) {
      contentTopRef.current.scrollTop = 0;
    }

    setLoadingVerses(true);

    const cacheKey = `verse_${selectedChapter.id}_page_${page}`;
    const fetcher = () => fetchVerses(selectedChapter.id, page);

    fetchWithCache(DB_STORES.VERSES, cacheKey, fetcher)
      .then(data => {
        if (controller.signal.aborted) return;

        const fetchedVerses = data.verses || [];
        const meta = data.pagination || {};
        setTotalPages(meta.total_pages || 1);

        setVerses(prev => {
          if (prev.length === 0) return fetchedVerses;
          const existingIds = new Set(prev.map(v => v.id));
          const uniqueNewVerses = fetchedVerses.filter(v => !existingIds.has(v.id));

          const lastVerse = prev[prev.length - 1];
          const firstNew = uniqueNewVerses[0];

          if (lastVerse && firstNew) {
            const lastId = parseInt(lastVerse.verse_key.split(':')[1]);
            const nextId = parseInt(firstNew.verse_key.split(':')[1]);
            if (nextId > lastId + 1) {
              return fetchedVerses;
            }
          }
          return [...prev, ...uniqueNewVerses];
        });

        setLoadingVerses(false);
      })
      .catch(err => {
        if (err.name !== 'AbortError') setLoadingVerses(false);
      });
    return () => controller.abort();
  }, [selectedChapter, page, fetchKey]);

  // ACTIONS 
  const handleChapterSelect = (chapter) => {
    let chapterObj = chapter;
    if (typeof chapter === 'number') chapterObj = chapters.find(c => c.id === chapter);
    if (chapterObj) {
      stopAudioTrigger.current(true);

      setIsHomeView(false); // leave home screen when a chapter is chosen

      if (selectedChapter && selectedChapter.id === chapterObj.id) return;

      setVerses([]);
      setPage(1);
      setStartPage(1);
      setSelectedChapter(chapterObj);
      setTargetVerse(null);
      localStorage.setItem('app-lastChapter', JSON.stringify(chapterObj));
    }
  };

  const handleChapterEnd = () => {
    if (!selectedChapter) return;
    const nextId = selectedChapter.id === 114 ? 1 : selectedChapter.id + 1;
    handleChapterSelect(nextId);
    setShouldAutoPlay(true);
  };

  const handleVerseJump = (verseNumber) => {
    const requiredPage = Math.ceil(verseNumber / 10);
    const verseKey = `${selectedChapter.id}:${verseNumber}`;

    if (selectedChapter) {
      const isLoaded = verses.some(v => v.verse_key === verseKey);
      if (isLoaded) {
        setTargetVerse({ id: verseNumber });
        return;
      }
    }

    if (requiredPage === page + 1) {
      setTargetVerse({ id: verseNumber });
      setPage(requiredPage);
      return;
    }

    setTargetVerse({ id: verseNumber });
    setVerses([]);
    setPage(requiredPage);
    setStartPage(requiredPage);
  };

  const handleLoadPrevious = () => {
    if (startPage <= 1 || loadingTop) return;

    const prevPage = startPage - 1;
    setLoadingTop(true);

    const cacheKey = `verse_${selectedChapter.id}_page_${prevPage}`;
    const fetcher = () => fetchVerses(selectedChapter.id, prevPage);

    fetchWithCache(DB_STORES.VERSES, cacheKey, fetcher)
      .then(data => {
        const newVerses = data.verses || [];
        if (newVerses.length > 0) {
          setVerses(prev => {
            const existingIds = new Set(prev.map(v => v.id));
            const uniqueNew = newVerses.filter(v => !existingIds.has(v.id));
            return [...uniqueNew, ...prev];
          });
          setStartPage(prevPage);
        }
        setLoadingTop(false);
      })
      .catch(err => {
        console.error("Failed to load prev verses", err);
        setLoadingTop(false);
      });
  };

  const handleToggleBookmark = (verseKey, verseId) => {
    let actionType = 'add';
    setBookmarks(prev => {
      const exists = prev.some(b => b.verseKey === verseKey);
      if (exists) {
        actionType = 'remove';
        return prev.filter(b => b.verseKey !== verseKey);
      } else {
        return [...prev, {
          chapter: selectedChapter,
          verseId: verseId,
          verseKey: verseKey,
          timestamp: Date.now()
        }];
      }
    });

    logAnalyticsEvent('bookmark_toggle', {
      action: actionType,
      chapter_id: selectedChapter?.id,
      verse_key: verseKey
    });
  };

  const handleRemoveBookmark = (verseKey) => {
    setBookmarks(prev => prev.filter(b => b.verseKey !== verseKey));
    logAnalyticsEvent('bookmark_toggle', {
      action: 'remove',
      verse_key: verseKey
    });
  };

  const handleGlobalAudioClick = () => {
    if (audioStatus === 'playing') stopAudioTrigger.current(true);
    else stopAudioTrigger.current(false);
  };

  const handleLogoClick = () => {
    if (selectedChapter && !isHomeView) {
      setIsInfoOpen(true);
      logAnalyticsEvent('view_surah_info', {
        chapter_id: selectedChapter.id
      });
    }
  };

  // Home button: show initial screen without losing reading state
  const handleHomeClick = () => {
    stopAudioTrigger.current(true);
    setIsHomeView(true);
  };

  // "Continue Reading" — jump to the start of the last-read 10-verse batch
  const handleContinueReading = () => {
    if (!selectedChapter) { setIsHomeView(false); return; }

    // Read the persisted page for this chapter
    let targetPage = 1;
    try {
      const saved = localStorage.getItem('app-lastPage');
      if (saved) {
        const { chapterId, page: savedPage } = JSON.parse(saved);
        if (chapterId === selectedChapter.id) targetPage = savedPage;
      }
    } catch { /* ignore */ }

    // Reset verses so we load exactly the target batch (page = batch of 10)
    setVerses([]);
    setPage(targetPage);
    setStartPage(targetPage);
    setTargetVerse(null);   // jump to batch start, not a specific verse
    setFetchKey(k => k + 1); // always force a refetch, even if page didn't change
    setIsHomeView(false);
  };

  // "Go to AI Verse" — navigate to chapter + verse returned by AI guidance
  const handleGoToVerse = (chapterNumber, verseNumber) => {
    const chapterObj = chapters.find(c => c.id === chapterNumber);
    if (!chapterObj) return;

    const requiredPage = Math.ceil(verseNumber / 10);
    stopAudioTrigger.current(true);
    setIsHomeView(false);
    setVerses([]);
    setPage(requiredPage);
    setStartPage(requiredPage);
    setSelectedChapter(chapterObj);
    setTargetVerse({ id: verseNumber });
    localStorage.setItem('app-lastChapter', JSON.stringify(chapterObj));
  };

  // "Go to Bookmark" — navigate to bookmarked chapter + exact verse
  const handleGoToBookmark = (targetBookmark) => {
    if (!targetBookmark) return;
    const { chapter: bmChapter, verseId } = targetBookmark;
    const requiredPage = Math.ceil(verseId / 10);

    stopAudioTrigger.current(true);
    setIsHomeView(false);

    if (selectedChapter && selectedChapter.id === bmChapter.id) {
      // Already on the right chapter — just jump to the verse
      const isLoaded = verses.some(v => v.verse_key === targetBookmark.verseKey);
      if (isLoaded) {
        setTargetVerse({ id: verseId });
      } else {
        setVerses([]);
        setPage(requiredPage);
        setStartPage(requiredPage);
        setTargetVerse({ id: verseId });
      }
    } else {
      // Different chapter — switch chapter and scroll to verse
      setVerses([]);
      setPage(requiredPage);
      setStartPage(requiredPage);
      setSelectedChapter(bmChapter);
      setTargetVerse({ id: verseId });
      localStorage.setItem('app-lastChapter', JSON.stringify(bmChapter));
    }
  };

  const isLight = theme === 'light';
  const mainBgClass = isLight ? 'bg-[#f5f5f0] text-[#2b2b2b]' : 'bg-[rgb(22,22,24)] text-[rgb(252,252,252)]';

  return (
    <div className={`flex h-screen font-sans overflow-hidden transition-colors duration-300 ${mainBgClass}`}>
      {/* Splash Screen for Mobile/Tablet */}
      {showSplash && (
        <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center ${mainBgClass} transition-opacity duration-300 ease-in-out ${isFadingOut ? 'opacity-0' : 'opacity-100'}`}>
          <span className="font-serif tracking-widest text-sm mb-4">WELCOME</span>
          <img
            src={brandLogo}
            alt="Dhakir Logo"
            className="w-56 sm:w-64 h-auto opacity-90 select-none pointer-events-none"
            draggable={false}
            style={{ filter: !isLight ? 'brightness(0) invert(1)' : 'none' }}
          />
        </div>
      )}

      {/* Top-left logo for Desktop */}
      {/* {(!selectedChapter || isHomeView) && (
        <div className="fixed top-0 left-4 z-[60] pointer-events-none select-none hidden lg:block">
          <img src={brandLogo} alt="Dhakir Logo" className="h-18 w-auto opacity-90 select-none pointer-events-none"
            draggable={false}
            style={{ filter: !isLight ? 'brightness(0) invert(1)' : 'none' }}
          />
        </div>
      )} */}
      <Header
        theme={theme}
        audioStatus={audioStatus}
        handleGlobalAudioClick={handleGlobalAudioClick}
        handleLogoClick={handleLogoClick}
        onHomeClick={handleHomeClick}
        loadingChapters={loadingChapters}
        selectedChapter={selectedChapter}
        chapters={chapters}
        handleChapterSelect={handleChapterSelect}
        handleVerseJump={handleVerseJump}
        setIsSettingsOpen={setIsSettingsOpen}
        isUserMenuOpen={isUserMenuOpen}
        setIsUserMenuOpen={setIsUserMenuOpen}
        userMenuView={userMenuView}
        setUserMenuView={setUserMenuView}
        isInitialScreen={!selectedChapter || isHomeView}
      />

      <main className="flex-1 h-full flex flex-col overflow-hidden relative">
        {/* Show initial screen when no chapter selected OR user pressed Home */}
        {(!selectedChapter || isHomeView) ? (
          <InitialScreen
            theme={theme}
            lastChapter={selectedChapter}
            onContinue={handleContinueReading}
            loadingChapters={loadingChapters}
            bookmarks={bookmarks}
            onGoToBookmark={handleGoToBookmark}
            onRemoveBookmark={handleRemoveBookmark}
            onGoToVerse={handleGoToVerse}
            chapters={chapters}
            onOpenActivity={() => {
              setUserMenuView('activity');
              setIsUserMenuOpen(true);
            }}
          />
        ) : (
          <VerseList
            verses={verses}
            loading={loadingVerses}
            page={page}
            setPage={setPage}
            totalPages={totalPages}
            scrollRef={contentTopRef}
            theme={theme}
            showTranslation={showTranslation}
            showTransliteration={showTransliteration}
            onlyTranslation={onlyTranslation}
            fontSize={fontSize}
            onAudioStatusChange={setAudioStatus}
            registerStopHandler={(handler) => stopAudioTrigger.current = handler}
            selectedChapter={selectedChapter}
            onChapterNavigate={handleChapterSelect}
            onChapterEnd={handleChapterEnd}
            shouldAutoPlay={shouldAutoPlay}
            setShouldAutoPlay={setShouldAutoPlay}
            targetVerse={targetVerse}
            setTargetVerse={setTargetVerse}
            startPage={startPage}
            onLoadPrevious={handleLoadPrevious}
            loadingTop={loadingTop}
            bookmarks={bookmarks}
            onToggleBookmark={handleToggleBookmark}
          />
        )}
      </main>

      <Suspense fallback={null}>
        {isSettingsOpen && (
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            theme={theme}
            setTheme={setTheme}
            showTranslation={showTranslation}
            setShowTranslation={setShowTranslation}
            showTransliteration={showTransliteration}
            setShowTransliteration={setShowTransliteration}
            onlyTranslation={onlyTranslation}
            setOnlyTranslation={setOnlyTranslation}
            fontSize={fontSize}
            setFontSize={setFontSize}
          />
        )}

        {isInfoOpen && selectedChapter && (
          <SurahInfoModal
            isOpen={isInfoOpen}
            onClose={() => setIsInfoOpen(false)}
            chapter={selectedChapter}
            theme={theme}
          />
        )}
      </Suspense>
    </div>
  );
}

export default App;