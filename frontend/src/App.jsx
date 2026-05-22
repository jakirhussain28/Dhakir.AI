import { useState, useEffect, useRef, lazy, Suspense, useCallback } from 'react';
import VerseList from './Components/VerseList';
import Header from './Components/Header';
import InitialScreen from './Components/InitialScreen';
import { fetchWithCache, DB_STORES } from './utils/db';
import { fetchChapters, fetchVerses, fetchCollectionBookmarks, addCollectionBookmark, deleteCollectionBookmark, fetchUserProfile } from './utils/api';
import { setupTokenRefresh, isAuthenticated } from './utils/auth';
import { getUserData, setUserData, migrateFromLocalStorage, USER_KEYS } from './utils/userDb';
import brandLogo from './assets/brandLogo.svg';

// IMPORT ANALYTICS
import { logAnalyticsEvent } from './firebase';

const SettingsModal = lazy(() => import('./Components/SettingsModal'));
const SurahInfoModal = lazy(() => import('./Components/SurahInfoModal'));

function App() {
  // ── AUTH STATE ──────────────────────────────────────────────────────────────
  const [loggedIn, setLoggedIn] = useState(isAuthenticated);

  // ── APP STATE ──────────────────────────────────────────────────────────────
  // Bookmarks: completely separate local vs online spaces
  const [localBookmarks, setLocalBookmarks] = useState([]);
  const [onlineBookmarks, setOnlineBookmarks] = useState([]);

  // Derived: the active bookmarks depend on auth state
  const bookmarks = loggedIn ? onlineBookmarks : localBookmarks;

  const [chapters, setChapters] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [page, setPage] = useState(1);
  const [startPage, setStartPage] = useState(1);
  const [verses, setVerses] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [targetVerse, setTargetVerse] = useState(null);

  const [loadingChapters, setLoadingChapters] = useState(true);
  const [loadingVerses, setLoadingVerses] = useState(false);
  const [loadingTop, setLoadingTop] = useState(false);

  const [audioStatus, setAudioStatus] = useState('idle');
  const stopAudioTrigger = useRef(() => { });
  const [shouldAutoPlay, setShouldAutoPlay] = useState(false);

  const [isHomeView, setIsHomeView] = useState(true);
  const [fetchKey, setFetchKey] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [userMenuView, setUserMenuView] = useState('menu');
  const [showSplash, setShowSplash] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

  // App-level preferences (shared, NOT user-scoped — stay in localStorage)
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

  // Track whether initial load from IndexedDB is done
  const [userDbReady, setUserDbReady] = useState(false);

  // Guard: only persist local bookmarks after they've actually been loaded from
  // localUserDB.  This prevents the persist-effect from writing an empty []
  // into localUserDB while the user is logged in (which would wipe saved local
  // bookmarks on next logout).
  const localBookmarksLoaded = useRef(false);

  // ── PERSIST APP PREFERENCES (localStorage — theme-level, not user data) ──
  useEffect(() => { localStorage.setItem('app-theme', theme); }, [theme]);
  useEffect(() => { localStorage.setItem('app-showTranslation', showTranslation); }, [showTranslation]);
  useEffect(() => { localStorage.setItem('app-showTransliteration', showTransliteration); }, [showTransliteration]);
  useEffect(() => { localStorage.setItem('app-onlyTranslation', onlyTranslation); }, [onlyTranslation]);
  useEffect(() => { localStorage.setItem('app-fontSize', fontSize); }, [fontSize]);

  // ── SPLASH SCREEN ──────────────────────────────────────────────────────────
  useEffect(() => {
    const fadeTimer = setTimeout(() => setIsFadingOut(true), 500);
    const removeTimer = setTimeout(() => setShowSplash(false), 800);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  // ── TOKEN REFRESH & AUTH SYNC ──────────────────────────────────────────────
  useEffect(() => {
    setupTokenRefresh();
    const onStorage = () => setLoggedIn(isAuthenticated());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Re-check auth when toggling home view (e.g. returning from callback)
  useEffect(() => {
    setLoggedIn(isAuthenticated());
  }, [isHomeView]);

  // ── LOAD USER DATA FROM IndexedDB ON MOUNT & AUTH CHANGE ───────────────────
  // This replaces all the old localStorage getInitial* helpers.
  // Runs once on mount (after migration) and again whenever loggedIn changes.
  const loadUserData = useCallback(async (isAuth) => {
    try {
      // Run one-time migration from legacy localStorage → localUserDB
      await migrateFromLocalStorage();

      const [savedBookmarks, savedChapter, savedPage, savedLastRead] = await Promise.all([
        getUserData(USER_KEYS.BOOKMARKS, isAuth),
        getUserData(USER_KEYS.LAST_CHAPTER, isAuth),
        getUserData(USER_KEYS.LAST_PAGE, isAuth),
        getUserData(USER_KEYS.LAST_READ_VERSE, isAuth),
      ]);

      if (!isAuth) {
        // LOCAL mode — populate localBookmarks from localUserDB
        setLocalBookmarks(Array.isArray(savedBookmarks) ? savedBookmarks : []);
        localBookmarksLoaded.current = true;
      } else {
        localBookmarksLoaded.current = false;
      }
      // (Online bookmarks are fetched from the API — see separate effect)

      if (savedChapter) {
        setSelectedChapter(savedChapter);
      }

      if (savedChapter && savedPage && savedPage.chapterId === savedChapter.id) {
        setPage(savedPage.page);
        setStartPage(savedPage.page);
      } else {
        setPage(1);
        setStartPage(1);
      }

      // Last-read verse is stored in userDb now (ContinueReadingBox reads it via getLastReadVerse)

      setUserDbReady(true);
    } catch (err) {
      console.error('[App] Failed to load user data from IndexedDB:', err);
      setUserDbReady(true); // still mark ready so the app isn't stuck
    }
  }, []);

  // Initial load + re-load when auth changes
  useEffect(() => {
    loadUserData(loggedIn);
  }, [loggedIn, loadUserData]);

  // ── PERSIST USER DATA TO IndexedDB ─────────────────────────────────────────

  // Persist last-read page (scoped to the current chapter)
  useEffect(() => {
    if (selectedChapter && userDbReady) {
      setUserData(USER_KEYS.LAST_PAGE, { chapterId: selectedChapter.id, page }, loggedIn);
    }
  }, [selectedChapter, page, loggedIn, userDbReady]);

  // Persist LOCAL bookmarks to localUserDB (online bookmarks live on the server)
  useEffect(() => {
    if (userDbReady && localBookmarksLoaded.current) {
      setUserData(USER_KEYS.BOOKMARKS, localBookmarks, false);
    }
  }, [localBookmarks, userDbReady]);

  // ── FETCH ONLINE BOOKMARKS when logged in ──────────────────────────────────
  const hasFetchedOnlineBookmarks = useRef(false);

  useEffect(() => {
    if (!loggedIn) {
      setOnlineBookmarks([]);
      hasFetchedOnlineBookmarks.current = false;
      return;
    }

    if (hasFetchedOnlineBookmarks.current) return;

    let cancelled = false;
    const loadOnlineBookmarks = async () => {
      try {
        const apiBookmarks = await fetchCollectionBookmarks();
        if (cancelled) return;

        const mapped = apiBookmarks.map(bm => ({
          chapter: { id: bm.key, name_simple: '' },
          verseId: bm.verseNumber,
          verseKey: `${bm.key}:${bm.verseNumber}`,
          timestamp: bm.createdAt ? new Date(bm.createdAt).getTime() : Date.now(),
          _apiId: bm.id,
        }));

        setOnlineBookmarks(mapped);
        hasFetchedOnlineBookmarks.current = true;
      } catch (err) {
        console.error('Failed to fetch online bookmarks:', err);
      }
    };

    loadOnlineBookmarks();
    return () => { cancelled = true; };
  }, [loggedIn]);

  // ── FETCH USER PROFILE when logged in ──────────────────────────────────────
  useEffect(() => {
    if (!loggedIn) return;
    
    let retryCount = 0;
    const maxRetries = 3;
    let timeoutId;

    const loadProfile = async () => {
      try {
        const data = await fetchUserProfile();
        const profileData = data?.data ?? data;
        if (profileData) {
          setUserData(USER_KEYS.PROFILE, profileData, true);
        }
      } catch (err) {
        console.error(`Failed to fetch and save user profile (attempt ${retryCount + 1}):`, err);
        if (retryCount < maxRetries) {
          retryCount++;
          // Exponential backoff: 2s, 4s, 6s
          timeoutId = setTimeout(loadProfile, 2000 * retryCount); 
        }
      }
    };

    loadProfile();

    return () => clearTimeout(timeoutId);
  }, [loggedIn]);


  // Enrich online bookmarks with chapter names once chapters load
  useEffect(() => {
    if (chapters.length === 0 || onlineBookmarks.length === 0) return;

    setOnlineBookmarks(prev => {
      let changed = false;
      const enriched = prev.map(bm => {
        if (bm.chapter.name_simple) return bm;
        const ch = chapters.find(c => c.id === bm.chapter.id);
        if (ch) {
          changed = true;
          return { ...bm, chapter: ch };
        }
        return bm;
      });
      return changed ? enriched : prev;
    });
  }, [chapters, onlineBookmarks.length]);

  // --- ANALYTICS ---
  useEffect(() => {
    let title = "DHAKIR";
    let path = '/';
    let chapterName = 'Home';

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

      setIsHomeView(false);

      if (selectedChapter && selectedChapter.id === chapterObj.id) return;

      setVerses([]);
      setPage(1);
      setStartPage(1);
      setSelectedChapter(chapterObj);
      setTargetVerse(null);
      // Persist to the active user DB
      setUserData(USER_KEYS.LAST_CHAPTER, chapterObj, loggedIn);
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
    const [chapterStr, verseStr] = verseKey.split(':');
    const chapterNum = parseInt(chapterStr, 10);
    const verseNum = parseInt(verseStr, 10);
    const exists = bookmarks.some(b => b.verseKey === verseKey);

    if (loggedIn) {
      // ── ONLINE MODE: sync with Quran Foundation API ──
      if (exists) {
        const target = onlineBookmarks.find(b => b.verseKey === verseKey);
        const apiId = target?._apiId;
        // Optimistic remove
        setOnlineBookmarks(prev => prev.filter(b => b.verseKey !== verseKey));
        if (apiId) {
          deleteCollectionBookmark(apiId).catch(err => {
            console.error('Failed to delete online bookmark:', err);
            // Rollback on failure — re-fetch
            fetchCollectionBookmarks().then(apiBookmarks => {
              const mapped = apiBookmarks.map(bm => ({
                chapter: chapters.find(c => c.id === bm.key) || { id: bm.key, name_simple: '' },
                verseId: bm.verseNumber,
                verseKey: `${bm.key}:${bm.verseNumber}`,
                timestamp: bm.createdAt ? new Date(bm.createdAt).getTime() : Date.now(),
                _apiId: bm.id,
              }));
              setOnlineBookmarks(mapped);
            }).catch(() => {});
          });
        }
      } else {
        // Optimistic add
        setOnlineBookmarks(prev => [...prev, {
          chapter: selectedChapter,
          verseId: verseId,
          verseKey: verseKey,
          timestamp: Date.now(),
        }]);
        addCollectionBookmark(chapterNum, verseNum).catch(err => {
          console.error('Failed to add online bookmark:', err);
          // Rollback on failure
          setOnlineBookmarks(prev => prev.filter(b => b.verseKey !== verseKey));
        });
      }
    } else {
      // ── LOCAL MODE: IndexedDB only ──
      if (exists) {
        setLocalBookmarks(prev => prev.filter(b => b.verseKey !== verseKey));
      } else {
        setLocalBookmarks(prev => [...prev, {
          chapter: selectedChapter,
          verseId: verseId,
          verseKey: verseKey,
          timestamp: Date.now(),
        }]);
      }
    }

    logAnalyticsEvent('bookmark_toggle', {
      action: exists ? 'remove' : 'add',
      chapter_id: selectedChapter?.id,
      verse_key: verseKey,
      mode: loggedIn ? 'online' : 'local',
    });
  };

  const handleRemoveBookmark = (verseKey) => {
    const [chapterStr, verseStr] = verseKey.split(':');
    const chapterNum = parseInt(chapterStr, 10);
    const verseNum = parseInt(verseStr, 10);

    if (loggedIn) {
      const target = onlineBookmarks.find(b => b.verseKey === verseKey);
      const apiId = target?._apiId;
      // Optimistic remove
      setOnlineBookmarks(prev => prev.filter(b => b.verseKey !== verseKey));
      if (apiId) {
        deleteCollectionBookmark(apiId).catch(err => {
          console.error('Failed to delete online bookmark:', err);
        });
      }
    } else {
      setLocalBookmarks(prev => prev.filter(b => b.verseKey !== verseKey));
    }

    logAnalyticsEvent('bookmark_toggle', {
      action: 'remove',
      verse_key: verseKey,
      mode: loggedIn ? 'online' : 'local',
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

  // "Continue Reading" — jump to the exact last-read verse
  const handleContinueReading = async () => {
    // Read from the active user DB
    const lastRead = await getUserData(USER_KEYS.LAST_READ_VERSE, loggedIn);

    if (!lastRead && !selectedChapter) {
      setIsHomeView(false);
      return;
    }

    const verseId = lastRead?.verseNumber || 1;
    const requiredPage = Math.ceil(verseId / 10);
    const targetVerseKey = lastRead ? `${lastRead.chapterId}:${verseId}` : null;

    stopAudioTrigger.current(true);
    setIsHomeView(false);

    let chapterToOpen = selectedChapter;
    let isDifferentChapter = false;

    if (lastRead) {
      if (!chapterToOpen || chapterToOpen.id !== lastRead.chapterId) {
        const found = chapters.find(c => c.id === lastRead.chapterId);
        if (found) {
          chapterToOpen = found;
          isDifferentChapter = true;
        }
      }
    }

    if (!chapterToOpen) {
      return;
    }

    if (!isDifferentChapter) {
      // Already on the right chapter — just jump to the verse if loaded
      const isLoaded = targetVerseKey && verses.some(v => v.verse_key === targetVerseKey);
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
      setSelectedChapter(chapterToOpen);
      setTargetVerse({ id: verseId });
      setUserData(USER_KEYS.LAST_CHAPTER, chapterToOpen, loggedIn);
    }
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
    setUserData(USER_KEYS.LAST_CHAPTER, chapterObj, loggedIn);
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
      setUserData(USER_KEYS.LAST_CHAPTER, bmChapter, loggedIn);
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
            isLoggedIn={loggedIn}
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