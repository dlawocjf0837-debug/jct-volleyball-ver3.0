import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Player, Team, TeamId, STAT_KEYS, STAT_NAME_KEYS, Stats } from '../types';
import PlayerCard from '../components/PlayerCard';
import TeamPanel from '../components/TeamPanel';
import StatModal from '../components/StatModal';
import ComparisonModal from '../components/ComparisonModal';
import FinalTeamsScreen from '../components/FinalTeamsScreen';
import { UsersIcon, EyeIcon, EyeSlashIcon, ScaleIcon, UndoIcon } from '../components/icons';
import { useData } from '../contexts/DataContext';
import { useTranslation } from '../hooks/useTranslation';

interface TeamBuilderScreenProps {
    initialPlayers: Player[];
    onReset: () => void;
    selectedClass: string;
}

type DraftMove = {
    playerId: string;
    teamId: TeamId;
    previousState: {
        unassignedPlayerIds: string[];
        teams: Team[];
        draftOrder: TeamId[];
        currentPickIndex: number;
        draftRound: number;
    };
};

const TEAM_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#eab308', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const TeamBuilderScreen: React.FC<TeamBuilderScreenProps> = ({ initialPlayers, onReset, selectedClass }) => {
    const { showToast } = useData();
    const { t } = useTranslation();
    const [phase, setPhase] = useState<'captain-selection' | 'drafting' | 'final'>('captain-selection');
    const [players, setPlayers] = useState<Record<string, Player>>({});
    const [teams, setTeams] = useState<Team[]>([]);
    const [unassignedPlayerIds, setUnassignedPlayerIds] = useState<string[]>([]);
    const [selectedCaptainIds, setSelectedCaptainIds] = useState<Set<string>>(new Set());
    
    // Draft state
    const [draftOrder, setDraftOrder] = useState<TeamId[]>([]);
    const [currentPickIndex, setCurrentPickIndex] = useState(0);
    const [draftRound, setDraftRound] = useState(1);
    const [draftHistory, setDraftHistory] = useState<DraftMove[]>([]);


    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
    const [balanceGender, setBalanceGender] = useState(false);
    const [genderQuotas, setGenderQuotas] = useState({ femaleMin: 0, femaleMax: 0, maleMin: 0, maleMax: 0 });
    const [teamTotalSlots, setTeamTotalSlots] = useState<Map<TeamId, number>>(new Map());

    const [showRealNames, setShowRealNames] = useState(false);
    const [comparisonPlayerIds, setComparisonPlayerIds] = useState<Set<string>>(new Set());
    const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);
    const [sortKey, setSortKey] = useState<keyof Stats | 'totalScore'>('totalScore');

    useEffect(() => {
        const playerMap = initialPlayers.reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
        setPlayers(playerMap);
        setUnassignedPlayerIds(initialPlayers.map(p => p.id));
    }, [initialPlayers]);
    
    const unassignedPlayers = useMemo(() => unassignedPlayerIds.map(id => players[id]).filter(Boolean), [unassignedPlayerIds, players]);
    const unassignedMaleCount = useMemo(() => unassignedPlayers.filter(p => p.gender.includes('남')).length, [unassignedPlayers]);
    const unassignedFemaleCount = useMemo(() => unassignedPlayers.filter(p => p.gender.includes('여')).length, [unassignedPlayers]);

    const handleViewStats = useCallback((player: Player) => {
        setSelectedPlayer(player);
    }, []);

    const handleToggleCaptainSelection = useCallback((player: Player) => {
        const newSelection = new Set(selectedCaptainIds);
        if (newSelection.has(player.id)) {
            newSelection.delete(player.id);
        } else if (newSelection.size < 4) {
            newSelection.add(player.id);
        } else {
            showToast(t('toast_max_4_captains'), 'error');
        }
        setSelectedCaptainIds(newSelection);
    }, [selectedCaptainIds, showToast, t]);
    
    const handleToggleComparison = useCallback((playerId: string) => {
        setComparisonPlayerIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(playerId)) {
                newSet.delete(playerId);
            } else if (newSet.size < 2) {
                newSet.add(playerId);
            } else {
                showToast(t('toast_max_2_compare'), 'error');
            }
            return newSet;
        });
    }, [showToast, t]);

    const handleStartDraft = useCallback(() => {
        if (selectedCaptainIds.size < 2 || selectedCaptainIds.size > 4) {
            showToast(t('toast_captain_count_2_to_4'), 'error');
            return;
        }
        
        const updatedPlayers = { ...players };
        selectedCaptainIds.forEach((id: string) => {
            if(updatedPlayers[id]) updatedPlayers[id]!.isCaptain = true;
        });
        
        const captainPlayers = Array.from(selectedCaptainIds)
            .map((id: string) => updatedPlayers[id])
            .filter((p): p is Player => Boolean(p));
        
        const newTeams = captainPlayers.map((captain, index) => ({
            id: `team-${captain.id}`,
            name: t('team_name_format', { name: captain.originalName }),
            captainId: captain.id,
            playerIds: [captain.id],
            color: TEAM_COLORS[index % TEAM_COLORS.length],
        }));
        
        const totalPlayers = initialPlayers.length;
        const numberOfTeams = newTeams.length;

        if (numberOfTeams > 0) {
            const totalFemales = initialPlayers.filter(p => p.gender.includes('여')).length;
            const totalMales = initialPlayers.filter(p => p.gender.includes('남')).length;
            setGenderQuotas({
                femaleMin: Math.floor(totalFemales / numberOfTeams),
                femaleMax: Math.ceil(totalFemales / numberOfTeams),
                maleMin: Math.floor(totalMales / numberOfTeams),
                maleMax: Math.ceil(totalMales / numberOfTeams),
            });
        }

        const baseSlots = Math.floor(totalPlayers / numberOfTeams);
        const extraSlots = totalPlayers % numberOfTeams;
        
        const initialDraftOrder = captainPlayers
            .sort((a, b) => b.totalScore - a.totalScore)
            .map(c => newTeams.find(t => t.captainId === c.id)!.id);

        const slotsMap = new Map<TeamId, number>();
        initialDraftOrder.forEach((teamId, index) => {
            const totalSlots = baseSlots + (index < extraSlots ? 1 : 0);
            slotsMap.set(teamId, totalSlots);
        });
        setTeamTotalSlots(slotsMap);
        
        setDraftOrder(initialDraftOrder);
        setCurrentPickIndex(0);
        setDraftRound(1);
        
        setPlayers(updatedPlayers);
        setTeams(newTeams);
        setUnassignedPlayerIds(Object.keys(players).filter(id => !selectedCaptainIds.has(id)));
        setPhase('drafting');
        setComparisonPlayerIds(new Set());
        setDraftHistory([]);
    }, [selectedCaptainIds, players, initialPlayers, showToast, t]);

    const performDraftPick = useCallback((playerId: string, targetTeamId: TeamId) => {
        const move: DraftMove = {
            playerId,
            teamId: targetTeamId,
            previousState: {
                unassignedPlayerIds,
                teams,
                draftOrder,
                currentPickIndex,
                draftRound,
            },
        };
        setDraftHistory(prev => [...prev, move]);

        const newUnassignedPlayerIds = unassignedPlayerIds.filter(id => id !== playerId);
        
        setTeams(currentTeams => currentTeams.map(t =>
            t.id === targetTeamId
            ? { ...t, playerIds: [...t.playerIds, playerId] }
            : t
        ));
        
        setUnassignedPlayerIds(newUnassignedPlayerIds);

        if (newUnassignedPlayerIds.length === 0) {
            setPhase('final');
        } else {
            const nextPickIndex = currentPickIndex + 1;
            if (nextPickIndex >= draftOrder.length) {
                setDraftRound(prev => prev + 1);
                setDraftOrder(prev => [...prev].reverse());
                setCurrentPickIndex(0);
            } else {
                setCurrentPickIndex(nextPickIndex);
            }
        }
    }, [unassignedPlayerIds, teams, draftOrder, currentPickIndex, draftRound]);

    const handleDrop = useCallback((playerId: string, targetTeamId: TeamId) => {
        const currentPickingTeamId = draftOrder[currentPickIndex];
        if (targetTeamId !== currentPickingTeamId) {
            const currentTeamName = teams.find(t => t.id === currentPickingTeamId)?.name || t('unknown_team');
            showToast(t('toast_wrong_turn', { teamName: currentTeamName }), 'error');
            return;
        }

        if (unassignedPlayerIds.includes(playerId)) {
            if (balanceGender) {
                const playerToDraft = players[playerId];
                const team = teams.find(t => t.id === targetTeamId);
                if (playerToDraft && team) {
                    const currentTeamPlayers = team.playerIds.map(id => players[id]).filter(Boolean);
                    const currentMaleCount = currentTeamPlayers.filter(p => p.gender.includes('남')).length;
                    const currentFemaleCount = currentTeamPlayers.filter(p => p.gender.includes('여')).length;

                    if (playerToDraft.gender.includes('여') && currentFemaleCount >= genderQuotas.femaleMax) {
                        showToast(t('toast_max_females_reached', { teamName: team.name, max: genderQuotas.femaleMax }), 'error');
                        return;
                    }
                    if (playerToDraft.gender.includes('남') && currentMaleCount >= genderQuotas.maleMax) {
                        showToast(t('toast_max_males_reached', { teamName: team.name, max: genderQuotas.maleMax }), 'error');
                        return;
                    }
                    
                    // Global possibility check
                    let futureUnassignedMales = unassignedMaleCount;
                    let futureUnassignedFemales = unassignedFemaleCount;
                    if (playerToDraft.gender.includes('남')) futureUnassignedMales--; else futureUnassignedFemales--;
                    
                    let totalFutureMalesNeeded = 0;
                    let totalFutureFemalesNeeded = 0;

                    teams.forEach(t => {
                        let teamMaleCount = t.playerIds.map(id => players[id]).filter(p => p && p.gender.includes('남')).length;
                        let teamFemaleCount = t.playerIds.map(id => players[id]).filter(p => p && p.gender.includes('여')).length;
                        
                        if (t.id === targetTeamId) {
                            if (playerToDraft.gender.includes('남')) teamMaleCount++; else teamFemaleCount++;
                        }

                        totalFutureMalesNeeded += Math.max(0, genderQuotas.maleMin - teamMaleCount);
                        totalFutureFemalesNeeded += Math.max(0, genderQuotas.femaleMin - teamFemaleCount);
                    });

                    if (totalFutureMalesNeeded > futureUnassignedMales) {
                        showToast(t('toast_male_shortage', { needed: futureUnassignedMales, min: genderQuotas.maleMin }), 'error');
                        return;
                    }
                    if (totalFutureFemalesNeeded > futureUnassignedFemales) {
                        showToast(t('toast_female_shortage', { needed: futureUnassignedFemales, min: genderQuotas.femaleMin }), 'error');
                        return;
                    }
                }
            }
            performDraftPick(playerId, targetTeamId);
        }
    }, [draftOrder, currentPickIndex, teams, unassignedPlayerIds, performDraftPick, balanceGender, players, genderQuotas, showToast, unassignedMaleCount, unassignedFemaleCount, t]);
    
    const handleDoubleClickDraft = useCallback((player: Player) => {
        if (phase !== 'drafting') return;
        const currentPickingTeamId = draftOrder[currentPickIndex];
        if (!currentPickingTeamId || !unassignedPlayerIds.includes(player.id)) {
            return;
        }

        if (balanceGender) {
            const team = teams.find(t => t.id === currentPickingTeamId);
            if (team) {
                const currentTeamPlayers = team.playerIds.map(id => players[id]).filter(Boolean);
                const currentMaleCount = currentTeamPlayers.filter(p => p.gender.includes('남')).length;
                const currentFemaleCount = currentTeamPlayers.filter(p => p.gender.includes('여')).length;

                if (player.gender.includes('여') && currentFemaleCount >= genderQuotas.femaleMax) {
                    showToast(t('toast_max_females_reached', { teamName: team.name, max: genderQuotas.femaleMax }), 'error');
                    return;
                }
                if (player.gender.includes('남') && currentMaleCount >= genderQuotas.maleMax) {
                    showToast(t('toast_max_males_reached', { teamName: team.name, max: genderQuotas.maleMax }), 'error');
                    return;
                }
        
                // Global possibility check
                let futureUnassignedMales = unassignedMaleCount;
                let futureUnassignedFemales = unassignedFemaleCount;
                if (player.gender.includes('남')) futureUnassignedMales--; else futureUnassignedFemales--;
                
                let totalFutureMalesNeeded = 0;
                let totalFutureFemalesNeeded = 0;

                teams.forEach(t => {
                    let teamMaleCount = t.playerIds.map(id => players[id]).filter(p => p && p.gender.includes('남')).length;
                    let teamFemaleCount = t.playerIds.map(id => players[id]).filter(p => p && p.gender.includes('여')).length;
                    
                    if (t.id === currentPickingTeamId) {
                        if (player.gender.includes('남')) teamMaleCount++; else teamFemaleCount++;
                    }

                    totalFutureMalesNeeded += Math.max(0, genderQuotas.maleMin - teamMaleCount);
                    totalFutureFemalesNeeded += Math.max(0, genderQuotas.femaleMin - teamFemaleCount);
                });

                if (totalFutureMalesNeeded > futureUnassignedMales) {
                    showToast(t('toast_male_shortage', { needed: futureUnassignedMales, min: genderQuotas.maleMin }), 'error');
                    return;
                }
                if (totalFutureFemalesNeeded > futureUnassignedFemales) {
                    showToast(t('toast_female_shortage', { needed: futureUnassignedFemales, min: genderQuotas.femaleMin }), 'error');
                    return;
                }
            }
        }

        performDraftPick(player.id, currentPickingTeamId);
    }, [phase, draftOrder, currentPickIndex, unassignedPlayerIds, performDraftPick, balanceGender, teams, players, genderQuotas, showToast, unassignedMaleCount, unassignedFemaleCount, t]);

    const handleUndo = useCallback(() => {
        if (draftHistory.length === 0) return;

        const lastMove = draftHistory[draftHistory.length - 1];
        
        setUnassignedPlayerIds(lastMove.previousState.unassignedPlayerIds);
        setTeams(lastMove.previousState.teams);
        setDraftOrder(lastMove.previousState.draftOrder);
        setCurrentPickIndex(lastMove.previousState.currentPickIndex);
        setDraftRound(lastMove.previousState.draftRound);
        
        setDraftHistory(prev => prev.slice(0, -1));

    }, [draftHistory]);

    const handleTeamNameChange = useCallback((teamId: TeamId, newName: string) => {
        setTeams(currentTeams => currentTeams.map(t => t.id === teamId ? { ...t, name: newName } : t));
    }, []);
    
    const sortedUnassignedPlayerIds = useMemo(() => {
        const sortablePlayers = unassignedPlayerIds.map(id => players[id]).filter(Boolean);

        sortablePlayers.sort((a, b) => {
            const valA = sortKey === 'totalScore' ? a.totalScore : a.stats[sortKey as keyof Stats];
            const valB = sortKey === 'totalScore' ? b.totalScore : b.stats[sortKey as keyof Stats];
            return valB - valA; // Always sort descending (higher score is better)
        });

        return sortablePlayers.map(p => p.id);
    }, [unassignedPlayerIds, players, sortKey]);

    const teamAverages = useMemo(() => {
        type GenderCount = { male: number; female: number; other: number };
        const averages: Record<TeamId, { stats: Record<keyof Stats, number>, total: number, count: number, gender: GenderCount }> = {};

        teams.forEach(team => {
            const numPlayers = team.playerIds.length;
            const genderCount: GenderCount = { male: 0, female: 0, other: 0 };
            const emptyStats = STAT_KEYS.reduce((acc, key) => ({...acc, [key]: 0}), {} as Stats);

            if (numPlayers === 0) { averages[team.id] = { stats: emptyStats, total: 0, count: 0, gender: genderCount }; return; }
            
            const teamTotals = team.playerIds.reduce((totals, id) => {
                const player = players[id];
                if (!player) return totals;
                STAT_KEYS.forEach(key => { totals.stats[key] += player.stats[key]; });
                totals.totalScore += player.totalScore;
                if (player.gender.includes('남')) genderCount.male++; else if (player.gender.includes('여')) genderCount.female++; else genderCount.other++;
                return totals;
            }, { stats: emptyStats, totalScore: 0 });

            averages[team.id] = {
                stats: STAT_KEYS.reduce((acc, key) => ({ ...acc, [key]: teamTotals.stats[key] / numPlayers }), {} as Stats),
                total: teamTotals.totalScore / numPlayers,
                count: numPlayers,
                gender: genderCount
            };
        });
        return averages;
    }, [teams, players]);

    const getStatLeaders = (statKey: keyof Stats | 'total') => {
        let max = -1, leaders: TeamId[] = [];
        for (const teamId of Object.keys(teamAverages)) {
            const data = teamAverages[teamId];
            let value: number;
            if (statKey === 'total') {
                value = data.total;
            } else {
                value = data.stats[statKey as keyof Stats];
            }
            
            if (value > max) { max = value; leaders = [teamId]; }
            else if (value.toFixed(1) === max.toFixed(1)) { leaders.push(teamId); }
        }
        return leaders;
    }
    
    const currentPickingTeam = useMemo(() => {
        if (phase !== 'drafting' || draftOrder.length === 0 || unassignedPlayerIds.length === 0) return null;
        const currentTeamId = draftOrder[currentPickIndex];
        return teams.find(t => t.id === currentTeamId);
    }, [phase, draftOrder, currentPickIndex, teams, unassignedPlayerIds]);

    const genderBalanceWarning = useMemo(() => {
        if (!balanceGender || !currentPickingTeam) return null;

        const currentTeamPlayers = currentPickingTeam.playerIds.map(id => players[id]).filter(Boolean);
        const currentMaleCount = currentTeamPlayers.filter(p => p.gender.includes('남')).length;
        const currentFemaleCount = currentTeamPlayers.filter(p => p.gender.includes('여')).length;

        if (currentMaleCount >= genderQuotas.maleMax) {
            return t('gender_warning_male_max_reached', { max: genderQuotas.maleMax });
        }
        if (currentFemaleCount >= genderQuotas.femaleMax) {
            return t('gender_warning_female_max_reached', { max: genderQuotas.femaleMax });
        }
        
        const totalSlotsForThisTeam = teamTotalSlots.get(currentPickingTeam.id) || 0;
        const picksRemainingForTeam = totalSlotsForThisTeam - currentPickingTeam.playerIds.length;
        const malesNeededForMin = Math.max(0, genderQuotas.maleMin - currentMaleCount);
        const femalesNeededForMin = Math.max(0, genderQuotas.femaleMin - currentFemaleCount);
        
        if (picksRemainingForTeam > 0) {
            if (malesNeededForMin > 0 && picksRemainingForTeam <= malesNeededForMin) {
                return t('gender_warning_must_pick_male', { min: genderQuotas.maleMin, remaining: picksRemainingForTeam });
            }
            if (femalesNeededForMin > 0 && picksRemainingForTeam <= femalesNeededForMin) {
                return t('gender_warning_must_pick_female', { min: genderQuotas.femaleMin, remaining: picksRemainingForTeam });
            }
        }
        
        return null;
    }, [balanceGender, currentPickingTeam, players, genderQuotas, teamTotalSlots, t]);


    const sortingControls = (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 text-xs sm:text-sm">
            <label htmlFor="sort-select" className="text-slate-400 font-semibold whitespace-nowrap">{t('team_builder_sort_by')}</label>
            <select 
                id="sort-select" 
                value={sortKey} 
                onChange={(e) => setSortKey(e.target.value as keyof Stats | 'totalScore')} 
                className="w-full sm:w-auto bg-slate-700 border border-slate-600 rounded-md py-2 sm:py-1 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#00A3FF] text-white min-h-[44px] sm:min-h-0"
            >
                <option value="totalScore">{t('team_builder_total_score')}</option>
                {STAT_KEYS.map(key => (
                    <option key={key} value={key}>{t(STAT_NAME_KEYS[key])}</option>
                ))}
            </select>
        </div>
    );

    const controlPanel = (
         <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-wrap">
            {phase === 'drafting' && (
                <>
                    <button onClick={() => setShowRealNames(!showRealNames)} className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 sm:py-2 px-3 sm:px-4 rounded-lg transition duration-200 min-h-[44px] text-sm sm:text-base">
                        {showRealNames ? <EyeSlashIcon className="w-4 h-4 sm:w-5 sm:h-5" /> : <EyeIcon className="w-4 h-4 sm:w-5 sm:h-5" />}
                        {showRealNames ? t('hide_names') : t('show_names')}
                    </button>
                    <button onClick={handleUndo} disabled={draftHistory.length === 0} className="flex items-center justify-center gap-2 bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-2 sm:py-2 px-3 sm:px-4 rounded-lg transition duration-200 disabled:bg-slate-600 disabled:cursor-not-allowed min-h-[44px] text-sm sm:text-base">
                        <UndoIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                        {t('undo')}
                    </button>
                </>
            )}
             <button onClick={() => setIsComparisonModalOpen(true)} disabled={comparisonPlayerIds.size !== 2} className="flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 sm:py-2 px-3 sm:px-4 rounded-lg transition duration-200 disabled:bg-slate-600 disabled:cursor-not-allowed min-h-[44px] text-sm sm:text-base">
                <ScaleIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                {t('compare_two_players', { count: comparisonPlayerIds.size })}
            </button>
             {phase === 'drafting' && (
                <>
                    <label htmlFor="gender-balance-toggle" className="flex items-center cursor-pointer p-2 rounded-lg hover:bg-slate-700 min-h-[44px]">
                        <UsersIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-pink-400"/>
                        <span className="font-semibold text-slate-300 text-sm sm:text-base">{t('gender_balance')}</span>
                        <div className="relative inline-block w-10 ml-2 align-middle select-none">
                            <input type="checkbox" id="gender-balance-toggle" checked={balanceGender} onChange={() => setBalanceGender(!balanceGender)} className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer transition-all duration-300"/>
                            <label htmlFor="gender-balance-toggle" className="toggle-label block overflow-hidden h-6 rounded-full bg-slate-600 cursor-pointer"></label>
                        </div>
                    </label>
                </>
            )}
        </div>
    );

    if (phase === 'final') {
        return <FinalTeamsScreen teams={teams} players={players} onReset={onReset} selectedClass={selectedClass} />;
    }

    if (phase === 'captain-selection') {
        const isButtonDisabled = selectedCaptainIds.size < 2 || selectedCaptainIds.size > 4;
        return (
             <div className="space-y-4 sm:space-y-6 px-4">
                <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-700 p-3 sm:p-4 rounded-lg shadow-lg">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                         <div className="text-center md:text-left w-full md:w-auto">
                            <h2 className="text-xl sm:text-2xl font-bold text-[#00A3FF]">{t('captain_selection_title')}</h2>
                            <p className="text-sm sm:text-base text-slate-400">{t('captain_selection_desc', { count: selectedCaptainIds.size })}</p>
                         </div>
                         <button onClick={handleStartDraft} disabled={isButtonDisabled} className="w-full md:w-auto bg-[#00A3FF] hover:bg-[#0082cc] text-white font-bold py-2 sm:py-2 px-4 sm:px-6 rounded-lg transition duration-200 disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed min-h-[44px] text-sm sm:text-base">
                            {isButtonDisabled ? t('start_draft') : t('create_teams_and_start_draft', { count: selectedCaptainIds.size })}
                        </button>
                    </div>
                    <div className="border-t border-slate-700 pt-3 sm:pt-4">
                        {controlPanel}
                    </div>
                </div>
                 <div className="bg-slate-900/50 p-3 sm:p-4 rounded-xl shadow-lg border-2 border-dashed border-slate-700">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {unassignedPlayerIds.map(id => players[id]).filter(Boolean).map(p => (
                            <PlayerCard 
                                key={p.id} 
                                player={p} 
                                onClick={handleToggleCaptainSelection} 
                                onViewStats={handleViewStats}
                                isDraggable={false} 
                                showRealNames={showRealNames} 
                                onToggleComparison={handleToggleComparison} 
                                isComparisonSelected={comparisonPlayerIds.has(p.id)} 
                                isCaptainSelectable={true} 
                                isCaptainSelected={selectedCaptainIds.has(p.id)} 
                            />
                        ))}
                    </div>
                </div>
                 {selectedPlayer && <StatModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} showRealNames={showRealNames} />}
                 {isComparisonModalOpen && comparisonPlayerIds.size === 2 && (
                    <ComparisonModal
                        player1={players[Array.from(comparisonPlayerIds)[0]]}
                        player2={players[Array.from(comparisonPlayerIds)[1]]}
                        onClose={() => { setIsComparisonModalOpen(false); }}
                        showRealNames={showRealNames}
                    />
                )}
            </div>
        );
    }


    return (
        <div className="space-y-4 sm:space-y-6 px-4">
            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-700 p-3 sm:p-4 rounded-lg shadow-lg flex flex-col gap-4 sm:gap-4">
                 <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 justify-between items-stretch sm:items-center">
                    <div className="flex-1">{controlPanel}</div>
                    <div className="flex items-center gap-2">
                         <button onClick={onReset} className="w-full sm:w-auto bg-red-600 hover:bg-red-500 text-white font-bold py-2 sm:py-2 px-3 sm:px-4 rounded-lg transition duration-200 min-h-[44px] text-sm sm:text-base">{t('reset')}</button>
                    </div>
                </div>
                {unassignedPlayerIds.length > 0 && currentPickingTeam && (
                    <div className="text-center bg-slate-900 p-2 sm:p-3 rounded-lg">
                        <h3 className="text-base sm:text-lg lg:text-xl font-bold text-[#00A3FF] animate-pulse break-words">
                            {t('draft_turn_info', { round: draftRound, teamName: '' })}<span style={{color: currentPickingTeam.color}}>{currentPickingTeam.name}</span>
                        </h3>
                    </div>
                )}
                {phase === 'drafting' && balanceGender && (
                    <div className={`text-center p-2 sm:p-3 rounded-lg border transition-all ${genderBalanceWarning ? 'bg-yellow-900/50 border-yellow-500/80' : 'bg-green-900/50 border-green-500/80'}`}>
                        <p className="font-bold text-sm sm:text-base text-slate-300">{t('gender_balance_guide_title')}</p>
                        <div className="flex justify-center items-center gap-2 sm:gap-4 mt-1">
                            <p className="text-xs sm:text-sm text-slate-400">
                                {t('gender_balance_guide_desc', { maleMin: genderQuotas.maleMin, maleMax: genderQuotas.maleMax, femaleMin: genderQuotas.femaleMin, femaleMax: genderQuotas.femaleMax })}
                            </p>
                        </div>
                        {genderBalanceWarning &&
                            <div className="mt-2 text-xs sm:text-sm font-semibold text-yellow-300">
                                <p className="mt-1 font-bold animate-pulse">{genderBalanceWarning}</p>
                            </div>
                        }
                    </div>
                )}
                <div className="w-full bg-slate-900 p-2 sm:p-3 rounded-lg overflow-x-auto">
                    <h3 className="text-center font-bold text-base sm:text-lg mb-2 text-[#00A3FF]">{t('team_builder_comparison_title')}</h3>
                    <div className="overflow-x-auto -mx-2 sm:mx-0">
                        <table className="min-w-full text-xs sm:text-sm text-center">
                            <thead>
                                <tr className="text-slate-400">
                                    <th className="p-1 sm:p-2 whitespace-nowrap">{t('team_builder_stats_header')}</th>
                                    {teams.map(team => 
                                        <th key={team.id} className="p-1 sm:p-2 whitespace-nowrap" style={{color: team.color}}>
                                            {t('team_builder_team_header_format', { name: team.name, count: teamAverages[team.id]?.count || 0 })}
                                            <span className="block text-xs sm:text-sm font-normal text-sky-400">
                                                {t('team_builder_avg_score', { score: (teamAverages[team.id]?.total || 0).toFixed(1) })}
                                            </span>
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="text-slate-300">
                                {['total', ...STAT_KEYS].map(key => {
                                    const leaders = getStatLeaders(key as keyof Stats | 'total');
                                    return (
                                        <tr key={key} className="border-t border-slate-700">
                                            <td className="p-1 sm:p-2 font-semibold text-slate-400 whitespace-nowrap">{key === 'total' ? t('team_builder_total_score') : t(STAT_NAME_KEYS[key as keyof Stats])}</td>
                                            {teams.map(team => (
                                                <td key={team.id} className={`p-1 sm:p-2 font-bold whitespace-nowrap ${leaders.includes(team.id) ? 'text-[#00A3FF]' : ''}`}>
                                                    {(key === 'total' ? teamAverages[team.id]?.total : teamAverages[team.id]?.stats[key as keyof Stats])?.toFixed(1) || '0.0'}
                                                </td>
                                            ))}
                                        </tr>
                                    )
                                })}
                                <tr className="border-t border-slate-700">
                                    <td className="p-1 sm:p-2 font-semibold text-slate-400 whitespace-nowrap">{t('team_builder_gender_ratio')}</td>
                                    {teams.map(team => (<td key={team.id} className="p-1 sm:p-2 font-semibold whitespace-nowrap">{teamAverages[team.id]?.gender.male || 0} / {teamAverages[team.id]?.gender.female || 0}</td>))}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-4 sm:gap-6">
                 <TeamPanel 
                    teamId="unassigned" 
                    name={t('unassigned_players')}
                    playerCount={unassignedPlayerIds.length} 
                    color="#64748b" 
                    onDrop={handleDrop} 
                    isCurrentPick={false}
                    headerControls={sortingControls}
                >
                    {sortedUnassignedPlayerIds.map(id => players[id]).filter(Boolean).map(p => (
                        <PlayerCard 
                            key={p.id} 
                            player={p} 
                            onClick={() => {}} 
                            onDoubleClick={handleDoubleClickDraft}
                            onViewStats={handleViewStats}
                            isDraggable={!p.isCaptain} 
                            showRealNames={showRealNames} 
                            onToggleComparison={handleToggleComparison} 
                            isComparisonSelected={comparisonPlayerIds.has(p.id)} 
                        />
                    ))}
                </TeamPanel>
                {teams.map(team => (
                     <TeamPanel 
                        key={team.id} 
                        teamId={team.id} 
                        name={team.name} 
                        playerCount={team.playerIds.length} 
                        averageScore={(teamAverages[team.id]?.total || 0)}
                        color={team.color} 
                        onDrop={handleDrop} 
                        onNameChange={handleTeamNameChange} 
                        isCurrentPick={team.id === currentPickingTeam?.id}
                     >
                        {team.playerIds.map(id => players[id]).filter(Boolean).sort((a, b) => Number(b.isCaptain) - Number(a.isCaptain)).map(p => (
                             <PlayerCard 
                                key={p.id} 
                                player={p} 
                                onClick={handleViewStats} 
                                onViewStats={handleViewStats}
                                isDraggable={!p.isCaptain} 
                                showRealNames={showRealNames} 
                                onToggleComparison={handleToggleComparison} 
                                isComparisonSelected={comparisonPlayerIds.has(p.id)}
                            />
                        ))}
                    </TeamPanel>
                ))}
            </div>
            {selectedPlayer && <StatModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} showRealNames={showRealNames} />}
            {isComparisonModalOpen && comparisonPlayerIds.size === 2 && (
                <ComparisonModal
                    player1={players[Array.from(comparisonPlayerIds)[0]]}
                    player2={players[Array.from(comparisonPlayerIds)[1]]}
                    onClose={() => { setIsComparisonModalOpen(false); }}
                    showRealNames={showRealNames}
                />
            )}
        </div>
    );
};

export default TeamBuilderScreen;