
import React, { useState, useMemo } from 'react';
import { Player, PlayerStats, MatchState, TeamSet, PlayerCumulativeStats, CoachingLog, Badge } from '../types';
import { useData } from '../contexts/DataContext';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { LockClosedIcon, CrownIcon } from './icons';
import { useTranslation } from '../hooks/useTranslation';
import { BADGE_DEFINITIONS } from '../data/badges';
import { BadgeDetailModal } from './BadgeDetailModal';

type MatchPerformance = {
    match: MatchState & { date: string };
    teamName: string;
    opponent: string;
    stats: PlayerStats;
    teamSet: TeamSet | undefined;
};

interface PlayerHistoryModalProps {
    player: Player;
    cumulativeStats: PlayerCumulativeStats;
    performanceHistory: MatchPerformance[];
    onClose: () => void;
    teamSets: TeamSet[];
}

// Updated Order: Points -> Serve Ace Rate -> Serve Success Rate -> Serve Faults -> Spike -> Assist -> Block -> Dig
const statOrder: (keyof PlayerStats | 'serveSuccessRate' | 'serveAceRate')[] = [
    'points',            // 득점
    'serveAceRate',      // 서브 득점률
    'serveSuccessRate',  // 서브 성공률
    'serviceFaults',     // 서브 범실
    'spikeSuccesses',    // 스파이크 성공
    'assists',           // 어시스트
    'blockingPoints',    // 블로킹
    'digs'               // 디그
];

export const PlayerHistoryModal: React.FC<PlayerHistoryModalProps> = ({ player, cumulativeStats, performanceHistory, onClose, teamSets }) => {
    const { coachingLogs, saveCoachingLog, requestPassword, playerAchievements } = useData();
    const { t } = useTranslation();
    const [newLog, setNewLog] = useState('');
    const [isLogUnlocked, setIsLogUnlocked] = useState(false);
    const [activeTab, setActiveTab] = useState<'analysis' | 'coaching'>('analysis');
    
    // Default chart stat to 'points' as it's the first item now
    const [chartStat, setChartStat] = useState<keyof PlayerStats | 'serveSuccessRate' | 'serveAceRate'>('points');
    const [winRateFilter, setWinRateFilter] = useState('all');
    const [rosterToShow, setRosterToShow] = useState<{ teamName: string, players: Player[], captainId?: string } | null>(null);
    const [selectedBadgeDetail, setSelectedBadgeDetail] = useState<{ badge: Badge, player: Player, stats: Partial<PlayerCumulativeStats> } | null>(null);

    const statDisplayNames: Record<string, string> = {
        points: t('stat_display_points'),
        serviceAces: t('stat_display_serve_ace'),
        spikeSuccesses: t('stat_display_spike_success'),
        blockingPoints: t('stat_display_blocking'),
        serviceFaults: t('stat_display_serve_fault'),
        digs: t('stat_display_digs'),
        assists: t('stat_display_assists'),
        serveIn: t('btn_serve_in'),
        serveSuccessRate: t('stat_serve_success_rate'),
        serveAceRate: t('stat_serve_ace_rate'), // "서브 득점률"
    };

    const handleTeamClick = (matchData: MatchState, teamNameToShow: string) => {
        const teamState = matchData.teamA.name === teamNameToShow ? matchData.teamA : matchData.teamB;
        const playerList = Object.values(teamState.players || {});
        
        const teamKey = teamState.key;
        let captainId: string | undefined = undefined;
        if(teamKey) {
            const [setId] = teamKey.split('___');
            const set = teamSets.find(s => s.id === setId);
            const teamInfo = set?.teams.find(t => t.teamName === teamNameToShow);
            captainId = teamInfo?.captainId;
        }
        
        setRosterToShow({ teamName: teamNameToShow, players: playerList, captainId });
    };

    const RosterModal = ({ teamName, players, captainId, onClose }: { teamName: string, players: Player[], captainId?: string, onClose: () => void }) => (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-slate-800 rounded-lg shadow-2xl p-6 w-full max-w-sm text-white border border-slate-700 flex flex-col" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-sky-400 mb-4 text-center">{t('player_history_roster_title', { teamName })}</h3>
                <div className="flex-grow overflow-y-auto pr-2 -mr-2">
                    <ul className="space-y-2">
                        {players.sort((a,b) => {
                            const isACaptain = a.id === captainId;
                            const isBCaptain = b.id === captainId;
                            if (isACaptain !== isBCaptain) return isACaptain ? -1 : 1;
                            return parseInt(a.studentNumber) - parseInt(b.studentNumber);
                        }).map(p => (
                            <li key={p.id} className="bg-slate-700/50 p-3 rounded-md flex items-center gap-3">
                                {p.id === captainId && <CrownIcon className="w-5 h-5 text-yellow-400 flex-shrink-0" />}
                                <div className="flex-grow">
                                    <p className="font-semibold text-slate-200">{p.originalName}</p>
                                    <p className="text-xs text-slate-400">{t('player_history_subtitle', { class: p.class, number: p.studentNumber })}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="text-center mt-6 flex-shrink-0">
                    <button onClick={onClose} className="bg-slate-600 hover:bg-slate-500 font-bold py-2 px-6 rounded-lg">{t('close')}</button>
                </div>
            </div>
        </div>
    );

    const handleSaveLog = async () => {
        if (newLog.trim()) {
            await saveCoachingLog(player.id, newLog.trim());
            setNewLog('');
        }
    };

    const handleUnlockLogs = () => {
        if (!isLogUnlocked) {
            requestPassword(() => {
                setIsLogUnlocked(true);
                setActiveTab('coaching');
            });
        } else {
            setActiveTab('coaching');
        }
    };
    
    const winRateStats = useMemo(() => {
        const filteredHistory = winRateFilter === 'all' 
            ? performanceHistory 
            : performanceHistory.filter(p => p.teamSet && String(p.teamSet.teamCount ?? 4) === winRateFilter);

        const matchesPlayed = filteredHistory.length;
        if (matchesPlayed === 0) return { winRate: 0, wins: 0, total: 0 };
        
        const wins = filteredHistory.filter(p => {
            const playerTeamKey = p.teamName === p.match.teamA.name ? 'A' : 'B';
            return p.match.winner === playerTeamKey;
        }).length;
        
        const winRate = (wins / matchesPlayed) * 100;
        return { winRate, wins, total: matchesPlayed };
    }, [performanceHistory, winRateFilter]);


    const logs = useMemo(() => {
        if (!coachingLogs[player.id]) return [];
        return [...coachingLogs[player.id]].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [coachingLogs, player.id]);

    const chartData = useMemo(() => {
        // We want the chart to go from G1 -> G_Latest (left to right)
        // performanceHistory is sorted Latest -> Oldest in RecordScreen calculation, 
        // so we reverse it to be Oldest -> Latest for the chart (index 0 = first game).
        return [...performanceHistory].reverse().map(({ stats, match, teamName, opponent }, index) => {
            let value = 0;
            const totalServes = (stats.serviceAces || 0) + (stats.serveIn || 0) + (stats.serviceFaults || 0);

            if (chartStat === 'serveSuccessRate') {
                value = totalServes > 0 ? ((stats.serviceAces || 0) + (stats.serveIn || 0)) / totalServes * 100 : 0;
                value = parseFloat(value.toFixed(1));
            } else if (chartStat === 'serveAceRate') {
                value = totalServes > 0 ? ((stats.serviceAces || 0) / totalServes * 100) : 0;
                value = parseFloat(value.toFixed(1));
            } else {
                value = stats[chartStat as keyof PlayerStats] || 0;
            }

            const result = match.winner ? (match.winner === (match.teamA.name === teamName ? 'A' : 'B') ? '승' : '패') : '무';

            return {
                name: `G${index + 1}`, // G1, G2, ...
                label: `G${index + 1}`,
                [statDisplayNames[chartStat]]: value,
                // Metadata for Tooltip
                date: new Date(match.date).toLocaleDateString(),
                team: teamName,
                opponent: opponent,
                result: result,
                score: `${match.teamA.score}:${match.teamB.score}`
            };
        });
    }, [performanceHistory, chartStat, statDisplayNames]);

    const calculateRates = useMemo(() => {
        const totalServes = (cumulativeStats.serviceAces || 0) + (cumulativeStats.serveIn || 0) + (cumulativeStats.serviceFaults || 0);
        // Serve Ace Rate: Aces / Total Attempts
        const aceRate = totalServes > 0 ? (cumulativeStats.serviceAces / totalServes) * 100 : 0;
        // Serve Success Rate: (Aces + In) / Total Attempts
        const successRate = totalServes > 0 ? ((cumulativeStats.serviceAces + cumulativeStats.serveIn) / totalServes) * 100 : 0;
        
        return { aceRate, successRate };
    }, [cumulativeStats]);

    // Get badges earned by this player
    const earnedBadges = useMemo(() => {
        const playerBadges = playerAchievements[player.id];
        if (!playerBadges || !playerBadges.earnedBadgeIds) {
            return [];
        }
        
        return BADGE_DEFINITIONS.filter(badge => 
            playerBadges.earnedBadgeIds.has(badge.id)
        );
    }, [playerAchievements, player.id]);

    // Custom Tooltip Component
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-slate-900 border border-slate-700 p-3 rounded shadow-lg text-xs text-white">
                    <p className="font-bold text-[#00A3FF] mb-1">{label}</p>
                    <p className="text-slate-300 mb-1">{data.date}</p>
                    <div className="border-t border-slate-700 my-1 pt-1 space-y-0.5">
                        <p><span className="text-slate-400">소속:</span> {data.team}</p>
                        <p><span className="text-slate-400">상대:</span> {data.opponent}</p>
                        <p><span className="text-slate-400">결과:</span> <span className={data.result === '승' ? 'text-green-400' : 'text-red-400'}>{data.result}</span> ({data.score})</p>
                    </div>
                    <p className="mt-2 font-bold text-white border-t border-slate-700 pt-1">
                        {payload[0].name}: {payload[0].value}
                    </p>
                </div>
            );
        }
        return null;
    };


    return (
        <>
            {rosterToShow && <RosterModal teamName={rosterToShow.teamName} players={rosterToShow.players} captainId={rosterToShow.captainId} onClose={() => setRosterToShow(null)} />}
            {selectedBadgeDetail && (
                <BadgeDetailModal
                    badge={selectedBadgeDetail.badge}
                    player={selectedBadgeDetail.player}
                    playerStats={selectedBadgeDetail.stats}
                    onClose={() => setSelectedBadgeDetail(null)}
                />
            )}
            <div 
                className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 animate-fade-in"
                onClick={onClose}
            >
                <div 
                    className="bg-slate-900 rounded-lg shadow-2xl p-6 w-full max-w-4xl text-white border border-slate-700 max-h-[95vh] flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex-shrink-0 flex justify-between items-start mb-4">
                        <div>
                            <h2 className="text-3xl font-bold text-[#00A3FF]">{t('player_history_title', { name: player.originalName })}</h2>
                            <p className="text-slate-400">{t('player_history_subtitle', { class: player.class, number: player.studentNumber })}</p>
                        </div>
                        <button onClick={onClose} className="text-3xl font-bold text-slate-500 hover:text-white">&times;</button>
                    </div>

                     <div className="flex-shrink-0 border-b border-slate-700 mb-4">
                        <div className="flex space-x-4">
                            <button 
                                onClick={() => setActiveTab('analysis')}
                                className={`px-4 py-2 font-semibold ${activeTab === 'analysis' ? 'border-b-2 border-sky-400 text-sky-400' : 'text-slate-400 hover:text-white'}`}
                            >
                                {t('player_history_tab_analysis')}
                            </button>
                            <button 
                                onClick={handleUnlockLogs}
                                className={`flex items-center gap-2 px-4 py-2 font-semibold ${activeTab === 'coaching' ? 'border-b-2 border-sky-400 text-sky-400' : 'text-slate-400 hover:text-white'}`}
                            >
                                <LockClosedIcon className="w-4 h-4" />
                                {t('player_history_tab_coaching')}
                            </button>
                        </div>
                    </div>

                    <div className="flex-grow overflow-y-auto pr-2 -mr-2">
                        {activeTab === 'analysis' && (
                            <div className="space-y-6 animate-fade-in">
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {[
                                        { label: t('player_history_stat_matches'), value: cumulativeStats.matchesPlayed, unit: t('player_history_unit_sessions') },
                                        { label: t('player_history_stat_total_points'), value: cumulativeStats.points, unit: t('player_history_unit_points') },
                                        { label: t('stat_serve_ace_rate'), value: isNaN(calculateRates.aceRate) ? '0.0' : calculateRates.aceRate.toFixed(1), unit: '%' },
                                        { label: t('stat_serve_success_rate'), value: isNaN(calculateRates.successRate) ? '0.0' : calculateRates.successRate.toFixed(1), unit: '%' },
                                        { label: t('player_history_stat_total_spikes'), value: cumulativeStats.spikeSuccesses, unit: t('player_history_unit_sessions') },
                                        { label: t('player_history_stat_total_blocks'), value: cumulativeStats.blockingPoints, unit: t('player_history_unit_sessions') },
                                        { label: t('stat_display_digs'), value: cumulativeStats.digs || 0, unit: t('player_history_unit_sessions') },
                                        { label: t('stat_display_assists'), value: cumulativeStats.assists || 0, unit: t('player_history_unit_sessions') },
                                    ].map(stat => (
                                        <div key={stat.label} className="bg-slate-800 p-3 rounded-lg text-center">
                                            <p className="text-slate-400 text-sm">{stat.label}</p>
                                            <p className="text-3xl font-bold text-sky-400 mt-1">{stat.value}<span className="text-xl">{stat.unit}</span></p>
                                        </div>
                                    ))}
                                </div>
                                
                                <div className="bg-slate-800/50 p-4 rounded-lg">
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="font-semibold text-slate-300">{t('player_history_performance_trend')}</h3>
                                        <select 
                                            value={chartStat} 
                                            onChange={e => setChartStat(e.target.value as keyof PlayerStats | 'serveSuccessRate' | 'serveAceRate')} 
                                            className="bg-slate-700 text-xs p-1 rounded text-white"
                                        >
                                            {statOrder.map(key => <option key={key} value={key}>{statDisplayNames[key]}</option>)}
                                        </select>
                                    </div>
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            {chartData.length > 1 ? (
                                                <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                                    <XAxis dataKey="name" stroke="#94a3b8" />
                                                    <YAxis allowDecimals={false} stroke="#94a3b8" />
                                                    <Tooltip content={<CustomTooltip />} />
                                                    <Legend />
                                                    <Line type="monotone" dataKey={statDisplayNames[chartStat]} stroke="#0ea5e9" strokeWidth={2} />
                                                </LineChart>
                                            ) : (
                                                <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                                    <XAxis dataKey="name" stroke="#94a3b8" />
                                                    <YAxis allowDecimals={false} stroke="#94a3b8" />
                                                    <Tooltip content={<CustomTooltip />} />
                                                    <Legend />
                                                    <Bar dataKey={statDisplayNames[chartStat]} fill="#0ea5e9" barSize={60} />
                                                </BarChart>
                                            )}
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                                
                                 <div className="bg-slate-800/50 p-4 rounded-lg">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-semibold text-slate-300">{t('player_history_win_rate_analysis')}</h3>
                                        <div className="flex gap-2">
                                            <button onClick={() => setWinRateFilter('all')} className={`px-2 py-1 text-xs rounded ${winRateFilter === 'all' ? 'bg-sky-500' : 'bg-slate-700'}`}>{t('all')}</button>
                                            <button onClick={() => setWinRateFilter('4')} className={`px-2 py-1 text-xs rounded ${winRateFilter === '4' ? 'bg-sky-500' : 'bg-slate-700'}`}>{t('team_format_n', { n: 4 })}</button>
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-6xl font-bold text-green-400">{winRateStats.winRate.toFixed(1)}<span className="text-4xl">%</span></p>
                                        <p className="text-slate-400">{t('player_history_win_rate_details', { wins: winRateStats.wins, total: winRateStats.total })}</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h3 className="text-lg font-bold text-slate-300">{t('player_history_detailed_records')}</h3>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-center text-sm">
                                            <thead className="text-slate-400">
                                                <tr className="border-b-2 border-slate-700">
                                                    <th className="p-2 text-left">{t('player_history_header_date')}</th><th className="p-2 text-left">{t('player_history_header_team')}</th><th className="p-2 text-left">{t('player_history_header_opponent')}</th>
                                                    {statOrder.map(key => (
                                                        <th key={key} className="p-2">{statDisplayNames[key]}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                            {performanceHistory.map(({ match, teamName, opponent, stats }, index) => {
                                                 const totalServes = (stats.serviceAces || 0) + (stats.serveIn || 0) + (stats.serviceFaults || 0);
                                                return (
                                                <tr key={index} className="border-b border-slate-700 last:border-0 text-slate-300">
                                                    <td className="p-2 text-left">
                                                        <div className="text-xs">{new Date(match.date).toLocaleDateString()}</div>
                                                        <div className="text-[10px] text-slate-500 font-mono">(G{performanceHistory.length - index})</div>
                                                    </td>
                                                    <td className="p-2 text-left font-semibold">
                                                        <button onClick={() => handleTeamClick(match, teamName)} className="text-left hover:text-sky-400 transition-colors">
                                                            {teamName}
                                                        </button>
                                                    </td>
                                                    <td className="p-2 text-left">
                                                        <button onClick={() => handleTeamClick(match, opponent)} className="text-left hover:text-sky-400 transition-colors">
                                                            {opponent}
                                                        </button>
                                                    </td>
                                                    {statOrder.map(key => {
                                                        let displayValue: string | number = 0;
                                                        if (key === 'serveSuccessRate') {
                                                            displayValue = totalServes > 0 ? (((stats.serviceAces||0) + (stats.serveIn||0)) / totalServes * 100).toFixed(1) + '%' : '-';
                                                        } else if (key === 'serveAceRate') {
                                                            displayValue = totalServes > 0 ? ((stats.serviceAces||0) / totalServes * 100).toFixed(1) + '%' : '-';
                                                        } else {
                                                            displayValue = stats[key as keyof PlayerStats] || 0;
                                                        }
                                                        return <td key={key} className="p-2 font-mono">{displayValue}</td>
                                                    })}
                                                </tr>
                                            )})}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Earned Badges Section */}
                                <div className="bg-slate-800/50 p-4 rounded-lg">
                                    <h3 className="text-lg font-bold text-slate-300 mb-4">{t('player_history_earned_badges')}</h3>
                                    {earnedBadges.length > 0 ? (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                            {earnedBadges.map(badge => {
                                                const isCompetitive = badge.isCompetitive;
                                                return (
                                                    <button
                                                        key={badge.id}
                                                        onClick={() => setSelectedBadgeDetail({ badge, player, stats: cumulativeStats })}
                                                        className={`p-3 bg-slate-700/50 rounded-lg flex flex-col items-center justify-center gap-2 text-center border-2 transition-all duration-200 cursor-pointer ${
                                                            isCompetitive 
                                                                ? 'border-yellow-400/50 hover:border-yellow-400 yellow-glowing-border' 
                                                                : 'border-sky-500/50 hover:border-sky-400'
                                                        }`}
                                                    >
                                                        <badge.icon className={`w-10 h-10 ${
                                                            isCompetitive ? 'text-yellow-400' : 'text-sky-400'
                                                        }`} />
                                                        <p className={`text-xs font-semibold ${
                                                            isCompetitive ? 'text-yellow-300' : 'text-slate-200'
                                                        }`}>
                                                            {t(badge.nameKey)}
                                                        </p>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-center py-6">
                                            <p className="text-slate-500">{t('player_history_no_badges')}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        {activeTab === 'coaching' && (
                            isLogUnlocked ? (
                                <div className="animate-fade-in space-y-4">
                                    <div className="bg-slate-800 p-4 rounded-lg">
                                        <textarea
                                            value={newLog}
                                            onChange={(e) => setNewLog(e.target.value)}
                                            placeholder={t('player_history_coaching_log_placeholder')}
                                            className="w-full h-24 bg-slate-900 border border-slate-700 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                                        />
                                        <div className="text-right mt-2">
                                            <button onClick={handleSaveLog} className="bg-sky-600 hover:bg-sky-500 font-semibold py-2 px-4 rounded-lg">{t('player_history_coaching_log_save')}</button>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        {logs.length > 0 ? logs.map((log: CoachingLog, index: number) => (
                                            <div key={index} className="bg-slate-800 p-3 rounded-lg">
                                                <p className="text-xs text-slate-500 mb-1">{new Date(log.date).toLocaleString()}</p>
                                                <p className="text-slate-300 whitespace-pre-wrap">{log.content}</p>
                                            </div>
                                        )) : (
                                            <p className="text-center text-slate-500 py-4">{t('player_history_coaching_log_none')}</p>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-center text-slate-400">
                                    <LockClosedIcon className="w-16 h-16 text-slate-500 mb-4" />
                                    <h3 className="text-xl font-bold">{t('player_history_coaching_log_private')}</h3>
                                    <p className="mt-2">{t('player_history_coaching_log_unlock_prompt')}</p>
                                </div>
                            )
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};
