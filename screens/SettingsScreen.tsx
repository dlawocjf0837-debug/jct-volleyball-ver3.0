import React, { useState, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { AppSettings } from '../types';
import { useTranslation } from '../hooks/useTranslation';

const SettingsScreen: React.FC = () => {
    const { settings, saveSettings, showToast } = useData();
    const { t } = useTranslation();
    const [currentSettings, setCurrentSettings] = useState<AppSettings>(settings);

    useEffect(() => {
        setCurrentSettings(settings);
    }, [settings]);

    const handleSave = () => {
        const score = Number(currentSettings.winningScore);
        if (isNaN(score) || score <= 0) {
            showToast('유효한 점수를 입력해주세요.', 'error');
            return;
        }
        saveSettings(currentSettings);
    };
    
    const handleSettingChange = (field: keyof AppSettings, value: any) => {
        setCurrentSettings(prev => ({ ...prev, [field]: value }));
    };


    const presetScores = [11, 15, 21, 25];

    return (
        <div className="max-w-2xl mx-auto bg-slate-900/50 backdrop-blur-sm border border-slate-700 p-6 rounded-lg shadow-2xl space-y-6 animate-fade-in">
            <div className="p-4 bg-slate-800/50 rounded-lg text-center border border-slate-700">
                <h2 className="text-2xl font-bold text-sky-400 mb-2">환경설정</h2>
                <p className="text-slate-300">
                    앱의 다양한 설정을 변경할 수 있습니다.
                </p>
            </div>
            
            <div className="space-y-4">
                <h3 className="text-xl font-bold text-slate-300">경기 목표 점수 설정</h3>
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
        </div>
    );
};

export default SettingsScreen;