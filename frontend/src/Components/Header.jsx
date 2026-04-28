import { useState, useEffect, useRef } from 'react';
import { FaRegUser, FaUser } from "react-icons/fa6";
import { LuSettings } from "react-icons/lu";
import { FaStop, FaPlay } from "react-icons/fa";
import { HiDotsVertical } from "react-icons/hi";
import { TiHomeOutline } from "react-icons/ti";
import logo from '/src/assets/logo.svg';
import DynamicBar from './DynamicBar';

import { initiateLogin } from '../utils/auth';

const Header = ({
  theme,
  audioStatus,
  handleGlobalAudioClick,
  handleLogoClick,
  onHomeClick,
  loadingChapters,
  selectedChapter,
  chapters,
  handleChapterSelect,
  handleVerseJump,
  setIsSettingsOpen
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const headerRef = useRef(null);

  // Close mobile menu when clicking outside the header
  useEffect(() => {
    function handleClickOutside(event) {
      if (isMobileMenuOpen && headerRef.current && !headerRef.current.contains(event.target)) {
        setIsMobileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMobileMenuOpen]);

  const isLight = theme === 'light';

  const headerBgClass = isLight
    ? 'bg-[#e7e5e4]/80 border-stone-300'
    : 'bg-[rgba(46,47,48,0.8)] border-gray-700/50';

  const isPlaying = audioStatus === 'playing';
  const controlBtnClass = isPlaying
    ? (isLight ? 'bg-red-100 text-red-600 border-1 border-amber-800' : 'bg-red-500/20 text-red-400 border-1 border-amber-700')
    : (isLight ? 'bg-emerald-100 text-emerald-600 border-1 border-emerald-300' : 'bg-emerald-500/20 text-emerald-400 border-1 border-emerald-500/50');

  return (
    <div
      ref={headerRef}
      className={`fixed top-2 md:bottom-auto md:top-2 left-1/2 -translate-x-1/2 z-50 w-[95%] md:w-[90%] max-w-4xl rounded-3xl
                    bg-white/10 dark:bg-neutral-600/50 
                    backdrop-blur-sm backdrop-saturate-150
                    border border-white/20 dark:border-white/10
                    shadow-[0_8px_32px_0_rgba(31,38,135,0.2)] 
                    dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.4)]
                    px-1 py-2 lg:px-2 lg:py-2 pt-1
                    flex items-center justify-between gap-0.5 transition-all duration-300 ${headerBgClass}`}>

      {/* LEFT: LOGO */}
      <div className="w-10 md:w-auto shrink-0 flex items-center justify-start z-20">
        <div className="md:hidden">
          {audioStatus !== 'idle' ? (
            <button
              onClick={handleGlobalAudioClick}
              aria-label={audioStatus === 'playing' ? "Stop Audio" : "Play Audio"}
              className={`w-8 h-8 rounded-full translate-x-1 flex items-center justify-center animate-in fade-in zoom-in duration-200 ${controlBtnClass}`}
            >
              {audioStatus === 'playing' ? <FaStop size={16} fill="currentColor" aria-hidden="true" /> : <FaPlay size={16} fill="currentColor" className="ml-0.5" aria-hidden="true" />}
            </button>
          ) : (
            <button
              onClick={handleLogoClick}
              className="hover:scale-105 active:scale-95 transition-transform cursor-pointer focus:outline-none flex items-center translate-x-0.5"
            >
              <img src={logo} alt="Al-Qur'an Logo" className="w-10 h-10 block" />
            </button>
          )}
        </div>

        {/* Desktop Logo */}
        <div className="hidden md:block">
          <button
            onClick={handleLogoClick}
            className="hover:scale-105 active:scale-95 transition-transform cursor-pointer focus:outline-none flex items-center translate-x-0.5"
          >
            <img src={logo} alt="Al-Qur'an Logo" className="w-11 h-11 block" />
          </button>
        </div>
      </div>

      {/* CENTER: DYNAMIC BAR */}
      <div className="flex-1 flex justify-center z-30 pointer-events-none min-w-0">
        <div className="pointer-events-auto flex items-center justify-center gap-1 w-full max-w-[500px]">

          {/* Desktop Audio Button */}
          <div className={`
             hidden md:flex items-center justify-center mr-0 shrink-0
             transition-all duration-300 ease-out transform
             ${audioStatus !== 'idle' ? 'opacity-100 translate-x-0 scale-100' : 'opacity-0 translate-x-4 scale-75 pointer-events-none'}
          `}>
            <button
              onClick={handleGlobalAudioClick}
              className={`w-9 h-9 rounded-full -translate-x-6 flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform ${controlBtnClass}`}
            >
              {audioStatus === 'playing' ? <FaStop size={16} fill="currentColor" /> : <FaPlay size={16} fill="currentColor" className="ml-0.5" />}
            </button>
          </div>

          <div className="w-full min-w-0">
            {loadingChapters && !selectedChapter ? (
              <div className="h-11 w-full bg-[#1a1b1d] border border-white/5 rounded-2xl animate-pulse flex items-center justify-center">
                <div className="h-2 w-12 bg-gray-700 rounded-full opacity-50"></div>
              </div>
            ) : (
              <DynamicBar
                chapters={chapters}
                selectedChapter={selectedChapter}
                onSelect={handleChapterSelect}
                onVerseJump={handleVerseJump}
                isMobileMenuOpen={isMobileMenuOpen}
                onHomeClick={() => {
                  setIsMobileMenuOpen(false);
                  onHomeClick();
                }}
                onSettingsClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsSettingsOpen(true);
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* RIGHT: HOME + SETTINGS */}
      <div className="shrink-0 flex items-center justify-end gap-1 z-20">

        {/* Mobile: dots menu toggle */}
        <button
          onClick={() => setIsMobileMenuOpen((v) => !v)}
          className={`md:hidden p-2 rounded-full transition-colors ${isLight ? 'hover:bg-stone-300 text-stone-700' : 'hover:bg-gray-700 text-gray-300'}`}
          aria-label="Toggle mobile menu"
        >
          <HiDotsVertical size={22} aria-hidden="true" />
        </button>

        {/* Desktop: individual buttons */}
        <button
          onClick={onHomeClick}
          className={`hidden md:flex p-2 rounded-full transition-colors ${isLight ? 'hover:bg-stone-300 text-stone-700' : 'hover:bg-gray-700 text-gray-300'}`}
          aria-label="Go to Home"
        >
          <TiHomeOutline size={24} aria-hidden="true" />
        </button>
        <button
          onClick={() => setIsSettingsOpen(true)}
          className={`hidden md:flex p-2 rounded-full transition-colors ${isLight ? 'hover:bg-stone-300 text-stone-700' : 'hover:bg-gray-700 text-gray-300'}`}
          aria-label="Open Settings"
        >
          <LuSettings size={24} aria-hidden="true" />
        </button>

        {/* LOGIN BUTTON */}
        <button
          onClick={initiateLogin}
          className={`hidden md:flex p-2 rounded-full transition-colors ${isLight ? 'hover:bg-stone-300 text-stone-700' : 'hover:bg-gray-700 text-gray-300'}`}
          aria-label="Login to Quran.Foundation"
        >
          <FaRegUser size={20} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

export default Header;