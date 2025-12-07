import React, { useMemo, useState } from 'react';
import { useData } from '../contexts/DataContext';
import { BADGE_DEFINITIONS } from '../data/badges';
import { Badge, Player, PlayerCumulativeStats } from '../types';
import { useTranslation } from '../hooks/useTranslation';

const AchievementsScreen: React.FC = () => {
    const { playerAchievements, teamSets, playerCumulativeStats } = useData();
    const { t } = useTranslation();
    const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);

    const allPlayersMap = useMemo(() => {
        const map = new Map<string, Player>();
        teamSets.forEach(set => {
            // Fix: Add explicit Player type to forEach callback parameter
            Object.values(set.players).forEach((player: Player) => {
                map.set(player.id, player);
            });
        });
        return map;
    }, [teamSets]);

    const badgeEarners = useMemo(() => {
        const earnersMap = new Map<string, Player[]>();
        // Fix: Add explicit Badge type to forEach callback parameter
        BADGE_DEFINITIONS.forEach((badge: Badge) => {
            const badgeId = badge.id;
            const currentEarners: Player[] = [];
            for (const playerId in playerAchievements) {
                if (playerAchievements[playerId].earnedBadgeIds.has(badgeId)) {
                    const player = allPlayersMap.get(playerId);
                    if (player) {
                        currentEarners.push(player);
                    }
                }
            }
            earnersMap.set(badgeId, currentEarners);
        });
        return earnersMap;
    }, [playerAchievements, allPlayersMap]);

    const EarnersModal: React.FC<{ 
        badge: Badge; 
        earners: Player[]; 
        onClose: () => void; 
        cumulativeStats: Record<string, Partial<PlayerCumulativeStats>>;
    }> = ({ badge, earners, onClose, cumulativeStats }) => {
        
        const badgeIdToStatKey: Partial<Record<string, { key: keyof PlayerCumulativeStats, unit: string }>> = {
            'serve_king': { key: 'serviceAces', unit: t('achievements_unit_times') },
            'spike_master': { key: 'spikeSuccesses', unit: t('achievements_unit_times') },
            'iron_wall_guardian': { key: 'blockingPoints', unit: t('achievements_unit_times') },
            'serve_ace_pro': { key: 'serviceAces', unit: t('achievements_unit_times') },
            'iron_wall': { key: 'blockingPoints', unit: t('achievements_unit_times') },
            'power_spiker': { key: 'spikeSuccesses', unit: t('achievements_unit_times') },
            'consistency_symbol': { key: 'matchesPlayed', unit: t('achievements_unit_times') },
            'victory_protagonist': { key: 'wins', unit: t('achievements_unit_wins') },
            'collection_master': { key: 'badgeCount', unit: t('achievements_unit_count') },
        };

        const statInfo = badgeIdToStatKey[badge.id];

        const sortedEarners = useMemo(() => {
            if (!statInfo) return earners;
            return [...earners].sort((a, b) => {
                const statA = cumulativeStats[a.id]?.[statInfo.key] || 0;
                const statB = cumulativeStats[b.id]?.[statInfo.key] || 0;
                return statB - statA;
            });
        }, [earners, badge, cumulativeStats, statInfo]);


        return (
            <div 
                className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 animate-fade-in"
                onClick={onClose}
            >
                <div 
                    className="bg-slate-900 rounded-lg shadow-2xl p-6 w-full max-w-md text-white border border-[#00A3FF]"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-start gap-4 mb-4">
                        <badge.icon className="w-16 h-16 text-[#00A3FF] flex-shrink-0" />
                        <div>
                            <h2 className="text-2xl font-bold text-[#00A3FF]">{t(badge.nameKey)}</h2>
                            <p className="text-slate-300 text-base mt-2 leading-relaxed">{t(badge.descriptionKey)}</p>
                        </div>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-300 mb-2">{t('achievements_earned_players')} ({sortedEarners.length}{t('achievements_unit_people')})</h3>
                    {sortedEarners.length > 0 ? (
                        <div className="max-h-80 overflow-y-auto bg-slate-800/50 p-2 rounded-lg">
                            <ul className="divide-y divide-slate-700">
                                {sortedEarners.map(player => {
                                    const statValue = statInfo && cumulativeStats[player.id] ? cumulativeStats[player.id]?.[statInfo.key] : null;

                                    return (
                                        <li key={player.id} className="p-2 flex justify-between items-center">
                                            <div>
                                                <span className="font-semibold text-slate-200">{player.originalName}</span>
                                                <span className="text-sm text-slate-500 ml-2">({t('class_format', { class: player.class })} {player.studentNumber}{t('achievements_student_number_suffix')})</span>
                                            </div>
                                            {statValue !== null && statInfo && (
                                                <span className="font-mono text-lg text-sky-400 font-bold">{statValue}{statInfo.unit}</span>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ) : (
                        <div className="bg-slate-800/50 p-4 rounded-lg text-center">
                            <p className="text-slate-500">{t('achievements_no_earners')}</p>
                        </div>
                    )}
                    <div className="text-center mt-6">
                        <button onClick={onClose} className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-6 rounded-lg">{t('close')}</button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <>
            {selectedBadge && <EarnersModal badge={selectedBadge} earners={badgeEarners.get(selectedBadge.id) || []} onClose={() => setSelectedBadge(null)} cumulativeStats={playerCumulativeStats} />}
            <div className="max-w-4xl mx-auto bg-slate-900/50 backdrop-blur-sm border border-slate-700 p-6 rounded-lg shadow-2xl space-y-6 animate-fade-in w-full">
                <div className="text-center">
                    <h2 className="text-3xl font-bold text-[#00A3FF]">{t('achievements_title')}</h2>
                    <p className="text-slate-400 mt-1">{t('achievements_subtitle')}</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {BADGE_DEFINITIONS.map(badge => {
                        const earners = badgeEarners.get(badge.id) || [];
                        const isEarned = earners.length > 0;
                        const isCompetitive = badge.isCompetitive;
                        return (
                            <div
                                key={badge.id}
                                onClick={() => setSelectedBadge(badge)}
                                className={`p-4 bg-slate-800 rounded-lg flex flex-col items-center justify-between gap-3 text-center border-2 cursor-pointer ${
                                    isEarned 
                                        ? (isCompetitive ? 'border-transparent' : 'border-sky-500/50 hover:border-sky-400')
                                        : 'border-transparent hover:border-slate-700'
                                } ${isEarned && isCompetitive ? 'yellow-glowing-border' : ''} transition-all duration-200 aspect-square`}
                            >
                                <div className={`flex-grow flex items-center justify-center ${!isEarned ? 'opacity-30' : ''}`}>
                                     <badge.icon className={`w-16 h-16 ${
                                        isEarned 
                                            ? (isCompetitive ? 'text-yellow-400' : 'text-sky-400')
                                            : 'text-slate-500'
                                    }`} />
                                </div>
                                <div className="text-center">
                                    <h3 className={`font-bold ${
                                        isEarned
                                            ? (isCompetitive ? 'text-yellow-300' : 'text-slate-100')
                                            : 'text-slate-500'
                                    }`}>
                                        {t(badge.nameKey)}
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-1">{t('achievements_earned_count')}: {earners.length}{t('achievements_unit_people')}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );
};

export default AchievementsScreen;