import React, { useMemo } from 'react';
import { Badge, Player, PlayerCumulativeStats } from '../types';
import { useData } from '../contexts/DataContext';
import { useTranslation } from '../hooks/useTranslation';

interface BadgeDetailModalProps {
    badge: Badge;
    player: Player;
    playerStats: Partial<PlayerCumulativeStats>;
    onClose: () => void;
}

// 배지별 관련 통계 필드 매핑
const badgeStatMapping: Record<string, keyof PlayerCumulativeStats | null> = {
    'serve_ace_pro': 'serviceAces',
    'iron_wall': 'blockingPoints',
    'power_spiker': 'spikeSuccesses',
    'victory_protagonist': 'wins',
    'consistency_symbol': 'matchesPlayed',
    'serve_king': 'serviceAces',
    'spike_master': 'spikeSuccesses',
    'iron_wall_guardian': 'blockingPoints',
    'first_score': 'points',
    'flawless_serve': 'serviceAces',
    'three_hit_master': null, // 팀 통계이므로 개인 통계로 매핑 불가
    'fair_play_master': null, // 팀 통계이므로 개인 통계로 매핑 불가
    'perfect_game': 'wins',
    'clutch_player': null,
    'rookie_ace': null,
    'comeback_kid': null,
    'team_player': null,
    'collection_master': null,
};

export const BadgeDetailModal: React.FC<BadgeDetailModalProps> = ({ badge, player, playerStats, onClose }) => {
    const { teamSets, playerCumulativeStats, playerAchievements } = useData();
    const { t } = useTranslation();

    // 모든 선수 맵 생성
    const allPlayersMap = useMemo(() => {
        const map = new Map<string, Player>();
        teamSets.forEach(set => {
            Object.values(set.players).forEach((p: Player) => {
                map.set(p.id, p);
            });
        });
        return map;
    }, [teamSets]);

    // 이 배지를 획득한 다른 선수들
    const badgeEarners = useMemo(() => {
        const earners: Player[] = [];
        for (const playerId in playerAchievements) {
            if (playerAchievements[playerId].earnedBadgeIds.has(badge.id)) {
                const p = allPlayersMap.get(playerId);
                if (p && p.id !== player.id) {
                    // 동일 인물 확인 (class, studentNumber, originalName 기준)
                    const playerKey = `${p.class}-${p.studentNumber}-${p.originalName}`;
                    const currentPlayerKey = `${player.class}-${player.studentNumber}-${player.originalName}`;
                    if (playerKey !== currentPlayerKey) {
                        earners.push(p);
                    }
                }
            }
        }
        // 중복 제거 (동일 인물이 여러 ID를 가질 수 있음)
        const uniqueEarners = new Map<string, Player>();
        earners.forEach(p => {
            const key = `${p.class}-${p.studentNumber}-${p.originalName}`;
            if (!uniqueEarners.has(key)) {
                uniqueEarners.set(key, p);
            }
        });
        return Array.from(uniqueEarners.values()).sort((a, b) => 
            a.originalName.localeCompare(b.originalName)
        );
    }, [badge.id, playerAchievements, allPlayersMap, player]);

    // 나의 순위 계산
    const myRank = useMemo(() => {
        const statField = badgeStatMapping[badge.id];
        if (!statField) return null;

        const myValue = playerStats[statField] || 0;
        if (myValue === 0) return null;

        // 모든 선수의 해당 통계 수집
        const allStats: Array<{ player: Player, value: number }> = [];
        for (const playerId in playerCumulativeStats) {
            const stats = playerCumulativeStats[playerId];
            const value = stats?.[statField] || 0;
            if (value > 0) {
                const p = allPlayersMap.get(playerId);
                if (p) {
                    allStats.push({ player: p, value });
                }
            }
        }

        // 중복 제거 및 통계 집계 (동일 인물이 여러 ID를 가질 수 있음)
        const uniqueStats = new Map<string, { player: Player, value: number }>();
        allStats.forEach(({ player: p, value }) => {
            const key = `${p.class}-${p.studentNumber}-${p.originalName}`;
            const existing = uniqueStats.get(key);
            if (!existing || existing.value < value) {
                uniqueStats.set(key, { player: p, value });
            }
        });

        const sortedStats = Array.from(uniqueStats.values())
            .sort((a, b) => b.value - a.value);

        const playerKey = `${player.class}-${player.studentNumber}-${player.originalName}`;
        const myIndex = sortedStats.findIndex(({ player: p }) => 
            `${p.class}-${p.studentNumber}-${p.originalName}` === playerKey
        );

        if (myIndex === -1) return null;

        const rank = myIndex + 1;
        const total = sortedStats.length;
        const percentage = Math.round((rank / total) * 100);

        return { rank, total, percentage, value: myValue };
    }, [badge.id, playerStats, playerCumulativeStats, allPlayersMap, player]);

    const Icon = badge.icon;

    // 획득 조건 설명 (translations의 descriptionKey 사용)
    const conditionText = t(badge.descriptionKey);

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4 animate-fade-in"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <div 
                className="bg-slate-900 rounded-lg shadow-2xl p-6 w-full max-w-lg text-white border border-slate-700 max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 헤더 */}
                <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-slate-800 rounded-lg flex items-center justify-center border border-slate-700">
                            <Icon className="w-10 h-10 text-yellow-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-[#00A3FF]">{t(badge.nameKey)}</h2>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-2xl font-bold text-slate-500 hover:text-white transition-colors"
                        aria-label={t('close')}
                    >
                        &times;
                    </button>
                </div>

                {/* 획득 조건 */}
                <div className="mb-6">
                    <h3 className="text-lg font-semibold text-slate-300 mb-2">획득 조건</h3>
                    <p className="text-slate-400 bg-slate-800/50 p-3 rounded-md border border-slate-700">
                        {conditionText || '멋진 플레이를 통해 획득했습니다.'}
                    </p>
                </div>

                {/* 나의 순위 */}
                {myRank && (
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-slate-300 mb-2">나의 순위</h3>
                        <div className="bg-slate-800/50 p-4 rounded-md border border-slate-700">
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-bold text-[#00A3FF]">{myRank.rank}위</span>
                                <span className="text-slate-400">/ {myRank.total}명</span>
                            </div>
                            <p className="text-sm text-slate-400 mt-1">
                                상위 {myRank.percentage}% (기록: {myRank.value})
                            </p>
                        </div>
                    </div>
                )}

                {/* 획득한 다른 선수들 */}
                <div>
                    <h3 className="text-lg font-semibold text-slate-300 mb-2">
                        획득한 다른 선수들 ({badgeEarners.length}명)
                    </h3>
                    {badgeEarners.length > 0 ? (
                        <div className="bg-slate-800/50 rounded-md border border-slate-700 max-h-48 overflow-y-auto">
                            <ul className="divide-y divide-slate-700">
                                {badgeEarners.map((earner) => {
                                    const key = `${earner.class}-${earner.studentNumber}-${earner.originalName}`;
                                    return (
                                        <li key={key} className="p-3 hover:bg-slate-700/50 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="flex-grow">
                                                    <p className="font-semibold text-slate-200">{earner.originalName}</p>
                                                    <p className="text-xs text-slate-400">
                                                        {t('class_format', { class: earner.class })} • {earner.studentNumber}{t('student_number')}
                                                    </p>
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ) : (
                        <p className="text-slate-400 bg-slate-800/50 p-3 rounded-md border border-slate-700 text-center">
                            아직 다른 선수가 이 배지를 획득하지 않았습니다.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

