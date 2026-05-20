import React, { useState } from 'react';
import brandLogo from '/src/assets/brandLogo.svg';
import TermsAndPolicies from './TermsAndPolicies';

const Footer = ({ isVisible }) => {
    const [modalConfig, setModalConfig] = useState({ isOpen: false, type: 'privacy' });

    const openModal = (e, type) => {
        e.preventDefault();
        setModalConfig({ isOpen: true, type });
    };

    const closeModal = () => {
        setModalConfig({ ...modalConfig, isOpen: false });
    };

    return (
        <>
            <footer
                className={`fixed bottom-0 left-0 w-full z-[100] px-4 sm:px-6 py-3 sm:py-2 flex items-center justify-between transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
                    } bg-black/80 backdrop-blur-md border-t border-white/5`}
            >
                {/* --- Mobile View (< sm) --- */}
                <div className="w-full flex items-center justify-between sm:hidden">
                    {/* Left: Copyright */}
                    <div className="text-gray-400 text-[10px] font-medium tracking-wider leading-[1.3]">
                        <p>© DHAKIR 2026</p>
                        <p>All Rights Reserved</p>
                    </div>

                    {/* Center: Logo */}
                    <div className="flex-shrink-0 mx-2">
                        <img
                            src={brandLogo}
                            alt="Dhakir Logo"
                            className="h-8 w-auto select-none pointer-events-none -translate-y-[4px]"
                            draggable={false}
                            style={{ filter: 'brightness(0) invert(1)' }}
                        />
                    </div>

                    {/* Right: Links */}
                    <div className="flex items-center gap-3 text-gray-400 text-[10px] font-bold tracking-wider uppercase leading-[1.3]">
                        <a
                            href="#"
                            onClick={(e) => openModal(e, 'privacy')}
                            className="hover:text-white transition-colors"
                        >
                            Privacy<br />Policy
                        </a>
                        <a
                            href="#"
                            onClick={(e) => openModal(e, 'terms')}
                            className="hover:text-white transition-colors"
                        >
                            Terms of<br />Service
                        </a>
                    </div>
                </div>

                {/* --- Desktop/Tablet View (>= sm) --- */}
                <div className="hidden w-full sm:flex items-center justify-between">
                    {/* Left Side: Logo & Copyright */}
                    <div className="flex items-center gap-6">
                        <img
                            src={brandLogo}
                            alt="Dhakir Logo"
                            className="h-10 w-auto select-none pointer-events-none -translate-y-[4px]"
                            draggable={false}
                            style={{ filter: 'brightness(0) invert(1)' }}
                        />
                        <p className="text-gray-400 text-[11px] font-medium tracking-widest ">
                            © DHAKIR 2026 All Rights Reserved
                        </p>
                    </div>

                    {/* Right Side: Links */}
                    <div className="flex items-center gap-10">
                        <a
                            href="#"
                            onClick={(e) => openModal(e, 'privacy')}
                            className="text-gray-400 hover:text-white text-[11px] font-bold tracking-widest uppercase transition-colors"
                        >
                            Privacy Policy
                        </a>
                        <a
                            href="#"
                            onClick={(e) => openModal(e, 'terms')}
                            className="text-gray-400 hover:text-white text-[11px] font-bold tracking-widest uppercase transition-colors"
                        >
                            Terms of Service
                        </a>
                    </div>
                </div>
            </footer>
            
            <TermsAndPolicies
                isOpen={modalConfig.isOpen}
                type={modalConfig.type}
                onClose={closeModal}
            />
        </>
    );
};

export default Footer;