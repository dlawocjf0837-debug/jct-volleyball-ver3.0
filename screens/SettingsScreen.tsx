import React, { useState, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { AppSettings } from '../types';
import { useTranslation } from '../hooks/useTranslation';
import { isAdminPasswordCorrect, setAdminPassword } from '../utils/adminPassword';

const SettingsScreen: React.FC = () => {
    const { settings, saveSettings, showToast } = useData();
    const { t } = useTranslation();
    const [currentSettings, setCurrentSettings] = useState<AppSettings>(settings);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordStep, setPasswordStep] = useState<'verify' | 'change'>('verify');
    const [verifyInput, setVerifyInput] = useState('');
    const [verifyError, setVerifyError] = useState('');
    const [newPasswordInput, setNewPasswordInput] = useState('');

    useEffect(() => {
        setCurrentSettings(settings);
    }, [settings]);

    const openPasswordModal = () => {
        setPasswordStep('verify');
        setVerifyInput('');
        setVerifyError('');
        setNewPasswordInput('');
        setShowPasswordModal(true);
    };

    const closePasswordModal = () => {
        setShowPasswordModal(false);
        setPasswordStep('verify');
        setVerifyInput('');
        setVerifyError('');
        setNewPasswordInput('');
    };

    const handleVerifyPassword = () => {
        if (!isAdminPasswordCorrect(verifyInput)) {
            setVerifyError('비밀번호가 일치하지 않습니다.');
            return;
        }
        setVerifyError('');
        setPasswordStep('change');
        setNewPasswordInput('');
    };

    const handleSaveNewPassword = () => {
        setAdminPassword(newPasswordInput);
        showToast('관리자 비밀번호가 저장되었습니다.', 'success');
        closePasswordModal();
    };

    const handleSave = () => {
        const score = Number(currentSettings.winningScore);
        if (isNaN(score) || score <= 0) {
            showToast('유효한 점수를 입력해주세요.', 'error');
            return;
        }
        const toSave: AppSettings = {
            ...currentSettings,
            tournamentTargetScore: [21, 25].includes(Number(currentSettings.tournamentTargetScore)) ? currentSettings.tournamentTargetScore : 21,
            tournamentMaxSets: [3, 5].includes(Number(currentSettings.tournamentMaxSets)) ? currentSettings.tournamentMaxSets : 3,
            volleyballRuleSystem: [6, 9].includes(Number(currentSettings.volleyballRuleSystem)) ? (currentSettings.volleyballRuleSystem as 6 | 9) : 6,
        };
        saveSettings(toSave);
    };
    
    const handleSettingChange = (field: keyof AppSettings, value: any) => {
        setCurrentSettings(prev => ({ ...prev, [field]: value }));
    };


    const presetScores = [11, 15, 21, 25];

    return (
        <div className="max-w-2xl mx-auto bg-slate-900/50 backdrop-blur-sm border border-slate-700 p-4 sm:p-6 rounded-lg shadow-2xl space-y-6 animate-fade-in px-4">
            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                <div className="flex flex-col lg:flex-row items-center lg:justify-between mb-6 gap-4">
                    <h1 className="text-3xl lg:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 text-center lg:text-right">
                        환경설정
                    </h1>
                </div>
                <p className="text-sm sm:text-base text-slate-300 text-center">
                    앱의 다양한 설정을 변경할 수 있습니다.
                </p>
            </div>
            
            <div className="space-y-4">
                <h3 className="text-xl font-bold text-slate-300">🏐 연습 경기 / 일반 수업 목표 점수</h3>
                <p className="text-slate-400 text-sm">
                    여기서 설정된 점수를 먼저 획득하는 팀이 세트에서 승리합니다. (듀스 제외)
                </p>

                <div className="flex flex-wrap gap-4 my-4">
                    {presetScores.map(score => (
                        <button
                            key={score}
                            onClick={() => handleSettingChange('winningScore', score)}
                            className={`px-6 py-3 text-lg rounded-md transition-colors font-semibold ${currentSettings.winningScore === score ? 'bg-sky-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
                        >
                            {score}점
                        </button>
                    ))}
                </div>
                
                <div className="flex items-center gap-4">
                    <label htmlFor="custom-score" className="text-slate-300 font-semibold">
                        직접 입력:
                    </label>
                    <input
                        id="custom-score"
                        type="number"
                        value={currentSettings.winningScore}
                        onChange={(e) => handleSettingChange('winningScore', Number(e.target.value))}
                        className="w-32 bg-slate-800 border border-slate-600 rounded-md py-2 px-3 text-white text-center text-lg focus:outline-none focus:ring-2 focus:ring-[#00A3FF]"
                        min="1"
                    />
                </div>
            </div>

            <div className="space-y-4 pt-6 border-t border-slate-700">
                <h3 className="text-xl font-bold text-slate-300">🏆 스포츠클럽 대회 룰 설정</h3>
                <p className="text-slate-400 text-sm">
                    조별 리그에서 [📺 라이브 전광판 켜기]로 진행할 때 적용됩니다. 결승 세트(마지막 세트)는 항상 15점, 8점에서 코트 체인지입니다.
                </p>
                <div className="space-y-3">
                    <p className="text-slate-300 font-semibold text-sm">대회 세트 당 목표 점수 (1~n-1세트)</p>
                    <div className="flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={() => handleSettingChange('tournamentTargetScore', 21)}
                            className={`px-5 py-2.5 rounded-lg font-semibold transition-colors ${(currentSettings.tournamentTargetScore ?? 21) === 21 ? 'bg-amber-500 text-slate-900' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
                        >
                            21점
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSettingChange('tournamentTargetScore', 25)}
                            className={`px-5 py-2.5 rounded-lg font-semibold transition-colors ${(currentSettings.tournamentTargetScore ?? 21) === 25 ? 'bg-amber-500 text-slate-900' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
                        >
                            25점
                        </button>
                    </div>
                </div>
                <div className="space-y-3 pt-2">
                    <p className="text-slate-300 font-semibold text-sm">대회 경기 세트 수</p>
                    <div className="flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={() => handleSettingChange('tournamentMaxSets', 3)}
                            className={`px-5 py-2.5 rounded-lg font-semibold transition-colors ${(currentSettings.tournamentMaxSets ?? 3) === 3 ? 'bg-amber-500 text-slate-900' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
                        >
                            3세트 (3판 2선승)
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSettingChange('tournamentMaxSets', 5)}
                            className={`px-5 py-2.5 rounded-lg font-semibold transition-colors ${(currentSettings.tournamentMaxSets ?? 3) === 5 ? 'bg-amber-500 text-slate-900' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
                        >
                            5세트 (5판 3선승)
                        </button>
                    </div>
                </div>
                <div className="space-y-3 pt-4 border-t border-slate-600/50 mt-4">
                    <p className="text-slate-300 font-semibold text-sm">🏐 배구 경기 인원 룰</p>
                    <p className="text-slate-400 text-xs">로테이션·서브 순서 트래커 등에 사용됩니다.</p>
                    <div className="flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={() => handleSettingChange('volleyballRuleSystem', 6)}
                            className={`px-5 py-2.5 rounded-lg font-semibold transition-colors ${(currentSettings.volleyballRuleSystem ?? 6) === 6 ? 'bg-amber-500 text-slate-900' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
                        >
                            6인제 (로테이션/서브)
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSettingChange('volleyballRuleSystem', 9)}
                            className={`px-5 py-2.5 rounded-lg font-semibold transition-colors ${(currentSettings.volleyballRuleSystem ?? 6) === 9 ? 'bg-amber-500 text-slate-900' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
                        >
                            9인제 (서브 순서만)
                        </button>
                    </div>
                </div>
            </div>

            <div className="space-y-4 pt-6 border-t border-slate-700">
                <h3 className="text-xl font-bold text-slate-300">추가 점수 설정</h3>
                <div className="flex items-center justify-between bg-slate-800/50 p-4 rounded-lg">
                    <div>
                        <p className="font-semibold text-slate-200">3단 플레이, 페어플레이 점수 포함</p>
                        <p className="text-sm text-slate-400 mt-1">
                            활성화: 최종 점수에 합산 | 비활성화: 점수판에서 버튼 숨김
                        </p>
                    </div>
                    <label htmlFor="bonus-points-toggle" className="flex items-center cursor-pointer">
                        <div className="relative">
                            <input 
                                type="checkbox" 
                                id="bonus-points-toggle" 
                                checked={currentSettings.includeBonusPointsInWinner} 
                                onChange={(e) => handleSettingChange('includeBonusPointsInWinner', e.target.checked)} 
                                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer transition-all duration-300"
                            />
                            <label htmlFor="bonus-points-toggle" className="toggle-label block overflow-hidden h-6 w-12 rounded-full bg-slate-600 cursor-pointer"></label>
                        </div>
                    </label>
                </div>
            </div>

            <div className="space-y-4 pt-6 border-t border-slate-700">
                <h3 className="text-xl font-bold text-slate-300">비밀번호 수정</h3>
                <p className="text-slate-400 text-sm">
                    프로그램 전체에서 사용하는 관리자 비밀번호를 설정합니다. (환경설정 입장, 대회 전광판 모드, 코칭 로그, 데이터 초기화 등)
                </p>
                <button
                    type="button"
                    onClick={openPasswordModal}
                    className="flex items-center gap-2 px-4 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold transition-colors"
                >
                    🔐 관리자 비밀번호 설정
                </button>
            </div>

            <div className="space-y-4 pt-6 border-t border-slate-700">
                <h3 className="text-xl font-bold text-slate-300">{t('settings_team_builder_title')}</h3>
                <div className="bg-slate-800/50 p-4 rounded-lg space-y-2">
                    <label htmlFor="sheet-url" className="block text-sm font-medium text-slate-300 mb-1">
                        {t('settings_google_sheet_url_label')}
                    </label>
                    <input
                        id="sheet-url"
                        type="text"
                        value={currentSettings.googleSheetUrl || ''}
                        onChange={(e) => handleSettingChange('googleSheetUrl', e.target.value)}
                        placeholder={t('settings_google_sheet_url_placeholder')}
                        className="w-full bg-slate-800 border border-slate-600 rounded-md p-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00A3FF]"
                    />
                </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-700">
                <button 
                    onClick={handleSave}
                    className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 rounded-lg text-lg"
                >
                    설정 저장
                </button>
            </div>

            {showPasswordModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={closePasswordModal} role="dialog" aria-modal="true">
                    <div className="bg-slate-900 rounded-2xl border border-slate-600 shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
                        {passwordStep === 'verify' ? (
                            <>
                                <div className="p-6">
                                    <h3 className="text-lg font-bold text-slate-200 mb-2">비밀번호 확인</h3>
                                    <p className="text-sm text-slate-400 mb-4">비밀번호 설정을 변경하려면 현재 비밀번호를 입력하세요.</p>
                                    <input
                                        type="password"
                                        value={verifyInput}
                                        onChange={e => { setVerifyInput(e.target.value); setVerifyError(''); }}
                                        placeholder="현재 비밀번호"
                                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        autoComplete="off"
                                        autoFocus
                                    />
                                    {verifyError && <p className="text-red-500 text-sm mt-2">{verifyError}</p>}
                                </div>
                                <div className="flex gap-2 p-4 bg-slate-800/50 border-t border-slate-700">
                                    <button type="button" onClick={closePasswordModal} className="flex-1 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-white font-medium">취소</button>
                                    <button type="button" onClick={handleVerifyPassword} className="flex-1 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium">확인</button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="p-6">
                                    <h3 className="text-lg font-bold text-slate-200 mb-2">비밀번호 수정</h3>
                                    <p className="text-sm text-slate-400 mb-4">
                                        프로그램 전체(환경설정, 대회 전광판 모드, 코칭 로그, 데이터 초기화 등)에서 사용하는 관리자 비밀번호입니다. 저장하지 않으면 기본값 0000으로 동작합니다.
                                    </p>
                                    <input
                                        type="password"
                                        value={newPasswordInput}
                                        onChange={e => setNewPasswordInput(e.target.value)}
                                        placeholder="새 비밀번호"
                                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        autoComplete="new-password"
                                        autoFocus
                                    />
                                </div>
                                <div className="flex gap-2 p-4 bg-slate-800/50 border-t border-slate-700">
                                    <button type="button" onClick={() => setPasswordStep('verify')} className="flex-1 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-white font-medium">뒤로</button>
                                    <button type="button" onClick={handleSaveNewPassword} className="flex-1 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium">저장</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SettingsScreen;