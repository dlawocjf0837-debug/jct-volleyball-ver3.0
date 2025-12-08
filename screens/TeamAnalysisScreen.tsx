
import React, { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { ArrowUpIcon, ArrowDownIcon } from '../components/icons';
import TeamEmblem from '../components/TeamEmblem';
import { SavedTeamInfo } from '../types';
import { useTranslation } from '../hooks/useTranslation';

type TeamStats = {
    teamName: string;
    className: string;
    teamCount: number;
    emblem?: string;
    slogan?: string;
    color?: string;
    gamesPlayed: number;
    wins: number;
    losses: number;
    winRate: number;
    pointsFor: number;
    pointsAgainst: number;
    avgPointsFor: number;
    avgPointsAgainst: number;
    serviceAces: number;
    serviceFaults: number;
    blockingPoints: number;
    spikeSuccesses: number;
    threeHitPlays: number;
    fairPlay: number;
    serveIn?: number;
    avgServeSuccess?: number;
};

type SortConfig = {
    key: keyof TeamStats;
    direction: 'ascending' | 'descending';
};

interface TeamComparisonRadarModalProps {
    isOpen: boolean;
    onClose: () => void;
    team1: TeamStats;
    team2: TeamStats;
    allTeamsData: TeamStats[];
}

const TeamComparisonRadarModal: React.FC<TeamComparisonRadarModalProps> = ({ isOpen, onClose, team1, team2, allTeamsData }) => {
    const { t } = useTranslation();
    const radarMetrics: { key: keyof TeamStats; label: string }[] = [
        { key: 'avgPointsFor', label: t('analysis_radar_avg_score') },
        { key: 'serviceAces', label: t('analysis_radar_avg_serve') },
        { key: 'avgServeSuccess', label: t('analysis_radar_avg_serve_success') },
        { key: 'spikeSuccesses', label: t('analysis_radar_avg_spike') },
        { key: 'blockingPoints', label: t('analysis_radar_avg_blocking') },
        { key: 'threeHitPlays', label: t('analysis_radar_avg_3hit') },
        { key: 'fairPlay', label: t('analysis_radar_avg_fairplay') },
    ];

    const chartData = useMemo(() => {
        if (!team1 || !team2) return [];

        const maxValues = radarMetrics.reduce((acc, metric) => {
            const maxValue = Math.max(...allTeamsData.map(t => Number((t as any)[metric.key]) || 0), 1);
            (acc as any)[metric.key] = Math.ceil(maxValue); // Round up for cleaner axis
            return acc;
        }, {} as Partial<Record<keyof TeamStats, number>>);

        return radarMetrics.map(metric => ({
            subject: metric.label,
            [team1.teamName]: team1[metric.key] || 0,
            [team2.teamName]: team2[metric.key] || 0,
            fullMark: (maxValues as any)[metric.key],
        }));
    }, [team1, team2, allTeamsData]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-slate-900 rounded-lg shadow-2xl p-6 w-full max-w-2xl text-white border border-slate-700" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-[#00A3FF]">{t('analysis_compare_title')}</h2>
                        <div className="flex items-center gap-4 mt-1 text-slate-300">
                           <p><span className="font-bold text-lg" style={{color: team1.color || '#3b82f6'}}>■</span> {team1.teamName}</p>
                           <p><span className="font-bold text-lg" style={{color: team2.color || '#ef4444'}}>■</span> {team2.teamName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-2xl font-bold text-slate-500 hover:text-white">&times;</button>
                </div>
                <div style={{ width: '100%', height: 400 }}>
                    <ResponsiveContainer>
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                            <PolarGrid stroke="#475569" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#cbd5e1' }} />
                            <PolarRadiusAxis angle={30} domain={[0, 'dataMax']} stroke="#475569" />
                            <Radar name={team1.teamName} dataKey={team1.teamName} stroke={team1.color || '#3b82f6'} fill={team1.color || '#3b82f6'} fillOpacity={0.6} />
                            <Radar name={team2.teamName} dataKey={team2.teamName} stroke={team2.color || '#ef4444'} fill={team2.color || '#ef4444'} fillOpacity={0.6} />
                            <Tooltip contentStyle={{ backgroundColor: 'rgba(10, 15, 31, 0.9)', borderColor: '#475569', borderRadius: '0.5rem' }} />
                            <Legend />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};


const TeamAnalysisScreen: React.FC = () => {
    const { matchHistory, teamSets, showToast } = useData();
    const { t } = useTranslation();
    const [selectedClass, setSelectedClass] = useState<string>('all');
    const [teamCountFilter, setTeamCountFilter] = useState('all');
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'winRate', direction: 'descending' });
    const [chartMetric, setChartMetric] = useState<keyof TeamStats>('winRate');
    const [selectedTeamsForComparison, setSelectedTeamsForComparison] = useState<Set<string>>(new Set());
    const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);
    const [isGraphOnlyMode, setIsGraphOnlyMode] = useState(false);

    const teamDetailsMap = useMemo(() => {
        const map = new Map<string, SavedTeamInfo & { className: string, teamCount: number }>();
        teamSets.forEach(set => {
            set.teams.forEach(team => {
                map.set(team.teamName, { ...team, className: set.className, teamCount: set.teamCount ?? 4 });
            });
        });
        return map;
    }, [teamSets]);

    const teamPerformanceData = useMemo((): TeamStats[] => {
        const stats: { [teamName: string]: Omit<TeamStats, 'teamName' | 'winRate' | 'avgPointsFor' | 'avgPointsAgainst' | 'className' | 'emblem' | 'color' | 'slogan' | 'teamCount' | 'avgServeSuccess'> } = {};

        matchHistory
            .filter(match => match.status === 'completed' && match.winner)
            .forEach(match => {
                const processTeam = (team: 'teamA' | 'teamB') => {
                    const teamData = match[team];
                    const opponentData = team === 'teamA' ? match.teamB : match.teamA;
                    const teamName = teamData.name;

                    if (!stats[teamName]) {
                        stats[teamName] = {
                            gamesPlayed: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0,
                            serviceAces: 0, serviceFaults: 0, blockingPoints: 0, spikeSuccesses: 0, threeHitPlays: 0, fairPlay: 0,
                            serveIn: 0
                        };
                    }

                    stats[teamName].gamesPlayed += 1;
                    if (match.winner === (team === 'teamA' ? 'A' : 'B')) {
                        stats[teamName].wins += 1;
                    } else {
                        stats[teamName].losses += 1;
                    }
                    stats[teamName].pointsFor += teamData.score || 0;
                    stats[teamName].pointsAgainst += opponentData.score || 0;
                    stats[teamName].serviceAces += teamData.serviceAces || 0;
                    stats[teamName].serviceFaults += teamData.serviceFaults || 0;
                    stats[teamName].blockingPoints += teamData.blockingPoints || 0;
                    stats[teamName].spikeSuccesses += teamData.spikeSuccesses || 0;
                    stats[teamName].threeHitPlays += teamData.threeHitPlays || 0;
                    stats[teamName].fairPlay += teamData.fairPlay || 0;
                    
                    // Sum serveIn from playerStats
                    let teamServeIn = 0;
                    if (teamData.playerStats) {
                        teamServeIn = Object.values(teamData.playerStats).reduce<number>((sum, p: any) => sum + (Number(p.serveIn) || 0), 0);
                    }
                    stats[teamName].serveIn! += teamServeIn;
                };

                processTeam('teamA');
                processTeam('teamB');
            });

        return Object.entries(stats).map(([teamName, data]) => {
            const gamesPlayed = data.gamesPlayed;
            const details = teamDetailsMap.get(teamName);

            return {
                teamName,
                className: details?.className || t('cheer_song_etc_class'),
                teamCount: details?.teamCount ?? 0,
                emblem: details?.emblem,
                slogan: details?.slogan,
                color: details?.color,
                gamesPlayed: data.gamesPlayed,
                wins: data.wins,
                losses: data.losses,
                winRate: gamesPlayed > 0 ? (data.wins / gamesPlayed) * 100 : 0,
                pointsFor: data.pointsFor,
                pointsAgainst: data.pointsAgainst,
                avgPointsFor: gamesPlayed > 0 ? data.pointsFor / gamesPlayed : 0,
                avgPointsAgainst: gamesPlayed > 0 ? data.pointsAgainst / gamesPlayed : 0,
                serviceAces: gamesPlayed > 0 ? data.serviceAces / gamesPlayed : 0,
                avgServeSuccess: gamesPlayed > 0 ? (data.serviceAces + (Number(data.serveIn) || 0)) / gamesPlayed : 0,
                spikeSuccesses: gamesPlayed > 0 ? data.spikeSuccesses / gamesPlayed : 0,
                threeHitPlays: gamesPlayed > 0 ? data.threeHitPlays / gamesPlayed : 0,
                fairPlay: gamesPlayed > 0 ? data.fairPlay / gamesPlayed : 0,
                serviceFaults: data.serviceFaults,
                blockingPoints: data.blockingPoints,
                serveIn: data.serveIn
            };
        });
    }, [matchHistory, teamDetailsMap, t]);

    const availableClasses = useMemo(() => {
        const classSet = new Set(teamPerformanceData.map(t => t.className));
        return Array.from(classSet).sort();
    }, [teamPerformanceData]);

    const availableTeamCounts = useMemo(() => {
        const counts = new Set<number>();
        const relevantSets = (selectedClass === 'all')
            ? teamSets
            : teamSets.filter(set => set.className === selectedClass);
            
        relevantSets.forEach(set => {
            counts.add(set.teamCount ?? 4); 
        });
        return Array.from(counts).filter(c => c > 0).sort((a,b) => a - b).map(String);
    }, [teamSets, selectedClass]);

    const filteredData = useMemo(() => {
        const classFiltered = selectedClass === 'all'
            ? teamPerformanceData
            : teamPerformanceData.filter(team => team.className === selectedClass);
        
        if (teamCountFilter === 'all') {
            return classFiltered;
        }
        return classFiltered.filter(team => String(team.teamCount) === teamCountFilter);
    }, [teamPerformanceData, selectedClass, teamCountFilter]);

    const sortedData = useMemo(() => {
        const sortableData = [...filteredData];
        if (sortConfig.key) {
            sortableData.sort((a, b) => {
                const valA = a[sortConfig.key];
                const valB = b[sortConfig.key];

                if (valA === valB) return 0;
                if (valA === undefined || valA === null) return 1;
                if (valB === undefined || valB === null) return -1;

                if (valA < valB) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (valA > valB) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableData;
    }, [filteredData, sortConfig]);

    const handleSort = (key: keyof TeamStats) => {
        let direction: 'ascending' | 'descending' = 'descending';
        if (sortConfig.key === key && sortConfig.direction === 'descending') {
            direction = 'ascending';
        }
        setSortConfig({ key, direction });
    };
    
    const handleTeamSelectForComparison = (teamName: string) => {
        setSelectedTeamsForComparison(prev => {
            const newSet = new Set(prev);
            if (newSet.has(teamName)) {
                newSet.delete(teamName);
            } else {
                if (newSet.size < 2) {
                    newSet.add(teamName);
                } else {
                    showToast(t('analysis_compare_max_toast'), 'error');
                }
            }
            return newSet;
        });
    };

    const comparisonTeams = useMemo(() => {
        if (selectedTeamsForComparison.size !== 2) return null;
        const teamNames = Array.from(selectedTeamsForComparison);
        const team1 = teamPerformanceData.find(t => t.teamName === teamNames[0]);
        const team2 = teamPerformanceData.find(t => t.teamName === teamNames[1]);
        if (!team1 || !team2) return null;
        return { team1, team2 };
    }, [selectedTeamsForComparison, teamPerformanceData]);
    
    const tooltips: Partial<Record<keyof TeamStats, string>> = {
        gamesPlayed: t('analysis_tooltip_games'),
        wins: t('analysis_tooltip_wins'),
        losses: t('analysis_tooltip_losses'),
        winRate: t('analysis_tooltip_winrate'),
        avgPointsFor: t('analysis_tooltip_avg_for'),
        avgPointsAgainst: t('analysis_tooltip_avg_against'),
        serviceAces: t('analysis_tooltip_avg_serve'),
        avgServeSuccess: t('analysis_tooltip_avg_serve_success'),
        spikeSuccesses: t('analysis_tooltip_avg_spike'),
        threeHitPlays: t('analysis_tooltip_avg_3hit'),
        fairPlay: t('analysis_tooltip_avg_fairplay'),
    };

    const maxValuesForHighlight = useMemo((): Partial<Record<keyof TeamStats, number>> => {
        if (sortedData.length === 0) return {};
    
        const maxVals: Partial<Record<keyof TeamStats, number>> = {};
        const keysToCompare: (keyof TeamStats)[] = [
            'gamesPlayed', 'wins', 'winRate', 'avgPointsFor', 
            'serviceAces', 'avgServeSuccess', 'spikeSuccesses', 'threeHitPlays', 'fairPlay'
        ];
    
        keysToCompare.forEach(key => {
            (maxVals as any)[key] = Math.max(...sortedData.map(team => Number((team as any)[key]) || 0));
        });
    
        return maxVals;
    }, [sortedData]);

    const tableHeaders: { key: keyof TeamStats; label: string; format?: (value: number) => string }[] = [
        { key: 'teamName', label: t('analysis_header_team') },
        { key: 'gamesPlayed', label: t('analysis_header_games') },
        { key: 'wins', label: t('analysis_header_wins') },
        { key: 'losses', label: t('analysis_header_losses') },
        { key: 'winRate', label: t('analysis_header_winrate'), format: v => `${v.toFixed(1)}%` },
        { key: 'avgPointsFor', label: t('analysis_header_avg_for'), format: v => v.toFixed(1) },
        { key: 'avgPointsAgainst', label: t('analysis_header_avg_against'), format: v => v.toFixed(1) },
        { key: 'serviceAces', label: t('analysis_header_avg_serve'), format: v => v.toFixed(1) },
        { key: 'avgServeSuccess', label: t('analysis_header_avg_serve_success'), format: v => v.toFixed(1) },
        { key: 'spikeSuccesses', label: t('analysis_header_avg_spike'), format: v => v.toFixed(1) },
        { key: 'threeHitPlays', label: t('analysis_header_avg_3hit'), format: v => v.toFixed(1) },
        { key: 'fairPlay', label: t('analysis_header_avg_fairplay'), format: v => v.toFixed(1) },
    ];

    const chartOptions: { key: keyof TeamStats; label: string }[] = [
        { key: 'winRate', label: t('analysis_chart_winrate') },
        { key: 'avgPointsFor', label: t('analysis_chart_avg_for') },
        { key: 'avgPointsAgainst', label: t('analysis_chart_avg_against') },
        { key: 'serviceAces', label: t('analysis_chart_avg_serve') },
        { key: 'avgServeSuccess', label: t('analysis_chart_avg_serve_success') },
        { key: 'spikeSuccesses', label: t('analysis_chart_avg_spike') },
        { key: 'threeHitPlays', label: t('analysis_chart_avg_3hit') },
        { key: 'fairPlay', label: t('analysis_chart_avg_fairplay') },
    ];
    
    return (
        <>
            {comparisonTeams && (
                <TeamComparisonRadarModal 
                    isOpen={isComparisonModalOpen}
                    onClose={() => setIsComparisonModalOpen(false)}
                    team1={comparisonTeams.team1}
                    team2={comparisonTeams.team2}
                    allTeamsData={teamPerformanceData}
                />
            )}
            
            {/* Scrollable Layout */}
            <div className="w-full max-w-[1400px] mx-auto p-4 space-y-6 animate-fade-in">
                
                {/* Header Controls */}
                <div className="flex-shrink-0 flex flex-col lg:flex-row items-center lg:justify-between mb-6 gap-4 bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                    <h1 className="text-3xl lg:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 text-center lg:text-right">
                        {t('team_analysis_title')}
                    </h1>
                    <div className="flex gap-4 items-center self-start lg:self-auto">
                        <select
                            id="class-select-analysis"
                            value={selectedClass}
                            onChange={(e) => {
                                setSelectedClass(e.target.value);
                                setTeamCountFilter('all');
                                setSelectedTeamsForComparison(new Set());
                            }}
                            className="bg-slate-700 border border-slate-600 rounded-md p-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00A3FF]"
                        >
                            <option value="all">{t('analysis_filter_all_classes')}</option>
                            {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <div className="flex gap-1">
                            <button onClick={() => setTeamCountFilter('all')} className={`px-3 py-1.5 text-xs rounded transition-colors ${teamCountFilter === 'all' ? 'bg-[#00A3FF] text-white font-bold' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}>{t('record_all_formats')}</button>
                            {availableTeamCounts.map(count => (
                                <button key={count} onClick={() => setTeamCountFilter(count)} className={`px-3 py-1.5 text-xs rounded transition-colors ${teamCountFilter === count ? 'bg-[#00A3FF] text-white font-bold' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}>
                                    {t('record_team_format', { count })}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {sortedData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-slate-400 py-10">
                        <p className="text-lg font-bold">{t('analysis_no_data_title')}</p>
                        <p className="text-sm mt-2">{t('analysis_no_data_desc')}</p>
                    </div>
                ) : (
                    <>
                        {/* Table Section - Shows Data Values */}
                        <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden shadow-xl">
                            <div className="p-3 flex justify-end bg-slate-800/50 border-b border-slate-700">
                                <button 
                                    onClick={() => setIsComparisonModalOpen(true)}
                                    disabled={selectedTeamsForComparison.size !== 2}
                                    className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold py-2 px-4 rounded transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed"
                                >
                                    {t('analysis_compare_button')} ({selectedTeamsForComparison.size}/2)
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-center text-xs">
                                    <thead className="text-slate-300 bg-slate-950">
                                        <tr>
                                            <th className="p-4 whitespace-nowrap">{t('analysis_header_compare')}</th>
                                            {tableHeaders.map(({ key, label }) => (
                                                <th key={key} className="p-4 whitespace-nowrap cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => key !== 'teamName' && handleSort(key as keyof TeamStats)} title={tooltips[key]}>
                                                    <div className="flex items-center justify-center gap-1">
                                                        {label}
                                                        {sortConfig.key === key ? (
                                                            sortConfig.direction === 'descending' ? <ArrowDownIcon className="w-3 h-3 text-sky-400" /> : <ArrowUpIcon className="w-3 h-3 text-sky-400" />
                                                        ) : null}
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="font-mono">
                                        {sortedData.map((team) => (
                                            <tr key={team.teamName} className="border-b border-slate-800 last:border-b-0 hover:bg-white/5 transition-colors">
                                                <td className="p-4">
                                                    <input 
                                                        type="checkbox"
                                                        checked={selectedTeamsForComparison.has(team.teamName)}
                                                        onChange={() => handleTeamSelectForComparison(team.teamName)}
                                                        className="h-4 w-4 bg-slate-700 border-slate-500 rounded text-sky-500 focus:ring-sky-500 cursor-pointer"
                                                    />
                                                </td>
                                                {tableHeaders.map(({ key, format }) => {
                                                    const value = team[key];
                                                    const isMax = maxValuesForHighlight[key] !== undefined && typeof value === 'number' && value > 0 && value === maxValuesForHighlight[key];
                                                    const highlightClass = isMax ? 'text-sky-300 font-bold bg-sky-900/20' : 'text-slate-300';
                                                    
                                                    if (key === 'teamName') {
                                                        return (
                                                            <td key={key} className="p-4 font-sans font-semibold text-left border-r border-slate-800">
                                                                <div className="flex items-center gap-3 min-w-[140px]">
                                                                    <div className="w-1.5 h-8 rounded-full" style={{backgroundColor: team.color}}></div>
                                                                    <TeamEmblem emblem={team.emblem} color={team.color} className="w-6 h-6 flex-shrink-0" />
                                                                    <span className="truncate text-slate-200 text-sm">{team.teamName}</span>
                                                                </div>
                                                            </td>
                                                        )
                                                    }

                                                    return (
                                                        <td key={key} className={`p-4 ${highlightClass}`}>
                                                            {format && typeof value === 'number' ? format(value) : String(value)}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Chart Section - Horizontal Scroll */}
                        <div className="bg-slate-900/50 p-6 rounded-lg border border-slate-800 shadow-xl">
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center gap-4">
                                    <h3 className="text-xl font-bold text-slate-300">{t('analysis_chart_title')}</h3>
                                    <button
                                        onClick={() => setIsGraphOnlyMode(!isGraphOnlyMode)}
                                        className="bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold py-1.5 px-3 rounded transition-colors"
                                    >
                                        {isGraphOnlyMode ? t('analysis_view_scroll') : t('analysis_view_graph_only')}
                                    </button>
                                </div>
                                <select
                                    value={chartMetric}
                                    onChange={(e) => setChartMetric(e.target.value as keyof TeamStats)}
                                    className="bg-slate-700 border border-slate-600 rounded-md py-1.5 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                                >
                                    {chartOptions.map(opt => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
                                </select>
                            </div>
                            <div className={`h-96 ${isGraphOnlyMode ? 'w-full' : 'overflow-x-auto overflow-y-hidden pb-2 custom-scrollbar'}`}>
                                {/* Use a minimum width based on number of items to force scrolling */}
                                <div style={{ width: isGraphOnlyMode ? '100%' : Math.max(1200, sortedData.length * 60), height: '100%', minWidth: '100%' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={sortedData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                            {/* Rotate X Axis labels to avoid overlap */}
                                            <XAxis 
                                                dataKey="teamName" 
                                                tick={{ fill: '#94a3b8', fontSize: 12 }} 
                                                interval={0} 
                                                angle={-30} 
                                                textAnchor="end"
                                                height={70}
                                                hide={isGraphOnlyMode}
                                            />
                                            <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} allowDecimals={false} />
                                            <Tooltip 
                                                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem' }} 
                                                cursor={{fill: 'rgba(255,255,255,0.05)'}}
                                            />
                                            <Legend verticalAlign="top" height={36}/>
                                            <Bar dataKey={chartMetric} name={chartOptions.find(o => o.key === chartMetric)?.label} barSize={isGraphOnlyMode ? undefined : 40} radius={[4, 4, 0, 0]}>
                                                {sortedData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color || '#3b82f6'} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </>
    );
};

export default TeamAnalysisScreen;
