
import React from 'react';
import LanguageToggle from './LanguageToggle';
import { useTranslation } from '../../hooks/useTranslation';

interface HeaderProps {
    title: string;
    showBackButton: boolean;
    onBack: () => void;
    showLanguageToggle?: boolean;
    subtitle?: string;
    brand?: string;
}

const Header: React.FC<HeaderProps> = ({ title, showBackButton, onBack, showLanguageToggle, subtitle, brand = "JCT" }) => {
    const { t } = useTranslation();
    return (
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
                <h1 className="text-4xl sm:text-5xl font-extrabold text-[#00A3FF] tracking-wider uppercase transform -skew-x-12">
                    {brand} <span className="text-white">{title}</span>
                </h1>
                {subtitle && (
                    <p className="text-slate-300 mt-2 text-sm sm:text-base font-medium tracking-tight animate-fade-in">
                        {subtitle}
                    </p>
                )}
                <p className="text-slate-500 mt-1 text-xs tracking-[0.3em] font-light opacity-80">By JCT</p>
            </div>
            <div className="absolute right-0 top-0 flex items-center gap-4">
                {showLanguageToggle && (
                    <LanguageToggle />
                )}
            </div>
        </header>
    );
};

export default Header;
