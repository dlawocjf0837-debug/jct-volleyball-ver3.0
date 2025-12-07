import React from 'react';
import LanguageToggle from './LanguageToggle';
import { useTranslation } from '../../hooks/useTranslation';

interface HeaderProps {
    title: string;
    showBackButton: boolean;
    onBack: () => void;
    showLanguageToggle?: boolean;
}

const Header: React.FC<HeaderProps> = ({ title, showBackButton, onBack, showLanguageToggle }) => {
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
            <div className="flex-grow">
                <h1 className="text-4xl sm:text-5xl font-extrabold text-[#00A3FF] tracking-wider uppercase transform -skew-x-12">
                    JCT <span className="text-white">{title}</span>
                </h1>
                <p className="text-slate-400 mt-2 text-sm tracking-widest">By JCT</p>
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