import React, { useMemo } from 'react';
import { Player, STAT_KEYS } from '../types';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslation } from '../hooks/useTranslation';
import { getStatLabel } from '../utils/labelUtils';

interface StatModalProps {
    player: Player;
    onClose: () => void;
    showRealNames: boolean;
    allPlayers?: Player[]; // 반 전체 데이터 (스마트 축 필터링용)
}

const StatModal: React.FC<StatModalProps> = ({ player, onClose, showRealNames, allPlayers = [] }) => {
    const { t } = useTranslation();
    
    // 데이터 안에 있는 라벨을 꺼내 씀 (없으면 기본값)
    const skill1Label = player.customLabel1 || "언더핸드";
    const skill2Label = player.customLabel2 || "서브";
    
    // 필터링 제거: 무조건 6개 축을 하드코딩으로 박아넣음
    const chartData = useMemo(() => {
        return [
            { subject: getStatLabel('height', t), value: player.stats.height || 0, fullMark: 100 },
            { subject: getStatLabel('shuttleRun', t), value: player.stats.shuttleRun || 0, fullMark: 100 },
            { subject: getStatLabel('flexibility', t), value: player.stats.flexibility || 0, fullMark: 100 },
            { subject: getStatLabel('fiftyMeterDash', t), value: player.stats.fiftyMeterDash || 0, fullMark: 100 },
            { subject: skill1Label, value: player.stats.underhand || 0, fullMark: 100 }, // 5번째 축
            { subject: skill2Label, value: player.stats.serve || 0, fullMark: 100 }, // 6번째 축 (무조건 포함)
        ];
    }, [player.stats, t, skill1Label, skill2Label]);

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
            </div>
        </div>
    );
};

export default StatModal;