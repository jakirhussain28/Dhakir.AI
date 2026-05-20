import React, { useState, useEffect } from 'react';
import policiesText from './policies.txt?raw';
import termsText from './terms.txt?raw';

const TermsAndPolicies = ({ isOpen, onClose, type }) => {
    const [content, setContent] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        const text = type === 'privacy' ? policiesText : termsText;
        setContent(text);
    }, [isOpen, type]);

    const parseContent = (text) => {
        if (!text) return '';
        return text
            .replace(/<title>/g, '<h3 class="text-lg font-semibold mt-4 mb-2 dark:text-white text-black">')
            .replace(/<\/title>/g, '</h3>')
            .replace(/<description>/g, '<p class="mb-4">')
            .replace(/<\/description>/g, '</p>')
            .replace(/<bold>/g, '<strong class="font-semibold dark:text-white text-black">')
            .replace(/<\/bold>/g, '</strong>')
            .replace(/<point>/g, '<li class="ml-6 mb-2 list-disc">')
            .replace(/<\/point>/g, '</li>');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div
                className="relative w-full max-w-3xl h-[80vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl dark:bg-[#2d2d2d] bg-black-500 border border-gray-300 dark:border-neutral-700"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="text-center py-4 border-b border-gray-300 dark:border-neutral-700 relative">
                    <h2 className="text-lg font-medium dark:text-white text-black">
                        {type === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}
                    </h2>
                </div>

                {/* Content */}
                <div
                    className="flex-1 overflow-y-auto p-6 dark:text-gray-300 text-gray-700 text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: content ? parseContent(content) : 'Loading...' }}
                >
                </div>

                {/* Footer Action */}
                <div className="flex justify-center p-4 border-t border-gray-300 dark:border-neutral-700">
                    <button
                        onClick={onClose}
                        className="px-6 py-1.5 rounded-lg dark:bg-neutral-600 dark:hover:bg-neutral-500 bg-gray-300 hover:bg-gray-400 dark:text-white text-black text-sm font-medium transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TermsAndPolicies;
