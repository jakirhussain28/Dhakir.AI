import { useEffect, useRef } from 'react';
import { FaUser } from "react-icons/fa6";
import { IoArrowBack } from "react-icons/io5";
import { TbLogout2 } from "react-icons/tb";
import { logout } from '../utils/auth';

const UserMenuModal = ({ isOpen, onClose, theme }) => {
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (isOpen && menuRef.current && !menuRef.current.contains(e.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    // Close on Escape key
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const isLight = theme === 'light';

    const overlayBg = isLight
        ? 'bg-black/10'
        : 'bg-black/30';

    const cardBg = isLight
        ? 'bg-white border-stone-200 shadow-xl'
        : 'bg-[#1e1f20] border-gray-700/60 shadow-2xl';

    const btnBg = isLight
        ? 'bg-stone-100 hover:bg-stone-200 text-stone-700'
        : 'bg-[#1a2a1a] hover:bg-[#243524] text-gray-200';

    const iconColor = isLight ? 'text-stone-500' : 'text-gray-400';
    const dividerColor = isLight ? 'border-stone-200' : 'border-gray-700/50';

    return (
        <div className={`fixed inset-0 z-[200] flex items-start justify-center pt-16 md:pt-20 ${overlayBg} transition-opacity duration-200`}>
            <div
                ref={menuRef}
                className={`w-[85%] max-w-xs rounded-2xl border ${cardBg} overflow-hidden
                            animate-in fade-in slide-in-from-top-4 duration-300`}
            >
                {/* Header Row: Back + User Icon */}
                <div className={`flex items-center justify-between px-4 py-3 border-b ${dividerColor}`}>
                    <button
                        onClick={onClose}
                        className={`p-1.5 rounded-full transition-colors ${isLight ? 'hover:bg-stone-200 text-stone-600' : 'hover:bg-gray-700 text-gray-300'}`}
                        aria-label="Close menu"
                    >
                        <IoArrowBack size={20} />
                    </button>
                    <div className={`p-1.5 ${iconColor}`}>
                        <FaUser size={20} />
                    </div>
                </div>

                {/* Menu Items */}
                <div className="flex flex-col gap-2.5 p-4">
                    <button
                        className={`w-full py-3 px-4 rounded-xl text-sm font-medium tracking-wide transition-all duration-200 ${btnBg}`}
                        onClick={() => {
                            // Placeholder for Profile action
                            onClose();
                        }}
                    >
                        Profile
                    </button>

                    <button
                        className={`w-full py-3 px-4 rounded-xl text-sm font-medium tracking-wide transition-all duration-200 ${btnBg}`}
                        onClick={() => {
                            // Placeholder for Streak action
                            onClose();
                        }}
                    >
                        Streak
                    </button>

                    <button
                        className={`w-full py-3 px-4 rounded-xl text-sm font-medium tracking-wide transition-all duration-200 flex items-center justify-center gap-2 ${btnBg}`}
                        onClick={() => {
                            logout();
                            onClose();
                        }}
                    >
                        <TbLogout2 size={18} />
                        Logout
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UserMenuModal;
