import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { Player, SavedTeamInfo, SavedOpponentTeam, Stats, MatchRoles } from '../types';
import TeamEmblem from '../components/TeamEmblem';
import { AnalysisMemoModal, AnalysisMemoFocusTarget } from '../components/AnalysisMemoModal';
import { RolePlayerPickerModal } from '../components/RolePlayerPickerModal';
import ConfirmationModal from '../components/common/ConfirmationModal';
import { useTranslation } from '../hooks/useTranslation';

const defaultStats: Stats = { height: 0, shuttleRun: 0, flexibility: 0, fiftyMeterDash: 0, underhand: 0, serve: 0 };

const CLUB_RECENT_LINEUP_KEY_V1 = 'jct_club_recent_lineup_v1';
const CLUB_RECENT_LINEUP_HISTORY_KEY = 'jct_club_recent_lineup_history_v2';

type StoredClubLineup = {
    teamAKey: string;
    teamBKey: string;
    teamAOrder: string[];
    teamBOrder: string[];
    liberoByPlayerId?: Record<string, boolean>;
};

type StoredClubLineupHistoryEntry = StoredClubLineup & { savedAt: number };

function readLineupHistory(): StoredClubLineupHistoryEntry[] {
    try {
        const raw = localStorage.getItem(CLUB_RECENT_LINEUP_HISTORY_KEY);
        if (raw) return JSON.parse(raw) as StoredClubLineupHistoryEntry[];
        const legacy = localStorage.getItem(CLUB_RECENT_LINEUP_KEY_V1);
        if (legacy) {
            const one = JSON.parse(legacy) as StoredClubLineup;
            const migrated: StoredClubLineupHistoryEntry[] = [{ ...one, savedAt: Date.now() }];
            localStorage.setItem(CLUB_RECENT_LINEUP_HISTORY_KEY, JSON.stringify(migrated));
            return migrated;
        }
    } catch { /* ignore */ }
    return [];
}

function saveLineupHistoryEntry(entry: StoredClubLineupHistoryEntry) {
    const all = readLineupHistory();
    const sameMatch = all.filter((e) => e.teamAKey === entry.teamAKey && e.teamBKey === entry.teamBKey);
    const others = all.filter((e) => e.teamAKey !== entry.teamAKey || e.teamBKey !== entry.teamBKey);
    const nextForMatch = [entry, ...sameMatch].slice(0, 3);
    localStorage.setItem(CLUB_RECENT_LINEUP_HISTORY_KEY, JSON.stringify([...nextForMatch, ...others]));
}

function getLineupHistoryForMatch(teamAKey: string, teamBKey: string): StoredClubLineupHistoryEntry[] {
    return readLineupHistory()
        .filter((e) => e.teamAKey === teamAKey && e.teamBKey === teamBKey)
        .sort((a, b) => b.savedAt - a.savedAt)
        .slice(0, 3);
}

function lineupStorageTeamBKey(teamSelection: AttendanceScreenProps['teamSelection']): string {
    if (teamSelection.teamBFromOpponent) return `opp_${teamSelection.teamBFromOpponent.id}`;
    return teamSelection.teamBKey ?? '';
}

function opponentTeamToSavedInfoAndPlayers(opp: SavedOpponentTeam): { teamBInfo: SavedTeamInfo; teamBPlayers: Record<string, Player> } {
    const playerIds = opp.players.map((_, i) => `opp_${opp.id}_${i}`);
    const teamBInfo: SavedTeamInfo = {
        teamName: opp.name,
        captainId: playerIds[0] ?? '',
        playerIds,
    };
    const teamBPlayers: Record<string, Player> = {};
    opp.players.forEach((p, i) => {
        const id = playerIds[i];
        teamBPlayers[id] = {
            id,
            originalName: p.name,
            anonymousName: p.name,
            class: '',
            studentNumber: p.number,
            gender: '',
            stats: defaultStats,
            isCaptain: i === 0,
            totalScore: 0,
            memo: p.memo,
        };
    });
    return { teamBInfo, teamBPlayers };
}

type ClubLineupPickerProps = {
    orderedIds: string[];
    team: 'teamA' | 'teamB';
    allPlayers: Player[];
    playerById: Record<string, Player>;
    teamColor: string;
    maxLineupCount: number;
    onMaxReached?: () => void;
    showLiberoCheckbox: boolean;
    liberoChecked: Record<string, boolean>;
    onLiberoToggle: (playerId: string) => void;
    onOrderChange: (ids: string[]) => void;
    onMemoClick: (playerId: string) => void;
    showMemoButton: boolean;
    onDragStart: (team: 'teamA' | 'teamB', index: number) => (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragEnter: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDragEnd: (e: React.DragEvent) => void;
    onDrop: (team: 'teamA' | 'teamB', index: number) => (e: React.DragEvent) => void;
};

const ClubLineupPicker: React.FC<ClubLineupPickerProps> = ({
    orderedIds,
    team,
    allPlayers,
    playerById,
    teamColor,
    maxLineupCount,
    onMaxReached,
    showLiberoCheckbox,
    liberoChecked,
    onLiberoToggle,
    onOrderChange,
    onMemoClick,
    showMemoButton,
    onDragStart,
    onDragOver,
    onDragEnter,
    onDragLeave,
    onDragEnd,
    onDrop,
}) => {
    const benchPlayers = allPlayers.filter((p) => !orderedIds.includes(p.id));
    const atMax = orderedIds.length >= maxLineupCount;

    const addToLineup = (playerId: string) => {
        if (orderedIds.includes(playerId)) return;
        if (orderedIds.length >= maxLineupCount) {
            onMaxReached?.();
            return;
        }
        onOrderChange([...orderedIds, playerId]);
    };

    const removeFromLineup = (playerId: string) => {
        onOrderChange(orderedIds.filter((id) => id !== playerId));
    };

    return (
        <div className="space-y-3">
            <div className="rounded-lg border border-sky-500/40 bg-slate-800/60 p-3">
                <p className="text-xs font-semibold text-sky-300 mb-2">선발 명단 · 드래그로 서브 순서(1번~)</p>
                {orderedIds.length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-4">아래 명단에서 선수를 선택하세요.</p>
                ) : (
                    <div className="space-y-1.5">
                        {orderedIds.map((id, idx) => {
                            const player = playerById[id];
                            if (!player) return null;
                            const isLibero = showLiberoCheckbox && (liberoChecked[id] ?? player.isLibero);
                            return (
                                <div
                                    key={id}
                                    draggable
                                    onDragStart={onDragStart(team, idx)}
                                    onDragOver={onDragOver}
                                    onDragEnter={onDragEnter}
                                    onDragLeave={onDragLeave}
                                    onDragEnd={onDragEnd}
                                    onDrop={onDrop(team, idx)}
                                    className={`flex items-center gap-2 p-2.5 rounded-lg border-l-4 cursor-grab active:cursor-grabbing bg-slate-900/80 hover:bg-slate-800/90 transition-colors ${isLibero ? 'bg-pink-500/15 border-pink-500/50' : ''}`}
                                    style={{ borderLeftColor: teamColor }}
                                >
                                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-700 text-sky-300 text-xs font-bold flex items-center justify-center">{idx + 1}</span>
                                    <span className="flex-1 font-medium text-slate-200 truncate">{player.originalName}{isLibero ? ' [L]' : ''}</span>
                                    {showLiberoCheckbox && (
                                        <label className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                            <input type="checkbox" checked={liberoChecked[id] ?? player.isLibero ?? false} onChange={() => onLiberoToggle(id)} className="h-4 w-4 rounded" />
                                            <span className="text-xs text-pink-400/90">L</span>
                                        </label>
                                    )}
                                    {showMemoButton && (
                                        <button type="button" onClick={() => onMemoClick(id)} className="p-1 rounded hover:bg-slate-600/50 text-amber-400/90 text-sm" aria-label="전력 분석 메모">📝</button>
                                    )}
                                    <button type="button" onClick={() => removeFromLineup(id)} className="p-1 rounded text-slate-500 hover:text-red-400 text-sm" aria-label="선발 제외">✕</button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            <div>
                <p className="text-xs text-slate-400 mb-2">전체 명단 (클릭하여 선발 추가)</p>
                <div className="space-y-1 max-h-[40vh] overflow-y-auto pr-1">
                    {benchPlayers.map((player) => {
                        const isLiberoBench = showLiberoCheckbox && (liberoChecked[player.id] ?? player.isLibero);
                        const disabled = atMax;
                        return (
                            <button
                                key={player.id}
                                type="button"
                                disabled={disabled}
                                onClick={() => addToLineup(player.id)}
                                className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors border-l-4 border-transparent ${
                                    disabled
                                        ? 'bg-slate-800/30 text-slate-600 cursor-not-allowed opacity-60'
                                        : `bg-slate-800/50 hover:bg-slate-700/60 ${isLiberoBench ? 'bg-pink-500/10 border-pink-500/40' : ''}`
                                }`}
                            >
                                <span className="text-slate-500 text-lg leading-none">+</span>
                                <span className="text-slate-300 flex-1">{player.originalName}{isLiberoBench ? ' [L]' : ''}</span>
                                {showLiberoCheckbox && (
                                    <label className="flex items-center gap-1 shrink-0" onClick={(e) => { e.stopPropagation(); onLiberoToggle(player.id); }}>
                                        <input type="checkbox" checked={liberoChecked[player.id] ?? player.isLibero ?? false} onChange={() => onLiberoToggle(player.id)} className="h-4 w-4 rounded" />
                                        <span className="text-xs text-pink-400/90">L</span>
                                    </label>
                                )}
                            </button>
                        );
                    })}
                    {benchPlayers.length === 0 && orderedIds.length > 0 && (
                        <p className="text-slate-600 text-xs text-center py-2">모든 선수가 선발 명단에 포함되었습니다.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

interface AttendanceScreenProps {
    appMode?: 'CLASS' | 'CLUB';
    teamSelection: {
        teamA: string;
        teamB: string;
        teamAKey?: string;
        teamBKey?: string;
        teamBFromOpponent?: SavedOpponentTeam;
        matchRoles?: MatchRoles;
    };
    onStartMatch: (data: {
        attendingPlayers: { teamA: Record<string, Player>, teamB: Record<string, Player> },
        onCourtIds: { teamA: Set<string>, teamB: Set<string> },
        onCourtOrder?: { teamA: string[], teamB: string[] },
        teamAInfo: SavedTeamInfo | null,
        teamBInfo: SavedTeamInfo | null,
        matchRoles?: MatchRoles;
    }) => void;
}

const AttendanceScreen: React.FC<AttendanceScreenProps> = ({ appMode = 'CLASS', teamSelection, onStartMatch }) => {
    const location = useLocation();
    const isClubMode = location.pathname.startsWith('/club');
    const { teamSetsMap, teamSets, showToast, settings } = useData();
    const { t } = useTranslation();
    const requiredCount = isClubMode ? ((settings?.volleyballRuleSystem === 6) ? 6 : 9) : 0;
    const is6v6 = settings?.volleyballRuleSystem === 6;
    const liberoEnabled = isClubMode && is6v6;
    const [liberoByPlayerId, setLiberoByPlayerId] = useState<Record<string, boolean>>({});

    const { teamAInfo, teamAPlayers, teamBInfo, teamBPlayers } = useMemo(() => {
        let teamAInfo: SavedTeamInfo | null = null;
        let localTeamAPlayers: Record<string, Player> = {};
        let teamBInfo: SavedTeamInfo | null = null;
        let localTeamBPlayers: Record<string, Player> = {};

        if (teamSelection.teamAKey) {
            const dataA = teamSetsMap.get(teamSelection.teamAKey);
            if (dataA) {
                teamAInfo = dataA.team;
                localTeamAPlayers = dataA.team.playerIds
                    .map(id => dataA.set.players[id])
                    .filter((p): p is Player => !!p)
                    .reduce((acc, p) => ({...acc, [p.id]: p}), {});
            }
        }

        if (teamSelection.teamBFromOpponent) {
            const { teamBInfo: info, teamBPlayers: players } = opponentTeamToSavedInfoAndPlayers(teamSelection.teamBFromOpponent);
            teamBInfo = info;
            localTeamBPlayers = players;
        } else if (teamSelection.teamBKey) {
            const dataB = teamSetsMap.get(teamSelection.teamBKey);
            if (dataB) {
                teamBInfo = dataB.team;
                localTeamBPlayers = dataB.team.playerIds
                    .map(id => dataB.set.players[id])
                    .filter((p): p is Player => !!p)
                    .reduce((acc, p) => ({...acc, [p.id]: p}), {});
            }
        }

        return { 
            teamAInfo, 
            teamAPlayers: localTeamAPlayers, 
            teamBInfo, 
            teamBPlayers: localTeamBPlayers
        };
    }, [teamSelection, teamSetsMap]);
    
    const [onCourtOrdered, setOnCourtOrdered] = useState<{ teamA: string[], teamB: string[] }>({ teamA: [], teamB: [] });
    const [memoOverrides, setMemoOverrides] = useState<Record<string, string>>({});
    const [analysisMemoOpen, setAnalysisMemoOpen] = useState(false);
    const [analysisMemoFocus, setAnalysisMemoFocus] = useState<AnalysisMemoFocusTarget | null>(null);
    const [matchRoles, setMatchRoles] = useState<MatchRoles>(() => teamSelection.matchRoles ?? { announcers: [], referees: [], lineJudges: [], cameraDirectors: [], recorders: [] });
    const [rolePickerTarget, setRolePickerTarget] = useState<'announcer' | 'referee' | 'lineJudge' | 'cameraDirector' | 'recorder' | null>(null);
    const [lineupPreviewTeam, setLineupPreviewTeam] = useState<'teamA' | 'teamB' | null>(null);
    const [lineupPreviewOrder, setLineupPreviewOrder] = useState<string[]>([]);
    const [lineupPreviewLibero, setLineupPreviewLibero] = useState<Record<string, boolean> | undefined>(undefined);
    const [recentLineupPickerTeam, setRecentLineupPickerTeam] = useState<'teamA' | 'teamB' | null>(null);
    const [recentLineupEntries, setRecentLineupEntries] = useState<StoredClubLineupHistoryEntry[]>([]);

    const clubModalLocksScroll = isClubMode && (
        analysisMemoOpen
        || (recentLineupPickerTeam !== null && recentLineupEntries.length > 0)
        || (lineupPreviewTeam !== null && lineupPreviewOrder.length > 0)
    );
    useEffect(() => {
        if (!clubModalLocksScroll) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [clubModalLocksScroll]);

    useEffect(() => {
        if (isClubMode) {
            setOnCourtOrdered({ teamA: [], teamB: [] });
        } else {
            const aOrder = Object.values(teamAPlayers).sort((a: Player, b: Player) => parseInt(a.studentNumber || '0') - parseInt(b.studentNumber || '0')).map(p => p.id);
            const bOrder = Object.values(teamBPlayers).sort((a: Player, b: Player) => parseInt(a.studentNumber || '0') - parseInt(b.studentNumber || '0')).map(p => p.id);
            setOnCourtOrdered({ teamA: aOrder, teamB: bOrder });
        }
    }, [teamAPlayers, teamBPlayers, isClubMode]);

    const handleToggleOnCourt = (playerId: string, team: 'teamA' | 'teamB') => {
        setOnCourtOrdered(prev => {
            const arr = prev[team];
            const idx = arr.indexOf(playerId);
            if (idx >= 0) return { ...prev, [team]: arr.filter(id => id !== playerId) };
            return { ...prev, [team]: [...arr, playerId] };
        });
    };

    const handleMoveCourtOrder = (team: 'teamA' | 'teamB', index: number, direction: 'up' | 'down') => {
        setOnCourtOrdered(prev => {
            const arr = [...prev[team]];
            const newIdx = direction === 'up' ? index - 1 : index + 1;
            if (newIdx < 0 || newIdx >= arr.length) return prev;
            [arr[index], arr[newIdx]] = [arr[newIdx], arr[index]];
            return { ...prev, [team]: arr };
        });
    };

    const handleDragStart = (team: 'teamA' | 'teamB', index: number) => (e: React.DragEvent) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ team, index }));
        e.dataTransfer.effectAllowed = 'move';
    };
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };
    const handleDragEnd = (e: React.DragEvent) => {
        (e.target as HTMLElement).classList.remove('opacity-60');
    };
    const handleLiberoToggle = (playerId: string) => {
        setLiberoByPlayerId(prev => ({ ...prev, [playerId]: !(prev[playerId] ?? false) }));
    };

    const handleDrop = (team: 'teamA' | 'teamB', dropIndex: number) => (e: React.DragEvent) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).classList.remove('opacity-60');
        try {
            const raw = e.dataTransfer.getData('text/plain');
            const { team: fromTeam, index: dragIndex } = JSON.parse(raw) as { team: 'teamA' | 'teamB'; index: number };
            if (fromTeam !== team || dragIndex === dropIndex) return;
            setOnCourtOrdered(prev => {
                const arr = [...prev[team]];
                const [removed] = arr.splice(dragIndex, 1);
                const insertAt = dragIndex < dropIndex ? dropIndex - 1 : dropIndex;
                arr.splice(insertAt, 0, removed);
                return { ...prev, [team]: arr };
            });
        } catch (_) { /* ignore */ }
    };
    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).classList.add('opacity-60');
    };
    const handleDragLeave = (e: React.DragEvent) => {
        (e.currentTarget as HTMLElement).classList.remove('opacity-60');
    };

    const currentLineupKeys = useMemo(() => ({
        teamAKey: teamSelection.teamAKey ?? '',
        teamBKey: lineupStorageTeamBKey(teamSelection),
    }), [teamSelection]);

    const saveRecentLineup = () => {
        if (!isClubMode) return;
        const payload: StoredClubLineupHistoryEntry = {
            teamAKey: currentLineupKeys.teamAKey,
            teamBKey: currentLineupKeys.teamBKey,
            teamAOrder: onCourtOrdered.teamA,
            teamBOrder: onCourtOrdered.teamB,
            savedAt: Date.now(),
            ...(liberoEnabled ? { liberoByPlayerId } : {}),
        };
        try {
            saveLineupHistoryEntry(payload);
        } catch { /* ignore quota */ }
    };

    const loadRecentLineupForTeam = (team: 'teamA' | 'teamB') => {
        if (!isClubMode) return;
        const entries = getLineupHistoryForMatch(currentLineupKeys.teamAKey, currentLineupKeys.teamBKey);
        if (entries.length === 0) {
            showToast(t('attendance_load_recent_lineup_empty'));
            return;
        }
        setRecentLineupPickerTeam(team);
        setRecentLineupEntries(entries);
    };

    const selectRecentLineupEntry = (entry: StoredClubLineupHistoryEntry) => {
        const team = recentLineupPickerTeam;
        if (!team) return;
        const valid = new Set(Object.keys(team === 'teamA' ? teamAPlayers : teamBPlayers));
        const order = (team === 'teamA' ? entry.teamAOrder : entry.teamBOrder ?? []).filter((id) => valid.has(id));
        if (order.length === 0) {
            showToast(t('attendance_load_recent_lineup_empty'));
            return;
        }
        setRecentLineupPickerTeam(null);
        setRecentLineupEntries([]);
        setLineupPreviewTeam(team);
        setLineupPreviewOrder(order);
        setLineupPreviewLibero(entry.liberoByPlayerId);
    };

    const applyLineupPreview = () => {
        if (!lineupPreviewTeam || lineupPreviewOrder.length === 0) return;
        setOnCourtOrdered((prev) => ({
            ...prev,
            [lineupPreviewTeam]: lineupPreviewOrder,
        }));
        if (liberoEnabled && lineupPreviewLibero) {
            setLiberoByPlayerId((prev) => {
                const next = { ...prev };
                for (const id of lineupPreviewOrder) {
                    if (lineupPreviewLibero[id]) next[id] = true;
                }
                return next;
            });
        }
        setLineupPreviewTeam(null);
        setLineupPreviewOrder([]);
        setLineupPreviewLibero(undefined);
        showToast(t('attendance_load_recent_lineup_success'));
    };

    const handleMaxLineupReached = () => {
        showToast(t('attendance_max_players', { count: requiredCount }), 'error');
    };

    const handleStart = () => {
        if (isClubMode) saveRecentLineup();
        const mergeMemo = (players: Record<string, Player>) => {
            const out: Record<string, Player> = {};
            for (const id of Object.keys(players)) {
                const p = players[id];
                out[id] = {
                    ...p,
                    memo: memoOverrides[id] ?? p.memo,
                    ...(liberoEnabled && { isLibero: liberoByPlayerId[id] ?? p.isLibero ?? false }),
                };
            }
            return out;
        };
        onStartMatch({
            attendingPlayers: {
                teamA: mergeMemo(teamAPlayers),
                teamB: mergeMemo(teamBPlayers),
            },
            onCourtIds: { teamA: new Set(onCourtOrdered.teamA), teamB: new Set(onCourtOrdered.teamB) },
            onCourtOrder: onCourtOrdered,
            teamAInfo: teamAInfo,
            teamBInfo: teamBInfo,
            ...(appMode === 'CLASS' ? { matchRoles } : {}),
        });
    };
    
    // FIX: Add explicit Player type to sort callback parameters to resolve them being inferred as `unknown`.
    const sortedTeamAPlayers = useMemo(() => Object.values(teamAPlayers).sort((a: Player, b: Player) => parseInt(a.studentNumber) - parseInt(b.studentNumber)), [teamAPlayers]);
    // FIX: Add explicit Player type to sort callback parameters to resolve them being inferred as `unknown`.
    const sortedTeamBPlayers = useMemo(() => Object.values(teamBPlayers).sort((a: Player, b: Player) => parseInt(a.studentNumber) - parseInt(b.studentNumber)), [teamBPlayers]);
    
    const onCourtSetA = useMemo(() => new Set(onCourtOrdered.teamA), [onCourtOrdered.teamA]);
    const onCourtSetB = useMemo(() => new Set(onCourtOrdered.teamB), [onCourtOrdered.teamB]);
    const isStartDisabled = isClubMode
        ? (onCourtOrdered.teamA.length !== requiredCount || onCourtOrdered.teamB.length !== requiredCount)
        : (onCourtOrdered.teamA.length < 1 || onCourtOrdered.teamB.length < 1);
    const lineupComplete = onCourtOrdered.teamA.length > 0 && onCourtOrdered.teamB.length > 0;
    const homeCountOk = !isClubMode || onCourtOrdered.teamA.length === requiredCount;
    const awayCountOk = !isClubMode || onCourtOrdered.teamB.length === requiredCount;

    const selectedClasses = useMemo(() => {
        const classes: string[] = [];
        if (teamSelection.teamAKey) {
            const data = teamSetsMap.get(teamSelection.teamAKey);
            if (data?.set.className && !classes.includes(data.set.className)) classes.push(data.set.className);
        }
        if (teamSelection.teamBKey) {
            const data = teamSetsMap.get(teamSelection.teamBKey);
            if (data?.set.className && !classes.includes(data.set.className)) classes.push(data.set.className);
        }
        return classes;
    }, [teamSelection.teamAKey, teamSelection.teamBKey, teamSetsMap]);

    const excludePlayerIds = useMemo(() => [...onCourtOrdered.teamA, ...onCourtOrdered.teamB], [onCourtOrdered.teamA, onCourtOrdered.teamB]);

    const showPlayerMemo = appMode === 'CLUB';

    const openPlayerAnalysisMemo = (playerId: string, side: 'teamA' | 'teamB') => {
        const teamName = side === 'teamA' ? teamAInfo?.teamName : teamBInfo?.teamName;
        const teamKey = side === 'teamA' ? teamSelection.teamAKey : teamSelection.teamBKey;
        const setId = teamKey?.split('___')[0];
        const category = setId ? teamSets.find((s) => s.id === setId)?.className : undefined;
        if (!teamName) return;
        setAnalysisMemoFocus({ playerId, teamName, category });
        setAnalysisMemoOpen(true);
    };
    const showServeOrder = appMode === 'CLUB';
    const playerById = useMemo(() => ({ ...teamAPlayers, ...teamBPlayers }), [teamAPlayers, teamBPlayers]);
    const CourtOrderList: React.FC<{
        orderedIds: string[];
        team: 'teamA' | 'teamB';
        allPlayers: Player[];
        onToggle: (playerId: string) => void;
        onMemoClick: (playerId: string) => void;
        showMemoButton: boolean;
        showServeOrder: boolean;
        teamColor: string;
        showLiberoCheckbox: boolean;
        liberoChecked: Record<string, boolean>;
        onLiberoToggle: (playerId: string) => void;
        onDragStart: (team: 'teamA' | 'teamB', index: number) => (e: React.DragEvent) => void;
        onDragOver: (e: React.DragEvent) => void;
        onDragEnter: (e: React.DragEvent) => void;
        onDragLeave: (e: React.DragEvent) => void;
        onDragEnd: (e: React.DragEvent) => void;
        onDrop: (team: 'teamA' | 'teamB', index: number) => (e: React.DragEvent) => void;
    }> = ({ orderedIds, team, allPlayers, onToggle, onMemoClick, showMemoButton, showServeOrder, teamColor, showLiberoCheckbox, liberoChecked, onLiberoToggle, onDragStart, onDragOver, onDragEnter, onDragLeave, onDragEnd, onDrop }) => (
        <div className="space-y-1.5">
            {showServeOrder && <p className="text-xs text-slate-400 mb-2">체크한 선수가 주전(1번~6번 서버 순서), ▲▼ 또는 드래그로 서브 순서 변경</p>}
            {showLiberoCheckbox && <p className="text-xs text-pink-400/90 mb-2">L: 리베로 지정 (공격/서브 불가, 전용 색상 표시)</p>}
            {orderedIds.map((id, idx) => {
                const player = playerById[id];
                if (!player) return null;
                const isLibero = showLiberoCheckbox && (liberoChecked[id] ?? player.isLibero);
                return (
                    <label
                        key={id}
                        draggable={showServeOrder}
                        onDragStart={showServeOrder ? onDragStart(team, idx) : undefined}
                        onDragOver={showServeOrder ? onDragOver : undefined}
                        onDragEnter={showServeOrder ? onDragEnter : undefined}
                        onDragLeave={showServeOrder ? onDragLeave : undefined}
                        onDragEnd={showServeOrder ? onDragEnd : undefined}
                        onDrop={showServeOrder ? onDrop(team, idx) : undefined}
                        className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer hover:opacity-90 transition-all border-l-4 ${
                            team === 'teamA' ? 'bg-blue-900/30 border-blue-500/60' : 'bg-red-900/30 border-red-500/60'
                        } ${isLibero ? 'bg-pink-500/20 border-pink-500/60' : ''} ${showServeOrder ? 'cursor-grab active:cursor-grabbing' : ''}`}
                        style={{ borderLeftColor: teamColor }}
                    >
                        <input type="checkbox" checked onChange={() => onToggle(id)} className="h-5 w-5 rounded flex-shrink-0" style={{ accentColor: teamColor }} />
                        <span className="font-medium text-slate-200 flex-1">{player.originalName}{isLibero ? ' [L]' : ''}</span>
                        {showLiberoCheckbox && (
                            <label className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                                <input type="checkbox" checked={liberoChecked[id] ?? player.isLibero ?? false} onChange={() => onLiberoToggle(id)} className="h-4 w-4 rounded" />
                                <span className="text-xs text-pink-400/90">L</span>
                            </label>
                        )}
                        {showServeOrder && (
                            <div className="flex flex-col gap-0.5 opacity-70">
                                <button type="button" onClick={e => { e.preventDefault(); handleMoveCourtOrder(team, idx, 'up'); }} disabled={idx === 0} className="p-0.5 rounded hover:bg-slate-600/50 disabled:opacity-30 text-slate-400 leading-none text-xs">▲</button>
                                <button type="button" onClick={e => { e.preventDefault(); handleMoveCourtOrder(team, idx, 'down'); }} disabled={idx === orderedIds.length - 1} className="p-0.5 rounded hover:bg-slate-600/50 disabled:opacity-30 text-slate-400 leading-none text-xs">▼</button>
                            </div>
                        )}
                        {showMemoButton && (
                            <button type="button" onClick={e => { e.preventDefault(); onMemoClick(id); }} className="p-1 rounded hover:bg-slate-600/50 text-amber-400/90 text-sm" aria-label="전력 분석 메모">📝</button>
                        )}
                    </label>
                );
            })}
            {allPlayers.filter(p => !orderedIds.includes(p.id)).map(player => {
                const isLiberoBench = showLiberoCheckbox && (liberoChecked[player.id] ?? player.isLibero);
                return (
                    <label key={player.id} className={`flex items-center gap-3 p-2.5 rounded-lg bg-slate-800/50 cursor-pointer hover:bg-slate-700/50 transition-colors border-l-4 border-transparent ${isLiberoBench ? 'bg-pink-500/10 border-pink-500/40' : ''}`}>
                        <input type="checkbox" checked={false} onChange={() => onToggle(player.id)} className="h-5 w-5 rounded flex-shrink-0" style={{ accentColor: teamColor }} />
                        <span className="text-slate-500 flex-1">+ {player.originalName}{isLiberoBench ? ' [L]' : ''}</span>
                        {showLiberoCheckbox && (
                            <label className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                                <input type="checkbox" checked={liberoChecked[player.id] ?? player.isLibero ?? false} onChange={() => onLiberoToggle(player.id)} className="h-4 w-4 rounded" />
                                <span className="text-xs text-pink-400/90">L</span>
                            </label>
                        )}
                    </label>
                );
            })}
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto bg-slate-900/50 backdrop-blur-sm border border-slate-700 p-6 rounded-lg shadow-2xl space-y-6 animate-fade-in">
            <div className="flex flex-col lg:flex-row items-center lg:justify-between mb-6 gap-4">
                <h1 className="text-3xl lg:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 text-center lg:text-right">
                    {t('attendance_select_players_title')}
                </h1>
            </div>
            <p className="text-slate-400 mt-1 text-center">
                {t('attendance_desc')}
            </p>
            {isClubMode && (
                <p className="text-slate-400 text-sm text-center">
                    💡 출전할 선수를 선택한 뒤, 선발 명단 영역에서 드래그하여 서브 순서를 정해주세요.
                </p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-900/50 p-4 rounded-lg border-2 border-slate-700">
                    <div className="flex flex-col items-center text-center gap-2 mb-4">
                        {teamAInfo && <TeamEmblem emblem={teamAInfo.emblem} color={teamAInfo.color || '#3b82f6'} className="w-16 h-16" />}
                        <h3 className="text-2xl font-bold" style={{ color: teamAInfo?.color || '#3b82f6' }}>{teamAInfo?.teamName || 'Team A'}</h3>
                        {isClubMode ? (
                            <p className={`text-sm font-semibold ${homeCountOk ? 'text-green-400' : 'text-red-400'}`}>
                                선발 명단 ( {onCourtOrdered.teamA.length} / {requiredCount} 명 )
                            </p>
                        ) : (
                            <p className="text-slate-400 text-sm">({onCourtOrdered.teamA.length}{t('attendance_count_suffix')})</p>
                        )}
                        {isClubMode && (
                            <button
                                type="button"
                                onClick={() => loadRecentLineupForTeam('teamA')}
                                className="mt-1 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-500 text-slate-200 text-xs font-semibold transition-colors"
                            >
                                {t('attendance_load_recent_lineup_team_a')}
                            </button>
                        )}
                    </div>
                    {isClubMode ? (
                        <ClubLineupPicker
                            orderedIds={onCourtOrdered.teamA}
                            team="teamA"
                            allPlayers={sortedTeamAPlayers}
                            playerById={playerById}
                            teamColor={teamAInfo?.color || '#3b82f6'}
                            maxLineupCount={requiredCount}
                            onMaxReached={handleMaxLineupReached}
                            showLiberoCheckbox={liberoEnabled}
                            liberoChecked={liberoByPlayerId}
                            onLiberoToggle={handleLiberoToggle}
                            onOrderChange={(ids) => setOnCourtOrdered((prev) => ({ ...prev, teamA: ids }))}
                            onMemoClick={(id) => openPlayerAnalysisMemo(id, 'teamA')}
                            showMemoButton={showPlayerMemo}
                            onDragStart={handleDragStart}
                            onDragOver={handleDragOver}
                            onDragEnter={handleDragEnter}
                            onDragLeave={handleDragLeave}
                            onDragEnd={handleDragEnd}
                            onDrop={handleDrop}
                        />
                    ) : (
                        <CourtOrderList orderedIds={onCourtOrdered.teamA} team="teamA" allPlayers={sortedTeamAPlayers} onToggle={(id) => handleToggleOnCourt(id, 'teamA')} onMemoClick={() => {}} showMemoButton={false} showServeOrder={showServeOrder} teamColor={teamAInfo?.color || '#3b82f6'} showLiberoCheckbox={liberoEnabled} liberoChecked={liberoByPlayerId} onLiberoToggle={handleLiberoToggle} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragEnd={handleDragEnd} onDrop={handleDrop} />
                    )}
                </div>
                <div className="bg-slate-900/50 p-4 rounded-lg border-2 border-slate-700">
                    <div className="flex flex-col items-center text-center gap-2 mb-4">
                        {teamBInfo && <TeamEmblem emblem={teamBInfo.emblem} color={teamBInfo.color || '#ef4444'} className="w-16 h-16" />}
                        <h3 className="text-2xl font-bold" style={{ color: teamBInfo?.color || '#ef4444' }}>{teamBInfo?.teamName || 'Team B'}</h3>
                        {isClubMode ? (
                            <p className={`text-sm font-semibold ${awayCountOk ? 'text-green-400' : 'text-red-400'}`}>
                                선발 명단 ( {onCourtOrdered.teamB.length} / {requiredCount} 명 )
                            </p>
                        ) : (
                            <p className="text-slate-400 text-sm">({onCourtOrdered.teamB.length}{t('attendance_count_suffix')})</p>
                        )}
                        {isClubMode && (
                            <button
                                type="button"
                                onClick={() => loadRecentLineupForTeam('teamB')}
                                className="mt-1 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-500 text-slate-200 text-xs font-semibold transition-colors"
                            >
                                {t('attendance_load_recent_lineup_team_b')}
                            </button>
                        )}
                    </div>
                    {isClubMode ? (
                        <ClubLineupPicker
                            orderedIds={onCourtOrdered.teamB}
                            team="teamB"
                            allPlayers={sortedTeamBPlayers}
                            playerById={playerById}
                            teamColor={teamBInfo?.color || '#ef4444'}
                            maxLineupCount={requiredCount}
                            onMaxReached={handleMaxLineupReached}
                            showLiberoCheckbox={liberoEnabled}
                            liberoChecked={liberoByPlayerId}
                            onLiberoToggle={handleLiberoToggle}
                            onOrderChange={(ids) => setOnCourtOrdered((prev) => ({ ...prev, teamB: ids }))}
                            onMemoClick={(id) => openPlayerAnalysisMemo(id, 'teamB')}
                            showMemoButton={showPlayerMemo}
                            onDragStart={handleDragStart}
                            onDragOver={handleDragOver}
                            onDragEnter={handleDragEnter}
                            onDragLeave={handleDragLeave}
                            onDragEnd={handleDragEnd}
                            onDrop={handleDrop}
                        />
                    ) : (
                        <CourtOrderList orderedIds={onCourtOrdered.teamB} team="teamB" allPlayers={sortedTeamBPlayers} onToggle={(id) => handleToggleOnCourt(id, 'teamB')} onMemoClick={() => {}} showMemoButton={false} showServeOrder={showServeOrder} teamColor={teamBInfo?.color || '#ef4444'} showLiberoCheckbox={liberoEnabled} liberoChecked={liberoByPlayerId} onLiberoToggle={handleLiberoToggle} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragEnd={handleDragEnd} onDrop={handleDrop} />
                    )}
                </div>
            </div>
            {appMode === 'CLASS' && lineupComplete && (
                <div className="p-4 sm:p-5 bg-slate-800/50 rounded-lg border border-slate-700">
                    <h3 className="text-lg sm:text-xl font-bold text-sky-400 mb-3">🎭 경기 역할 배정</h3>
                    <p className="text-sm sm:text-base text-slate-400 mb-4">비출전 학생에게 경기 역할을 배정할 수 있습니다. 역할당 최대 4명.</p>
                    <div className="space-y-4">
                        {[
                            { key: 'announcer' as const, label: '아나운서', players: matchRoles.announcers },
                            { key: 'referee' as const, label: '주심', players: matchRoles.referees },
                            { key: 'cameraDirector' as const, label: '카메라 감독', players: matchRoles.cameraDirectors },
                            { key: 'recorder' as const, label: '기록관', players: matchRoles.recorders },
                            { key: 'lineJudge' as const, label: '선심', players: matchRoles.lineJudges },
                        ].map(({ key, label, players }) => (
                            <div key={key} className="flex items-start sm:items-center justify-between gap-3 p-3 rounded-lg bg-slate-900/50 flex-wrap sm:flex-nowrap">
                                <span className="text-base sm:text-lg font-medium text-slate-300 shrink-0">{label}</span>
                                <div className="flex flex-wrap items-center gap-2 flex-1 justify-end min-w-0">
                                    {players.map(p => (
                                        <span
                                            key={p.id}
                                            onClick={() => {
                                                const remove = players.filter(x => x.id !== p.id);
                                                if (key === 'announcer') setMatchRoles(r => ({ ...r, announcers: remove }));
                                                else if (key === 'referee') setMatchRoles(r => ({ ...r, referees: remove }));
                                                else if (key === 'lineJudge') setMatchRoles(r => ({ ...r, lineJudges: remove }));
                                                else if (key === 'cameraDirector') setMatchRoles(r => ({ ...r, cameraDirectors: remove }));
                                                else if (key === 'recorder') setMatchRoles(r => ({ ...r, recorders: remove }));
                                            }}
                                            className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-sm cursor-pointer hover:bg-blue-200 transition"
                                        >
                                            {p.originalName} ✕
                                        </span>
                                    ))}
                                    {players.length < 4 && (
                                        <button type="button" onClick={() => setRolePickerTarget(key)} className="text-sm px-3 py-1.5 rounded-lg bg-slate-600 hover:bg-slate-500 text-white font-medium">+ 학생 선택</button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <RolePlayerPickerModal
                isOpen={!!rolePickerTarget}
                onClose={() => setRolePickerTarget(null)}
                selectedClasses={selectedClasses}
                excludePlayerIds={excludePlayerIds}
                roleLabel={rolePickerTarget === 'lineJudge' ? '선심' : rolePickerTarget === 'announcer' ? '아나운서' : rolePickerTarget === 'referee' ? '주심' : rolePickerTarget === 'cameraDirector' ? '카메라 감독' : rolePickerTarget === 'recorder' ? '기록관' : ''}
                multiSelect={true}
                selectedPlayers={rolePickerTarget === 'announcer' ? matchRoles.announcers : rolePickerTarget === 'referee' ? matchRoles.referees : rolePickerTarget === 'lineJudge' ? matchRoles.lineJudges : rolePickerTarget === 'cameraDirector' ? matchRoles.cameraDirectors : rolePickerTarget === 'recorder' ? matchRoles.recorders : []}
                onSelectMultiple={(list) => {
                    if (rolePickerTarget === 'announcer') setMatchRoles(r => ({ ...r, announcers: list }));
                    else if (rolePickerTarget === 'referee') setMatchRoles(r => ({ ...r, referees: list }));
                    else if (rolePickerTarget === 'lineJudge') setMatchRoles(r => ({ ...r, lineJudges: list }));
                    else if (rolePickerTarget === 'cameraDirector') setMatchRoles(r => ({ ...r, cameraDirectors: list }));
                    else if (rolePickerTarget === 'recorder') setMatchRoles(r => ({ ...r, recorders: list }));
                }}
            />

            {isClubMode && recentLineupPickerTeam && recentLineupEntries.length > 0 && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={() => { setRecentLineupPickerTeam(null); setRecentLineupEntries([]); }}>
                    <div className="bg-slate-800 rounded-xl border border-slate-600 w-full max-w-lg max-h-[85vh] overflow-y-auto p-5 shadow-2xl my-auto" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-sky-300 mb-1">{t('attendance_recent_lineup_modal_title')}</h3>
                        <p className="text-slate-400 text-sm mb-4">
                            {recentLineupPickerTeam === 'teamA'
                                ? t('attendance_recent_lineup_modal_subtitle_a', { teamName: teamAInfo?.teamName ?? 'A팀' })
                                : t('attendance_recent_lineup_modal_subtitle_b', { teamName: teamBInfo?.teamName ?? 'B팀' })}
                        </p>
                        <div className="space-y-3">
                            {recentLineupEntries.map((entry, idx) => {
                                const playersMap = recentLineupPickerTeam === 'teamA' ? teamAPlayers : teamBPlayers;
                                const order = (recentLineupPickerTeam === 'teamA' ? entry.teamAOrder : entry.teamBOrder).filter((id) => playersMap[id]);
                                const savedLabel = new Date(entry.savedAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                                return (
                                    <button
                                        key={`${entry.savedAt}-${idx}`}
                                        type="button"
                                        onClick={() => selectRecentLineupEntry(entry)}
                                        className="w-full text-left rounded-lg border-2 border-slate-600 bg-slate-900/80 hover:border-sky-500/60 hover:bg-slate-800/90 p-4 transition-colors"
                                    >
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-sm font-bold text-sky-300">{idx + 1}번 명단</span>
                                            <span className="text-xs text-slate-500">{savedLabel}</span>
                                        </div>
                                        <ol className="list-decimal list-inside text-slate-300 text-sm space-y-0.5">
                                            {order.map((id) => (
                                                <li key={id} className="truncate">{playersMap[id]?.originalName ?? '—'}</li>
                                            ))}
                                        </ol>
                                    </button>
                                );
                            })}
                        </div>
                        <button type="button" onClick={() => { setRecentLineupPickerTeam(null); setRecentLineupEntries([]); }} className="mt-4 w-full py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium">닫기</button>
                    </div>
                </div>,
                document.body
            )}

            {isClubMode && lineupPreviewTeam && lineupPreviewOrder.length > 0 && (
                <ConfirmationModal
                    isOpen
                    usePortal
                    onClose={() => { setLineupPreviewTeam(null); setLineupPreviewOrder([]); setLineupPreviewLibero(undefined); }}
                    onConfirm={applyLineupPreview}
                    title={t('attendance_lineup_preview_title')}
                    message={lineupPreviewTeam === 'teamA'
                        ? t('attendance_lineup_preview_message_team_a', { teamName: teamAInfo?.teamName ?? 'A팀' })
                        : t('attendance_lineup_preview_message_team_b', { teamName: teamBInfo?.teamName ?? 'B팀' })}
                    confirmText={t('confirm')}
                >
                    <ol className="mt-4 list-decimal list-inside text-slate-300 text-sm space-y-1 max-h-[40vh] overflow-y-auto">
                        {lineupPreviewOrder.map((id) => (
                            <li key={id}>
                                {(lineupPreviewTeam === 'teamA' ? teamAPlayers : teamBPlayers)[id]?.originalName ?? '—'}
                            </li>
                        ))}
                    </ol>
                </ConfirmationModal>
            )}

            {isClubMode && (
                <AnalysisMemoModal
                    isOpen={analysisMemoOpen}
                    onClose={() => { setAnalysisMemoOpen(false); setAnalysisMemoFocus(null); }}
                    focusTarget={analysisMemoFocus}
                    onFocusComplete={() => setAnalysisMemoFocus(null)}
                />
            )}
            <div className="flex flex-col items-center gap-2 pt-6">
                {isClubMode && isStartDisabled && (
                    <p className="text-red-400 text-sm font-medium">각 팀 선발 {requiredCount}명을 정확히 선택해 주세요.</p>
                )}
                <button
                    onClick={handleStart}
                    disabled={isStartDisabled}
                    className="w-full sm:w-auto bg-[#00A3FF] hover:bg-[#0082cc] text-white font-bold py-3 px-12 rounded-lg transition duration-200 text-xl disabled:bg-slate-600 disabled:cursor-not-allowed"
                >
                    {isStartDisabled ? (isClubMode ? `선발 ${requiredCount}명 선택` : t('select_min_one_player_per_team')) : t('start_match')}
                </button>
            </div>
        </div>
    );
};

export default AttendanceScreen;
