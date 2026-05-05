import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaUser } from "react-icons/fa6";
import { IoArrowBack } from "react-icons/io5";
import { TbLogout2 } from "react-icons/tb";
import { logout, getUserProfile } from '../../utils/auth';

const UserMenuModal = ({ isOpen, onClose, theme }) => {
    const [activeView, setActiveView] = useState('menu'); // 'menu' or 'profile'
    const [userProfile, setUserProfile] = useState(null);

    // Fetch user profile on mount
    useEffect(() => {
        if (isOpen) {
            const profile = getUserProfile();
            setUserProfile(profile);
        }
    }, [isOpen]);

    // Close on Escape key
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    // Reset view when modal closes
    useEffect(() => {
        if (!isOpen) {
            const timer = setTimeout(() => setActiveView('menu'), 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    /* LOCK SCROLL */
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'; // prevent bg scroll
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    if (!isOpen) return null;

    const isLight = theme === 'light';

    const cardBg = isLight
        ? 'bg-white border-stone-400 shadow-xl'
        : 'bg-[#121212] border-gray-500 shadow-2xl';

    const rowBase = isLight
        ? 'bg-stone-100 hover:bg-stone-200'
        : 'bg-[#192516] hover:bg-[#243524]';

    const formRowBg = isLight ? 'bg-stone-100' : 'bg-[#192516]';
    const inputBg = isLight ? 'bg-white' : 'bg-[#121212]';

    /* FONT COLORS SYNced WITH SETTINGS MODAL */
    const textActive = isLight ? 'text-stone-800' : 'text-gray-200';
    const textInactive = isLight ? 'text-stone-400' : 'text-gray-500';
    const labelColor = isLight ? 'text-stone-500' : 'text-gray-400';
    const iconColor = isLight ? 'text-stone-400' : 'text-gray-400';

    const inputTextColor = textInactive; // For immutable
    const activeInputText = textActive;  // For mutable

    const handleBack = () => {
        if (activeView === 'profile') {
            setActiveView('menu');
        } else {
            onClose();
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
                className={`w-[90%] max-w-[380px] rounded-4xl p-5 sm:p-6 border ${cardBg} 
                            relative transition-colors duration-300`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header Row: Back + User Icon */}
                <div className="flex items-center justify-between mb-4 sm:mb-5">
                    <button
                        onClick={handleBack}
                        className={`transition-colors focus:outline-none ${iconColor}`}
                        aria-label={activeView === 'profile' ? "Back to menu" : "Close menu"}
                    >
                        <IoArrowBack className="w-6 h-6 sm:w-7 sm:h-7 hover:scale-110 transition-transform" />
                    </button>
                    <FaUser className={`w-5 h-5 sm:w-6 sm:h-6 ${iconColor}`} />
                </div>

                {/* Content based on activeView */}
                {activeView === 'menu' ? (
                    <div className="space-y-4 sm:space-y-5 animate-in slide-in-from-left-4 fade-in duration-300">
                        <button
                            className={`w-full ${rowBase} rounded-3xl h-16 sm:h-20 px-4 sm:px-6 flex items-center justify-center transition-colors duration-300 focus:outline-none`}
                            onClick={() => setActiveView('profile')}
                        >
                            <span className={`text-sm sm:text-base font-medium ${textActive}`}>Profile</span>
                        </button>

                        <button
                            className={`w-full ${rowBase} rounded-3xl h-16 sm:h-20 px-4 sm:px-6 flex items-center justify-center transition-colors duration-300 focus:outline-none`}
                            onClick={() => {
                                // Placeholder for Streak action
                                onClose();
                            }}
                        >
                            <span className={`text-sm sm:text-base font-medium ${textActive}`}>Streak</span>
                        </button>

                        <button
                            className={`w-full ${rowBase} rounded-3xl h-16 sm:h-20 px-4 sm:px-6 flex items-center justify-center gap-2 transition-colors duration-300 focus:outline-none`}
                            onClick={() => {
                                logout();
                                onClose();
                            }}
                        >
                            <TbLogout2 className={`w-5 h-5 sm:w-6 sm:h-6 ${textActive}`} />
                            <span className={`text-sm sm:text-base font-medium ${textActive}`}>Logout</span>
                        </button>
                    </div>
                ) : (
                    <div className="animate-in slide-in-from-right-4 fade-in duration-300">
                        <div className="space-y-3 sm:space-y-4">
                            <div className={`w-full ${formRowBg} rounded-2xl h-14 sm:h-16 px-3 flex items-center`}>
                                <span className={`w-24 sm:w-28 text-sm sm:text-base font-medium pl-1 sm:pl-2 ${labelColor}`}>Email</span>
                                <input
                                    type="text"
                                    value={userProfile?.email || "No Email"}
                                    disabled
                                    className={`flex-1 h-10 sm:h-11 px-3 sm:px-4 rounded-xl text-sm sm:text-base outline-none ${inputBg} ${inputTextColor}`}
                                />
                            </div>

                            <div className={`w-full ${formRowBg} rounded-2xl h-14 sm:h-16 px-3 flex items-center`}>
                                <span className={`w-24 sm:w-28 text-sm sm:text-base font-medium pl-1 sm:pl-2 ${labelColor}`}>Username</span>
                                <input
                                    type="text"
                                    value={userProfile?.preferred_username || userProfile?.nickname || userProfile?.name || "No Username"}
                                    disabled
                                    className={`flex-1 h-10 sm:h-11 px-3 sm:px-4 rounded-xl text-sm sm:text-base outline-none ${inputBg} ${inputTextColor}`}
                                />
                            </div>

                            <div className={`w-full ${formRowBg} rounded-2xl h-14 sm:h-16 px-3 flex items-center`}>
                                <span className={`w-24 sm:w-28 text-sm sm:text-base font-medium pl-1 sm:pl-2 ${labelColor}`}>First Name</span>
                                <input
                                    type="text"
                                    defaultValue={userProfile?.given_name || ""}
                                    className={`flex-1 h-10 sm:h-11 px-3 sm:px-4 rounded-xl text-sm sm:text-base outline-none ${inputBg} ${activeInputText} focus:ring-1 focus:ring-emerald-500`}
                                />
                            </div>

                            <div className={`w-full ${formRowBg} rounded-2xl h-14 sm:h-16 px-3 flex items-center`}>
                                <span className={`w-24 sm:w-28 text-sm sm:text-base font-medium pl-1 sm:pl-2 ${labelColor}`}>Last Name</span>
                                <input
                                    type="text"
                                    defaultValue={userProfile?.family_name || ""}
                                    className={`flex-1 h-10 sm:h-11 px-3 sm:px-4 rounded-xl text-sm sm:text-base outline-none ${inputBg} ${activeInputText} focus:ring-1 focus:ring-emerald-500`}
                                />
                            </div>
                        </div>

                        <div className="mt-6 sm:mt-8 flex justify-center">
                            <button className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2.5 sm:px-8 sm:py-3 rounded-xl font-medium transition-colors duration-300 text-sm sm:text-base">
                                Save Changes
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

export default UserMenuModal;