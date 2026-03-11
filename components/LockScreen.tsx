import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';

/** 세션 인증 키: 현재 잠금 해제 권한 모드 ('master' | 'class' | 'club') */
export const UNLOCKED_MODE_KEY = 'unlockedMode';

interface LockScreenProps {
    onUnlock: () => void;
}

/** 제자리 잠금 오버레이: 비밀번호 입력 시 sessionStorage 설정 후 onUnlock 호출 */
const LockScreen: React.FC<LockScreenProps> = ({ onUnlock }) => {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const location = useLocation();

    const modeLabel = (() => {
        if (location.pathname.startsWith('/class')) return '수업 모드 잠금 중';
        if (location.pathname.startsWith('/club')) return '스포츠클럽 모드 잠금 중';
        return '화면 잠금';
    })();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const trimmed = pin.trim();

        let mode: string | null = null;
        if (trimmed === '0819') {
            mode = 'master';
        } else if (trimmed === '0000') {
            mode = 'class';
        } else if (trimmed === '9999') {
            mode = 'club';
        }

        if (!mode) {
            setError('비밀번호가 틀렸습니다.');
            setPin('');
            return;
        }

        setPin('');
        if (typeof window !== 'undefined') {
            sessionStorage.setItem(UNLOCKED_MODE_KEY, mode);
        }
        onUnlock();
    };

    return (
        <div
            className="fixed inset-0 z-[9999] bg-black/90 flex flex-col items-center justify-center p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lock-screen-title"
        >
            <div className="flex flex-col items-center justify-center max-w-sm w-full">
                <span className="text-6xl mb-4" aria-hidden>🔒</span>
                <h2 id="lock-screen-title" className="text-xl sm:text-2xl font-bold text-white mb-1 tracking-tight">
                    {modeLabel}
                </h2>
                <p className="text-slate-400 text-sm mb-6">해당 모드에 맞는 비밀번호를 입력하여 해제하세요.</p>
                <form onSubmit={handleSubmit} className="w-full space-y-4">
                    <input
                        type="password"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="비밀번호 4자리"
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 20))}
                        className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-white text-center text-lg tracking-[0.4em] placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00A3FF] focus:border-transparent"
                        aria-label="잠금 해제 비밀번호"
                        autoFocus
                    />
                    {error && (
                        <p className="text-red-400 text-sm text-center" role="alert">
                            {error}
                        </p>
                    )}
                    <button
                        type="submit"
                        className="w-full py-3 rounded-xl bg-[#00A3FF] hover:bg-[#0090e0] text-white font-bold text-lg transition-colors"
                    >
                        해제
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LockScreen;
