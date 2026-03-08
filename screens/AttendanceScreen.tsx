import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { Player, SavedTeamInfo, SavedOpponentTeam, Stats, MatchRoles } from '../types';
import TeamEmblem from '../components/TeamEmblem';
import { PlayerMemoModal } from '../components/PlayerMemoModal';
import { RolePlayerPickerModal } from '../components/RolePlayerPickerModal';
import { useTranslation } from '../hooks/useTranslation';

const defaultStats: Stats = { height: 0, shuttleRun: 0, flexibility: 0, fiftyMeterDash: 0, underhand: 0, serve: 0 };

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
    const { teamSetsMap, updatePlayerMemoInTeamSet, showToast, settings } = useData();
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
    const [memoModalPlayer, setMemoModalPlayer] = useState<{ playerId: string; name: string; side: 'teamA' | 'teamB' } | null>(null);
    const [matchRoles, setMatchRoles] = useState<MatchRoles>(() => teamSelection.matchRoles ?? { announcers: [], referees: [], lineJudges: [], cameraDirectors: [], recorders: [] });
    const [rolePickerTarget, setRolePickerTarget] = useState<'announcer' | 'referee' | 'lineJudge' | 'cameraDirector' | 'recorder' | null>(null);

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

    const handleStart = () => {
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
    const showServeOrder = appMode === 'CLUB';
    const playerById = useMemo(() => ({ ...teamAPlayers, ...teamBPlayers }), [teamAPlayers, teamBPlayers]);
    const CourtOrderList: React.FC<{
        orderedIds: string[];
        team: 'teamA' | 'teamB';
        allPlayers: Player[];
        onToggle: (playerId: string) => void;
        onMemoClick: (playerId: string, name: string) => void;
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
                            <button type="button" onClick={e => { e.preventDefault(); onMemoClick(id, player.originalName); }} className="p-1 rounded hover:bg-slate-600/50 text-amber-400/90 text-sm" title="전력 분석 메모">📝</button>
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
                    💡 서브 순서대로 선수를 터치하여 선발 명단을 구성해주세요.
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
                    </div>
                    <CourtOrderList orderedIds={onCourtOrdered.teamA} team="teamA" allPlayers={sortedTeamAPlayers} onToggle={(id) => handleToggleOnCourt(id, 'teamA')} onMemoClick={(id, name) => setMemoModalPlayer({ playerId: id, name, side: 'teamA' })} showMemoButton={showPlayerMemo} showServeOrder={showServeOrder} teamColor={teamAInfo?.color || '#3b82f6'} showLiberoCheckbox={liberoEnabled} liberoChecked={liberoByPlayerId} onLiberoToggle={handleLiberoToggle} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragEnd={handleDragEnd} onDrop={handleDrop} />
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
                    </div>
                    <CourtOrderList orderedIds={onCourtOrdered.teamB} team="teamB" allPlayers={sortedTeamBPlayers} onToggle={(id) => handleToggleOnCourt(id, 'teamB')} onMemoClick={(id, name) => setMemoModalPlayer({ playerId: id, name, side: 'teamB' })} showMemoButton={showPlayerMemo} showServeOrder={showServeOrder} teamColor={teamBInfo?.color || '#ef4444'} showLiberoCheckbox={liberoEnabled} liberoChecked={liberoByPlayerId} onLiberoToggle={handleLiberoToggle} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragEnd={handleDragEnd} onDrop={handleDrop} />
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

            {memoModalPlayer && (
                <PlayerMemoModal
                    isOpen={!!memoModalPlayer}
                    onClose={() => setMemoModalPlayer(null)}
                    playerName={memoModalPlayer.name}
                    initialMemo={memoOverrides[memoModalPlayer.playerId] ?? (teamAPlayers[memoModalPlayer.playerId] || teamBPlayers[memoModalPlayer.playerId])?.memo ?? ''}
                    onSave={async (text) => {
                        const key = memoModalPlayer.side === 'teamA' ? teamSelection.teamAKey : teamSelection.teamBKey;
                        const setId = key?.split('___')[0];
                        if (setId && updatePlayerMemoInTeamSet) {
                            await updatePlayerMemoInTeamSet(setId, memoModalPlayer.playerId, text);
                            showToast?.('메모가 성공적으로 저장되었습니다.', 'success');
                        }
                        setMemoOverrides(prev => ({ ...prev, [memoModalPlayer.playerId]: text }));
                        setMemoModalPlayer(null);
                    }}
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
