
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Player, PlayerStats, MatchState, TeamSet, PlayerCumulativeStats, CoachingLog, Badge } from '../types';
import { useData } from '../contexts/DataContext';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { LockClosedIcon, CrownIcon } from './icons';
import { useTranslation } from '../hooks/useTranslation';
import { BADGE_DEFINITIONS } from '../data/badges';
import { BadgeDetailModal } from './BadgeDetailModal';

type MatchPerformance = {
    match: MatchState & { date: string; _matchType?: 'regular' | 'practice' | 'tournament' };
    teamName: string;
    opponent: string;
    stats: PlayerStats;
    teamSet: TeamSet | undefined;
    matchType: 'regular' | 'practice' | 'tournament';
};

interface PlayerHistoryModalProps {
    player: Player;
    cumulativeStats: PlayerCumulativeStats;
    performanceHistory: MatchPerformance[];
    onClose: () => void;
    teamSets: TeamSet[];
    appMode?: 'CLASS' | 'CLUB';
    /** 경기 중 스코어보드에서 열었을 때 현재 경기 정보 (예: "A팀 vs B팀") */
    currentMatchInfo?: string;
}

/** 전략 메모 개별 기록 타입 */
export type MemoEntry = { id: string; createdAt: string; content: string; matchInfo?: string };

/** 기존 string 메모를 배열로 변환 (하위 호환) */
function parseMemoEntries(raw: string | undefined): MemoEntry[] {
    if (raw == null || raw === '') return [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.filter((e: unknown) => e && typeof e === 'object' && 'id' in e && 'content' in e)
                .map((e: { id?: string; createdAt?: string; content?: string; matchInfo?: string }) => ({
                    id: String(e?.id ?? genMemoId()),
                    createdAt: String(e?.createdAt ?? '이전 기록'),
                    content: String(e?.content ?? ''),
                    matchInfo: e?.matchInfo ? String(e.matchInfo) : undefined
                }));
        }
    } catch (_) {}
    return [{ id: 'legacy', createdAt: '이전 기록', content: String(raw) }];
}

function genMemoId(): string {
    return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `memo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** 날짜 포맷 YYYY.MM.DD HH:mm */
function formatMemoDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}.${m}.${day} ${h}:${min}`;
}

// Updated Order: Points -> Serve Ace Rate -> Serve Success Rate -> Serve Faults -> Spike -> Assist -> Block -> Dig
const statOrder: (keyof PlayerStats | 'serveSuccessRate' | 'serveAceRate')[] = [
    'points',            // 득점
    'serveAceRate',      // 서브 득점률
    'serveSuccessRate',  // 서브 성공률
    'serviceFaults',     // 서브 범실
    'spikeSuccesses',    // 스파이크 성공
    'assists',           // 어시스트
    'blockingPoints',    // 블로킹
    'digs'               // 디그
];

export const PlayerHistoryModal: React.FC<PlayerHistoryModalProps> = ({ player, cumulativeStats, performanceHistory, onClose, teamSets, appMode = 'CLASS', currentMatchInfo }) => {
    const { coachingLogs, saveCoachingLog, requestPassword, playerAchievements, updatePlayerMemoInTeamSet, showToast, matchHistory, practiceMatchHistory, leagueMatchHistory } = useData();
    const { t } = useTranslation();
    const [newLog, setNewLog] = useState('');
    const [isLogUnlocked, setIsLogUnlocked] = useState(false);
    const [activeTab, setActiveTab] = useState<'analysis' | 'coaching' | 'memo'>('analysis');
    const [categoryFilter, setCategoryFilter] = useState<'all' | 'practice' | 'tournament'>('all');
    const [selectedModalCompetition, setSelectedModalCompetition] = useState<string>('전체');
    const [memoEntries, setMemoEntries] = useState<MemoEntry[]>([]);
    const [newMemoContent, setNewMemoContent] = useState('');
    const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
    const [editingContent, setEditingContent] = useState('');
    
    // Default chart stat to 'points' as it's the first item now
    const [chartStat, setChartStat] = useState<keyof PlayerStats | 'serveSuccessRate' | 'serveAceRate'>('points');
    const [winRateFilter, setWinRateFilter] = useState('all');
    const [rosterToShow, setRosterToShow] = useState<{ teamName: string, players: Player[], captainId?: string } | null>(null);
    const [selectedBadgeDetail, setSelectedBadgeDetail] = useState<{ badge: Badge, player: Player, stats: Partial<PlayerCumulativeStats> } | null>(null);

    const statDisplayNames: Record<string, string> = {
        points: t('stat_display_points'),
        serviceAces: t('stat_display_serve_ace'),
        spikeSuccesses: t('stat_display_spike_success'),
        blockingPoints: t('stat_display_blocking'),
        serviceFaults: t('stat_display_serve_fault'),
        digs: t('stat_display_digs'),
        assists: t('stat_display_assists'),
        serveIn: t('btn_serve_in'),
        serveSuccessRate: t('stat_serve_success_rate'),
        serveAceRate: t('stat_serve_ace_rate'), // "서브 득점률"
    };

    const handleTeamClick = (matchData: MatchState, teamNameToShow: string) => {
        const teamState = matchData?.teamA?.name === teamNameToShow ? matchData.teamA : matchData?.teamB;
        if (!teamState) return;
        const playerList = Object.values(teamState.players || {});
        const teamKey = teamState.key;
        let captainId: string | undefined = undefined;
        if (teamKey) {
            const [setId] = teamKey.split('___');
            const set = (teamSets || []).find(s => s?.id === setId);
            const teamInfo = set?.teams?.find((t: { teamName?: string }) => t?.teamName === teamNameToShow);
            captainId = teamInfo?.captainId;
        }
        setRosterToShow({ teamName: teamNameToShow, players: playerList, captainId });
    };

    const RosterModal = ({ teamName, players, captainId, onClose }: { teamName: string, players: Player[], captainId?: string, onClose: () => void }) => (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-slate-800 rounded-lg shadow-2xl p-6 w-full max-w-sm text-white border border-slate-700 flex flex-col" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-sky-400 mb-4 text-center">{t('player_history_roster_title', { teamName })}</h3>
                <div className="flex-grow overflow-y-auto pr-2 -mr-2">
                    <ul className="space-y-2">
                        {(players ?? []).slice().sort((a, b) => {
                            const isACaptain = a?.id === captainId;
                            const isBCaptain = b?.id === captainId;
                            if (isACaptain !== isBCaptain) return isACaptain ? -1 : 1;
                            return parseInt(String(a?.studentNumber ?? 0), 10) - parseInt(String(b?.studentNumber ?? 0), 10);
                        }).map((p, index) => (
                            <li key={p?.id ?? index} className="bg-slate-700/50 p-3 rounded-md flex items-center gap-3">
                                {p?.id === captainId && <CrownIcon className="w-5 h-5 text-yellow-400 flex-shrink-0" />}
                                <div className="flex-grow">
                                    <p className="font-semibold text-slate-200">{p?.originalName ?? ''}</p>
                                    <p className="text-xs text-slate-400">{t('player_history_subtitle', { class: p?.class ?? '', number: p?.studentNumber ?? '' })}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="text-center mt-6 flex-shrink-0">
                    <button onClick={onClose} className="bg-slate-600 hover:bg-slate-500 font-bold py-2 px-6 rounded-lg">{t('close')}</button>
                </div>
            </div>
        </div>
    );

    const handleSaveLog = async () => {
        if (newLog.trim() && player?.id) {
            await saveCoachingLog(player.id, newLog.trim());
            setNewLog('');
        }
    };

    const setContainingPlayer = useMemo(() => teamSets?.find((s) => s.players && player?.id && s.players[player.id]), [teamSets, player?.id]);
    const currentPlayerMemo = setContainingPlayer?.players?.[player?.id ?? ''] ? (setContainingPlayer.players[player!.id] as { memo?: string })?.memo : (player as { memo?: string })?.memo;

    useEffect(() => {
        if (activeTab === 'memo') setMemoEntries(parseMemoEntries(currentPlayerMemo));
    }, [activeTab, currentPlayerMemo]);

    const persistMemoEntries = useCallback(async (entries: MemoEntry[]) => {
        if (!player?.id || !updatePlayerMemoInTeamSet || !setContainingPlayer) return;
        const payload = entries.length === 0 ? '' : JSON.stringify(entries);
        await updatePlayerMemoInTeamSet(setContainingPlayer.id, player.id, payload);
        showToast?.('메모가 저장되었습니다.', 'success');
    }, [player?.id, updatePlayerMemoInTeamSet, setContainingPlayer, showToast]);

    const handleAddMemo = useCallback(async () => {
        const content = newMemoContent.trim();
        if (!content) return;
        const entry: MemoEntry = {
            id: genMemoId(),
            createdAt: formatMemoDate(new Date()),
            content,
            ...(currentMatchInfo?.trim() ? { matchInfo: currentMatchInfo.trim() } : {})
        };
        const next = [entry, ...memoEntries];
        setMemoEntries(next);
        setNewMemoContent('');
        await persistMemoEntries(next);
    }, [newMemoContent, memoEntries, persistMemoEntries, currentMatchInfo]);

    const handleEditMemo = useCallback((entry: MemoEntry) => {
        setEditingMemoId(entry.id);
        setEditingContent(entry.content);
    }, []);

    const handleSaveEditMemo = useCallback(async () => {
        if (!editingMemoId) return;
        const content = editingContent.trim();
        if (!content) return;
        const next = memoEntries.map(e => e.id === editingMemoId ? { ...e, content } : e);
        setMemoEntries(next);
        setEditingMemoId(null);
        setEditingContent('');
        await persistMemoEntries(next);
    }, [editingMemoId, editingContent, memoEntries, persistMemoEntries]);

    const handleCancelEditMemo = useCallback(() => {
        setEditingMemoId(null);
        setEditingContent('');
    }, []);

    const handleDeleteMemo = useCallback(async (id: string) => {
        const next = memoEntries.filter(e => e.id !== id);
        setMemoEntries(next);
        if (editingMemoId === id) {
            setEditingMemoId(null);
            setEditingContent('');
        }
        await persistMemoEntries(next);
    }, [memoEntries, editingMemoId, persistMemoEntries]);

    const handleUnlockLogs = () => {
        if (!isLogUnlocked) {
            requestPassword(() => {
                setIsLogUnlocked(true);
                setActiveTab('coaching');
            });
        } else {
            setActiveTab('coaching');
        }
    };
    
    const availableCompetitions = useMemo(() => {
        if (appMode !== 'CLUB') return [];
        return [...new Set((teamSets ?? []).map((s: TeamSet) => s.className).filter(Boolean))].sort();
    }, [appMode, teamSets]);

    const collectedPlayers = useMemo(() => {
        const name = player?.originalName ?? '';
        const number = String(player?.studentNumber ?? '');
        const out: { player: Player; teamSet: TeamSet; team: { teamName: string } }[] = [];
        (teamSets ?? []).forEach((set: TeamSet) => {
            (set.teams ?? []).forEach((team: { teamName: string; playerIds?: string[] }) => {
                (team.playerIds ?? []).forEach((pid: string) => {
                    const p = set.players?.[pid];
                    if (p && p.originalName === name && String(p.studentNumber ?? '') === number) {
                        out.push({ player: p, teamSet: set, team });
                    }
                });
            });
        });
        return out;
    }, [teamSets, player?.originalName, player?.studentNumber]);

    const allPlayerIds = useMemo(() => {
        const ids = new Set(collectedPlayers.map(c => c.player.id));
        if (ids.size === 0 && player?.id) ids.add(player.id);
        return ids;
    }, [collectedPlayers, player?.id]);

    const unifiedPerformanceHistory = useMemo((): MatchPerformance[] => {
        const regular = (matchHistory ?? []).filter((m: any) => m?.status === 'completed').map((m: any) => ({ ...m, _matchType: 'regular' as const }));
        const practice = (practiceMatchHistory ?? []).filter((m: any) => m?.status === 'completed').map((m: any) => ({ ...m, _matchType: 'practice' as const }));
        const league = (leagueMatchHistory ?? []).filter((m: any) => m?.status === 'completed').map((m: any) => ({ ...m, _matchType: 'tournament' as const }));
        const allMatches = [...regular, ...practice, ...league]
            .sort((a: any, b: any) => new Date(a?.date ?? 0).getTime() - new Date(b?.date ?? 0).getTime());

        const history: MatchPerformance[] = [];
        allMatches.forEach((match: any) => {
            let playerTeam: 'teamA' | 'teamB' | null = null;
            let matchedId: string | null = null;

            if (match?.teamA?.players) {
                const foundId = Object.keys(match.teamA.players).find(id => allPlayerIds.has(id));
                if (foundId) {
                    playerTeam = 'teamA';
                    matchedId = foundId;
                }
            }
            if (!playerTeam && match?.teamB?.players) {
                const foundId = Object.keys(match.teamB.players).find(id => allPlayerIds.has(id));
                if (foundId) {
                    playerTeam = 'teamB';
                    matchedId = foundId;
                }
            }

            if (playerTeam && matchedId) {
                const teamState = match[playerTeam];
                const opponentName = (playerTeam === 'teamA' ? match?.teamB : match?.teamA)?.name;
                const playerStatsForMatch = teamState?.playerStats?.[matchedId];
                if (playerStatsForMatch) {
                    let teamSet: TeamSet | undefined;
                    const key = teamState?.key;
                    if (key) {
                        const [setId] = String(key).split('___');
                        teamSet = (teamSets ?? []).find((s: TeamSet) => s.id === setId);
                    }
                    history.push({
                        match,
                        teamName: teamState.name,
                        opponent: opponentName ?? '',
                        stats: playerStatsForMatch,
                        teamSet,
                        matchType: match._matchType ?? 'regular',
                    });
                }
            }
        });
        return history.reverse();
    }, [matchHistory, practiceMatchHistory, leagueMatchHistory, allPlayerIds, teamSets]);

    const baseForFilter = useMemo(() => {
        if (appMode === 'CLUB') return unifiedPerformanceHistory;
        return (performanceHistory ?? []).map((p: any) => {
            const key = p?.match?.teamA?.key || p?.match?.teamB?.key;
            let teamSet: TeamSet | undefined;
            if (key) {
                const [setId] = String(key).split('___');
                teamSet = (teamSets ?? []).find((s: TeamSet) => s.id === setId);
            }
            return {
                ...p,
                teamSet: p.teamSet ?? teamSet,
                matchType: (p?.match?.matchType ?? p?.matchType ?? 'regular') as 'regular' | 'practice' | 'tournament',
            };
        });
    }, [appMode, unifiedPerformanceHistory, performanceHistory, teamSets]);

    const getEntryCompetition = (entry: MatchPerformance): string | null => {
        const key = entry?.match?.teamA?.key || entry?.match?.teamB?.key;
        if (!key) return null;
        const [setId] = String(key).split('___');
        return (teamSets ?? []).find((s: TeamSet) => s.id === setId)?.className ?? null;
    };

    const filteredPerformanceHistory = useMemo(() => {
        let base = baseForFilter;
        if (appMode === 'CLUB' && selectedModalCompetition && selectedModalCompetition !== '전체') {
            base = base.filter((p: MatchPerformance) => getEntryCompetition(p) === selectedModalCompetition);
        }
        if (categoryFilter === 'all') return base;
        if (categoryFilter === 'practice') return base.filter((p: MatchPerformance) => p.matchType === 'practice');
        return base.filter((p: MatchPerformance) => p.matchType === 'tournament');
    }, [baseForFilter, categoryFilter, appMode, selectedModalCompetition]);

    const filteredCumulativeStats = useMemo(() => {
        const hist = filteredPerformanceHistory ?? [];
        const stats: any = { matchesPlayed: 0, points: 0, serviceAces: 0, serveIn: 0, serviceFaults: 0, spikeSuccesses: 0, blockingPoints: 0, digs: 0, assists: 0 };
        hist.forEach((p: any) => {
            const s = p?.stats ?? {};
            stats.matchesPlayed += 1;
            Object.keys(s).forEach(k => { if (typeof s[k] === 'number') stats[k] = (stats[k] ?? 0) + s[k]; });
        });
        return stats;
    }, [filteredPerformanceHistory]);

    const displayStats = filteredCumulativeStats;

    const winRateStats = useMemo(() => {
        const base = filteredPerformanceHistory ?? [];
        const filteredHistory = winRateFilter === 'all' 
            ? base 
            : base.filter(p => p?.teamSet && String(p.teamSet?.teamCount ?? 4) === winRateFilter);

        const matchesPlayed = filteredHistory?.length ?? 0;
        if (matchesPlayed === 0) return { winRate: 0, wins: 0, total: 0 };
        
        const wins = (filteredHistory ?? []).filter(p => {
            const m = p?.match;
            if (!m) return false;
            const playerTeamKey = p.teamName === m.teamA?.name ? 'A' : 'B';
            return m.winner === playerTeamKey;
        }).length;
        
        const winRate = (wins / matchesPlayed) * 100;
        return { winRate, wins, total: matchesPlayed };
    }, [filteredPerformanceHistory, winRateFilter]);


    const logs = useMemo(() => {
        const merged: CoachingLog[] = [];
        allPlayerIds.forEach(id => {
            const byPlayer = coachingLogs?.[id];
            if (byPlayer && Array.isArray(byPlayer)) merged.push(...byPlayer);
        });
        return merged.sort((a, b) => new Date((b?.date) || 0).getTime() - new Date((a?.date) || 0).getTime());
    }, [coachingLogs, allPlayerIds]);

    const chartData = useMemo(() => {
        const history = filteredPerformanceHistory ?? [];
        return [...history].reverse().map(({ stats, match, teamName, opponent }, index) => {
            const s = stats ?? {};
            let value = 0;
            const totalServes = (s.serviceAces || 0) + (s.serveIn || 0) + (s.serviceFaults || 0);

            if (chartStat === 'serveSuccessRate') {
                value = totalServes > 0 ? ((s.serviceAces || 0) + (s.serveIn || 0)) / totalServes * 100 : 0;
                value = parseFloat(value.toFixed(1));
            } else if (chartStat === 'serveAceRate') {
                value = totalServes > 0 ? ((s.serviceAces || 0) / totalServes * 100) : 0;
                value = parseFloat(value.toFixed(1));
            } else {
                value = s[chartStat as keyof PlayerStats] || 0;
            }

            const m = match ?? {};
            const result = m.winner ? (m.winner === (m.teamA?.name === teamName ? 'A' : 'B') ? '승' : '패') : '무';

            return {
                name: `G${index + 1}`,
                label: `G${index + 1}`,
                [statDisplayNames?.[chartStat] ?? 'value']: value,
                date: m.date ? new Date(m.date).toLocaleDateString() : '',
                team: teamName ?? '',
                opponent: opponent ?? '',
                result,
                score: `${m.teamA?.score ?? 0}:${m.teamB?.score ?? 0}`
            };
        });
    }, [filteredPerformanceHistory, chartStat, statDisplayNames]);

    const calculateRates = useMemo(() => {
        const totalServes = (displayStats.serviceAces || 0) + (displayStats.serveIn || 0) + (displayStats.serviceFaults || 0);
        // Serve Ace Rate: Aces / Total Attempts
        const aceRate = totalServes > 0 ? ((displayStats.serviceAces || 0) / totalServes) * 100 : 0;
        const successRate = totalServes > 0 ? (((displayStats.serviceAces || 0) + (displayStats.serveIn || 0)) / totalServes) * 100 : 0;
        return { aceRate, successRate };
    }, [displayStats]);

    const earnedBadges = useMemo(() => {
        const badgeIds = new Set<string>();
        allPlayerIds.forEach(id => {
            const pb = playerAchievements?.[id];
            const earned = pb?.earnedBadgeIds;
            if (earned) {
                const ids = earned instanceof Set ? Array.from(earned) : (Array.isArray(earned) ? earned : []);
                ids.forEach((bid: string) => badgeIds.add(bid));
            }
        });
        return (BADGE_DEFINITIONS || []).filter(badge => badge && badgeIds.has(badge.id));
    }, [playerAchievements, allPlayerIds]);

    // Custom Tooltip Component
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-slate-900 border border-slate-700 p-3 rounded shadow-lg text-xs text-white">
                    <p className="font-bold text-[#00A3FF] mb-1">{label}</p>
                    <p className="text-slate-300 mb-1">{data.date}</p>
                    <div className="border-t border-slate-700 my-1 pt-1 space-y-0.5">
                        <p><span className="text-slate-400">소속:</span> {data.team}</p>
                        <p><span className="text-slate-400">상대:</span> {data.opponent}</p>
                        <p><span className="text-slate-400">결과:</span> <span className={data.result === '승' ? 'text-green-400' : 'text-red-400'}>{data.result}</span> ({data.score})</p>
                    </div>
                    <p className="mt-2 font-bold text-white border-t border-slate-700 pt-1">
                        {payload[0].name}: {payload[0].value}
                    </p>
                </div>
            );
        }
        return null;
    };


    if (!player) return null;

    return (
        <>
            {rosterToShow && <RosterModal teamName={rosterToShow.teamName} players={rosterToShow.players ?? []} captainId={rosterToShow.captainId} onClose={() => setRosterToShow(null)} />}
            {selectedBadgeDetail && (
                <BadgeDetailModal
                    badge={selectedBadgeDetail.badge}
                    player={selectedBadgeDetail.player}
                    playerStats={selectedBadgeDetail.stats}
                    onClose={() => setSelectedBadgeDetail(null)}
                />
            )}
            <div 
                className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 animate-fade-in"
                onClick={onClose}
            >
                <div 
                    className="bg-slate-900 rounded-lg shadow-2xl p-6 w-full max-w-4xl text-white border border-slate-700 max-h-[95vh] flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex-shrink-0 flex justify-between items-start mb-4">
                        <div>
                            <h2 className="text-3xl font-bold text-[#00A3FF]">{t('player_history_title', { name: player?.originalName ?? '' })}</h2>
                            <p className="text-slate-400">{t('player_history_subtitle', { class: player?.class ?? '', number: player?.studentNumber ?? '' })}</p>
                        </div>
                        <button onClick={onClose} className="text-3xl font-bold text-slate-500 hover:text-white">&times;</button>
                    </div>

                     <div className="flex-shrink-0 border-b border-slate-700 mb-4">
                        <div className="flex space-x-4">
                            <button 
                                onClick={() => setActiveTab('analysis')}
                                className={`px-4 py-2 font-semibold ${activeTab === 'analysis' ? 'border-b-2 border-sky-400 text-sky-400' : 'text-slate-400 hover:text-white'}`}
                            >
                                {t('player_history_tab_analysis')}
                            </button>
                            <button 
                                onClick={handleUnlockLogs}
                                className={`flex items-center gap-2 px-4 py-2 font-semibold ${activeTab === 'coaching' ? 'border-b-2 border-sky-400 text-sky-400' : 'text-slate-400 hover:text-white'}`}
                            >
                                <LockClosedIcon className="w-4 h-4" />
                                {t('player_history_tab_coaching')}
                            </button>
                            {appMode === 'CLUB' && (
                                <button 
                                    onClick={() => setActiveTab('memo')}
                                    className={`px-4 py-2 font-semibold ${activeTab === 'memo' ? 'border-b-2 border-sky-400 text-sky-400' : 'text-slate-400 hover:text-white'}`}
                                >
                                    전략 메모
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex-grow overflow-y-auto pr-2 -mr-2">
                        {activeTab === 'analysis' && (
                            <div className="space-y-6 animate-fade-in">
                                <div className="flex justify-between items-center flex-wrap gap-2 mb-2">
                                    {appMode === 'CLUB' && (
                                        <div className="flex gap-2 flex-wrap">
                                            {(['all', 'practice', 'tournament'] as const).map(k => (
                                                <button key={k} onClick={() => setCategoryFilter(k)} className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${categoryFilter === k ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}>
                                                    {k === 'all' ? '전체' : k === 'practice' ? '연습 경기' : '대회 경기'}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {appMode === 'CLUB' && (
                                        <select
                                            value={selectedModalCompetition}
                                            onChange={(e) => setSelectedModalCompetition(e.target.value)}
                                            className="bg-slate-700 border border-slate-600 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        >
                                            <option value="전체">전체</option>
                                            {availableCompetitions.map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {[
                                        { label: t('player_history_stat_matches'), value: displayStats.matchesPlayed, unit: t('player_history_unit_sessions') },
                                        { label: t('player_history_stat_total_points'), value: displayStats.points, unit: t('player_history_unit_points') },
                                        { label: t('stat_serve_ace_rate'), value: isNaN(calculateRates.aceRate) ? '0.0' : calculateRates.aceRate.toFixed(1), unit: '%' },
                                        { label: t('stat_serve_success_rate'), value: isNaN(calculateRates.successRate) ? '0.0' : calculateRates.successRate.toFixed(1), unit: '%' },
                                        { label: t('player_history_stat_total_spikes'), value: displayStats.spikeSuccesses || 0, unit: t('player_history_unit_sessions') },
                                        { label: t('player_history_stat_total_blocks'), value: displayStats.blockingPoints || 0, unit: t('player_history_unit_sessions') },
                                        { label: t('stat_display_digs'), value: displayStats.digs || 0, unit: t('player_history_unit_sessions') },
                                        { label: t('stat_display_assists'), value: displayStats.assists || 0, unit: t('player_history_unit_sessions') },
                                    ].map(stat => (
                                        <div key={stat.label} className="bg-slate-800 p-3 rounded-lg text-center">
                                            <p className="text-slate-400 text-sm">{stat.label}</p>
                                            <p className="text-3xl font-bold text-sky-400 mt-1">{stat.value}<span className="text-xl">{stat.unit}</span></p>
                                        </div>
                                    ))}
                                </div>
                                
                                <div className="bg-slate-800/50 p-4 rounded-lg">
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="font-semibold text-slate-300">{t('player_history_performance_trend')}</h3>
                                        <select 
                                            value={chartStat} 
                                            onChange={e => setChartStat(e.target.value as keyof PlayerStats | 'serveSuccessRate' | 'serveAceRate')} 
                                            className="bg-slate-700 text-xs p-1 rounded text-white"
                                        >
                                            {(statOrder ?? []).map(key => <option key={key} value={key}>{statDisplayNames?.[key] ?? key}</option>)}
                                        </select>
                                    </div>
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            {chartData.length > 1 ? (
                                                <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                                    <XAxis dataKey="name" stroke="#94a3b8" />
                                                    <YAxis allowDecimals={false} stroke="#94a3b8" />
                                                    <Tooltip content={<CustomTooltip />} />
                                                    <Legend />
                                                    <Line type="monotone" dataKey={statDisplayNames?.[chartStat] ?? 'value'} stroke="#0ea5e9" strokeWidth={2} />
                                                </LineChart>
                                            ) : (
                                                <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                                    <XAxis dataKey="name" stroke="#94a3b8" />
                                                    <YAxis allowDecimals={false} stroke="#94a3b8" />
                                                    <Tooltip content={<CustomTooltip />} />
                                                    <Legend />
                                                    <Bar dataKey={statDisplayNames?.[chartStat] ?? 'value'} fill="#0ea5e9" barSize={60} />
                                                </BarChart>
                                            )}
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                                
                                 <div className="bg-slate-800/50 p-4 rounded-lg">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-semibold text-slate-300">{t('player_history_win_rate_analysis')}</h3>
                                        <div className="flex gap-2">
                                            <button onClick={() => setWinRateFilter('all')} className={`px-2 py-1 text-xs rounded ${winRateFilter === 'all' ? 'bg-sky-500' : 'bg-slate-700'}`}>{t('all')}</button>
                                            <button onClick={() => setWinRateFilter('4')} className={`px-2 py-1 text-xs rounded ${winRateFilter === '4' ? 'bg-sky-500' : 'bg-slate-700'}`}>{t('team_format_n', { n: 4 })}</button>
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-6xl font-bold text-green-400">{winRateStats.winRate.toFixed(1)}<span className="text-4xl">%</span></p>
                                        <p className="text-slate-400">{t('player_history_win_rate_details', { wins: winRateStats.wins, total: winRateStats.total })}</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h3 className="text-lg font-bold text-slate-300">{t('player_history_detailed_records')}</h3>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-center text-sm">
                                            <thead className="text-slate-400">
                                                <tr className="border-b-2 border-slate-700">
                                                    <th className="p-2 text-left">{t('player_history_header_date')}</th><th className="p-2 text-left">{t('player_history_header_team')}</th><th className="p-2 text-left">{t('player_history_header_opponent')}</th>
                                                    {(statOrder ?? []).map(key => (
                                                        <th key={key} className="p-2">{statDisplayNames?.[key] ?? key}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                            {(filteredPerformanceHistory ?? []).map((entry, index) => {
                                                const { match, teamName, opponent, stats } = entry ?? {};
                                                const s = stats ?? {};
                                                const totalServes = (s.serviceAces || 0) + (s.serveIn || 0) + (s.serviceFaults || 0);
                                                return (
                                                <tr key={index} className="border-b border-slate-700 last:border-0 text-slate-300">
                                                    <td className="p-2 text-left">
                                                        <div className="text-xs">{match?.date ? new Date(match.date).toLocaleDateString() : ''}</div>
                                                        <div className="text-[10px] text-slate-500 font-mono">(G{(filteredPerformanceHistory?.length ?? 0) - index})</div>
                                                    </td>
                                                    <td className="p-2 text-left font-semibold">
                                                        <button onClick={() => match && handleTeamClick(match, teamName ?? '')} className="text-left hover:text-sky-400 transition-colors">
                                                            {teamName ?? ''}
                                                        </button>
                                                    </td>
                                                    <td className="p-2 text-left">
                                                        <button onClick={() => match && handleTeamClick(match, opponent ?? '')} className="text-left hover:text-sky-400 transition-colors">
                                                            {opponent ?? ''}
                                                        </button>
                                                    </td>
                                                    {(statOrder ?? []).map(key => {
                                                        let displayValue: string | number = 0;
                                                        if (key === 'serveSuccessRate') {
                                                            displayValue = totalServes > 0 ? (((s.serviceAces||0) + (s.serveIn||0)) / totalServes * 100).toFixed(1) + '%' : '-';
                                                        } else if (key === 'serveAceRate') {
                                                            displayValue = totalServes > 0 ? ((s.serviceAces||0) / totalServes * 100).toFixed(1) + '%' : '-';
                                                        } else {
                                                            displayValue = s[key as keyof PlayerStats] || 0;
                                                        }
                                                        return <td key={key} className="p-2 font-mono">{displayValue}</td>
                                                    })}
                                                </tr>
                                            )})}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Earned Badges Section */}
                                <div className="bg-slate-800/50 p-4 rounded-lg">
                                    <h3 className="text-lg font-bold text-slate-300 mb-4">{t('player_history_earned_badges')}</h3>
                                    {(earnedBadges ?? []).length > 0 ? (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                            {(earnedBadges ?? []).map(badge => {
                                                const isCompetitive = badge.isCompetitive;
                                                return (
                                                    <button
                                                        key={badge.id}
                                                        onClick={() => setSelectedBadgeDetail({ badge, player, stats: displayStats })}
                                                        className={`p-3 bg-slate-700/50 rounded-lg flex flex-col items-center justify-center gap-2 text-center border-2 transition-all duration-200 cursor-pointer ${
                                                            isCompetitive 
                                                                ? 'border-yellow-400/50 hover:border-yellow-400 yellow-glowing-border' 
                                                                : 'border-sky-500/50 hover:border-sky-400'
                                                        }`}
                                                    >
                                                        <badge.icon className={`w-10 h-10 ${
                                                            isCompetitive ? 'text-yellow-400' : 'text-sky-400'
                                                        }`} />
                                                        <p className={`text-xs font-semibold ${
                                                            isCompetitive ? 'text-yellow-300' : 'text-slate-200'
                                                        }`}>
                                                            {t(badge.nameKey)}
                                                        </p>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-center py-6">
                                            <p className="text-slate-500">{t('player_history_no_badges')}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        {activeTab === 'coaching' && (
                            isLogUnlocked ? (
                                <div className="animate-fade-in space-y-4">
                                    <div className="bg-slate-800 p-4 rounded-lg">
                                        <textarea
                                            value={newLog}
                                            onChange={(e) => setNewLog(e.target.value)}
                                            placeholder={t('player_history_coaching_log_placeholder')}
                                            className="w-full h-24 bg-slate-900 border border-slate-700 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                                        />
                                        <div className="text-right mt-2">
                                            <button onClick={handleSaveLog} className="bg-sky-600 hover:bg-sky-500 font-semibold py-2 px-4 rounded-lg">{t('player_history_coaching_log_save')}</button>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        {(logs ?? []).length > 0 ? (logs ?? []).map((log: CoachingLog, index: number) => (
                                            <div key={index} className="bg-slate-800 p-3 rounded-lg">
                                                <p className="text-xs text-slate-500 mb-1">{log?.date ? new Date(log.date).toLocaleString() : ''}</p>
                                                <p className="text-slate-300 whitespace-pre-wrap">{log?.content ?? ''}</p>
                                            </div>
                                        )) : (
                                            <p className="text-center text-slate-500 py-4">{t('player_history_coaching_log_none')}</p>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-center text-slate-400">
                                    <LockClosedIcon className="w-16 h-16 text-slate-500 mb-4" />
                                    <h3 className="text-xl font-bold">{t('player_history_coaching_log_private')}</h3>
                                    <p className="mt-2">{t('player_history_coaching_log_unlock_prompt')}</p>
                                </div>
                            )
                        )}
                        {appMode === 'CLUB' && activeTab === 'memo' && (
                            <div className="animate-fade-in flex flex-col gap-4 h-full">
                                <p className="text-slate-400 text-sm flex-shrink-0">해당 선수의 전력 분석 메모를 타임라인 형태로 관리합니다. 저장 시 전역 데이터에 반영됩니다.</p>
                                {setContainingPlayer ? (
                                    <>
                                        <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                                            <textarea
                                                value={newMemoContent}
                                                onChange={(e) => setNewMemoContent(e.target.value)}
                                                placeholder="예: 공격 에이스, 서브 리시브 약함"
                                                className="flex-1 min-h-[80px] bg-slate-900 border border-slate-700 rounded-md p-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddMemo(); } }}
                                            />
                                            <button
                                                onClick={handleAddMemo}
                                                disabled={!newMemoContent.trim()}
                                                className="flex-shrink-0 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:bg-slate-600 disabled:cursor-not-allowed font-semibold text-white transition-colors min-h-[44px] flex items-center justify-center gap-2"
                                            >
                                                ➕ 추가
                                            </button>
                                        </div>
                                        <div className="flex-grow min-h-0 overflow-y-auto space-y-3 pr-2">
                                            {memoEntries.length === 0 ? (
                                                <p className="text-slate-500 text-sm text-center py-8">등록된 메모가 없습니다.</p>
                                            ) : (
                                                memoEntries.map((entry) => (
                                                    <div key={entry.id} className="bg-slate-800 rounded-lg p-3 border border-slate-700/50 flex flex-col gap-2">
                                                        <div className="flex justify-between items-start gap-2">
                                                            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                                                                <span className="text-xs text-slate-500 flex-shrink-0">{entry.createdAt}</span>
                                                                {entry.matchInfo && (
                                                                    <span className="text-xs text-sky-400 flex-shrink-0">[{entry.matchInfo}]</span>
                                                                )}
                                                            </div>
                                                            <div className="flex gap-1 flex-shrink-0">
                                                                {editingMemoId === entry.id ? (
                                                                    <>
                                                                        <button onClick={handleSaveEditMemo} className="text-xs px-2 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-medium">저장</button>
                                                                        <button onClick={handleCancelEditMemo} className="text-xs px-2 py-1 rounded bg-slate-600 hover:bg-slate-500 text-slate-300 font-medium">취소</button>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <button onClick={() => handleEditMemo(entry)} className="text-xs px-2 py-1 rounded bg-slate-600 hover:bg-slate-500 text-slate-300 font-medium">수정</button>
                                                                        <button onClick={() => handleDeleteMemo(entry.id)} className="text-xs px-2 py-1 rounded bg-red-900/50 hover:bg-red-800/50 text-red-300 font-medium">삭제</button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {editingMemoId === entry.id ? (
                                                            <textarea
                                                                value={editingContent}
                                                                onChange={(e) => setEditingContent(e.target.value)}
                                                                className="w-full min-h-[60px] bg-slate-900 border border-slate-600 rounded-md p-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500 resize-none"
                                                                autoFocus
                                                            />
                                                        ) : (
                                                            <p className="text-slate-200 text-sm whitespace-pre-wrap break-words">{entry.content}</p>
                                                        )}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-slate-500 text-sm">이 선수는 현재 팀 세트에 등록되어 있지 않아 메모를 저장할 수 없습니다.</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};
