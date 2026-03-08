import React, { useState } from 'react';
import { isAdminPasswordCorrect } from '../utils/adminPassword';

export const SESSION_UNLOCK_KEY = 'isUnlocked';

interface LockScreenProps {
    onUnlock: () => void;
}

/** 제자리 잠금 오버레이: 비밀번호 입력 시 sessionStorage 설정 후 onUnlock 호출 */
const LockScreen: React.FC<LockScreenProps> = ({ onUnlock }) => {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (isAdminPasswordCorrect(pin)) {
            setPin('');
            if (typeof window !== 'undefined') {
                sessionStorage.setItem(SESSION_UNLOCK_KEY, 'true');
            }
            onUnlock();
        } else {
            setError('비밀번호가 일치하지 않습니다.');
            setPin('');
        }
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
                    화면 잠금
                </h2>
                <p className="text-slate-400 text-sm mb-6">관리자 비밀번호를 입력하여 해제하세요.</p>
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
