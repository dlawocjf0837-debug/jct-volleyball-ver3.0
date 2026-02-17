import React, { useState } from 'react';
import { isAdminPasswordCorrect } from '../utils/adminPassword';

interface AdminLockScreenProps {
    onUnlock: (mode: 'CLASS' | 'CLUB') => void;
}

const AdminLockScreen: React.FC<AdminLockScreenProps> = ({ onUnlock }) => {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [appMode, setAppMode] = useState<'CLASS' | 'CLUB'>('CLASS');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (isAdminPasswordCorrect(pin)) {
            setPin('');
            onUnlock(appMode);
        } else {
            setError('비밀번호가 일치하지 않습니다.');
            setPin('');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-sm">
                <div className="bg-slate-800/80 rounded-2xl border border-slate-600 shadow-2xl p-8 text-center">
                    <h1 className="text-2xl font-bold text-[#00A3FF] mb-2 tracking-tight">
                        J-IVE 관리자 시스템
                    </h1>
                    <p className="text-slate-400 text-sm mb-4">
                        인가된 관리자만 접근할 수 있습니다.
                    </p>

                    {/* 모드 선택: 상단 작은 토글 (기본 수업 모드) */}
                    <div className="flex items-center justify-center gap-2 mb-5 py-2 px-3 rounded-lg bg-slate-900/60 border border-slate-600/80">
                        <span className={`text-[11px] sm:text-xs font-medium whitespace-nowrap ${appMode === 'CLASS' ? 'text-sky-400' : 'text-slate-500'}`}>수업 모드</span>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={appMode === 'CLUB'}
                            onClick={() => setAppMode(m => m === 'CLASS' ? 'CLUB' : 'CLASS')}
                            className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 focus:ring-offset-slate-800 ${appMode === 'CLUB' ? 'bg-amber-500/80' : 'bg-slate-600'}`}
                        >
                            <span className={`pointer-events-none absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${appMode === 'CLUB' ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                        <span className={`text-[11px] sm:text-xs font-medium whitespace-nowrap ${appMode === 'CLUB' ? 'text-amber-400' : 'text-slate-500'}`}>스포츠클럽 모드</span>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <input
                            type="password"
                            placeholder="비밀번호"
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-600 text-white text-center text-lg tracking-[0.4em] placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00A3FF] focus:border-transparent"
                            autoFocus
                            aria-label="비밀번호 입력"
                        />
                        {error && (
                            <p className="text-red-400 text-sm" role="alert">
                                {error}
                            </p>
                        )}
                        <button
                            type="submit"
                            className="w-full py-3 rounded-xl bg-[#00A3FF] hover:bg-[#0090e0] text-white font-bold text-lg transition-colors"
                        >
                            접속하기
                        </button>
                    </form>
                </div>

                <p className="mt-8 text-slate-500 text-xs text-center leading-relaxed">
                    * 본 시스템은 학생 개인정보 보호 가이드라인을 준수하며,<br />
                    인가된 관리자(교사)만 접근 가능합니다.
                </p>
            </div>
        </div>
    );
};

export default AdminLockScreen;
