import React, { useMemo } from 'react';
import { Player, STAT_KEYS, STAT_NAME_KEYS } from '../types';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslation } from '../hooks/useTranslation';

interface StatModalProps {
    player: Player;
    onClose: () => void;
    showRealNames: boolean;
}

const StatModal: React.FC<StatModalProps> = ({ player, onClose, showRealNames }) => {
    const { t } = useTranslation();
    const chartData = useMemo(() => 
        STAT_KEYS.map(key => ({
            subject: t(STAT_NAME_KEYS[key]),
            value: player.stats[key],
            fullMark: 100,
        }))
    , [player.stats, t]);

    const hasNoData = useMemo(() => Object.values(player.stats).every(s => s === 0), [player.stats]);

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 animate-fade-in"
            onClick={onClose}
        >
            <div 
                className="bg-slate-900 rounded-lg shadow-2xl p-6 w-full max-w-lg mx-4 text-white border border-slate-700"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-[#00A3FF]">{player.anonymousName} 능력치</h2>
                        {showRealNames && (
                            <p className="text-slate-400">정보: {player.class}반 {player.studentNumber}번 {player.originalName} ({player.gender})</p>
                        )}
                    </div>
                    <button onClick={onClose} className="text-2xl font-bold text-slate-500 hover:text-white">&times;</button>
                </div>
                
                {hasNoData ? (
                    <div className="h-[300px] flex items-center justify-center text-center text-slate-500">
                        <p>{t('stat_modal_no_data')}</p>
                    </div>
                ) : (
                    <>
                        <div style={{ width: '100%', height: 300 }}>
                            <ResponsiveContainer>
                                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                                    <PolarGrid stroke="#475569" />
                                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#cbd5e1' }} />
                                    <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#475569" />
                                    <Radar name={player.anonymousName} dataKey="value" stroke="#00A3FF" fill="#00A3FF" fillOpacity={0.6} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'rgba(10, 15, 31, 0.9)',
                                            borderColor: '#475569',
                                            borderRadius: '0.5rem'
                                        }}
                                        labelStyle={{ color: '#f1f5f9' }}
                                    />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                        <p className="text-xs text-slate-500 text-center mt-4">
                            * 100점은 현재 입력된 학생들 중 가장 높은 수치를 기준으로 한 상대적 점수입니다.
                        </p>
                    </>
                )}
            </div>
        </div>
    );
};

export default StatModal;