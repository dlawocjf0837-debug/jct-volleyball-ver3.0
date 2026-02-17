
import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { Player, SavedTeamInfo, SavedOpponentTeam, Stats } from '../types';
import TeamEmblem from '../components/TeamEmblem';
import { PlayerMemoModal } from '../components/PlayerMemoModal';
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
    teamSelection: {
        teamA: string;
        teamB: string;
        teamAKey?: string;
        teamBKey?: string;
        teamBFromOpponent?: SavedOpponentTeam;
    };
    onStartMatch: (data: {
        attendingPlayers: { teamA: Record<string, Player>, teamB: Record<string, Player> },
        onCourtIds: { teamA: Set<string>, teamB: Set<string> },
        teamAInfo: SavedTeamInfo | null,
        teamBInfo: SavedTeamInfo | null,
    }) => void;
}

const AttendanceScreen: React.FC<AttendanceScreenProps> = ({ teamSelection, onStartMatch }) => {
    const { teamSetsMap } = useData();
    const { t } = useTranslation();

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
    
    const [onCourt, setOnCourt] = useState<{ teamA: Set<string>, teamB: Set<string> }>({ teamA: new Set(), teamB: new Set() });
    const [memoOverrides, setMemoOverrides] = useState<Record<string, string>>({});
    const [memoModalPlayer, setMemoModalPlayer] = useState<{ playerId: string; name: string } | null>(null);

    useEffect(() => {
        setOnCourt({
            teamA: new Set(Object.keys(teamAPlayers)),
            teamB: new Set(Object.keys(teamBPlayers))
        });
    }, [teamAPlayers, teamBPlayers]);

    const handleToggleOnCourt = (playerId: string, team: 'teamA' | 'teamB') => {
        setOnCourt(prev => {
            const newSet = new Set(prev[team]);
            if (newSet.has(playerId)) {
                newSet.delete(playerId);
            } else {
                newSet.add(playerId);
            }
            return { ...prev, [team]: newSet };
        });
    };

    const handleStart = () => {
        const mergeMemo = (players: Record<string, Player>) => {
            const out: Record<string, Player> = {};
            for (const id of Object.keys(players)) {
                const p = players[id];
                out[id] = { ...p, memo: memoOverrides[id] ?? p.memo };
            }
            return out;
        };
        onStartMatch({
            attendingPlayers: {
                teamA: mergeMemo(teamAPlayers),
                teamB: mergeMemo(teamBPlayers),
            },
            onCourtIds: onCourt,
            teamAInfo: teamAInfo,
            teamBInfo: teamBInfo,
        });
    };
    
    // FIX: Add explicit Player type to sort callback parameters to resolve them being inferred as `unknown`.
    const sortedTeamAPlayers = useMemo(() => Object.values(teamAPlayers).sort((a: Player, b: Player) => parseInt(a.studentNumber) - parseInt(b.studentNumber)), [teamAPlayers]);
    // FIX: Add explicit Player type to sort callback parameters to resolve them being inferred as `unknown`.
    const sortedTeamBPlayers = useMemo(() => Object.values(teamBPlayers).sort((a: Player, b: Player) => parseInt(a.studentNumber) - parseInt(b.studentNumber)), [teamBPlayers]);
    
    const isStartDisabled = onCourt.teamA.size < 1 || onCourt.teamB.size < 1;

    const PlayerList: React.FC<{
        players: Player[];
        onCourtSet: Set<string>;
        onToggle: (playerId: string) => void;
        onMemoClick: (playerId: string, name: string) => void;
    }> = ({ players, onCourtSet, onToggle, onMemoClick }) => (
        <div className="space-y-2">
            {players.map(player => (
                <label key={player.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-800 cursor-pointer hover:bg-slate-700 transition-colors">
                    <input
                        type="checkbox"
                        checked={onCourtSet.has(player.id)}
                        onChange={() => onToggle(player.id)}
                        className="h-6 w-6 bg-slate-700 border-slate-500 rounded text-sky-500 focus:ring-sky-500 cursor-pointer"
                    />
                    <span className="font-semibold text-slate-200 flex-1">{player.originalName}</span>
                    <button type="button" onClick={e => { e.preventDefault(); onMemoClick(player.id, player.originalName); }} className="p-1 rounded hover:bg-slate-600 text-amber-400/90 shrink-0" title="전력 분석 메모">📝</button>
                </label>
            ))}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-900/50 p-4 rounded-lg border-2 border-slate-700">
                    <div className="flex flex-col items-center text-center gap-2 mb-4">
                        {teamAInfo && <TeamEmblem emblem={teamAInfo.emblem} color={teamAInfo.color || '#3b82f6'} className="w-16 h-16" />}
                        <h3 className="text-2xl font-bold" style={{ color: teamAInfo?.color || '#3b82f6' }}>{teamAInfo?.teamName || 'Team A'} ({onCourt.teamA.size}{t('attendance_count_suffix')})</h3>
                    </div>
                    <PlayerList players={sortedTeamAPlayers} onCourtSet={onCourt.teamA} onToggle={(id) => handleToggleOnCourt(id, 'teamA')} onMemoClick={(id, name) => setMemoModalPlayer({ playerId: id, name })} />
                </div>
                <div className="bg-slate-900/50 p-4 rounded-lg border-2 border-slate-700">
                    <div className="flex flex-col items-center text-center gap-2 mb-4">
                        {teamBInfo && <TeamEmblem emblem={teamBInfo.emblem} color={teamBInfo.color || '#ef4444'} className="w-16 h-16" />}
                        <h3 className="text-2xl font-bold" style={{ color: teamBInfo?.color || '#ef4444' }}>{teamBInfo?.teamName || 'Team B'} ({onCourt.teamB.size}{t('attendance_count_suffix')})</h3>
                    </div>
                    <PlayerList players={sortedTeamBPlayers} onCourtSet={onCourt.teamB} onToggle={(id) => handleToggleOnCourt(id, 'teamB')} onMemoClick={(id, name) => setMemoModalPlayer({ playerId: id, name })} />
                </div>
            </div>
            {memoModalPlayer && (
                <PlayerMemoModal
                    isOpen={!!memoModalPlayer}
                    onClose={() => setMemoModalPlayer(null)}
                    playerName={memoModalPlayer.name}
                    initialMemo={memoOverrides[memoModalPlayer.playerId] ?? (teamAPlayers[memoModalPlayer.playerId] || teamBPlayers[memoModalPlayer.playerId])?.memo ?? ''}
                    onSave={text => { setMemoOverrides(prev => ({ ...prev, [memoModalPlayer.playerId]: text })); setMemoModalPlayer(null); }}
                />
            )}
            <div className="flex justify-center pt-6">
                <button
                    onClick={handleStart}
                    disabled={isStartDisabled}
                    className="bg-[#00A3FF] hover:bg-[#0082cc] text-white font-bold py-3 px-12 rounded-lg transition duration-200 text-xl disabled:bg-slate-600 disabled:cursor-not-allowed"
                >
                    {isStartDisabled ? t('select_min_one_player_per_team') : t('start_match')}
                </button>
            </div>
        </div>
    );
};

export default AttendanceScreen;
