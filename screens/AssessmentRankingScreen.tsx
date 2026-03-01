import React, { useState, useMemo, useCallback } from 'react';
import { useData } from '../contexts/DataContext';
import { Player, PlayerCumulativeStats, TeamSet } from '../types';
import { useTranslation } from '../hooks/useTranslation';

type TabType = 'excellence' | 'effort';

/** 우수 학생 부문 가중치 (더블 카운팅 방지: 베이스 득점 + 가산점 각 1.0) */
const EXCELLENCE_WEIGHT_POINTS = 1.0;
const EXCELLENCE_WEIGHT_ACE = 1.0;
const EXCELLENCE_WEIGHT_SPIKE = 1.0;
const EXCELLENCE_WEIGHT_BLOCK = 1.0;

const TEAM_FILTER_VALUES = ['ALL', '2', '3', '4'] as const;
type TeamFilterValue = typeof TEAM_FILTER_VALUES[number];

interface AssessmentRankingScreenProps {
    onBack: () => void;
}

type MatchWithHustle = {
    hustlePlayerIds?: string[];
    hustlePlayers?: { id: string }[];
    status?: string;
    isAssessment?: boolean;
    teamA?: { key?: string };
    teamB?: { key?: string };
};

function getMatchTeamCount(match: MatchWithHustle & { teamA?: { key?: string }; teamB?: { key?: string } }, teamSets: TeamSet[]): number {
    const key = match?.teamA?.key || match?.teamB?.key;
    if (!key) return 4;
    const setId = String(key).split('___')[0];
    return teamSets.find(s => s.id === setId)?.teamCount ?? 4;
}

export const AssessmentRankingScreen: React.FC<AssessmentRankingScreenProps> = ({ onBack }) => {
    const { teamSets, playerCumulativeStats, matchHistory, practiceMatchHistory, leagueMatchHistory } = useData();
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<TabType>('excellence');
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [teamFilter, setTeamFilter] = useState<TeamFilterValue>('ALL');

    const availableClasses = useMemo(() => {
        const set = new Set<string>();
        (teamSets ?? []).forEach(s => { if (s?.className) set.add(s.className); });
        return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    }, [teamSets]);

    const allPlayers = useMemo(() => {
        const seen = new Set<string>();
        const list: Player[] = [];
        (teamSets ?? []).forEach(set => {
            const players = set?.players ?? {};
            Object.values(players).forEach((player: Player) => {
                const key = `${player.class}-${player.studentNumber}-${player.originalName}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    list.push(player);
                }
            });
        });
        return list.sort((a, b) => a.originalName.localeCompare(b.originalName));
    }, [teamSets]);

    /** 동일 인물(반+번호+이름)에 해당하는 모든 player id 목록 */
    const identityToPlayerIds = useMemo(() => {
        const map = new Map<string, string[]>();
        (teamSets ?? []).forEach(set => {
            const players = set?.players ?? {};
            Object.values(players).forEach((player: Player) => {
                const key = `${player.class}-${player.studentNumber}-${player.originalName}`;
                if (!map.has(key)) map.set(key, []);
                if (!map.get(key)!.includes(player.id)) map.get(key)!.push(player.id);
            });
        });
        return map;
    }, [teamSets]);

    /** 팀 구성(2/3/4팀제) 기준으로 필터링한 경기 목록. '전체(ALL)' 선택 시 원본 경기 100% 통과 */
    const filteredMatchHistory = useMemo(() => {
        const rawMatches: (MatchWithHustle & { teamA?: { key?: string }; teamB?: { key?: string }; teamFormat?: number; teamCount?: number })[] = [
            ...(matchHistory ?? []),
            ...(practiceMatchHistory ?? []),
            ...(leagueMatchHistory ?? []),
        ];
        const completedOnly = rawMatches.filter(m => m.status === 'completed');
        if (teamFilter === 'ALL') return completedOnly;
        const teamFilterStr = String(teamFilter);
        return completedOnly.filter(m => {
            const format = (m as any).teamFormat ?? (m as any).teamCount ?? getMatchTeamCount(m, teamSets ?? []);
            return String(format) === teamFilterStr;
        });
    }, [matchHistory, practiceMatchHistory, leagueMatchHistory, teamFilter, teamSets]);

    /** 필터된 경기에서만 계산한 노력상 횟수 (누적 합산) */
    const filteredHustleCountByPlayerId = useMemo(() => {
        const count = new Map<string, number>();
        filteredMatchHistory
            .filter((m: MatchWithHustle) => m.isAssessment)
            .forEach(match => {
                const ids = (match as MatchWithHustle).hustlePlayerIds?.length
                    ? (match as MatchWithHustle).hustlePlayerIds!
                    : ((match as MatchWithHustle).hustlePlayers ?? []).map(p => p.id);
                ids.forEach(pid => {
                    count.set(pid, (count.get(pid) ?? 0) + 1);
                });
            });
        return count;
    }, [filteredMatchHistory]);

    const filteredPlayers = useMemo(() => {
        if (!selectedClass) return allPlayers;
        return allPlayers.filter(p => p.class === selectedClass || (p.class && p.class.replace(/\D/g, '') === selectedClass.replace(/\D/g, '')));
    }, [allPlayers, selectedClass]);

    /** 필터된 경기만으로 집계한 스탯 (playerId -> stats). 모든 숫자 항목은 누적(+=)만 사용 */
    const statsFromFilteredMatches = useMemo(() => {
        const agg = new Map<string, Partial<PlayerCumulativeStats>>();
        filteredMatchHistory.forEach((match: any) => {
            const teams = [match?.teamA, match?.teamB].filter(Boolean);
            teams.forEach((team: { playerStats?: Record<string, any> }) => {
                Object.entries(team?.playerStats ?? {}).forEach(([pid, s]: [string, any]) => {
                    if (!s || typeof s !== 'object') return;
                    let cur = agg.get(pid);
                    if (!cur) {
                        cur = {};
                        agg.set(pid, cur);
                    }
                    cur.points = (cur.points ?? 0) + (Number(s.points) || 0);
                    cur.serviceAces = (cur.serviceAces ?? 0) + (Number(s.serviceAces) || 0);
                    cur.blockingPoints = (cur.blockingPoints ?? 0) + (Number(s.blockingPoints) || 0);
                    cur.spikeSuccesses = (cur.spikeSuccesses ?? 0) + (Number(s.spikeSuccesses) || 0);
                    cur.digs = (cur.digs ?? 0) + (Number(s.digs) || 0);
                    cur.serveIn = (cur.serveIn ?? 0) + (Number(s.serveIn) || 0);
                    cur.assists = (cur.assists ?? 0) + (Number(s.assists) || 0);
                });
            });
        });
        return agg;
    }, [filteredMatchHistory]);

    /** 랭킹용 스탯: 항상 필터된 경기만으로 누적 집계 후 동일 인물(여러 id) 합산. 전역 스탯 미사용으로 필터 간 일관성 보장 */
    const effectiveStatsMap = useMemo(() => {
        const map = new Map<string, Partial<PlayerCumulativeStats>>();
        filteredPlayers.forEach(p => {
            const key = `${p.class}-${p.studentNumber}-${p.originalName}`;
            const allIds = identityToPlayerIds.get(key) ?? [p.id];
            const merged: Partial<PlayerCumulativeStats> = {};
            allIds.forEach(id => {
                const s = statsFromFilteredMatches.get(id);
                if (!s) return;
                Object.entries(s).forEach(([k, v]) => {
                    if (typeof v === 'number') (merged as any)[k] = ((merged as any)[k] ?? 0) + v;
                });
            });
            map.set(p.id, merged);
        });
        return map;
    }, [filteredPlayers, identityToPlayerIds, statsFromFilteredMatches]);

    /** 랭킹용 노력상: 항상 필터된 경기만으로 집계 (전체 선택 시에도 동일 경로로 일관성 유지) */
    const effectiveHustleCountByPlayerId = filteredHustleCountByPlayerId;

    /** 해당 학생(동일 인물 모든 id)의 노력상 횟수 — 필터된 경기 기준 누적 합산 */
    const getEffectiveHustleCount = useCallback((player: Player) => {
        const key = `${player.class}-${player.studentNumber}-${player.originalName}`;
        const allIds = identityToPlayerIds.get(key) ?? [player.id];
        return Math.max(0, ...allIds.map(id => effectiveHustleCountByPlayerId.get(id) ?? 0));
    }, [identityToPlayerIds, effectiveHustleCountByPlayerId]);

    const excellenceRanking = useMemo(() => {
        return [...filteredPlayers]
            .map(player => {
                const stats = effectiveStatsMap.get(player.id) ?? {};
                const points = stats.points ?? 0;
                const serviceAces = stats.serviceAces ?? 0;
                const spikeSuccesses = stats.spikeSuccesses ?? 0;
                const blockingPoints = stats.blockingPoints ?? 0;
                const score =
                    points * EXCELLENCE_WEIGHT_POINTS +
                    serviceAces * EXCELLENCE_WEIGHT_ACE +
                    spikeSuccesses * EXCELLENCE_WEIGHT_SPIKE +
                    blockingPoints * EXCELLENCE_WEIGHT_BLOCK;
                return { player, stats, score };
            })
            .sort((a, b) => b.score - a.score);
    }, [filteredPlayers, effectiveStatsMap]);

    const effortRanking = useMemo(() => {
        return [...filteredPlayers]
            .map(player => {
                const stats = effectiveStatsMap.get(player.id) ?? {};
                const effectiveHustles = getEffectiveHustleCount(player);
                const digs = stats.digs ?? 0;
                const serveIn = stats.serveIn ?? 0;
                const assists = stats.assists ?? 0;
                const score = effectiveHustles * 2 + digs * 1 + serveIn * 0.5 + assists * 0.5;
                return { player, stats, score, effectiveHustles };
            })
            .sort((a, b) => b.score - a.score);
    }, [filteredPlayers, effectiveStatsMap, getEffectiveHustleCount]);

    const formatScore = (value: number): string => {
        if (Number.isInteger(value)) return String(value);
        return value.toFixed(1);
    };

    const renderExcellenceRow = (item: { player: Player; stats: Partial<PlayerCumulativeStats>; score: number }, rank: number) => (
        <div key={item.player.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/60 border border-slate-700/50 hover:bg-slate-700/50">
            <span className="w-8 h-8 flex-shrink-0 rounded-full bg-amber-500/30 text-amber-400 font-bold flex items-center justify-center text-sm">
                {rank}
            </span>
            <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-200 truncate">{item.player.originalName}</p>
                <p className="text-xs text-slate-400">{item.player.class} · {item.player.studentNumber}번</p>
            </div>
            <div className="flex items-center gap-4 text-sm">
                <span title="총 득점">득점 {item.stats.points ?? 0}</span>
                <span title="서브 에이스" className="text-amber-400">에이스 {item.stats.serviceAces ?? 0}</span>
                <span title="스파이크 성공">스파이크 {item.stats.spikeSuccesses ?? 0}</span>
                <span title="블로킹">블로킹 {item.stats.blockingPoints ?? 0}</span>
            </div>
            <span className="text-amber-400 font-mono font-semibold">{formatScore(item.score)}점</span>
        </div>
    );

    const renderEffortRow = (item: { player: Player; stats: Partial<PlayerCumulativeStats>; score: number; effectiveHustles: number }, rank: number) => (
        <div key={item.player.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/60 border border-slate-700/50 hover:bg-slate-700/50">
            <span className="w-8 h-8 flex-shrink-0 rounded-full bg-amber-600/30 text-amber-400 font-bold flex items-center justify-center text-sm">
                🔥 {rank}
            </span>
            <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-200 truncate">{item.player.originalName}</p>
                <p className="text-xs text-slate-400">{item.player.class} · {item.player.studentNumber}번</p>
            </div>
            <div className="flex items-center gap-4 text-sm">
                <span title="허슬 뱃지(노력상)" className="text-amber-400 font-semibold">🔥 노력상 {item.effectiveHustles}회</span>
                <span title="디그">디그 {item.stats.digs ?? 0}</span>
                <span title="서브 In (서브 성공)">서브 In {item.stats.serveIn ?? 0}</span>
                <span title="어시스트">어시스트 {item.stats.assists ?? 0}</span>
            </div>
            <span className="text-amber-400 font-mono font-semibold">{formatScore(item.score)}점</span>
        </div>
    );

    return (
        <div className="flex flex-col h-full animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
                <button
                    onClick={onBack}
                    className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-600 text-slate-300 text-xl"
                    aria-label="뒤로"
                >
                    ←
                </button>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-200">🏆 클래스 랭킹 보드</h1>
            </div>

            <div className="mb-4 no-print">
                <label htmlFor="assessment-class-select" className="block text-sm font-semibold text-slate-400 mb-2">반 선택</label>
                <select
                    id="assessment-class-select"
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="w-full max-w-xs bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                    <option value="">전체</option>
                    {availableClasses.map(c => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                </select>
            </div>

            <div className="mb-4 no-print">
                <label className="block text-sm font-semibold text-slate-400 mb-2">팀 구성 기준</label>
                <div className="flex flex-wrap gap-2">
                    {TEAM_FILTER_VALUES.map((value) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setTeamFilter(value)}
                            className={`px-3 py-2 text-sm rounded-lg transition-colors min-h-[44px] ${
                                teamFilter === value
                                    ? 'bg-amber-600 text-white font-semibold'
                                    : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                            }`}
                        >
                            {value === 'ALL' ? '전체' : t('record_team_format', { count: parseInt(value, 10) })}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex rounded-xl overflow-hidden bg-slate-800/50 border border-slate-700/50 mb-6">
                <button
                    onClick={() => setActiveTab('excellence')}
                    className={`flex-1 py-3 px-4 font-semibold transition-colors ${activeTab === 'excellence' ? 'bg-amber-600/40 text-amber-300 border-b-2 border-amber-500' : 'text-slate-400 hover:bg-slate-700/50'}`}
                >
                    ⭐ 우수 학생 부문
                </button>
                <button
                    onClick={() => setActiveTab('effort')}
                    className={`flex-1 py-3 px-4 font-semibold transition-colors ${activeTab === 'effort' ? 'bg-amber-600/40 text-amber-300 border-b-2 border-amber-500' : 'text-slate-400 hover:bg-slate-700/50'}`}
                >
                    🔥 노력 학생 부문
                </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
                {activeTab === 'excellence' && (
                    <>
                        <div className="bg-slate-800/60 border border-slate-600 rounded-lg p-4 mb-4">
                            <h3 className="text-sm font-bold text-slate-300 mb-2">⭐ 우수 학생 부문 점수 공식</h3>
                            <p className="text-slate-400 text-sm mb-2">
                                득점×1 + 에이스×1 + 스파이크×1 + 블로킹×1
                            </p>
                            <table className="text-sm text-slate-400 w-full max-w-xs">
                                <tbody>
                                    <tr><td className="py-0.5">득점</td><td className="text-right">1점/회</td></tr>
                                    <tr><td className="py-0.5">서브 에이스</td><td className="text-right">1점/회</td></tr>
                                    <tr><td className="py-0.5">스파이크 성공</td><td className="text-right">1점/회</td></tr>
                                    <tr><td className="py-0.5">블로킹</td><td className="text-right">1점/회</td></tr>
                                </tbody>
                            </table>
                            <p className="text-slate-500 text-xs mt-2">
                                예: 10×1 + 2×1 + 5×1 + 3×1 = 10+2+5+3 = 20점
                            </p>
                        </div>
                        {filteredPlayers.length === 0 ? (
                            <p className="text-slate-400 py-8 text-center">선택한 반에 학생이 없습니다.</p>
                        ) : (
                            excellenceRanking.map((item, idx) => renderExcellenceRow(item, idx + 1))
                        )}
                    </>
                )}
                {activeTab === 'effort' && (
                    <>
                        <div className="bg-slate-800/60 border border-slate-600 rounded-lg p-4 mb-4">
                            <h3 className="text-sm font-bold text-slate-300 mb-2">🔥 노력 학생 부문 점수 공식</h3>
                            <p className="text-slate-400 text-sm mb-2">
                                노력상×2 + 디그×1 + 서브 In×0.5 + 어시스트×0.5
                            </p>
                            <table className="text-sm text-slate-400 w-full max-w-xs">
                                <tbody>
                                    <tr><td className="py-0.5">노력상</td><td className="text-right">2점/회</td></tr>
                                    <tr><td className="py-0.5">디그</td><td className="text-right">1점/회</td></tr>
                                    <tr><td className="py-0.5">서브 In</td><td className="text-right">0.5점/회</td></tr>
                                    <tr><td className="py-0.5">어시스트</td><td className="text-right">0.5점/회</td></tr>
                                </tbody>
                            </table>
                            <p className="text-slate-500 text-xs mt-2">
                                예: 2×2 + 5×1 + 3×0.5 + 4×0.5 = 4+5+1.5+2 = 12.5점
                            </p>
                        </div>
                        {filteredPlayers.length === 0 ? (
                            <p className="text-slate-400 py-8 text-center">선택한 반에 학생이 없습니다.</p>
                        ) : (
                            effortRanking.map((item, idx) => renderEffortRow(item, idx + 1))
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
