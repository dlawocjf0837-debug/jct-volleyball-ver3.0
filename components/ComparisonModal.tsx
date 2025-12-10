import React, { useMemo } from 'react';
import { Player, STAT_KEYS } from '../types';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslation } from '../hooks/useTranslation';
import { getStatLabel } from '../utils/labelUtils';

interface ComparisonModalProps {
    player1: Player;
    player2: Player;
    onClose: () => void;
    showRealNames: boolean;
    allPlayers?: Player[]; // 반 전체 데이터 (스마트 축 필터링용)
}

type ChartDataPoint = {
    subject: string;
    fullMark: number;
    [key: string]: string | number;
};

const player1Color = "#00A3FF"; // electric-blue
const player2Color = "#fb923c"; // orange-400

const ComparisonModal: React.FC<ComparisonModalProps> = ({ player1, player2, onClose, showRealNames, allPlayers = [] }) => {
    const { t } = useTranslation();
    
    // 데이터 안에 있는 라벨을 꺼내 씀 (없으면 기본값)
    // 두 선수 중 하나라도 라벨이 있으면 사용 (일반적으로 같은 반이므로 동일한 라벨을 가짐)
    const skill1Label = player1.customLabel1 || player2.customLabel1 || "언더핸드";
    const skill2Label = player1.customLabel2 || player2.customLabel2 || "서브";
    
    // 필터링 제거: 무조건 6개 축을 하드코딩으로 박아넣음
    const chartData = useMemo((): ChartDataPoint[] => {
        if (!player1 || !player2) return [];
        
        return [
            { 
                subject: getStatLabel('height', t), 
                [player1.anonymousName]: player1.stats.height || 0, 
                [player2.anonymousName]: player2.stats.height || 0, 
                fullMark: 100 
            },
            { 
                subject: getStatLabel('shuttleRun', t), 
                [player1.anonymousName]: player1.stats.shuttleRun || 0, 
                [player2.anonymousName]: player2.stats.shuttleRun || 0, 
                fullMark: 100 
            },
            { 
                subject: getStatLabel('flexibility', t), 
                [player1.anonymousName]: player1.stats.flexibility || 0, 
                [player2.anonymousName]: player2.stats.flexibility || 0, 
                fullMark: 100 
            },
            { 
                subject: getStatLabel('fiftyMeterDash', t), 
                [player1.anonymousName]: player1.stats.fiftyMeterDash || 0, 
                [player2.anonymousName]: player2.stats.fiftyMeterDash || 0, 
                fullMark: 100 
            },
            { 
                subject: skill1Label, 
                [player1.anonymousName]: player1.stats.underhand || 0, 
                [player2.anonymousName]: player2.stats.underhand || 0, 
                fullMark: 100 
            }, // 5번째 축
            { 
                subject: skill2Label, 
                [player1.anonymousName]: player1.stats.serve || 0, 
                [player2.anonymousName]: player2.stats.serve || 0, 
                fullMark: 100 
            }, // 6번째 축 (무조건 포함)
        ];
    }, [player1, player2, t, skill1Label, skill2Label]);

    if (!player1 || !player2) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-slate-900 rounded-lg shadow-2xl p-6 w-full max-w-2xl text-white border border-slate-700" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-[#00A3FF]">선수 능력치 비교</h2>
                         <div className="flex items-center gap-4 mt-1 text-slate-300">
                           <p><span className="font-bold text-lg" style={{color: player1Color}}>■</span> {player1.anonymousName}</p>
                           <p><span className="font-bold text-lg" style={{color: player2Color}}>■</span> {player2.anonymousName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-2xl font-bold text-slate-500 hover:text-white">&times;</button>
                </div>

                {showRealNames && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm text-slate-400 mb-4 bg-slate-800/50 p-3 rounded-md">
                        <p className="truncate">정보: {player1.class}반 {player1.studentNumber}번 {player1.originalName} ({player1.gender})</p>
                        <p className="truncate">정보: {player2.class}반 {player2.studentNumber}번 {player2.originalName} ({player2.gender})</p>
                    </div>
                )}
                
                <div style={{ width: '100%', height: 350 }}>
                    <ResponsiveContainer>
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                            <PolarGrid stroke="#475569" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#cbd5e1', fontSize: 12 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#475569" />
                            <Radar name={player1.anonymousName} dataKey={player1.anonymousName} stroke={player1Color} fill={player1Color} fillOpacity={0.5} />
                            <Radar name={player2.anonymousName} dataKey={player2.anonymousName} stroke={player2Color} fill={player2Color} fillOpacity={0.5} />
                            <Tooltip contentStyle={{ backgroundColor: 'rgba(10, 15, 31, 0.9)', borderColor: '#475569', borderRadius: '0.5rem' }} />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>

                <div className="mt-4">
                    <h3 className="font-bold text-lg text-slate-300 mb-2">상세 능력치</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-800/50">
                                <tr>
                                    <th className="p-2">능력치</th>
                                    <th className="p-2 text-center" style={{color: player1Color}}>{player1.anonymousName}</th>
                                    <th className="p-2 text-center" style={{color: player2Color}}>{player2.anonymousName}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {chartData.map(data => (
                                    <tr key={data.subject} className="border-b border-slate-700">
                                        <td className="p-2 font-semibold text-slate-400">{data.subject}</td>
                                        <td className="p-2 text-center font-mono">{Number(data[player1.anonymousName]).toFixed(1)}</td>
                                        <td className="p-2 text-center font-mono">{Number(data[player2.anonymousName]).toFixed(1)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default ComparisonModal;