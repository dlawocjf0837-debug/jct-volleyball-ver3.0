
import React, { useState, useMemo, useCallback } from 'react';
import { useData } from '../contexts/DataContext';
import { League, LeagueMatch, SavedTeamInfo } from '../types';
import TeamEmblem from '../components/TeamEmblem';
import { useTranslation } from '../hooks/useTranslation';

interface LeagueScreenProps {
    onStartMatch: (data: { teamAKey: string, teamBKey: string, teamAName: string, teamBName: string, leagueId: string, leagueMatchId: string }) => void;
}

const LeagueScreen: React.FC<LeagueScreenProps> = ({ onStartMatch }) => {
    const { teamSets, leagues, saveLeagues, teamSetsMap, teamPerformanceData } = useData();
    const { t } = useTranslation();
    const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
    const [isSetupMode, setIsSetupMode] = useState(false);
    const [selectedTeamKeys, setSelectedTeamKeys] = useState<Set<string>>(new Set());
    const [showPredictions, setShowPredictions] = useState<Record<string, boolean>>({});
    const [matchesPerDay, setMatchesPerDay] = useState<number>(3);

    const allTeams = useMemo(() => {
        const teams: (SavedTeamInfo & { key: string, className: string })[] = [];
        teamSets.forEach(set => {
            set.teams.forEach(team => {
                teams.push({
                    ...team,
                    key: `${set.id}___${team.teamName}`,
                    className: set.className
                });
            });
        });
        return teams.sort((a,b) => a.teamName.localeCompare(b.teamName));
    }, [teamSets]);

    const handleToggleTeam = (key: string) => {
        setSelectedTeamKeys(prev => {
            const newSet = new Set(prev);
            if (newSet.has(key)) newSet.delete(key);
            else newSet.add(key);
            return newSet;
        });
    };

    const handleCreateLeague = () => {
        if (selectedTeamKeys.size < 3) {
            alert(t('league_min_teams_alert'));
            return;
        }

        const teams: string[] = Array.from(selectedTeamKeys);
        
        // Round Robin Algorithm
        // 1. Add a dummy team if odd number
        const rrTeams = [...teams];
        if (rrTeams.length % 2 !== 0) {
            rrTeams.push('BYE');
        }

        const n = rrTeams.length;
        const totalRounds = n - 1;
        const matchesPerRound = n / 2;
        let schedule: LeagueMatch[] = [];

        for (let round = 0; round < totalRounds; round++) {
            for (let i = 0; i < matchesPerRound; i++) {
                const home = rrTeams[i];
                const away = rrTeams[n - 1 - i];

                if (home !== 'BYE' && away !== 'BYE') {
                    const teamA = teamSetsMap.get(home);
                    const teamB = teamSetsMap.get(away);
                    if (teamA && teamB) {
                        schedule.push({
                            id: `match-${schedule.length + 1}`,
                            teamAKey: home,
                            teamBKey: away,
                            teamAName: teamA.team.teamName,
                            teamBName: teamB.team.teamName,
                            matchId: null,
                        });
                    }
                }
            }
            // Rotate teams (keep index 0 fixed)
            rrTeams.splice(1, 0, rrTeams.pop()!);
        }

        // Apply "Matches Per Day" grouping
        const matchesPerDayVal = matchesPerDay > 0 ? matchesPerDay : 1;
        schedule = schedule.map((match, index) => ({
            ...match,
            day: Math.floor(index / matchesPerDayVal) + 1
        }));

        const newLeague: League = {
            id: `league_${Date.now()}`,
            name: `${t('league_default_name_prefix')} - ${new Date().toLocaleDateString()}`,
            createdAt: new Date().toISOString(),
            teamKeys: Array.from(selectedTeamKeys),
            schedule,
        };

        saveLeagues([...leagues, newLeague]);
        setSelectedLeague(newLeague);
        setIsSetupMode(false);
        setSelectedTeamKeys(new Set());
    };
    
    const getPrediction = useCallback((teamAName: string, teamBName: string) => {
        const teamAStats = teamPerformanceData.find(t => t.teamName === teamAName);
        const teamBStats = teamPerformanceData.find(t => t.teamName === teamBName);
        
        const rateA = teamAStats?.winRate ?? 50;
        const rateB = teamBStats?.winRate ?? 50;

        if (rateA === 50 && rateB === 50 && !teamAStats && !teamBStats) return null;
        if (rateA + rateB === 0) return { a: 50, b: 50 };

        const totalRate = rateA + rateB;
        return { a: Math.round((rateA / totalRate) * 100), b: Math.round((rateB / totalRate) * 100) };
    }, [teamPerformanceData]);

    const standings = useMemo(() => {
        if (!selectedLeague) return [];
        const leagueTeams = teamPerformanceData.filter(t => selectedLeague.teamKeys.includes(allTeams.find(at => at.teamName === t.teamName)?.key || ''));
        return leagueTeams.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.pointDifference !== a.pointDifference) return b.pointDifference - a.pointDifference;
            return b.pointsFor - a.pointsFor;
        });
    }, [selectedLeague, teamPerformanceData, allTeams]);

    const groupedSchedule = useMemo((): Record<number, LeagueMatch[]> => {
        if (!selectedLeague) return {};
        const grouped: Record<number, LeagueMatch[]> = {};
        selectedLeague.schedule.forEach(match => {
            const day = match.day || 1;
            if (!grouped[day]) grouped[day] = [];
            grouped[day].push(match);
        });
        return grouped;
    }, [selectedLeague]);

    if (isSetupMode) {
        return (
            <div className="flex flex-col gap-4">
                <div className="flex flex-col lg:flex-row items-center lg:justify-between mb-6 gap-4">
                    <h1 className="text-3xl lg:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 text-center lg:text-right">
                        {t('league_create_new_title')}
                    </h1>
                </div>
                <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <p className="text-slate-300 text-sm mb-2">{t('league_round_robin_info')}</p>
                    <div className="flex items-center gap-2">
                        <label className="text-slate-300 text-sm font-semibold">{t('league_matches_per_day')}:</label>
                        <input 
                            type="number" 
                            min="1" 
                            value={matchesPerDay} 
                            onChange={(e) => setMatchesPerDay(parseInt(e.target.value) || 1)}
                            className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white w-20 text-center focus:outline-none focus:ring-1 focus:ring-sky-500"
                            placeholder={t('league_matches_per_day_placeholder')}
                        />
                    </div>
                </div>
                <p>{t('league_select_teams_prompt', { count: selectedTeamKeys.size })}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-h-96 overflow-y-auto p-2 bg-slate-800/50 rounded">
                    {allTeams.map(team => (
                        <button key={team.key} onClick={() => handleToggleTeam(team.key)} className={`p-3 rounded-lg text-left ${selectedTeamKeys.has(team.key) ? 'bg-sky-600 ring-2 ring-sky-400' : 'bg-slate-700 hover:bg-slate-600'}`}>
                            <p className="font-bold truncate">{team.teamName}</p>
                            <p className="text-sm text-slate-300">{team.className}</p>
                        </button>
                    ))}
                </div>
                <div className="flex gap-4">
                    <button onClick={handleCreateLeague} disabled={selectedTeamKeys.size < 3} className="bg-green-600 hover:bg-green-500 disabled:bg-slate-600 text-white font-bold py-2 px-4 rounded">{t('league_generate_schedule')}</button>
                    <button onClick={() => setIsSetupMode(false)} className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded">{t('cancel')}</button>
                </div>
            </div>
        );
    }
    
    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row items-center lg:justify-between mb-6 gap-4 no-print">
                <h1 className="text-3xl lg:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 text-center lg:text-right">
                    {t('league_title')}
                </h1>
                <button onClick={() => { setIsSetupMode(true); setSelectedLeague(null); }} className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 px-4 rounded min-h-[44px] w-full lg:w-auto">{t('league_create_new_button')}</button>
            </div>
            <div className="flex gap-2 no-print">
                {leagues.map(l => (
                    <button key={l.id} onClick={() => setSelectedLeague(l)} className={`px-3 py-1 rounded ${selectedLeague?.id === l.id ? 'bg-sky-500' : 'bg-slate-700'}`}>{l.name}</button>
                ))}
            </div>
            {selectedLeague ? (
                <div className="printable-area">
                    <div className="printable-header hidden print:flex">
                        <h1 className="printable-title">J-IVE {t('league_report_title')}</h1>
                        <p className="printable-subtitle">{selectedLeague.name}</p>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-slate-800/50 p-4 rounded-lg print-bg-white">
                             <div className="flex justify-between items-center mb-2">
                                <h3 className="text-xl font-bold text-slate-300 print-text-black">{t('league_standings_title')}</h3>
                            </div>
                            <table className="w-full text-center text-sm">
                                <thead>
                                    <tr className="border-b-2 border-slate-600 text-slate-300 print-text-black">
                                        <th className="p-2">{t('league_header_rank')}</th><th className="p-2 text-left">{t('league_header_team')}</th><th className="p-2">{t('league_header_points')}</th><th className="p-2">{t('league_header_wins')}</th><th className="p-2">{t('league_header_losses')}</th><th className="p-2">{t('league_header_ties')}</th><th className="p-2">{t('league_header_gd')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {standings.map((team, index) => (
                                        <tr key={team.teamName} className="border-b border-slate-700 text-slate-200 print-text-black">
                                            <td className="p-2 font-bold">{index + 1}</td>
                                            <td className="p-2 text-left font-semibold">{team.teamName}</td>
                                            <td className="p-2 font-mono font-bold text-sky-400">{team.points}</td>
                                            <td className="p-2 font-mono">{team.wins}</td>
                                            <td className="p-2 font-mono">{team.losses}</td>
                                            <td className="p-2 font-mono">{team.ties}</td>
                                            <td className="p-2 font-mono">{team.pointDifference > 0 ? `+${team.pointDifference}` : team.pointDifference}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="bg-slate-800/50 p-4 rounded-lg print-bg-white">
                            <h3 className="text-xl font-bold text-slate-300 mb-2 print-text-black">{t('league_schedule_title')}</h3>
                            <div className="max-h-[600px] overflow-y-auto space-y-4 pr-2">
                                {Object.entries(groupedSchedule).sort((a, b) => Number(a[0]) - Number(b[0])).map(([day, matches]) => (
                                    <div key={day} className="space-y-2">
                                        <h4 className="text-sm font-bold text-sky-400 sticky top-0 bg-slate-900/90 py-1 px-2 rounded">{t('league_day_n', { n: day })}</h4>
                                        {(matches as LeagueMatch[]).map(match => {
                                            const teamAInfo = teamSetsMap.get(match.teamAKey);
                                            const teamBInfo = teamSetsMap.get(match.teamBKey);
                                            const prediction = getPrediction(match.teamAName, match.teamBName);
                                            return (
                                                <div key={match.id} className="bg-slate-800 p-3 rounded-lg print-bg-white border border-slate-700">
                                                    <div className="flex justify-between items-center text-lg">
                                                        <span className="font-semibold truncate w-5/12 text-right" style={{color: teamAInfo?.team.color}}>{match.teamAName}</span>
                                                        <span className="font-bold text-slate-500 w-2/12 text-center text-sm">vs</span>
                                                        <span className="font-semibold truncate w-5/12 text-left" style={{color: teamBInfo?.team.color}}>{match.teamBName}</span>
                                                    </div>
                                                    {prediction && (
                                                        showPredictions[match.id] ? (
                                                            <div className="text-xs text-center text-slate-400 pt-1 animate-fade-in space-y-1">
                                                                <div>
                                                                    {t('ai_prediction')}: <span className="font-bold" style={{ color: teamAInfo?.team.color }}>{prediction.a}%</span> vs <span className="font-bold" style={{ color: teamBInfo?.team.color }}>{prediction.b}%</span>
                                                                </div>
                                                                <button
                                                                    onClick={() => setShowPredictions(prev => ({ ...prev, [match.id]: false }))}
                                                                    className="bg-slate-700 hover:bg-slate-600 text-white/80 font-bold py-0.5 px-2 rounded-full text-xs transition-colors"
                                                                >
                                                                    {t('close')}
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="text-center pt-1 no-print">
                                                                <button
                                                                    onClick={() => setShowPredictions(prev => ({ ...prev, [match.id]: true }))}
                                                                    className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-1 px-3 rounded text-xs transition-colors"
                                                                >
                                                                    {t('ai_prediction_button')}
                                                                </button>
                                                            </div>
                                                        )
                                                    )}
                                                    <button 
                                                        onClick={() => onStartMatch({ ...match, leagueId: selectedLeague.id, leagueMatchId: match.id })}
                                                        className="w-full mt-2 bg-green-600 hover:bg-green-500 text-white font-bold py-1 rounded text-sm transition-colors no-print"
                                                    >
                                                        {t('start_match_button')}
                                                    </button>
                                                </div>
                                            )
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            ) : <p className="text-slate-400">{t('league_select_or_create_prompt')}</p>}
        </div>
    );
};

export default LeagueScreen;
