import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import AnnouncerScreen from './AnnouncerScreen';
import { useTranslation } from '../hooks/useTranslation';

interface StudentJoinScreenProps {
    onBackToLock: () => void;
    appMode?: 'CLASS' | 'CLUB';
    pendingJoinCode?: string | null;
    clearPendingJoinCode?: () => void;
}

const StudentJoinScreen: React.FC<StudentJoinScreenProps> = ({ onBackToLock, appMode = 'CLASS', pendingJoinCode, clearPendingJoinCode }) => {
    const { joinSession, p2p } = useData();
    const { t } = useTranslation();
    const [joinId, setJoinId] = useState(pendingJoinCode ?? '');
    const [isJoining, setIsJoining] = useState(false);
    const [joinError, setJoinError] = useState('');
    const hasTriedAutoJoin = useRef(false);

    useEffect(() => {
        if (pendingJoinCode && joinSession && clearPendingJoinCode && !hasTriedAutoJoin.current) {
            hasTriedAutoJoin.current = true;
            setJoinId(pendingJoinCode);
            setIsJoining(true);
            joinSession(pendingJoinCode, () => {
                setIsJoining(false);
                clearPendingJoinCode();
            });
        }
    }, [pendingJoinCode, joinSession, clearPendingJoinCode]);

    useEffect(() => {
        if (isJoining && p2p.status === 'error') {
            setJoinError(p2p.error || t('unknown_error'));
            setIsJoining(false);
        }
    }, [p2p.status, p2p.error, isJoining, t]);

    const handleJoin = () => {
        if (!joinId.trim()) return;
        setJoinError('');
        setIsJoining(true);
        joinSession(joinId.trim().toUpperCase(), () => {
            setIsJoining(false);
        });
    };

    if (p2p.isConnected) {
        return (
            <div className="min-h-screen flex flex-col bg-slate-900">
                <div className="flex-shrink-0 flex justify-between items-center p-3 bg-slate-800/80 border-b border-slate-700">
                    <button
                        onClick={onBackToLock}
                        className="text-slate-400 hover:text-white text-sm font-medium"
                    >
                        ← 관리자 화면으로
                    </button>
                    <span className="text-emerald-400 text-sm font-semibold">✓ 연결됨</span>
                </div>
                <div className="flex-grow overflow-auto">
                    <AnnouncerScreen
                        onNavigateToHistory={onBackToLock}
                        appMode={appMode}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-sm">
                <div className="bg-slate-800/80 rounded-2xl border border-slate-600 shadow-2xl p-8">
                    <h2 className="text-xl font-bold text-emerald-400 mb-2 text-center">
                        👥 실시간 세션 참여
                    </h2>
                    <p className="text-slate-400 text-sm mb-5 text-center">
                        교사가 알려준 4자리 참여 코드를 입력하세요.
                    </p>
                    <div className="space-y-4">
                        <input
                            type="text"
                            placeholder={t('menu_join_session_placeholder')}
                            value={joinId}
                            onChange={(e) => setJoinId(e.target.value.toUpperCase().slice(0, 8))}
                            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                            className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-600 text-white text-center text-lg tracking-widest placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                            aria-label="참여 코드"
                            disabled={isJoining}
                        />
                        {joinError && (
                            <p className="text-red-400 text-sm text-center" role="alert">
                                {joinError}
                            </p>
                        )}
                        <button
                            onClick={handleJoin}
                            disabled={isJoining || !joinId.trim()}
                            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold text-lg transition-colors"
                        >
                            {isJoining ? t('menu_connecting') : t('menu_join_session_button')}
                        </button>
                    </div>
                </div>
                <button
                    onClick={onBackToLock}
                    className="mt-6 w-full py-2 text-slate-500 hover:text-slate-300 text-sm transition-colors"
                >
                    ← 관리자 화면으로
                </button>
            </div>
        </div>
    );
};

export default StudentJoinScreen;
