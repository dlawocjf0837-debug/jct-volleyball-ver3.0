import React, { useState } from 'react';

const ADMIN_PIN = '9999';

interface AdminLockScreenProps {
    onUnlock: () => void;
}

const AdminLockScreen: React.FC<AdminLockScreenProps> = ({ onUnlock }) => {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (pin === ADMIN_PIN) {
            setPin('');
            onUnlock();
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
                    <p className="text-slate-400 text-sm mb-6">
                        인가된 관리자만 접근할 수 있습니다.
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <input
                            type="password"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={6}
                            placeholder="비밀번호 (PIN)"
                            value={pin}
                            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
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
