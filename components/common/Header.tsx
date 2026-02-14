
import React, { useState } from 'react';
import LanguageToggle from './LanguageToggle';
import UpdateNotesModal from './UpdateNotesModal';
import { useTranslation } from '../../hooks/useTranslation';

interface HeaderProps {
    title: string;
    showBackButton: boolean;
    onBack: () => void;
    showLanguageToggle?: boolean;
    showUpdateNotesIcon?: boolean;
    subtitle?: string;
    brand?: string;
}

const Header: React.FC<HeaderProps> = ({ title, showBackButton, onBack, showLanguageToggle, showUpdateNotesIcon = false, subtitle, brand = "J-IVE" }) => {
    const { t } = useTranslation();
    const [showUpdateNotes, setShowUpdateNotes] = useState(false);

    return (
        <>
        <header className="text-center mb-8 relative flex items-center justify-center no-print">
             {showBackButton && (
                <button 
                    onClick={onBack}
                    className="absolute left-0 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg transition duration-200 z-10"
                    aria-label={t('back_to_main')}
                >
                    {t('back_to_main')}
                </button>
            )}
            <div className="flex-grow flex flex-col items-center">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#00A3FF] tracking-wider uppercase transform -skew-x-12">
                    {brand} <span className="text-white">{title}</span>
                </h1>
                {subtitle && (
                    <p className="text-slate-300 mt-2 text-xs sm:text-sm lg:text-base font-medium tracking-tight animate-fade-in">
                        {subtitle}
                    </p>
                )}
                <p className="text-slate-500 mt-1 text-xs tracking-[0.3em] font-light opacity-80">By JCT</p>
            </div>
            <div className="absolute right-0 top-0 flex items-center gap-3">
                {showUpdateNotesIcon && (
                    <button
                        onClick={() => setShowUpdateNotes(true)}
                        className="relative p-2 rounded-lg bg-slate-700/80 hover:bg-slate-600 text-white text-xl transition-colors"
                        aria-label="업데이트 노트"
                        title="업데이트 노트"
                    >
                        🔔
                        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-slate-900" aria-hidden />
                    </button>
                )}
                {showLanguageToggle && (
                    <LanguageToggle />
                )}
            </div>
        </header>
        <UpdateNotesModal isOpen={showUpdateNotes} onClose={() => setShowUpdateNotes(false)} />
        </>
    );
};

export default Header;
