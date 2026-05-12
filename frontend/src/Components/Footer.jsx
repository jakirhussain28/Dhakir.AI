import React from 'react';
import brandLogo from '../assets/brandLogo.svg';

const Footer = ({ isVisible }) => {
    return (
        <footer
            className={`fixed bottom-0 left-0 w-full z-[100] px-6 py-2 flex items-center justify-between transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
                } bg-black/80 backdrop-blur-md border-t border-white/5`}
        >
            {/* Left Side: Logo & Copyright */}
            <div className="flex items-center gap-6">
                <img
                    src={brandLogo}
                    alt="Dhakir Logo"
                    className="h-12 w-auto select-none pointer-events-none"
                    draggable={false}
                    style={{ filter: 'brightness(0) invert(1)' }}
                />
                <p className="text-gray-400 text-[12px] sm:text-[11px] font-medium tracking-widest ">
                    © DHAKIR 2026 All Rights Reserved
                </p>
            </div>

            {/* Right Side: Links */}
            <div className="flex items-center gap-6 sm:gap-10">
                <a
                    href="#"
                    className="text-gray-400 hover:text-white text-[10px] sm:text-[11px] font-bold tracking-widest uppercase transition-colors"
                >
                    Privacy Policy
                </a>
                <a
                    href="#"
                    className="text-gray-400 hover:text-white text-[10px] sm:text-[11px] font-bold tracking-widest uppercase transition-colors"
                >
                    Terms of Service
                </a>
            </div>
        </footer>
    );
};

export default Footer;
