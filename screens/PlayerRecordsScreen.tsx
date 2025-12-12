import React, { useState, useMemo, useCallback } from 'react';
import { useData } from '../contexts/DataContext';
import { Player, PlayerStats, Badge, PlayerCumulativeStats } from '../types';
// Fix: Changed import to be a named import as PlayerHistoryModal is not a default export.
import { PlayerHistoryModal } from '../components/PlayerHistoryModal';
import { BADGE_DEFINITIONS } from '../data/badges';
import { useTranslation } from '../hooks/useTranslation';

const PlayerRecordsScreen: React.FC = () => {
    const { teamSets, matchHistory, playerCumulativeStats, playerAchievements } = useData();
    const { t } = useTranslation();
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
    const [playerHistoryData, setPlayerHistoryData] = useState<any | null>(null);

    const availableClasses = useMemo(() => {
        const classSet = new Set<string>();
        teamSets.forEach(set => {
            // Strip any non-numeric suffixes if possible, but keep original if needed.
            // Assumption: set.className usually contains "1반", "2반".
            // We want just "1", "2".
            const digits = set.className.replace(/[^0-9]/g, '');
            if (digits) {
                classSet.add(digits);
            } else {
                // Fallback for non-numeric class names
                classSet.add(set.className);
            }
        });
        return Array.from(classSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    }, [teamSets]);

    // Group players by identity (Class + Student Number + Name) to handle duplicates from old ID generation logic
    const groupedPlayers = useMemo<Map<string, { player: Player; ids: string[] }>>(() => {
        const groups = new Map<string, { player: Player; ids: string[] }>();
        
        teamSets.forEach(set => {
            Object.values(set.players).forEach((player: Player) => {
                // Identity key: "Class-Number-Name"
                const identityKey = `${player.class}-${player.studentNumber}-${player.originalName}`;
                
                if (!groups.has(identityKey)) {
                    groups.set(identityKey, { player, ids: [player.id] });
                } else {
                    const entry = groups.get(identityKey)!;
                    if (!entry.ids.includes(player.id)) {
                        entry.ids.push(player.id);
                    }
                }
            });
        });
        return groups;
    }, [teamSets]);

    const allPlayers = useMemo(() => {
        return Array.from(groupedPlayers.values())
            .map((group: { player: Player; ids: string[] }) => group.player)
            .sort((a, b) => a.originalName.localeCompare(b.originalName));
    }, [groupedPlayers]);

    const filteredPlayers = useMemo(() => {
        if (!selectedClass) return [];
    
        // Only return representative players that belong to the selected class
        return allPlayers.filter(player => {
             // Check if player class matches. Note: player.class is just the number string "1", "2".
             // We need to compare it with the selectedClass ("1", "2") directly.
             // Sometimes player.class might have suffix in old data, strip it.
             const pClass = player.class.replace(/[^0-9]/g, '');
             return pClass === selectedClass || player.class === selectedClass;
        });
    }, [allPlayers, selectedClass]); // t 의존성 제거: 필터링 로직에서 사용하지 않음
    
    // Aggregate stats from all IDs belonging to the same person
    const getAggregatedStats = useCallback((player: Player) => {
        const identityKey = `${player.class}-${player.studentNumber}-${player.originalName}`;
        const entry = groupedPlayers.get(identityKey);
        const ids = entry ? entry.ids : [player.id];

        const aggregated: Partial<PlayerCumulativeStats> = {
            matchesPlayed: 0,
            wins: 0,
            points: 0,
            serviceAces: 0,
            serviceFaults: 0,
            spikeSuccesses: 0,
            blockingPoints: 0,
            serveIn: 0,
            digs: 0,
            assists: 0,
            plusMinus: 0,
            badgeCount: 0
        };

        const aggregatedBadges = new Set<string>();

        ids.forEach(id => {
            const stats = playerCumulativeStats[id];
            if (stats) {
                aggregated.matchesPlayed = (aggregated.matchesPlayed || 0) + (stats.matchesPlayed || 0);
                aggregated.wins = (aggregated.wins || 0) + (stats.wins || 0);
                aggregated.points = (aggregated.points || 0) + (stats.points || 0);
                aggregated.serviceAces = (aggregated.serviceAces || 0) + (stats.serviceAces || 0);
                aggregated.serviceFaults = (aggregated.serviceFaults || 0) + (stats.serviceFaults || 0);
                aggregated.spikeSuccesses = (aggregated.spikeSuccesses || 0) + (stats.spikeSuccesses || 0);
                aggregated.blockingPoints = (aggregated.blockingPoints || 0) + (stats.blockingPoints || 0);
                aggregated.serveIn = (aggregated.serveIn || 0) + (stats.serveIn || 0);
                aggregated.digs = (aggregated.digs || 0) + (stats.digs || 0);
                aggregated.assists = (aggregated.assists || 0) + (stats.assists || 0);
                aggregated.plusMinus = (aggregated.plusMinus || 0) + (stats.plusMinus || 0);
            }
            
            const achievements = playerAchievements[id];
            if (achievements && achievements.earnedBadgeIds) {
                achievements.earnedBadgeIds.forEach(badgeId => aggregatedBadges.add(badgeId));
            }
        });

        return { stats: aggregated, badgeIds: aggregatedBadges };
    }, [groupedPlayers, playerCumulativeStats, playerAchievements]);


    const calculatePlayerHistory = useCallback((player: Player) => {
        if (!player) return;
        
        const identityKey = `${player.class}-${player.studentNumber}-${player.originalName}`;
        const entry = groupedPlayers.get(identityKey);
        const playerIds = new Set(entry ? entry.ids : [player.id]);
    
        const cumulativeStats: any = {
            points: 0, serviceAces: 0, serviceFaults: 0, blockingPoints: 0, spikeSuccesses: 0, matchesPlayed: 0
        };
        const performanceHistory: any[] = [];
    
        const completedMatches = matchHistory
            .filter(m => m.status === 'completed')
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
        completedMatches.forEach(match => {
            // Check if ANY of the player's IDs participated in this match
            let playerTeam: 'teamA' | 'teamB' | null = null;
            let matchedId: string | null = null;

            if (match.teamA.players) {
                const foundId = Object.keys(match.teamA.players).find(id => playerIds.has(id));
                if (foundId) {
                    playerTeam = 'teamA';
                    matchedId = foundId;
                }
            }
            
            if (!playerTeam && match.teamB.players) {
                const foundId = Object.keys(match.teamB.players).find(id => playerIds.has(id));
                if (foundId) {
                    playerTeam = 'teamB';
                    matchedId = foundId;
                }
            }
    
            if (playerTeam && matchedId) {
                const teamState = match[playerTeam];
                const opponentName = (playerTeam === 'teamA' ? match.teamB : match.teamA).name;
                const playerStatsForMatch = teamState.playerStats?.[matchedId];
    
                if (playerStatsForMatch) {
                    cumulativeStats.matchesPlayed += 1;
                    Object.keys(playerStatsForMatch).forEach(key => {
                        cumulativeStats[key as keyof PlayerStats] = (cumulativeStats[key as keyof PlayerStats] || 0) + playerStatsForMatch[key as keyof PlayerStats];
                    });
    
                    performanceHistory.push({
                        match,
                        teamName: teamState.name,
                        opponent: opponentName,
                        stats: playerStatsForMatch,
                    });
                }
            }
        });
    
        const totalServices = (cumulativeStats.serviceAces || 0) + (cumulativeStats.serviceFaults || 0);
        cumulativeStats.serviceSuccessRate = totalServices > 0 ? (cumulativeStats.serviceAces / totalServices) * 100 : 0;
        
        performanceHistory.reverse();
    
        setPlayerHistoryData({ player, cumulativeStats, performanceHistory });
    }, [matchHistory, groupedPlayers]);

    const handlePlayerClick = (player: Player) => {
        setSelectedPlayer(player);
        calculatePlayerHistory(player);
    };

    return (
        <>
            {playerHistoryData && (
                <PlayerHistoryModal
                    player={playerHistoryData.player}
                    cumulativeStats={playerHistoryData.cumulativeStats}
                    performanceHistory={playerHistoryData.performanceHistory}
                    onClose={() => setPlayerHistoryData(null)}
                    teamSets={teamSets}
                />
            )}
            <div className="max-w-4xl mx-auto bg-slate-900/50 backdrop-blur-sm border border-slate-700 p-4 sm:p-6 rounded-lg shadow-2xl space-y-6 animate-fade-in w-full px-4">
                <div className="flex flex-col lg:flex-row items-center lg:justify-between mb-6 gap-4">
                    <h1 className="text-3xl lg:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 text-center lg:text-right">
                        {t('player_records_title')}
                    </h1>
                    <div className="flex-grow sm:flex-grow-0 self-start lg:self-auto">
                        <label htmlFor="class-select-records" className="sr-only">{t('record_filter_class_label')}</label>
                        <select
                            id="class-select-records"
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                            className="w-full sm:w-auto bg-slate-700 border border-slate-600 rounded-md p-3 text-white focus:outline-none focus:ring-2 focus:ring-[#00A3FF]"
                        >
                            <option value="">{t('player_records_select_class_prompt')}</option>
                            {availableClasses.map(c => (
                                <option key={c} value={c}>{t('class_format', { class: c })}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 min-h-[400px]">
                    {selectedClass ? (
                         <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 items-start">
                            {filteredPlayers.map(player => {
                                // Use the aggregation function instead of direct lookup
                                const { stats, badgeIds } = getAggregatedStats(player);
                                
                                const badges = Array.from(badgeIds)
                                        .map(badgeId => BADGE_DEFINITIONS.find(b => b.id === badgeId))
                                        .filter((b): b is Badge => !!b);

                                return (
                                <button
                                    key={player.id}
                                    onClick={() => handlePlayerClick(player)}
                                    className="p-4 bg-slate-800 rounded-lg text-center hover:bg-slate-700 hover:ring-2 ring-sky-500 transition-all duration-200"
                                >
                                    <div>
                                        <p className="text-lg font-bold text-slate-100 truncate">{player.originalName}</p>
                                        <p className="text-sm text-slate-400">{player.studentNumber}{t('student_number')}</p>
                                        <div className="mt-2 text-xs text-slate-500">
                                            <p>{t('player_records_matches_label')}: {stats?.matchesPlayed || 0}{t('player_records_matches_unit')}</p>
                                            <p>{t('player_records_wins_label')}: {stats?.wins || 0} / {t('player_records_losses_label')}: {(stats?.matchesPlayed || 0) - (stats?.wins || 0)}</p>
                                        </div>
                                    </div>
                                    {badges.length > 0 && (
                                        <div className="mt-3 border-t border-slate-700 pt-2 space-y-1">
                                            {badges.map(badge => {
                                                const Icon = badge.icon;
                                                return (
                                                    <div key={badge.id} className="flex items-center justify-center gap-1.5 text-yellow-400" title={t(badge.descriptionKey)}>
                                                        <Icon className="w-4 h-4 flex-shrink-0" />
                                                        <span className="truncate text-sm font-semibold text-yellow-300">{t(badge.nameKey)}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </button>
                            )})}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center py-8 px-4 text-slate-400">
                            <h3 className="text-lg font-bold text-sky-400 mb-3">{t('player_records_guide_title')}</h3>
                            <p>{t('player_records_guide_desc')}</p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default PlayerRecordsScreen;