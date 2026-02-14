
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useData } from '../contexts/DataContext';
import { Tournament, TournamentMatch, SavedTeamInfo, Player, MatchState, TeamMatchState, PlayerStats } from '../types';
import TeamEmblem from '../components/TeamEmblem';
import { useTranslation } from '../hooks/useTranslation';
import MatchDetailAnalysis from '../components/MatchDetailAnalysis';
import MvpDetailModal from '../components/MvpDetailModal';

interface TournamentScreenProps {
    onStartMatch: (data: { teamAKey: string, teamBKey: string, teamAName: string, teamBName: string, tournamentId: string, tournamentMatchId: string }) => void;
    onOpenMatchAnalysis: (matchId: string) => void;
}

const TournamentScreen: React.FC<TournamentScreenProps> = ({ onStartMatch, onOpenMatchAnalysis }) => {
    const { teamSets, tournaments, saveTournaments, matchHistory, teamSetsMap, teamPerformanceData, settings } = useData();
    const { t } = useTranslation();
    const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
    const [isSetupMode, setIsSetupMode] = useState(false);
    const [selectedTeamKeys, setSelectedTeamKeys] = useState<Set<string>>(new Set());
    const [bracketSize, setBracketSize] = useState<4 | 8 | 16 | 32>(4);
    const [showPredictions, setShowPredictions] = useState<Record<string, boolean>>({});
    const [tournamentNameInput, setTournamentNameInput] = useState<string>('');
    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState<string>('');
    const [showRankingModal, setShowRankingModal] = useState(false);
    const [selectedRankingCategory, setSelectedRankingCategory] = useState<string | null>(null);
    const [selectedMvp, setSelectedMvp] = useState<{
        player: Player;
        teamName: string;
        totalPoints: number;
        sumPoints?: number;
        sumServiceAces?: number;
        sumBlockingPoints?: number;
        sumDigs?: number;
        sumAssists?: number;
        sumServeIn?: number;
        sumServiceFaults?: number;
    } | null>(null);
    const [showMvpModal, setShowMvpModal] = useState(false);

    // [최우선] Early Return - 데이터 로딩 확인
    // 모든 useMemo 계산 전에 데이터가 준비되었는지 확인
    if (!teamSets || !Array.isArray(teamSets) || teamSets.length === 0) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <p className="text-slate-400 text-lg mb-2">데이터를 불러오는 중...</p>
                    <p className="text-slate-500 text-sm">팀 정보를 불러오고 있습니다.</p>
                </div>
            </div>
        );
    }

    if (!tournaments || !Array.isArray(tournaments)) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <p className="text-slate-400 text-lg mb-2">데이터를 불러오는 중...</p>
                    <p className="text-slate-500 text-sm">토너먼트 정보를 불러오고 있습니다.</p>
                </div>
            </div>
        );
    }

    if (!matchHistory || !Array.isArray(matchHistory)) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <p className="text-slate-400 text-lg mb-2">데이터를 불러오는 중...</p>
                    <p className="text-slate-500 text-sm">경기 기록을 불러오고 있습니다.</p>
                </div>
            </div>
        );
    }

    const allTeams = useMemo(() => {
        if (!teamSets || !Array.isArray(teamSets)) return [];
        const teams: (SavedTeamInfo & { key: string, className: string })[] = [];
        teamSets.forEach(set => {
            if (!set || !set.teams || !Array.isArray(set.teams)) return;
            set.teams.forEach(team => {
                if (!team || !team.teamName) return;
                teams.push({
                    ...team,
                    key: `${set.id}___${team.teamName}`,
                    className: set.className || ''
                });
            });
        });
        return teams;
    }, [teamSets]);

    useEffect(() => {
        if (!tournaments || !Array.isArray(tournaments) || !selectedTournament) return;
        try {
            const updatedTournament = tournaments.find(t => t && t.id === selectedTournament?.id);
        if (updatedTournament) {
                const latestMatch = (matchHistory && Array.isArray(matchHistory) && matchHistory.length > 0) ? matchHistory[0] : null;
            if (latestMatch && latestMatch.tournamentId === updatedTournament.id && latestMatch.status === 'completed') {
                const newTournament = JSON.parse(JSON.stringify(updatedTournament));
                let matchUpdated = false;

                    if (!newTournament.rounds || !Array.isArray(newTournament.rounds)) return;
                for (const round of newTournament.rounds) {
                        if (!round || !Array.isArray(round)) continue;
                    for (const match of round) {
                            if (!match || !latestMatch) continue;
                        if (match.id === latestMatch.tournamentMatchId && !match.winnerKey) {
                            match.teamA.score = latestMatch.teamA.score;
                            match.teamB.score = latestMatch.teamB.score;
                            const winner = latestMatch.winner === 'A' ? match.teamA : match.teamB;
                            match.winnerKey = winner.key;

                            if (match.nextMatchId) {
                                for (const nextRound of newTournament.rounds) {
                                    const nextMatch = nextRound.find((m: TournamentMatch) => m.id === match.nextMatchId);
                                    if (nextMatch) {
                                        if (!nextMatch.teamA.key) {
                                            nextMatch.teamA.key = winner.key;
                                            nextMatch.teamA.name = winner.name;
                                        } else {
                                            nextMatch.teamB.key = winner.key;
                                            nextMatch.teamB.name = winner.name;
                                        }
                                        break;
                                    }
                                }
                            }
                            matchUpdated = true;
                            break;
                        }
                    }
                    if (matchUpdated) break;
                }

                if (matchUpdated) {
                        const newTournaments = tournaments.map(t => t && t.id === newTournament.id ? newTournament : t);
                    saveTournaments(newTournaments);
                    setSelectedTournament(newTournament);
                    }
                }
            }
        } catch (error) {
            console.error('Error updating tournament:', error);
        }
    }, [matchHistory, selectedTournament, tournaments, saveTournaments]);
    
    const handleToggleTeam = (key: string) => {
        setSelectedTeamKeys(prev => {
            const newSet = new Set(prev);
            if (newSet.has(key)) {
                newSet.delete(key);
            } else {
                if (newSet.size < bracketSize) {
                    newSet.add(key);
                }
            }
            return newSet;
        });
    };

    const handleCreateTournament = () => {
        if (selectedTeamKeys.size !== bracketSize) {
            alert(t('tournament_team_count_alert', { bracketSize }));
            return;
        }
        
        try {
        // Fisher-Yates shuffle algorithm for true randomization
        const teamKeysArray: string[] = Array.from(selectedTeamKeys);
        for (let i = teamKeysArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [teamKeysArray[i], teamKeysArray[j]] = [teamKeysArray[j], teamKeysArray[i]];
        }
        const shuffledTeamKeys = teamKeysArray;

        const rounds: TournamentMatch[][] = [];
        let currentRound: TournamentMatch[] = [];

        for (let i = 0; i < shuffledTeamKeys.length; i += 2) {
            const teamAKey = shuffledTeamKeys[i];
            const teamBKey = shuffledTeamKeys[i + 1];
            const teamA = teamSetsMap.get(teamAKey);
            const teamB = teamSetsMap.get(teamBKey);

            currentRound.push({
                id: `r1-m${i / 2}`,
                teamA: { key: teamAKey, name: teamA?.team.teamName || null },
                teamB: { key: teamBKey, name: teamB?.team.teamName || null },
                winnerKey: null,
                nextMatchId: null,
                round: 1,
            });
        }
        rounds.push(currentRound);

        let roundNum = 2;
        while (currentRound.length > 1) {
            const nextRound: TournamentMatch[] = [];
            for (let i = 0; i < currentRound.length; i += 2) {
                const match1 = currentRound[i];
                const match2 = currentRound[i+1];
                const nextMatch = {
                    id: `r${roundNum}-m${i / 2}`,
                    teamA: { key: null, name: null },
                    teamB: { key: null, name: null },
                    winnerKey: null,
                    nextMatchId: null,
                    round: roundNum,
                };
                match1.nextMatchId = nextMatch.id;
                if (match2) match2.nextMatchId = nextMatch.id;
                nextRound.push(nextMatch);
            }
            rounds.push(nextRound);
            currentRound = nextRound;
            roundNum++;
        }

        const nameFromInput = tournamentNameInput.trim();

        const newTournament: Tournament = {
            id: `tour_${Date.now()}`,
            name: nameFromInput || t('tournament_default_name', { bracketSize, date: new Date().toLocaleDateString() }),
            teamKeys: Array.from(selectedTeamKeys),
            createdAt: new Date().toISOString(),
            rounds,
        };
        
        const newTournaments = [...tournaments, newTournament];
        saveTournaments(newTournaments);
        setSelectedTournament(newTournament);
        setIsSetupMode(false);
        setSelectedTeamKeys(new Set());
        setTournamentNameInput('');
        } catch (error) {
            console.error('Error creating tournament:', error);
            alert('토너먼트 생성 중 오류가 발생했습니다. 다시 시도해주세요.');
        }
    };
    
    const getPrediction = useCallback((teamAName: string, teamBName: string) => {
        const teamAStats = teamPerformanceData.find(t => t.teamName === teamAName);
        const teamBStats = teamPerformanceData.find(t => t.teamName === teamBName);
        
        const rateA = teamAStats?.winRate ?? 50;
        const rateB = teamBStats?.winRate ?? 50;

        if (rateA + rateB === 0) return { a: 50, b: 50 };

        const totalRate = rateA + rateB;
        const predictionA = (rateA / totalRate) * 100;
        const predictionB = (rateB / totalRate) * 100;

        return { a: Math.round(predictionA), b: Math.round(predictionB) };
    }, [teamPerformanceData]);

    const renderBracket = () => {
        if (!selectedTournament) return null;

        return (
            <div className="flex gap-4 overflow-x-auto p-4 custom-scrollbar">
                {selectedTournament.rounds.map((round, roundIndex) => (
                    <div key={roundIndex} className="flex flex-col justify-around gap-8 min-w-[280px]">
                        <h3 className="text-xl font-bold text-center text-sky-400">
                            {round.length === 1 ? t('tournament_final') : round.length === 2 ? t('tournament_semifinal') : t('tournament_round', { teamCount: round.length * 2 })}
                        </h3>
                        {round.map((match) => {
                            const teamAInfo = match.teamA.key ? teamSetsMap.get(match.teamA.key) : null;
                            const teamBInfo = match.teamB.key ? teamSetsMap.get(match.teamB.key) : null;
                            const isPlayable = teamAInfo && teamBInfo && !match.winnerKey;
                            const prediction = isPlayable ? getPrediction(teamAInfo.team.teamName, teamBInfo.team.teamName) : null;
                            
                            const renderTeam = (team: { key: string | null, name: string | null, score?: number }, info: { set: any, team: SavedTeamInfo } | undefined | null, isWinner: boolean) => (
                                <div className={`flex items-center justify-between p-2 rounded ${isWinner ? 'bg-green-800/50' : 'bg-slate-700/50'}`}>
                                    <div className="flex items-center gap-2 truncate">
                                        <TeamEmblem emblem={info?.team.emblem} color={info?.team.color} className="w-6 h-6 flex-shrink-0" />
                                        <span className={`font-semibold truncate ${isWinner ? 'text-white' : 'text-slate-300'}`}>{team.name || '...'}</span>
                                    </div>
                                    <span className={`font-mono font-bold text-lg ${isWinner ? 'text-green-300' : 'text-slate-400'}`}>{team.score ?? ''}</span>
                                </div>
                            );
                            
                            const completedMatch = match.winnerKey ? tournamentMatches.find(m => {
                                // tournamentMatchId로 매칭하되, 데이터가 완전한지 확인
                                return m.tournamentMatchId === match.id && 
                                       m.status === 'completed' && 
                                       m.teamA && 
                                       m.teamB && 
                                       m.teamA.name && 
                                       m.teamB.name;
                            }) : null;
                            
                            return (
                                <div 
                                    key={match.id} 
                                    className={`bg-slate-800 rounded-lg p-3 space-y-2 border border-slate-700 ${completedMatch ? 'cursor-pointer hover:bg-slate-700/50' : ''}`}
                                    onClick={completedMatch ? (e) => {
                                        e.stopPropagation();
                                        // 데이터 검증 후에만 설정
                                        if (completedMatch && 
                                            completedMatch.status === 'completed' && 
                                            completedMatch.teamA && 
                                            completedMatch.teamB &&
                                            completedMatch.teamA.players &&
                                            completedMatch.teamB.players) {
                                            setSelectedDetailMatch(completedMatch);
                                        }
                                    } : undefined}
                                >
                                    {renderTeam(match.teamA, teamAInfo, match.winnerKey === match.teamA.key)}
                                    {renderTeam(match.teamB, teamBInfo, match.winnerKey === match.teamB.key)}
                                    {isPlayable && (
                                        <div className="space-y-2 pt-1">
                                            {prediction && (
                                                showPredictions[match.id] ? (
                                                    <div className="text-xs text-center text-slate-400 animate-fade-in space-y-1">
                                                        <div>
                                                            {t('ai_prediction')}:
                                                            <span className="font-bold" style={{ color: teamAInfo?.team.color }}>{prediction.a}%</span> vs <span className="font-bold" style={{ color: teamBInfo?.team.color }}>{prediction.b}%</span>
                                                        </div>
                                                        <button
                                                            onClick={() => setShowPredictions(prev => ({ ...prev, [match.id]: false }))}
                                                            className="bg-slate-700 hover:bg-slate-600 text-white/80 font-bold py-0.5 px-2 rounded-full text-xs transition-colors"
                                                        >
                                                            {t('close')}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setShowPredictions(prev => ({ ...prev, [match.id]: true }))}
                                                        className="w-full bg-slate-600 hover:bg-slate-500 text-white font-bold py-1 rounded text-xs transition-colors"
                                                    >
                                                        {t('ai_prediction_button')}
                                                    </button>
                                                )
                                            )}
                                            <button 
                                                onClick={() => onStartMatch({ teamAKey: match.teamA.key!, teamBKey: match.teamB.key!, teamAName: teamAInfo.team.teamName, teamBName: teamBInfo.team.teamName, tournamentId: selectedTournament.id, tournamentMatchId: match.id })}
                                                className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-1 rounded text-sm transition-colors"
                                            >
                                                {t('start_match_button')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        );
    };

    const tournamentMatches = useMemo(() => {
        // 안전한 계산: 방어 로직
        const matches = matchHistory || [];
        const tournament = selectedTournament;
        
        if (!tournament || !matches || !Array.isArray(matches) || matches.length === 0) {
            return [];
        }

        try {
            return matches.filter(
                m => m && m.status === 'completed' && m.tournamentId === tournament.id
            ) || [];
        } catch (error) {
            console.error('Error filtering tournament matches:', error);
            return [];
        }
    }, [matchHistory, selectedTournament]);

    const [selectedDetailMatch, setSelectedDetailMatch] = useState<(MatchState & { date?: string; time?: number }) | null>(null);
    const [showDetailReportModal, setShowDetailReportModal] = useState(false);
    const [detailReportMatch, setDetailReportMatch] = useState<(MatchState & { date?: string; time?: number }) | null>(null);

    const tournamentMvpList = useMemo(() => {
        // 지난 경기 결과와 100% 동일한 목록 사용 — tournamentMatches가 이미 완료 경기만 담고 있음 (status === 'completed' && tournamentId 일치)
        const completedMatches = tournamentMatches || [];
        if (completedMatches.length === 0 || !selectedTournament) return [];

        try {
        const totals = new Map<string, { 
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
        }>();

        const accumulateTeam = (team: TeamMatchState) => {
            if (!team.players || !team.playerStats) return;
            Object.keys(team.playerStats).forEach((playerId) => {
                const player = team.players[playerId];
                const stats: PlayerStats = team.playerStats[playerId];
                if (!player || !stats) return;

                const key = `${selectedTournament.id}::${playerId}`;
                
                // 리그/토너먼트 전용 커스텀 가중치 적용
                const customScore = 
                    (stats.points || 0) * 1.0 +           // 득점/스파이크: +1.0점
                    (stats.serviceAces || 0) * 2.0 +       // 서브 에이스: +2.0점
                    (stats.blockingPoints || 0) * 1.5 +    // 블로킹: +1.5점
                    (stats.digs || 0) * 0.5 +              // 디그: +0.5점
                    (stats.assists || 0) * 0.5 +           // 어시스트: +0.5점
                    (stats.serveIn || 0) * 0.1 +           // 서브 성공(In): +0.1점
                    (stats.serviceFaults || 0) * -1.0;     // 범실: -1.0점

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

        // 완료된 경기만 처리
        completedMatches.forEach((match: any) => {
            if (!match || !match.teamA || !match.teamB) return;
            try {
                accumulateTeam(match.teamA);
                accumulateTeam(match.teamB);
            } catch (error) {
                console.error('Error accumulating team stats:', error);
            }
        });

        const list = Array.from(totals.values());
        list.sort((a, b) => {
            if (!a || !b) return 0;
            if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
            const nameA = a.player?.originalName || '';
            const nameB = b.player?.originalName || '';
            return nameA.localeCompare(nameB);
        });

        return list.slice(0, 3);
        } catch (error) {
            console.error('Error calculating tournament MVP:', error);
            return [];
        }
    }, [matchHistory, tournamentMatches, selectedTournament]);

    // 부문별 타이틀 배지 계산 (순수 횟수 기준)
    const categoryAwards = useMemo(() => {
        // 지난 경기 결과와 100% 동일한 목록 사용 — tournamentMatches가 이미 완료 경기만 담고 있음
        const completedMatches = tournamentMatches || [];
        if (completedMatches.length === 0 || !selectedTournament) return null;

        try {

        const playerStats = new Map<string, {
            player: Player;
            teamName: string;
            totalScoringCount: number; // 순수 득점 횟수
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

                const key = `${selectedTournament.id}::${playerId}`;
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

        // 완료된 경기만 처리
        completedMatches.forEach((match: any) => {
            if (!match || !match.teamA || !match.teamB) return;
            try {
                accumulateTeam(match.teamA);
                accumulateTeam(match.teamB);
            } catch (error) {
                console.error('Error accumulating team stats for category awards:', error);
            }
        });

        const allPlayers = Array.from(playerStats.values()).filter(p => p && p.player);
        
        const scoringKing = allPlayers.length > 0 ? allPlayers.reduce((max, p) => {
            if (!p || !max) return max || p;
            return (p.totalScoringCount || 0) > (max.totalScoringCount || 0) ? p : max;
        }, null as any) : null;
        
        const aceKing = allPlayers.length > 0 ? allPlayers.reduce((max, p) => {
            if (!p || !max) return max || p;
            return (p.serviceAces || 0) > (max.serviceAces || 0) ? p : max;
        }, null as any) : null;
        
        const serveInKing = allPlayers.length > 0 ? allPlayers.reduce((max, p) => {
            if (!p || !max) return max || p;
            return (p.serveIn || 0) > (max.serveIn || 0) ? p : max;
        }, null as any) : null;
        
        const blockingKing = allPlayers.length > 0 ? allPlayers.reduce((max, p) => {
            if (!p || !max) return max || p;
            return (p.blockingPoints || 0) > (max.blockingPoints || 0) ? p : max;
        }, null as any) : null;
        
        const digKing = allPlayers.length > 0 ? allPlayers.reduce((max, p) => {
            if (!p || !max) return max || p;
            return (p.digs || 0) > (max.digs || 0) ? p : max;
        }, null as any) : null;

        return {
            scoringKing: scoringKing && scoringKing.totalScoringCount > 0 ? scoringKing : null,
            aceKing: aceKing && aceKing.serviceAces > 0 ? aceKing : null,
            serveInKing: serveInKing && serveInKing.serveIn > 0 ? serveInKing : null,
            blockingKing: blockingKing && blockingKing.blockingPoints > 0 ? blockingKing : null,
            digKing: digKing && digKing.digs > 0 ? digKing : null,
            allPlayers: allPlayers || [], // Top 5 랭킹을 위해 전체 리스트도 반환
        };
        } catch (error) {
            console.error('Error calculating category awards:', error);
            // 빈 객체 반환 (앱이 죽지 않도록)
            return {
                scoringKing: null,
                aceKing: null,
                serveInKing: null,
                blockingKing: null,
                digKing: null,
                allPlayers: [],
            };
        }
    }, [matchHistory, tournamentMatches, selectedTournament]);

    // 리그 화면과 동일한 데이터 형태 — UI 방어 및 tournamentStats?.mvp 등 매핑용
    const tournamentStats = useMemo(() => {
        const hasMvp = Array.isArray(tournamentMvpList) && tournamentMvpList.length > 0;
        const hasCategory = categoryAwards != null && Array.isArray(categoryAwards.allPlayers) && categoryAwards.allPlayers.length > 0;
        if (!hasMvp && !hasCategory) return null;
        return {
            mvp: hasMvp ? tournamentMvpList[0] : null,
            mvpList: tournamentMvpList ?? [],
            categoryAwards: categoryAwards ?? null,
        };
    }, [tournamentMvpList, categoryAwards]);

    const handleSaveTournamentName = async () => {
        if (!selectedTournament) return;
        const trimmed = editedName.trim();
        if (!trimmed) {
            setIsEditingName(false);
            return;
        }
        const updated = tournaments.map(t =>
            t.id === selectedTournament.id ? { ...t, name: trimmed } : t
        );
        await saveTournaments(updated);
        const updatedSelected = updated.find(t => t.id === selectedTournament.id) || null;
        setSelectedTournament(updatedSelected);
        setIsEditingName(false);
    };

    if (isSetupMode) {
        return (
            <div className="flex flex-col gap-4 h-full">
                <div className="flex flex-col lg:flex-row items-center lg:justify-between mb-6 gap-4">
                    <h1 className="text-3xl lg:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 text-center lg:text-right">
                        {t('tournament_create_new_title')}
                    </h1>
                </div>
                <div className="flex flex-wrap gap-4">
                    <button onClick={() => setBracketSize(4)} className={`px-4 py-2 rounded ${bracketSize === 4 ? 'bg-sky-500' : 'bg-slate-700'}`}>{t('tournament_4_teams')}</button>
                    <button onClick={() => setBracketSize(8)} className={`px-4 py-2 rounded ${bracketSize === 8 ? 'bg-sky-500' : 'bg-slate-700'}`}>{t('tournament_8_teams')}</button>
                    <button onClick={() => setBracketSize(16)} className={`px-4 py-2 rounded ${bracketSize === 16 ? 'bg-sky-500' : 'bg-slate-700'}`}>{t('tournament_16_teams')}</button>
                    <button onClick={() => setBracketSize(32)} className={`px-4 py-2 rounded ${bracketSize === 32 ? 'bg-sky-500' : 'bg-slate-700'}`}>{t('tournament_32_teams')}</button>
                </div>
                <p>{t('tournament_select_teams_prompt', { bracketSize, count: selectedTeamKeys.size })}</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 flex-grow overflow-y-auto p-2 bg-slate-800/50 rounded">
                    {allTeams.map(team => (
                        <button key={team.key} onClick={() => handleToggleTeam(team.key)} className={`p-3 rounded-lg text-left transition-all ${selectedTeamKeys.has(team.key) ? 'bg-sky-600 ring-2 ring-sky-400 scale-95' : 'bg-slate-700 hover:bg-slate-600'}`}>
                            <p className="font-bold truncate">{team.teamName}</p>
                            <p className="text-sm text-slate-300">{team.className}</p>
                        </button>
                    ))}
                </div>
                <div className="flex gap-4 pt-2">
                    <button onClick={handleCreateTournament} disabled={selectedTeamKeys.size !== bracketSize} className="bg-green-600 hover:bg-green-500 disabled:bg-slate-600 text-white font-bold py-2 px-4 rounded">{t('tournament_create_bracket')}</button>
                    <button onClick={() => setIsSetupMode(false)} className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded">{t('cancel')}</button>
                </div>
            </div>
        );
    }
    
    // [데이터 검증 강화] 렌더링 차단 - return 문 바로 위에 배치
    const matches = tournamentMatches || [];
    if (!selectedTournament || !matches || !Array.isArray(matches) || matches.length === 0) {
        // 토너먼트가 선택되지 않았거나 경기 데이터가 없어도 대진표는 보여줘야 함
        // 단, selectedTournament가 없으면 로딩 메시지 표시
        if (!selectedTournament) {
            return (
                <div className="flex flex-col gap-4 h-full">
                    <div className="flex flex-col lg:flex-row items-center lg:justify-between mb-6 gap-4">
                        <h1 className="text-3xl lg:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 text-center lg:text-right">
                            {t('tournament_list')}
                        </h1>
                        <button onClick={() => { setIsSetupMode(true); setSelectedTournament(null); }} className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 px-4 rounded min-h-[44px] w-full lg:w-auto">{t('tournament_create_new_button')}</button>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {(tournaments && Array.isArray(tournaments) ? tournaments : []).map(t => {
                            if (!t || !t.id) return null;
                            return (
                                <button key={t.id} onClick={() => setSelectedTournament(t)} className={`px-3 py-1 rounded whitespace-nowrap ${selectedTournament?.id === t.id ? 'bg-sky-500' : 'bg-slate-700'}`}>{t.name || '이름 없음'}</button>
                            );
                        })}
                    </div>
                    <div className="flex items-center justify-center h-full">
                        <p className="text-slate-400">토너먼트를 선택해주세요.</p>
                    </div>
                </div>
            );
        }
    }
    
    return (
        <div className="flex flex-col gap-4 h-full">
            <div className="flex flex-col lg:flex-row items-center lg:justify-between mb-6 gap-4">
                <h1 className="text-3xl lg:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 text-center lg:text-right">
                    {t('tournament_list')}
                </h1>
                <button onClick={() => { setIsSetupMode(true); setSelectedTournament(null); }} className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 px-4 rounded min-h-[44px] w-full lg:w-auto">{t('tournament_create_new_button')}</button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
                {tournaments.map(t => (
                    <button key={t.id} onClick={() => setSelectedTournament(t)} className={`px-3 py-1 rounded whitespace-nowrap ${selectedTournament?.id === t.id ? 'bg-sky-500' : 'bg-slate-700'}`}>{t.name}</button>
                ))}
            </div>
                {selectedTournament ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
                        <div className="bg-slate-800/50 rounded-lg p-4 flex flex-col gap-3">
                            <div className="flex items-center justify-between mb-1">
                                {isEditingName ? (
                                    <div className="flex items-center gap-2 w-full">
                                        <input
                                            type="text"
                                            value={editedName}
                                            onChange={(e) => setEditedName(e.target.value)}
                                            className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                                        />
                                        <button
                                            onClick={handleSaveTournamentName}
                                            className="px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-xs font-semibold"
                                        >
                                            저장
                                        </button>
                                        <button
                                            onClick={() => setIsEditingName(false)}
                                            className="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-xs font-semibold"
                                        >
                                            취소
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <h2 className="text-lg font-bold text-slate-100 truncate">{selectedTournament.name}</h2>
                                        <button
                                            onClick={() => {
                                                setEditedName(selectedTournament.name);
                                                setIsEditingName(true);
                                            }}
                                            className="ml-2 text-xs px-2 py-1 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-200"
                                        >
                                            ✏️ 이름 수정
                                        </button>
                                    </>
                                )}
                            </div>

                            {/* 🏆 토너먼트 MVP — 제목 항상 표시, 데이터 없으면 Fallback (리그와 100% 동일) */}
                            <div>
                                <div className="flex items-center gap-2 mt-4 mb-2">
                                    <h3 className="text-lg font-semibold text-slate-200 print-text-black">
                                        🏆 토너먼트 MVP
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
                                {(!tournamentMvpList || tournamentMvpList.length === 0) ? (
                                    <p className="text-sm text-slate-400">
                                        아직 MVP를 계산할 수 있는 토너먼트 경기 데이터가 없습니다.
                                    </p>
                                ) : (
                                    <ul className="space-y-1 text-sm">
                                        {tournamentMvpList.map((entry, index) => {
                                            if (!entry || !entry.player) return null;
                                            const rank = index + 1;
                                            return (
                                                <li
                                                    key={`${entry.player.id}-${entry.teamName}`}
                                                    className="flex items-center justify-between bg-slate-900/60 rounded px-3 py-1.5 cursor-pointer hover:bg-slate-800/80 transition-colors"
                                                    onClick={() => {
                                                        setSelectedMvp(entry);
                                                        setShowMvpModal(true);
                                                    }}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-yellow-300 font-bold w-6 text-center">{rank}</span>
                                                        <span className="font-semibold text-slate-100">{entry.player.originalName}</span>
                                                        <span className="text-xs text-slate-400">({entry.teamName})</span>
                                                    </div>
                                                    <span className="text-sm font-mono text-sky-300">{entry.totalPoints.toFixed(1)}</span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>

                            {/* 부문별 랭킹 — 제목 항상 표시, 데이터 없으면 Fallback (리그와 100% 동일 카드 디자인) */}
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
                                {!categoryAwards || !categoryAwards.allPlayers?.length ? (
                                    <p className="text-sm text-slate-400">
                                        아직 부문별 랭킹을 계산할 수 있는 토너먼트 경기 데이터가 없습니다.
                                    </p>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {categoryAwards.scoringKing && (
                                            <div className="bg-gradient-to-br from-orange-800/30 to-slate-900/50 rounded-lg p-3 border border-orange-500/40">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-2xl">🔥</span>
                                                    <span className="font-bold text-orange-300 text-sm">득점왕</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="font-semibold text-white text-sm">{categoryAwards.scoringKing.player?.originalName ?? '이름 없음'}</p>
                                                        <p className="text-xs text-slate-400">{categoryAwards.scoringKing.teamName}</p>
                                                        <p className="text-xs text-orange-300 font-mono mt-1">{categoryAwards.scoringKing.totalScoringCount}득점</p>
                                                    </div>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setSelectedRankingCategory('scoring'); setShowRankingModal(true); }}
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
                                                        <p className="font-semibold text-white text-sm">{categoryAwards.aceKing.player?.originalName ?? '이름 없음'}</p>
                                                        <p className="text-xs text-slate-400">{categoryAwards.aceKing.teamName}</p>
                                                        <p className="text-xs text-yellow-300 font-mono mt-1">{categoryAwards.aceKing.serviceAces}개</p>
                                                    </div>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setSelectedRankingCategory('ace'); setShowRankingModal(true); }}
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
                                                        <p className="font-semibold text-white text-sm">{categoryAwards.serveInKing.player?.originalName ?? '이름 없음'}</p>
                                                        <p className="text-xs text-slate-400">{categoryAwards.serveInKing.teamName}</p>
                                                        <p className="text-xs text-blue-300 font-mono mt-1">{categoryAwards.serveInKing.serveIn}개</p>
                                                    </div>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setSelectedRankingCategory('serveIn'); setShowRankingModal(true); }}
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
                                                        <p className="font-semibold text-white text-sm">{categoryAwards.blockingKing.player?.originalName ?? '이름 없음'}</p>
                                                        <p className="text-xs text-slate-400">{categoryAwards.blockingKing.teamName}</p>
                                                        <p className="text-xs text-purple-300 font-mono mt-1">{categoryAwards.blockingKing.blockingPoints}개</p>
                                                    </div>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setSelectedRankingCategory('blocking'); setShowRankingModal(true); }}
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
                                                        <p className="font-semibold text-white text-sm">{categoryAwards.digKing.player?.originalName ?? '이름 없음'}</p>
                                                        <p className="text-xs text-slate-400">{categoryAwards.digKing.teamName}</p>
                                                        <p className="text-xs text-green-300 font-mono mt-1">{categoryAwards.digKing.digs}개</p>
                                                    </div>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setSelectedRankingCategory('dig'); setShowRankingModal(true); }}
                                                        className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200"
                                                    >
                                                        📊 랭킹
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div>
                                <h3 className="text-sm font-semibold text-slate-200 mb-2">지난 경기 결과</h3>
                                {tournamentMatches.length === 0 ? (
                                    <p className="text-xs text-slate-400">아직 진행된 경기가 없습니다.</p>
                                ) : (
                                    <div className="max-h-64 overflow-y-auto pr-1 space-y-1.5">
                                        {tournamentMatches
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
                                                        className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between text-[11px] sm:text-xs bg-slate-900/60 rounded px-2 py-1.5 text-left hover:bg-slate-800/80 transition-colors"
                                                        onClick={() => setSelectedDetailMatch(m as any)}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-slate-400 min-w-[70px]">{dateLabel}</span>
                                                            <span className="font-semibold text-slate-50 truncate">
                                                                {m.teamA.name} <span className="text-slate-400">vs</span> {m.teamB.name}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-1 sm:mt-0 sm:ml-3">
                                                            <span className="font-mono text-sky-400">{scoreLabel}</span>
                                                            {winnerName && (
                                                                <span className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full bg-emerald-600/20 text-emerald-300">
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
                        <div className="bg-slate-800/50 rounded-lg p-2 sm:p-4 overflow-hidden">
                            {renderBracket()}
                        </div>
                    </div>
                ) : (
                    <div className="flex-grow flex items-center justify-center">
                        <p className="text-slate-400 text-xl">{t('tournament_select_or_create_prompt')}</p>
                    </div>
                )}

            {/* 경기 상세 모달 */}
            {selectedDetailMatch && selectedDetailMatch.teamA && selectedDetailMatch.teamB && selectedDetailMatch.teamA.name && selectedDetailMatch.teamB.name && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setSelectedDetailMatch(null)}>
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
                                if (!team.playerStats) {
                                    return (
                                        <div key={label} className="bg-slate-800/60 rounded-xl p-3 border border-slate-700">
                                            <h3 className="font-semibold mb-2">{label}</h3>
                                            <p className="text-slate-400 text-xs">기록 데이터가 없습니다.</p>
                                        </div>
                                    );
                                }
                                const totals = Object.values(team.playerStats).reduce(
                                    (acc: { points: number; serviceAces: number; blockingPoints: number; spikeSuccesses: number }, s: PlayerStats) => {
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
                                    if (!selectedDetailMatch || selectedDetailMatch.status !== 'completed') return;
                                    if (!selectedDetailMatch.teamA || !selectedDetailMatch.teamB) return;
                                    if (!selectedDetailMatch.teamA.players || !selectedDetailMatch.teamB.players) return;
                                    if (!selectedDetailMatch.teamA.playerStats || !selectedDetailMatch.teamB.playerStats) return;
                                    if (!selectedDetailMatch.teamA.name || !selectedDetailMatch.teamB.name) return;
                                    
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

            {/* 상세 리포트 모달 - 데이터 직접 주입 */}
            {showDetailReportModal && detailReportMatch && (
                <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50" onClick={() => {
                    setShowDetailReportModal(false);
                    setDetailReportMatch(null);
                    document.body.style.overflow = 'unset';
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
            {/* MVP 상세 모달 — 클릭한 MVP 데이터가 있을 때만 표시 */}
            {showMvpModal && selectedMvp && (
                <MvpDetailModal
                    isOpen={showMvpModal}
                    onClose={() => setShowMvpModal(false)}
                    mvpData={selectedMvp}
                />
            )}

            {/* 부문별 Top 5 랭킹 모달 — showRankingModal + selectedRankingCategory로 제어 */}
            {showRankingModal && selectedRankingCategory && categoryAwards?.allPlayers && Array.isArray(categoryAwards.allPlayers) && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => {
                    setShowRankingModal(false);
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
                                    setShowRankingModal(false);
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
                                if (!categoryAwards?.allPlayers || !Array.isArray(categoryAwards.allPlayers)) {
                                    return <p className="text-center text-slate-400 py-4">기록이 없습니다.</p>;
                                }
                                let sortedPlayers = [...(categoryAwards.allPlayers || [])];
                                let getValue: (p: typeof sortedPlayers[0]) => number;
                                let unit = '개';

                                switch (selectedRankingCategory) {
                                    case 'scoring':
                                        sortedPlayers.sort((a, b) => (b?.totalScoringCount || 0) - (a?.totalScoringCount || 0));
                                        getValue = (p) => p?.totalScoringCount || 0;
                                        unit = '득점';
                                        break;
                                    case 'ace':
                                        sortedPlayers.sort((a, b) => (b?.serviceAces || 0) - (a?.serviceAces || 0));
                                        getValue = (p) => p?.serviceAces || 0;
                                        break;
                                    case 'serveIn':
                                        sortedPlayers.sort((a, b) => (b?.serveIn || 0) - (a?.serveIn || 0));
                                        getValue = (p) => p?.serveIn || 0;
                                        break;
                                    case 'blocking':
                                        sortedPlayers.sort((a, b) => (b?.blockingPoints || 0) - (a?.blockingPoints || 0));
                                        getValue = (p) => p?.blockingPoints || 0;
                                        break;
                                    case 'dig':
                                        sortedPlayers.sort((a, b) => (b?.digs || 0) - (a?.digs || 0));
                                        getValue = (p) => p?.digs || 0;
                                        break;
                                    default:
                                        return <p className="text-center text-slate-400 py-4">기록이 없습니다.</p>;
                                }

                                const top5 = sortedPlayers.slice(0, 5).filter(p => p && getValue(p) > 0);
                                
                                if (top5.length === 0) {
                                    return <p className="text-center text-slate-400 py-4">기록이 없습니다.</p>;
                                }

                                return top5.map((player, index) => {
                                    if (!player || !player.player) return null;
                                    const value = getValue(player);
                                    const prevValue = index > 0 ? getValue(sortedPlayers[index - 1]) : null;
                                    const rank = prevValue !== null && value === prevValue ? (index) : (index + 1);
                                    
                                    return (
                                        <div
                                            key={`${player.player?.id || index}-${selectedRankingCategory}`}
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
                                                    <p className="font-semibold text-white">{player.player?.originalName || '이름 없음'}</p>
                                                    <p className="text-xs text-slate-400">{player.teamName || ''}</p>
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

export default TournamentScreen;
