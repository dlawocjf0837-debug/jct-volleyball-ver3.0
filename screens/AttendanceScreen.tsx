
import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { Player, SavedTeamInfo } from '../types';
import TeamEmblem from '../components/TeamEmblem';
import { useTranslation } from '../hooks/useTranslation';

interface AttendanceScreenProps {
    teamSelection: {
        teamA: string;
        teamB: string;
        teamAKey?: string;
        teamBKey?: string;
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
        
        if (teamSelection.teamBKey) {
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
        onStartMatch({
            attendingPlayers: {
                teamA: teamAPlayers,
                teamB: teamBPlayers,
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
    }> = ({ players, onCourtSet, onToggle }) => (
        <div className="space-y-2">
            {players.map(player => (
                <label key={player.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-800 cursor-pointer hover:bg-slate-700 transition-colors">
                    <input
                        type="checkbox"
                        checked={onCourtSet.has(player.id)}
                        onChange={() => onToggle(player.id)}
                        className="h-6 w-6 bg-slate-700 border-slate-500 rounded text-sky-500 focus:ring-sky-500 cursor-pointer"
                    />
                    <span className="font-semibold text-slate-200">{player.originalName}</span>
                </label>
            ))}
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto bg-slate-900/50 backdrop-blur-sm border border-slate-700 p-6 rounded-lg shadow-2xl space-y-6 animate-fade-in">
            <div className="text-center">
                <h2 className="text-3xl font-bold text-[#00A3FF]">{t('attendance_select_players_title')}</h2>
                <p className="text-slate-400 mt-1">{t('attendance_desc')}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-900/50 p-4 rounded-lg border-2 border-slate-700">
                    <div className="flex flex-col items-center text-center gap-2 mb-4">
                        {teamAInfo && <TeamEmblem emblem={teamAInfo.emblem} color={teamAInfo.color || '#3b82f6'} className="w-16 h-16" />}
                        <h3 className="text-2xl font-bold" style={{ color: teamAInfo?.color || '#3b82f6' }}>{teamAInfo?.teamName || 'Team A'} ({onCourt.teamA.size}{t('attendance_count_suffix')})</h3>
                    </div>
                    <PlayerList players={sortedTeamAPlayers} onCourtSet={onCourt.teamA} onToggle={(id) => handleToggleOnCourt(id, 'teamA')} />
                </div>
                <div className="bg-slate-900/50 p-4 rounded-lg border-2 border-slate-700">
                    <div className="flex flex-col items-center text-center gap-2 mb-4">
                        {teamBInfo && <TeamEmblem emblem={teamBInfo.emblem} color={teamBInfo.color || '#ef4444'} className="w-16 h-16" />}
                        <h3 className="text-2xl font-bold" style={{ color: teamBInfo?.color || '#ef4444' }}>{teamBInfo?.teamName || 'Team B'} ({onCourt.teamB.size}{t('attendance_count_suffix')})</h3>
                    </div>
                    <PlayerList players={sortedTeamBPlayers} onCourtSet={onCourt.teamB} onToggle={(id) => handleToggleOnCourt(id, 'teamB')} />
                </div>
            </div>
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
