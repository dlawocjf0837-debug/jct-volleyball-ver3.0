
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
    /** 전역 잠금 버튼 클릭 시 호출 (전달 시 우측 영역에 잠금 버튼 표시, 언어 토글과 겹치지 않음) */
    onLockClick?: () => void;
    subtitle?: string;
    brand?: string;
    appMode?: 'CLASS' | 'CLUB';
    onAppModeChange?: (mode: 'CLASS' | 'CLUB') => void;
    showModeToggle?: boolean;
    showReturnToInitial?: boolean;
    onReturnToInitial?: () => void;
}

const Header: React.FC<HeaderProps> = ({ title, showBackButton, onBack, showLanguageToggle, showUpdateNotesIcon = false, onLockClick, subtitle, brand = "J-IVE", appMode = 'CLASS', onAppModeChange, showModeToggle = false, showReturnToInitial = false, onReturnToInitial }) => {
    const { t } = useTranslation();
    const [showUpdateNotes, setShowUpdateNotes] = useState(false);
    const isClub = appMode === 'CLUB';

    return (
        <>
        <header className={`text-center mb-8 relative flex items-center justify-center no-print ${isClub ? 'text-amber-50/95' : ''}`}>
             {showBackButton && (
                <button 
                    onClick={onBack}
                    className="absolute left-0 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-700/90 hover:bg-slate-600 border border-slate-600/80 text-white font-semibold text-sm sm:text-base transition-all duration-200 z-10 shadow-lg hover:shadow-sky-500/10 hover:border-sky-500/30"
                    aria-label={t('back_to_main')}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 shrink-0">
                        <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
                    </svg>
                    {t('back_to_main')}
                </button>
            )}
            {showReturnToInitial && onReturnToInitial && (
                <button 
                    onClick={onReturnToInitial}
                    className="absolute left-0 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-3 sm:px-4 rounded-lg transition duration-200 z-10 text-sm sm:text-base"
                    aria-label="초기 화면으로"
                >
                    🏠 초기 화면
                </button>
            )}
            <div className="flex-grow flex flex-col items-center">
                <h1 className={`text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-wider uppercase transform -skew-x-12 ${isClub ? 'text-amber-400' : 'text-[#00A3FF]'}`}>
                    {brand} <span className="text-white">{title}</span>
                </h1>
                {subtitle && (
                    <p className="text-slate-300 mt-2 text-xs sm:text-sm lg:text-base font-medium tracking-tight animate-fade-in">
                        {subtitle}
                    </p>
                )}
                {isClub && (
                    <span className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-bold bg-amber-500/20 text-amber-400 border border-amber-500/50">
                        🏆 학교스포츠클럽 모드
                    </span>
                )}
                <p className="text-slate-500 mt-1 text-xs tracking-[0.3em] font-light opacity-80">By JCT</p>
            </div>
            <div className="absolute right-0 top-0 flex items-center gap-2 sm:gap-3">
                {onLockClick && (
                    <button
                        type="button"
                        onClick={onLockClick}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-700/90 hover:bg-slate-600 border border-slate-600 text-white font-semibold text-sm transition-colors no-print shrink-0"
                        aria-label="화면 잠금"
                    >
                        🔒 잠금
                    </button>
                )}
                {showModeToggle && onAppModeChange && (
                    <div className="flex items-center gap-2 bg-slate-800/90 rounded-full p-1 border border-slate-600">
                        <span className={`text-xs font-medium px-2 hidden sm:inline ${appMode === 'CLASS' ? 'text-sky-400' : 'text-slate-500'}`}>수업</span>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={appMode === 'CLUB'}
                            onClick={() => onAppModeChange(appMode === 'CLASS' ? 'CLUB' : 'CLASS')}
                            className={`relative inline-flex h-7 w-12 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${appMode === 'CLUB' ? 'bg-amber-500/80' : 'bg-slate-600'}`}
                        >
                            <span className={`pointer-events-none absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${appMode === 'CLUB' ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                        <span className={`text-xs font-medium px-2 hidden sm:inline ${appMode === 'CLUB' ? 'text-amber-400' : 'text-slate-500'}`}>클럽</span>
                    </div>
                )}
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
