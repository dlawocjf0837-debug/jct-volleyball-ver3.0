
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { League, LeagueMatch, MatchState, SavedTeamInfo, PlayerStats, Player, TeamMatchState } from '../types';
import TeamEmblem from '../components/TeamEmblem';
import { useTranslation } from '../hooks/useTranslation';
import MatchDetailAnalysis from '../components/MatchDetailAnalysis';

interface LeagueScreenProps {
    onStartMatch: (data: { teamAKey: string, teamBKey: string, teamAName: string, teamBName: string, leagueId: string, leagueMatchId: string }) => void;
    selectedLeagueId?: string | null;
    onOpenMatchAnalysis: (matchId: string) => void;
}

type LeagueStanding = {
    teamKey: string;
    teamName: string;
    points: number;
    wins: number;
    losses: number;
    ties: number;
    pointDifference: number;
};

type LeagueMvpEntry = {
    player: Player;
    teamName: string;
    totalPoints: number;
    sumPoints: number;
    sumServiceAces: number;
    sumBlockingPoints: number;
    sumDigs: number;
    sumAssists: number;
    sumServeIn: number;
    sumServiceFaults: number;
};

const LeagueScreen: React.FC<LeagueScreenProps> = ({ onStartMatch, selectedLeagueId, onOpenMatchAnalysis }) => {
    const { teamSets, leagues, saveLeagues, teamSetsMap, matchHistory, teamPerformanceData, settings } = useData();
    const { t } = useTranslation();
    const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
    const [isSetupMode, setIsSetupMode] = useState(false);
    const [selectedTeamKeys, setSelectedTeamKeys] = useState<Set<string>>(new Set());
    const [showPredictions, setShowPredictions] = useState<Record<string, boolean>>({});
    const [matchesPerDay, setMatchesPerDay] = useState<number>(3);
    const [leagueNameInput, setLeagueNameInput] = useState<string>('');
    const [isEditingLeagueName, setIsEditingLeagueName] = useState(false);
    const [editedLeagueName, setEditedLeagueName] = useState<string>('');

    // 외부에서 선택된 리그 ID가 주어지면 해당 리그를 활성화
    useEffect(() => {
        if (!selectedLeagueId) return;
        const found = leagues.find(l => l.id === selectedLeagueId) || null;
        setSelectedLeague(found);
    }, [selectedLeagueId, leagues]);

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

        const nameFromInput = leagueNameInput.trim();

        const newLeague: League = {
            id: `league_${Date.now()}`,
            name: nameFromInput || `${t('league_default_name_prefix')} - ${new Date().toLocaleDateString()}`,
            createdAt: new Date().toISOString(),
            teamKeys: Array.from(selectedTeamKeys),
            schedule,
        };

        saveLeagues([...leagues, newLeague]);
        setSelectedLeague(newLeague);
        setIsSetupMode(false);
        setSelectedTeamKeys(new Set());
        setLeagueNameInput('');
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

    // --- League-scoped match history & standings ---
    const leagueMatches = useMemo(() => {
        if (!selectedLeague) return [] as (MatchState & { date: string; time?: number })[];
        return matchHistory.filter(
            (m) => m.status === 'completed' && m.leagueId === selectedLeague.id
        ) as (MatchState & { date: string; time?: number })[];
    }, [matchHistory, selectedLeague]);

    const standings = useMemo<LeagueStanding[]>(() => {
        if (!selectedLeague) return [];

        const statsByTeamKey = new Map<string, LeagueStanding>();

        const ensureTeam = (teamKey: string, teamName: string) => {
            if (!statsByTeamKey.has(teamKey)) {
                statsByTeamKey.set(teamKey, {
                    teamKey,
                    teamName,
                    points: 0,
                    wins: 0,
                    losses: 0,
                    ties: 0,
                    pointDifference: 0,
                });
            }
            return statsByTeamKey.get(teamKey)!;
        };

        // 리그에 포함된 모든 팀을 먼저 초기화 (경기 전에도 순위표에 표시되도록)
        selectedLeague.teamKeys.forEach((teamKey) => {
            const info = teamSetsMap.get(teamKey);
            const name = info?.team.teamName || teamKey;
            ensureTeam(teamKey, name);
        });

        leagueMatches.forEach((match) => {
            const teamAKey = match.teamA.key;
            const teamBKey = match.teamB.key;
            if (!teamAKey || !teamBKey) return;

            const teamAInfo = teamSetsMap.get(teamAKey);
            const teamBInfo = teamSetsMap.get(teamBKey);
            if (!teamAInfo || !teamBInfo) return;

            const teamAName = teamAInfo.team.teamName;
            const teamBName = teamBInfo.team.teamName;

            const a = ensureTeam(teamAKey, teamAName);
            const b = ensureTeam(teamBKey, teamBName);

            const scoreA = match.teamA.score;
            const scoreB = match.teamB.score;

            a.pointDifference += scoreA - scoreB;
            b.pointDifference += scoreB - scoreA;

            if (match.winner === 'A') {
                a.wins += 1;
                b.losses += 1;
                a.points += 3;
            } else if (match.winner === 'B') {
                b.wins += 1;
                a.losses += 1;
                b.points += 3;
            } else {
                // 무승부
                a.ties += 1;
                b.ties += 1;
                a.points += 1;
                b.points += 1;
            }
        });

        const allStandings = Array.from(statsByTeamKey.values());

        return allStandings.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.pointDifference !== a.pointDifference) return b.pointDifference - a.pointDifference;
            // 추가 정렬 기준: 이름 오름차순
            return a.teamName.localeCompare(b.teamName);
        });
    }, [leagueMatches, selectedLeague, teamSetsMap]);

    const leagueMvpList = useMemo<LeagueMvpEntry[]>(() => {
        if (!selectedLeague || leagueMatches.length === 0) return [];

        const totals = new Map<string, LeagueMvpEntry>();

        const accumulateTeam = (team: TeamMatchState) => {
            if (!team.players || !team.playerStats) return;
            Object.keys(team.playerStats).forEach((playerId) => {
                const player = team.players[playerId];
                const stats: PlayerStats = team.playerStats[playerId];
                if (!player || !stats) return;

                const key = `${selectedLeague.id}::${playerId}`;
                
                // 리그/토너먼트 전용 커스텀 가중치 적용
                const customScore = 
                    (stats.points || 0) * 1.0 +           // 득점/스파이크: +1.0점
                    (stats.serviceAces || 0) * 2.0 +       // 서브 에이스: +2.0점
                    (stats.blockingPoints || 0) * 1.5 +    // 블로킹: +1.5점
                    (stats.digs || 0) * 0.5 +              // 디그: +0.5점
                    (stats.assists || 0) * 0.5 +            // 어시스트: +0.5점
                    (stats.serveIn || 0) * 0.1 -            // 서브 성공(In): +0.1점
                    (stats.serviceFaults || 0) * 1.0;      // 범실: -1.0점

                if (customScore <= 0) return;

                const existing = totals.get(key);
                if (existing) {
                    existing.totalPoints += customScore;
                    existing.sumPoints += stats.points || 0;
                    existing.sumServiceAces += stats.serviceAces || 0;
                    existing.sumBlockingPoints += stats.blockingPoints || 0;
                    existing.sumDigs += stats.digs || 0;
                    existing.sumAssists += stats.assists || 0;
                    existing.sumServeIn += stats.serveIn || 0;
                    existing.sumServiceFaults += stats.serviceFaults || 0;
                } else {
                    totals.set(key, {
                        player,
                        teamName: team.name,
                        totalPoints: customScore,
                        sumPoints: stats.points || 0,
                        sumServiceAces: stats.serviceAces || 0,
                        sumBlockingPoints: stats.blockingPoints || 0,
                        sumDigs: stats.digs || 0,
                        sumAssists: stats.assists || 0,
                        sumServeIn: stats.serveIn || 0,
                        sumServiceFaults: stats.serviceFaults || 0,
                    });
                }
            });
        };

        leagueMatches.forEach((match) => {
            accumulateTeam(match.teamA);
            accumulateTeam(match.teamB);
        });

        const list = Array.from(totals.values());
        list.sort((a, b) => {
            if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
            return a.player.originalName.localeCompare(b.player.originalName);
        });

        return list.slice(0, 3);
    }, [leagueMatches, selectedLeague]);

    // 부문별 타이틀 배지 계산 (순수 횟수 기준)
    const categoryAwards = useMemo(() => {
        if (!selectedLeague || leagueMatches.length === 0) return null;

        const playerStats = new Map<string, {
            player: Player;
            teamName: string;
            totalScoringCount: number; // 순수 득점 횟수 (스파이크 + 블로킹 + 서브 에이스)
            serviceAces: number;
            serveIn: number;
            blockingPoints: number;
            digs: number;
        }>();

        const accumulateTeam = (team: TeamMatchState) => {
            if (!team.players || !team.playerStats) return;
            Object.keys(team.playerStats).forEach((playerId) => {
                const player = team.players[playerId];
                const stats: PlayerStats = team.playerStats[playerId];
                if (!player || !stats) return;

                const key = `${selectedLeague.id}::${playerId}`;
                const existing = playerStats.get(key);
                
                if (existing) {
                    existing.totalScoringCount += (stats.points || 0) + (stats.serviceAces || 0) + (stats.blockingPoints || 0);
                    existing.serviceAces += stats.serviceAces || 0;
                    existing.serveIn += stats.serveIn || 0;
                    existing.blockingPoints += stats.blockingPoints || 0;
                    existing.digs += stats.digs || 0;
                } else {
                    playerStats.set(key, {
                        player,
                        teamName: team.name,
                        totalScoringCount: (stats.points || 0) + (stats.serviceAces || 0) + (stats.blockingPoints || 0),
                        serviceAces: stats.serviceAces || 0,
                        serveIn: stats.serveIn || 0,
                        blockingPoints: stats.blockingPoints || 0,
                        digs: stats.digs || 0,
                    });
                }
            });
        };

        leagueMatches.forEach((match) => {
            accumulateTeam(match.teamA);
            accumulateTeam(match.teamB);
        });

        const allPlayers = Array.from(playerStats.values());
        
        const scoringKing = allPlayers.length > 0 ? allPlayers.reduce((max, p) => 
            p.totalScoringCount > max.totalScoringCount ? p : max
        ) : null;
        
        const aceKing = allPlayers.length > 0 ? allPlayers.reduce((max, p) => 
            p.serviceAces > max.serviceAces ? p : max
        ) : null;
        
        const serveInKing = allPlayers.length > 0 ? allPlayers.reduce((max, p) => 
            p.serveIn > max.serveIn ? p : max
        ) : null;
        
        const blockingKing = allPlayers.length > 0 ? allPlayers.reduce((max, p) => 
            p.blockingPoints > max.blockingPoints ? p : max
        ) : null;
        
        const digKing = allPlayers.length > 0 ? allPlayers.reduce((max, p) => 
            p.digs > max.digs ? p : max
        ) : null;

        return {
            scoringKing: scoringKing && scoringKing.totalScoringCount > 0 ? scoringKing : null,
            aceKing: aceKing && aceKing.serviceAces > 0 ? aceKing : null,
            serveInKing: serveInKing && serveInKing.serveIn > 0 ? serveInKing : null,
            blockingKing: blockingKing && blockingKing.blockingPoints > 0 ? blockingKing : null,
            digKing: digKing && digKing.digs > 0 ? digKing : null,
            allPlayers: allPlayers, // Top 5 랭킹을 위해 전체 리스트도 반환
        };
    }, [leagueMatches, selectedLeague]);

    const [selectedMvp, setSelectedMvp] = useState<LeagueMvpEntry | null>(null);
    const [selectedDetailMatch, setSelectedDetailMatch] = useState<(MatchState & { date?: string; time?: number }) | null>(null);
    const [showDetailReportModal, setShowDetailReportModal] = useState(false);
    const [detailReportMatch, setDetailReportMatch] = useState<(MatchState & { date?: string; time?: number }) | null>(null);
    const [selectedRankingCategory, setSelectedRankingCategory] = useState<'scoring' | 'ace' | 'serveIn' | 'blocking' | 'dig' | null>(null);

    // 모달 열릴 때 배경 스크롤 잠금
    useEffect(() => {
        if (selectedMvp || selectedDetailMatch || showDetailReportModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [selectedMvp, selectedDetailMatch, showDetailReportModal]);

    const handleSaveLeagueName = async () => {
        if (!selectedLeague) return;
        const trimmed = editedLeagueName.trim();
        if (!trimmed) {
            setIsEditingLeagueName(false);
            return;
        }
        const updatedLeagues = leagues.map(l =>
            l.id === selectedLeague.id ? { ...l, name: trimmed } : l
        );
        await saveLeagues(updatedLeagues);
        const updated = updatedLeagues.find(l => l.id === selectedLeague.id) || null;
        setSelectedLeague(updated);
        setIsEditingLeagueName(false);
    };

    if (isSetupMode) {
        return (
            <div className="flex flex-col gap-4">
                <div className="flex flex-col lg:flex-row items-center lg:justify-between mb-6 gap-4">
                    <h1 className="text-3xl lg:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 text-center lg:text-right">
                        {t('league_create_new_title')}
                    </h1>
                </div>
                <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 space-y-3">
                    <div>
                        <label className="block text-slate-300 text-sm font-semibold mb-1">리그 이름</label>
                        <input
                            type="text"
                            value={leagueNameInput}
                            onChange={(e) => setLeagueNameInput(e.target.value)}
                            placeholder={t('league_default_name_prefix')}
                            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
                        />
                    </div>
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
            {/* MVP 상세 모달 */}
            {selectedMvp && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setSelectedMvp(null)}>
                    <div
                        className="bg-slate-900 rounded-2xl border border-sky-500/40 shadow-2xl max-w-md w-full p-5 text-slate-100"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center mb-3">
                            <h2 className="text-xl font-bold">🏆 리그 MVP 상세</h2>
                            <button
                                onClick={() => setSelectedMvp(null)}
                                className="text-slate-400 hover:text-white text-xl leading-none"
                            >
                                ×
                            </button>
                        </div>
                        <p className="mb-4">
                            <span className="font-bold text-lg">{selectedMvp.player.originalName}</span>
                            <span className="text-slate-400"> ({selectedMvp.teamName})</span>
                        </p>
                        
                        {/* 점수 산출 내역 */}
                        <div className="bg-slate-800/60 rounded-lg p-4 mb-4 space-y-2">
                            <h3 className="text-sm font-semibold text-slate-300 mb-3">점수 획득 내역</h3>
                            <div className="space-y-1.5 text-sm">
                                {selectedMvp.sumPoints > 0 && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-300">공격 득점 (+1.0) × {selectedMvp.sumPoints}회</span>
                                        <span className="font-mono text-sky-300">+{(selectedMvp.sumPoints * 1.0).toFixed(1)}</span>
                                    </div>
                                )}
                                {selectedMvp.sumServiceAces > 0 && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-300">서브 에이스 (+2.0) × {selectedMvp.sumServiceAces}회</span>
                                        <span className="font-mono text-sky-300">+{(selectedMvp.sumServiceAces * 2.0).toFixed(1)}</span>
                                    </div>
                                )}
                                {selectedMvp.sumBlockingPoints > 0 && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-300">블로킹 득점 (+1.5) × {selectedMvp.sumBlockingPoints}회</span>
                                        <span className="font-mono text-sky-300">+{(selectedMvp.sumBlockingPoints * 1.5).toFixed(1)}</span>
                                    </div>
                                )}
                                {selectedMvp.sumDigs > 0 && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-300">디그 (+0.5) × {selectedMvp.sumDigs}회</span>
                                        <span className="font-mono text-sky-300">+{(selectedMvp.sumDigs * 0.5).toFixed(1)}</span>
                                    </div>
                                )}
                                {selectedMvp.sumAssists > 0 && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-300">어시스트 (+0.5) × {selectedMvp.sumAssists}회</span>
                                        <span className="font-mono text-sky-300">+{(selectedMvp.sumAssists * 0.5).toFixed(1)}</span>
                                    </div>
                                )}
                                {selectedMvp.sumServeIn > 0 && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-300">서브 성공(In) (+0.1) × {selectedMvp.sumServeIn}회</span>
                                        <span className="font-mono text-sky-300">+{(selectedMvp.sumServeIn * 0.1).toFixed(1)}</span>
                                    </div>
                                )}
                                {selectedMvp.sumServiceFaults > 0 && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-300">범실 (-1.0) × {selectedMvp.sumServiceFaults}회</span>
                                        <span className="font-mono text-red-400">-{(selectedMvp.sumServiceFaults * 1.0).toFixed(1)}</span>
                                    </div>
                                )}
                            </div>
                            <div className="border-t border-slate-600 mt-3 pt-3">
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-slate-200">총점</span>
                                    <span className="font-bold text-2xl text-sky-300">{selectedMvp.totalPoints.toFixed(1)}점</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 경기 상세 모달 */}
            {selectedDetailMatch && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => {
                    setSelectedDetailMatch(null);
                    document.body.style.overflow = 'unset';
                }}>
                    <div
                        className="bg-slate-900 rounded-2xl border border-sky-500/40 shadow-2xl max-w-3xl w-full p-5 text-slate-100 space-y-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center mb-1">
                            <h2 className="text-xl font-bold">경기 상세 결과</h2>
                            <button
                                onClick={() => {
                                    setSelectedDetailMatch(null);
                                    document.body.style.overflow = 'unset';
                                }}
                                className="text-slate-400 hover:text-white text-xl leading-none"
                            >
                                ×
                            </button>
                        </div>
                        <p className="text-sm text-slate-400">
                            {selectedDetailMatch.date && new Date(selectedDetailMatch.date).toLocaleString('ko-KR')}
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-lg font-semibold">
                                <span>{selectedDetailMatch.teamA.name}</span>
                                <span className="font-mono text-sky-300">
                                    {selectedDetailMatch.teamA.score} : {selectedDetailMatch.teamB.score}
                                </span>
                                <span>{selectedDetailMatch.teamB.name}</span>
                            </div>
                            {selectedDetailMatch.winner && (
                                <div className="text-sm text-emerald-300 font-semibold">
                                    승리 팀:{' '}
                                    {selectedDetailMatch.winner === 'A'
                                        ? selectedDetailMatch.teamA.name
                                        : selectedDetailMatch.teamB.name}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                            {[
                                { label: selectedDetailMatch.teamA.name, team: selectedDetailMatch.teamA },
                                { label: selectedDetailMatch.teamB.name, team: selectedDetailMatch.teamB },
                            ].map(({ label, team }) => {
                                const totals = Object.values(team.playerStats || {}).reduce(
                                    (acc, s: any) => {
                                        acc.points += s.points || 0;
                                        acc.serviceAces += s.serviceAces || 0;
                                        acc.blockingPoints += s.blockingPoints || 0;
                                        acc.spikeSuccesses += s.spikeSuccesses || 0;
                                        return acc;
                                    },
                                    { points: 0, serviceAces: 0, blockingPoints: 0, spikeSuccesses: 0 }
                                );
                                return (
                                    <div key={label} className="bg-slate-800/60 rounded-xl p-3 border border-slate-700">
                                        <h3 className="font-semibold mb-2">{label}</h3>
                                        <ul className="space-y-1">
                                            <li>공격 득점: {totals.points}</li>
                                            <li>서브 에이스: {totals.serviceAces}</li>
                                            <li>블로킹 득점: {totals.blockingPoints}</li>
                                            <li>스파이크 성공: {totals.spikeSuccesses}</li>
                                        </ul>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex justify-end mt-2">
                            <button
                                onClick={() => {
                                    if (!selectedDetailMatch) return;
                                    setDetailReportMatch(selectedDetailMatch);
                                    setShowDetailReportModal(true);
                                    setSelectedDetailMatch(null);
                                    document.body.style.overflow = 'hidden';
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-xs font-semibold"
                            >
                                📊 자세히 분석하기
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                        <div className="bg-slate-800/50 p-4 rounded-lg print-bg-white space-y-4">
                            <div className="flex items-center justify-between mb-2 no-print">
                                {isEditingLeagueName ? (
                                    <div className="flex items-center gap-2 w-full">
                                        <input
                                            type="text"
                                            value={editedLeagueName}
                                            onChange={(e) => setEditedLeagueName(e.target.value)}
                                            className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                                        />
                                        <button
                                            onClick={handleSaveLeagueName}
                                            className="px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-xs font-semibold"
                                        >
                                            저장
                                        </button>
                                        <button
                                            onClick={() => setIsEditingLeagueName(false)}
                                            className="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-xs font-semibold"
                                        >
                                            취소
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between w-full">
                                        <span className="text-lg font-bold text-slate-100 truncate">
                                            {selectedLeague.name}
                                        </span>
                                        <button
                                            onClick={() => {
                                                setEditedLeagueName(selectedLeague.name);
                                                setIsEditingLeagueName(true);
                                            }}
                                            className="ml-2 text-xs px-2 py-1 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-200"
                                        >
                                            ✏️ 이름 수정
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="text-xl font-bold text-slate-300 print-text-black">{t('league_standings_title')}</h3>
                                </div>
                                <table className="w-full text-center text-sm">
                                    <thead>
                                        <tr className="border-b-2 border-slate-600 text-slate-300 print-text-black">
                                            <th className="p-2">{t('league_header_rank')}</th>
                                            <th className="p-2 text-left">{t('league_header_team')}</th>
                                            <th className="p-2">{t('league_header_points')}</th>
                                            <th className="p-2">{t('league_header_wins')}</th>
                                            <th className="p-2">{t('league_header_losses')}</th>
                                            <th className="p-2">{t('league_header_ties')}</th>
                                            <th className="p-2">{t('league_header_gd')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {standings.map((team, index) => (
                                            <tr key={team.teamKey} className="border-b border-slate-700 text-slate-200 print-text-black">
                                                <td className="p-2 font-bold">{index + 1}</td>
                                                <td className="p-2 text-left font-semibold">{team.teamName}</td>
                                                <td className="p-2 font-mono font-bold text-sky-400">{team.points}</td>
                                                <td className="p-2 font-mono">{team.wins}</td>
                                                <td className="p-2 font-mono">{team.losses}</td>
                                                <td className="p-2 font-mono">{team.ties}</td>
                                                <td className="p-2 font-mono">
                                                    {team.pointDifference > 0 ? `+${team.pointDifference}` : team.pointDifference}
                                                </td>
                                            </tr>
                                        ))}
                                        {standings.length === 0 && (
                                            <tr>
                                                <td colSpan={7} className="p-4 text-slate-400 text-center">
                                                    {t('no_league_matches_yet')}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* 리그 MVP 섹션 */}
                            <div>
                                <div className="flex items-center gap-2 mt-4 mb-2">
                                    <h3 className="text-lg font-semibold text-slate-200 print-text-black">
                                        🏆 리그 MVP
                                    </h3>
                                    <div className="group relative">
                                        <span className="text-xs text-slate-400 cursor-help">ℹ️</span>
                                        <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-slate-800 border border-slate-600 rounded-lg shadow-xl text-xs text-slate-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                                            <p className="font-bold mb-2 text-sky-300">리그/토너먼트 MVP 산정 기준</p>
                                            <ul className="space-y-1">
                                                <li>• 공격/스파이크 득점: +1.0점</li>
                                                <li>• 서브 에이스: +2.0점</li>
                                                <li>• 블로킹 득점: +1.5점</li>
                                                <li>• 일반 서브 성공(In): +0.1점</li>
                                                <li>• 디그/어시스트: +0.5점</li>
                                                <li>• 범실: -1.0점</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                                {leagueMvpList.length === 0 ? (
                                    <p className="text-sm text-slate-400">
                                        아직 MVP를 계산할 수 있는 리그 경기 데이터가 없습니다.
                                    </p>
                                ) : (
                                    <ul className="space-y-1 text-sm">
                                        {leagueMvpList.map((entry, index) => {
                                            const rank = index + 1;
                                            return (
                                                <li
                                                    key={`${entry.player.id}-${entry.teamName}`}
                                                    className="flex items-center justify-between bg-slate-900/60 rounded px-3 py-1.5 cursor-pointer hover:bg-slate-800/80 transition-colors"
                                                    onClick={() => setSelectedMvp(entry)}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-yellow-300 font-bold w-6 text-center">
                                                            {rank}
                                                        </span>
                                                        <span className="font-semibold text-slate-100">
                                                            {entry.player.originalName}
                                                        </span>
                                                        <span className="text-xs text-slate-400">
                                                            ({entry.teamName})
                                                        </span>
                                                    </div>
                                                    <span className="text-sm font-mono text-sky-300">
                                                        {entry.totalPoints.toFixed(1)}
                                                    </span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>

                            {/* 부문별 타이틀 배지 */}
                            {categoryAwards && (
                                <div className="mt-6">
                                    <div className="flex items-center gap-2 mb-3">
                                        <h3 className="text-lg font-semibold text-slate-200 print-text-black">
                                            부문별 랭킹
                                        </h3>
                                        <div className="group relative">
                                            <span className="text-xs text-slate-400 cursor-help">ℹ️</span>
                                            <div className="absolute left-0 bottom-full mb-2 w-64 p-3 bg-slate-800 border border-slate-600 rounded-lg shadow-xl text-xs text-slate-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                                                <p className="font-bold mb-2 text-sky-300">부문별 랭킹 안내</p>
                                                <p className="mb-2">부문별 랭킹은 총 <span className="font-bold text-sky-300">5개 부문</span>으로 구성되어 있습니다:</p>
                                                <ul className="space-y-1">
                                                    <li>• 🔥 득점왕: 공격+블로킹+서브 에이스 합계</li>
                                                    <li>• 🚀 서브 득점왕: 서브 에이스 횟수</li>
                                                    <li>• 🎯 서브 성공왕: 일반 서브 성공(In) 횟수</li>
                                                    <li>• 🛡️ 블로킹왕: 블로킹 득점 횟수</li>
                                                    <li>• ⚡ 디그왕: 디그 성공 횟수</li>
                                                </ul>
                                                <p className="mt-2 text-slate-400">각 부문의 📊 버튼을 클릭하면 Top 5 랭킹을 확인할 수 있습니다.</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {categoryAwards.scoringKing && (
                                            <div className="bg-gradient-to-br from-orange-800/30 to-slate-900/50 rounded-lg p-3 border border-orange-500/40">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-2xl">🔥</span>
                                                    <span className="font-bold text-orange-300 text-sm">득점왕</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="font-semibold text-white text-sm">{categoryAwards.scoringKing.player.originalName}</p>
                                                        <p className="text-xs text-slate-400">{categoryAwards.scoringKing.teamName}</p>
                                                        <p className="text-xs text-orange-300 font-mono mt-1">{categoryAwards.scoringKing.totalScoringCount}득점</p>
                                                    </div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedRankingCategory('scoring');
                                                        }}
                                                        className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200"
                                                    >
                                                        📊 랭킹
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        {categoryAwards.aceKing && (
                                            <div className="bg-gradient-to-br from-yellow-800/30 to-slate-900/50 rounded-lg p-3 border border-yellow-500/40">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-2xl">🚀</span>
                                                    <span className="font-bold text-yellow-300 text-sm">서브 득점왕</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="font-semibold text-white text-sm">{categoryAwards.aceKing.player.originalName}</p>
                                                        <p className="text-xs text-slate-400">{categoryAwards.aceKing.teamName}</p>
                                                        <p className="text-xs text-yellow-300 font-mono mt-1">{categoryAwards.aceKing.serviceAces}개</p>
                                                    </div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedRankingCategory('ace');
                                                        }}
                                                        className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200"
                                                    >
                                                        📊 랭킹
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        {categoryAwards.serveInKing && (
                                            <div className="bg-gradient-to-br from-blue-800/30 to-slate-900/50 rounded-lg p-3 border border-blue-500/40">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-2xl">🎯</span>
                                                    <span className="font-bold text-blue-300 text-sm">서브 성공왕</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="font-semibold text-white text-sm">{categoryAwards.serveInKing.player.originalName}</p>
                                                        <p className="text-xs text-slate-400">{categoryAwards.serveInKing.teamName}</p>
                                                        <p className="text-xs text-blue-300 font-mono mt-1">{categoryAwards.serveInKing.serveIn}개</p>
                                                    </div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedRankingCategory('serveIn');
                                                        }}
                                                        className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200"
                                                    >
                                                        📊 랭킹
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        {categoryAwards.blockingKing && (
                                            <div className="bg-gradient-to-br from-purple-800/30 to-slate-900/50 rounded-lg p-3 border border-purple-500/40">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-2xl">🛡️</span>
                                                    <span className="font-bold text-purple-300 text-sm">블로킹왕</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="font-semibold text-white text-sm">{categoryAwards.blockingKing.player.originalName}</p>
                                                        <p className="text-xs text-slate-400">{categoryAwards.blockingKing.teamName}</p>
                                                        <p className="text-xs text-purple-300 font-mono mt-1">{categoryAwards.blockingKing.blockingPoints}개</p>
                                                    </div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedRankingCategory('blocking');
                                                        }}
                                                        className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200"
                                                    >
                                                        📊 랭킹
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        {categoryAwards.digKing && (
                                            <div className="bg-gradient-to-br from-green-800/30 to-slate-900/50 rounded-lg p-3 border border-green-500/40">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-2xl">⚡</span>
                                                    <span className="font-bold text-green-300 text-sm">디그왕</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="font-semibold text-white text-sm">{categoryAwards.digKing.player.originalName}</p>
                                                        <p className="text-xs text-slate-400">{categoryAwards.digKing.teamName}</p>
                                                        <p className="text-xs text-green-300 font-mono mt-1">{categoryAwards.digKing.digs}개</p>
                                                    </div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedRankingCategory('dig');
                                                        }}
                                                        className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200"
                                                    >
                                                        📊 랭킹
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* 지난 경기 결과 섹션 */}
                            <div>
                                <h3 className="text-lg font-semibold text-slate-200 mt-4 mb-2 print-text-black">
                                    {t('league_past_results_title') !== 'league_past_results_title'
                                        ? t('league_past_results_title')
                                        : '지난 경기 결과'}
                                </h3>
                                    {leagueMatches.length === 0 ? (
                                    <p className="text-sm text-slate-400">
                                        {t('no_league_matches_yet') !== 'no_league_matches_yet'
                                            ? t('no_league_matches_yet')
                                            : '아직 진행된 리그 경기가 없습니다.'}
                                    </p>
                                    ) : (
                                        <div className="max-h-64 overflow-y-auto pr-1 space-y-2">
                                            {leagueMatches
                                                .slice()
                                                .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
                                                .map((m, idx) => {
                                                    const dateLabel = m.date ? new Date(m.date).toLocaleDateString() : '';
                                                    const scoreLabel = `${m.teamA.score} : ${m.teamB.score}`;
                                                    const winnerName =
                                                        m.winner === 'A'
                                                            ? m.teamA.name
                                                            : m.winner === 'B'
                                                            ? m.teamB.name
                                                            : null;
                                                    return (
                                                        <button
                                                            key={`${m.date}_${idx}`}
                                                            type="button"
                                                            className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs sm:text-sm bg-slate-900/60 rounded px-2 py-1.5 text-left hover:bg-slate-800/80 transition-colors"
                                                            onClick={() => setSelectedDetailMatch(m)}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-slate-400 min-w-[70px]">{dateLabel}</span>
                                                                <span className="font-semibold text-slate-50 truncate">
                                                                    {m.teamA.name} <span className="text-slate-400">vs</span> {m.teamB.name}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-3 mt-1 sm:mt-0 sm:ml-3">
                                                                <span className="font-mono text-sky-400">{scoreLabel}</span>
                                                                {winnerName && (
                                                                    <span className="text-[11px] sm:text-xs px-2 py-0.5 rounded-full bg-emerald-600/20 text-emerald-300">
                                                                        {winnerName}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                        </div>
                                    )}
                            </div>
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

            {/* 상세 리포트 모달 - RecordScreen으로 이동 */}
            {showDetailReportModal && detailReportMatch && (
                <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50" onClick={() => {
                    setShowDetailReportModal(false);
                    setDetailReportMatch(null);
                }}>
                    <div className="bg-slate-900 rounded-2xl border border-sky-500/40 shadow-2xl max-w-7xl w-full p-6 text-slate-100 relative max-h-[95vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4 sticky top-0 bg-slate-900 z-10 pb-4 border-b border-slate-700">
                            <h2 className="text-2xl font-bold">경기 상세 분석 리포트</h2>
                            <button
                                onClick={() => {
                                    setShowDetailReportModal(false);
                                    setDetailReportMatch(null);
                                    document.body.style.overflow = 'unset';
                                }}
                                className="text-slate-400 hover:text-white text-2xl leading-none"
                            >
                                ×
                            </button>
                        </div>
                        {detailReportMatch && detailReportMatch.teamA && detailReportMatch.teamB ? (
                            <MatchDetailAnalysis 
                                matchData={detailReportMatch}
                                teamSets={teamSets}
                                settings={settings}
                                t={t}
                            />
                        ) : (
                            <div className="text-center text-slate-400 py-12">
                                <p>경기 데이터를 불러올 수 없습니다.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 부문별 Top 5 랭킹 모달 */}
            {selectedRankingCategory && categoryAwards && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => {
                    setSelectedRankingCategory(null);
                    document.body.style.overflow = 'unset';
                }}>
                    <div
                        className="bg-slate-900 rounded-2xl border border-sky-500/40 shadow-2xl max-w-md w-full p-5 text-slate-100"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">
                                {selectedRankingCategory === 'scoring' && '🔥 득점왕 랭킹'}
                                {selectedRankingCategory === 'ace' && '🚀 서브 득점왕 랭킹'}
                                {selectedRankingCategory === 'serveIn' && '🎯 서브 성공왕 랭킹'}
                                {selectedRankingCategory === 'blocking' && '🛡️ 블로킹왕 랭킹'}
                                {selectedRankingCategory === 'dig' && '⚡ 디그왕 랭킹'}
                            </h2>
                            <button
                                onClick={() => {
                                    setSelectedRankingCategory(null);
                                    document.body.style.overflow = 'unset';
                                }}
                                className="text-slate-400 hover:text-white text-xl leading-none"
                            >
                                ×
                            </button>
                        </div>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {(() => {
                                let sortedPlayers = [...categoryAwards.allPlayers];
                                let getValue: (p: typeof sortedPlayers[0]) => number;
                                let unit = '개';

                                switch (selectedRankingCategory) {
                                    case 'scoring':
                                        sortedPlayers.sort((a, b) => b.totalScoringCount - a.totalScoringCount);
                                        getValue = (p) => p.totalScoringCount;
                                        unit = '득점';
                                        break;
                                    case 'ace':
                                        sortedPlayers.sort((a, b) => b.serviceAces - a.serviceAces);
                                        getValue = (p) => p.serviceAces;
                                        break;
                                    case 'serveIn':
                                        sortedPlayers.sort((a, b) => b.serveIn - a.serveIn);
                                        getValue = (p) => p.serveIn;
                                        break;
                                    case 'blocking':
                                        sortedPlayers.sort((a, b) => b.blockingPoints - a.blockingPoints);
                                        getValue = (p) => p.blockingPoints;
                                        break;
                                    case 'dig':
                                        sortedPlayers.sort((a, b) => b.digs - a.digs);
                                        getValue = (p) => p.digs;
                                        break;
                                    default:
                                        return null;
                                }

                                const top5 = sortedPlayers.slice(0, 5).filter(p => getValue(p) > 0);
                                
                                if (top5.length === 0) {
                                    return <p className="text-center text-slate-400 py-4">기록이 없습니다.</p>;
                                }

                                return top5.map((player, index) => {
                                    const value = getValue(player);
                                    const prevValue = index > 0 ? getValue(sortedPlayers[index - 1]) : null;
                                    const rank = prevValue !== null && value === prevValue ? (index) : (index + 1);
                                    
                                    return (
                                        <div
                                            key={`${player.player.id}-${selectedRankingCategory}`}
                                            className="flex items-center justify-between bg-slate-800/60 rounded-lg p-3 border border-slate-700"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className={`font-bold w-8 text-center ${
                                                    rank === 1 ? 'text-yellow-300 text-lg' :
                                                    rank === 2 ? 'text-slate-300 text-base' :
                                                    rank === 3 ? 'text-orange-300 text-base' :
                                                    'text-slate-400'
                                                }`}>
                                                    {rank}위
                                                </span>
                                                <div>
                                                    <p className="font-semibold text-white">{player.player.originalName}</p>
                                                    <p className="text-xs text-slate-400">{player.teamName}</p>
                                                </div>
                                            </div>
                                            <span className="font-mono text-sky-300 font-bold">{value}{unit}</span>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LeagueScreen;
