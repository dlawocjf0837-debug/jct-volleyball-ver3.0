
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useData } from '../contexts/DataContext';
import { Tournament, TournamentMatch, SavedTeamInfo } from '../types';
import TeamEmblem from '../components/TeamEmblem';
import { useTranslation } from '../hooks/useTranslation';

interface TournamentScreenProps {
    onStartMatch: (data: { teamAKey: string, teamBKey: string, teamAName: string, teamBName: string, tournamentId: string, tournamentMatchId: string }) => void;
}

const TournamentScreen: React.FC<TournamentScreenProps> = ({ onStartMatch }) => {
    const { teamSets, tournaments, saveTournaments, matchHistory, teamSetsMap, teamPerformanceData } = useData();
    const { t } = useTranslation();
    const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
    const [isSetupMode, setIsSetupMode] = useState(false);
    const [selectedTeamKeys, setSelectedTeamKeys] = useState<Set<string>>(new Set());
    const [bracketSize, setBracketSize] = useState<4 | 8 | 16 | 32>(4);
    const [showPredictions, setShowPredictions] = useState<Record<string, boolean>>({});

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
        return teams;
    }, [teamSets]);

    useEffect(() => {
        const updatedTournament = tournaments.find(t => t.id === selectedTournament?.id);
        if (updatedTournament) {
            const latestMatch = matchHistory.length > 0 ? matchHistory[0] : null;
            if (latestMatch && latestMatch.tournamentId === updatedTournament.id && latestMatch.status === 'completed') {
                const newTournament = JSON.parse(JSON.stringify(updatedTournament));
                let matchUpdated = false;

                for (const round of newTournament.rounds) {
                    for (const match of round) {
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
                    const newTournaments = tournaments.map(t => t.id === newTournament.id ? newTournament : t);
                    saveTournaments(newTournaments);
                    setSelectedTournament(newTournament);
                }
            }
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

        const newTournament: Tournament = {
            id: `tour_${Date.now()}`,
            name: t('tournament_default_name', { bracketSize, date: new Date().toLocaleDateString() }),
            teamKeys: Array.from(selectedTeamKeys),
            createdAt: new Date().toISOString(),
            rounds,
        };
        
        const newTournaments = [...tournaments, newTournament];
        saveTournaments(newTournaments);
        setSelectedTournament(newTournament);
        setIsSetupMode(false);
        setSelectedTeamKeys(new Set());
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
                            
                            return (
                                <div key={match.id} className="bg-slate-800 rounded-lg p-3 space-y-2 border border-slate-700">
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
            {selectedTournament ? renderBracket() : <div className="flex-grow flex items-center justify-center"><p className="text-slate-400 text-xl">{t('tournament_select_or_create_prompt')}</p></div>}
        </div>
    );
};

export default TournamentScreen;
