import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FaUser, FaRegUser } from "react-icons/fa6";
import { IoArrowBack, IoCalendarSharp } from "react-icons/io5"; // <-- Imported IoCalendarSharp
import { TbLogout2, TbLogin2 } from "react-icons/tb";
import { logout, initiateLogin, isAuthenticated } from '../../utils/auth';
import { fetchUserProfile, updateUserProfile } from '../../utils/api';
import ActivityBox from './ActivityBox';

const UserMenuModal = ({ isOpen, onClose, theme }) => {
    const [activeView, setActiveView] = useState('menu'); // 'menu', 'profile', or 'activity'
    const [userProfile, setUserProfile] = useState(null);
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileError, setProfileError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const firstNameRef = useRef(null);
    const lastNameRef = useRef(null);

    // Fetch QF user profile from the pre-live API when modal opens
    useEffect(() => {
        if (!isOpen) return;

        const token = localStorage.getItem('access_token');
        if (!token) return;

        setProfileLoading(true);
        setProfileError(null);

        fetchUserProfile()
            .then(data => {
                setUserProfile(data?.data ?? data);
            })
            .catch(err => {
                console.error('Failed to fetch user profile:', err);
                setProfileError('Could not load profile.');
            })
            .finally(() => setProfileLoading(false));
    }, [isOpen]);

    // Close on Escape key
    useEffect(() => {
        const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
        if (isOpen) document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    // Reset view when modal closes
    useEffect(() => {
        if (!isOpen) {
            const timer = setTimeout(() => {
                setActiveView('menu');
                setSaveSuccess(false);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Lock background scroll
    useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = 'unset';
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    if (!isOpen) return null;

    const isLight = theme === 'light';

    // Increase max-width if activity view is active to ensure the calendar looks clean
    const cardBg = isLight
        ? 'bg-white border-stone-400 shadow-xl'
        : 'bg-[#121212] border-gray-500 shadow-2xl';

    const rowBase = isLight
        ? 'bg-stone-100 hover:bg-stone-200'
        : 'bg-[#192516] hover:bg-[#243524]';

    const formRowBg = isLight ? 'bg-stone-100' : 'bg-[#192516]';
    const inputBg = isLight ? 'bg-white' : 'bg-[#121212]';

    const textActive = isLight ? 'text-stone-800' : 'text-gray-200';
    const textInactive = isLight ? 'text-stone-400' : 'text-gray-500';
    const labelColor = isLight ? 'text-stone-500' : 'text-gray-400';
    const iconColor = isLight ? 'text-stone-400' : 'text-gray-400';

    // Handle back logic for BOTH sub-menus
    const handleBack = () => {
        if (activeView === 'profile' || activeView === 'activity') setActiveView('menu');
        else onClose();
    };

    const handleSaveProfile = async () => {
        setIsSaving(true);
        setSaveSuccess(false);
        setProfileError(null);
        try {
            const payload = {
                firstName: firstNameRef.current?.value || '',
                lastName: lastNameRef.current?.value || '',
            };
            const updated = await updateUserProfile(payload);
            setUserProfile(prev => ({ ...prev, ...payload, ...(updated?.data ?? {}) }));
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2500);
        } catch (err) {
            console.error('Failed to save profile:', err);
            setProfileError('Failed to save. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20 backdrop-blur-[2px] animate-in fade-in duration-200 font-sans"
            onClick={onClose}
            aria-modal="true"
            role="dialog"
        >
            <div
                // Expand width dynamically when Activity view is open to fit the calendar properly
                className={`w-[90%] ${activeView === 'activity' ? 'max-w-[480px]' : 'max-w-[380px]'} rounded-4xl p-5 sm:p-6 border ${cardBg} relative transition-all duration-300`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header Row */}
                <div className="flex items-center justify-between mb-4 sm:mb-5">
                    <button
                        onClick={handleBack}
                        className={`transition-colors focus:outline-none ${iconColor}`}
                        aria-label={activeView !== 'menu' ? "Back to menu" : "Close menu"}
                    >
                        <IoArrowBack className="w-6 h-6 sm:w-7 sm:h-7 hover:scale-110 transition-transform" />
                    </button>

                    {/* dynamically swap icon based on active view */}
                    {activeView === 'activity' ? (
                        <IoCalendarSharp className={`w-5 h-5 sm:w-6 sm:h-6 ${iconColor}`} />
                    ) : isAuthenticated() ? (
                        <FaUser className={`w-5 h-5 sm:w-6 sm:h-6 ${iconColor}`} />
                    ) : (
                        <FaRegUser className={`w-5 h-5 sm:w-6 sm:h-6 ${iconColor}`} />
                    )}
                </div>

                {/* ── Menu View ── */}
                {activeView === 'menu' ? (
                    <div className="space-y-4 sm:space-y-5 animate-in slide-in-from-left-4 fade-in duration-300">
                        {isAuthenticated() && (
                            <button
                                className={`w-full ${rowBase} rounded-3xl h-16 sm:h-20 px-4 sm:px-6 flex items-center justify-center transition-colors duration-300 focus:outline-none`}
                                onClick={() => setActiveView('profile')}
                            >
                                <span className={`text-sm sm:text-base font-medium ${textActive}`}>Profile</span>
                            </button>
                        )}

                        <button
                            className={`w-full ${rowBase} rounded-3xl h-16 sm:h-20 px-4 sm:px-6 flex items-center justify-center transition-colors duration-300 focus:outline-none`}
                            onClick={() => setActiveView('activity')} // <-- Open Activity view
                        >
                            <span className={`text-sm sm:text-base font-medium ${textActive}`}>Activity</span>
                        </button>

                        {isAuthenticated() ? (
                            <button
                                className={`w-full ${rowBase} rounded-3xl h-16 sm:h-20 px-4 sm:px-6 flex items-center justify-center gap-2 transition-colors duration-300 focus:outline-none`}
                                onClick={() => { logout(); onClose(); }}
                            >
                                <TbLogout2 className={`w-5 h-5 sm:w-6 sm:h-6 ${textActive}`} />
                                <span className={`text-sm sm:text-base font-medium ${textActive}`}>Logout</span>
                            </button>
                        ) : (
                            <button
                                className={`w-full ${rowBase} rounded-3xl h-16 sm:h-20 px-4 sm:px-6 flex items-center justify-center gap-2 transition-colors duration-300 focus:outline-none`}
                                onClick={() => { initiateLogin(); onClose(); }}
                            >
                                <TbLogin2 className={`w-5 h-5 sm:w-6 sm:h-6 ${textActive}`} />
                                <span className={`text-sm sm:text-base font-medium ${textActive}`}>Log In</span>
                            </button>
                        )}
                    </div>

                ) : activeView === 'profile' ? (
                    /* ── Profile View ── */
                    <div className="animate-in slide-in-from-right-4 fade-in duration-300">
                        {profileLoading ? (
                            <div className={`text-center py-8 text-sm ${textInactive}`}>Loading profile…</div>
                        ) : (
                            <div className="space-y-3 sm:space-y-4">
                                <div className={`w-full ${formRowBg} rounded-2xl h-14 sm:h-16 px-3 flex items-center`}>
                                    <span className={`w-24 sm:w-28 text-sm sm:text-base font-medium pl-1 sm:pl-2 ${labelColor}`}>Email</span>
                                    <input type="text" value={userProfile?.email || '—'} disabled className={`flex-1 h-10 sm:h-11 px-3 sm:px-4 rounded-xl text-sm sm:text-base outline-none ${inputBg} ${textInactive}`} />
                                </div>
                                <div className={`w-full ${formRowBg} rounded-2xl h-14 sm:h-16 px-3 flex items-center`}>
                                    <span className={`w-24 sm:w-28 text-sm sm:text-base font-medium pl-1 sm:pl-2 ${labelColor}`}>Username</span>
                                    <input type="text" value={userProfile?.username || '—'} disabled className={`flex-1 h-10 sm:h-11 px-3 sm:px-4 rounded-xl text-sm sm:text-base outline-none ${inputBg} ${textInactive}`} />
                                </div>
                                <div className={`w-full ${formRowBg} rounded-2xl h-14 sm:h-16 px-3 flex items-center`}>
                                    <span className={`w-24 sm:w-28 text-sm sm:text-base font-medium pl-1 sm:pl-2 ${labelColor}`}>First Name</span>
                                    <input ref={firstNameRef} type="text" defaultValue={userProfile?.firstName || ''} className={`flex-1 h-10 sm:h-11 px-3 sm:px-4 rounded-xl text-sm sm:text-base outline-none ${inputBg} ${textActive} focus:ring-1 focus:ring-emerald-500`} />
                                </div>
                                <div className={`w-full ${formRowBg} rounded-2xl h-14 sm:h-16 px-3 flex items-center`}>
                                    <span className={`w-24 sm:w-28 text-sm sm:text-base font-medium pl-1 sm:pl-2 ${labelColor}`}>Last Name</span>
                                    <input ref={lastNameRef} type="text" defaultValue={userProfile?.lastName || ''} className={`flex-1 h-10 sm:h-11 px-3 sm:px-4 rounded-xl text-sm sm:text-base outline-none ${inputBg} ${textActive} focus:ring-1 focus:ring-emerald-500`} />
                                </div>
                                {profileError && <p className="text-red-400 text-xs text-center">{profileError}</p>}
                                <div className="mt-6 sm:mt-8 flex justify-center">
                                    <button onClick={handleSaveProfile} disabled={isSaving} className={`px-6 py-2.5 sm:px-8 sm:py-3 rounded-xl font-medium transition-colors duration-300 text-sm sm:text-base text-white ${saveSuccess ? 'bg-emerald-600 cursor-default' : 'bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed'}`}>
                                        {isSaving ? 'Saving…' : saveSuccess ? 'Saved ✓' : 'Save Changes'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    /* ── Activity View ── */
                    <div className="animate-in slide-in-from-right-4 fade-in duration-300">
                        <ActivityBox isLight={isLight} />
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

export default UserMenuModal;