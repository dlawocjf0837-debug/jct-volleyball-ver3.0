import React, { useState, useRef, useEffect } from 'react';
import { isAdminPasswordCorrect } from '../utils/adminPassword';
import { loadBackupFromFile } from '../utils/loadBackupOnLockScreen';

interface AdminLockScreenProps {
    onUnlock: (mode: 'CLASS' | 'CLUB') => void;
    onRequestStudentJoin?: () => void;
}

const AdminLockScreen: React.FC<AdminLockScreenProps> = ({ onUnlock, onRequestStudentJoin }) => {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [appMode, setAppMode] = useState<'CLASS' | 'CLUB'>('CLASS');
    const [loadToast, setLoadToast] = useState<string | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [showBetaModal, setShowBetaModal] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    /** 모드가 CLUB으로 변경될 때 베타 알림 모달 표시 */
    useEffect(() => {
        if (appMode === 'CLUB') {
            setShowBetaModal(true);
        }
    }, [appMode]);
    useEffect(() => {
        if (showBetaModal) document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, [showBetaModal]);

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

    const handleLoadDataClick = () => {
        setLoadToast(null);
        setLoadError(null);
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setLoadError(null);
        const result = await loadBackupFromFile(file);
        if (result.ok) {
            setLoadToast('🔔 데이터를 성공적으로 불러왔습니다. 비밀번호를 입력해 주세요.');
            setTimeout(() => setLoadToast(null), 4000);
        } else {
            setLoadError(result.error ?? '파일 로드 실패');
        }
    };

    const handleModeChange = (newMode: 'CLASS' | 'CLUB') => setAppMode(newMode);

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col items-center justify-center p-6">
            <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
                aria-hidden="true"
            />
            <div className="w-full max-w-sm">
                <div className="bg-slate-800/80 rounded-2xl border border-slate-600 shadow-2xl p-8 text-center">
                    <h1 className="text-2xl font-bold text-[#00A3FF] mb-2 tracking-tight">
                        J-IVE 관리자 시스템
                    </h1>
                    <p className="text-slate-400 text-sm mb-4">
                        인가된 관리자만 접근할 수 있습니다.
                    </p>

                    {/* 모드 선택 */}
                    <div className="flex items-center justify-center gap-2 mb-5 py-2 px-3 rounded-lg bg-slate-900/60 border border-slate-600/80">
                        <span className={`text-[11px] sm:text-xs font-medium whitespace-nowrap ${appMode === 'CLASS' ? 'text-sky-400' : 'text-slate-500'}`}>수업 모드</span>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={appMode === 'CLUB'}
                            onClick={() => handleModeChange(appMode === 'CLASS' ? 'CLUB' : 'CLASS')}
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
                        {loadToast && (
                            <p className="text-emerald-400 text-sm" role="status">
                                {loadToast}
                            </p>
                        )}
                        {loadError && (
                            <p className="text-red-400 text-sm" role="alert">
                                {loadError}
                            </p>
                        )}
                        <button
                            type="submit"
                            className="w-full py-3 rounded-xl bg-[#00A3FF] hover:bg-[#0090e0] text-white font-bold text-lg transition-colors"
                        >
                            접속하기
                        </button>
                    </form>

                    {onRequestStudentJoin && (
                        <button
                            type="button"
                            onClick={onRequestStudentJoin}
                            className="mt-5 w-full py-3 rounded-xl border-2 border-emerald-500/60 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-400 font-semibold text-base transition-colors"
                        >
                            👥 실시간 세션 참여 (학생용)
                        </button>
                    )}
                </div>

                <div className="mt-6 flex flex-col items-center gap-4">
                    <button
                        type="button"
                        onClick={handleLoadDataClick}
                        className="text-slate-500 hover:text-slate-300 text-sm transition-colors flex items-center gap-1.5"
                    >
                        <span>📂</span>
                        <span>데이터 불러오기</span>
                    </button>

                    <p className="text-slate-500 text-xs text-center leading-relaxed max-w-[280px]">
                        * 본 시스템은 학생 개인정보 보호 가이드라인을 준수하며,
                        <br />
                        인가된 관리자(교사)만 접근 가능합니다.
                    </p>
                </div>
            </div>

            {showBetaModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-slate-800 p-6 rounded-xl shadow-2xl max-w-sm w-full max-h-[90vh] overflow-y-auto text-center border-2 border-amber-500 animate-fade-in">
                        <div className="text-5xl mb-4">🛠️</div>
                        <h3 className="text-xl font-bold text-amber-400 mb-3">[스포츠클럽 모드 베타 테스트 중!]</h3>
                        <p className="text-gray-300 text-sm mb-6 leading-relaxed break-keep">
                            임재철 선생님이 다음 학기(여름방학쯤) 정식 도입을 위해 열심히 테스트하고 있는 기능입니다.
                            <br/><br/>
                            아직 사용 매뉴얼이 없으니 구경만 해보시거나, 조심해서(?) 다뤄주세요!
                            <br/>
                            (피드백은 언제나 환영입니다 😉)
                        </p>
                        <button
                            onClick={() => setShowBetaModal(false)}
                            className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold transition-colors"
                        >
                            확인했습니다
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminLockScreen;
