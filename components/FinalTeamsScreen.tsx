
import React, { useState, useCallback, useMemo } from 'react';
import { Player, Team, TeamSet, TeamId, SavedTeamInfo } from '../types';
import { useData } from '../contexts/DataContext';
import { CrownIcon } from './icons';
import TeamEmblem from './TeamEmblem';
import { useTranslation } from '../hooks/useTranslation';

interface FinalTeamsScreenProps {
    teams: Team[];
    players: Record<string, Player>;
    onReset: () => void;
    selectedClass: string;
}

const FinalTeamsScreen: React.FC<FinalTeamsScreenProps> = ({ teams, players, onReset, selectedClass }) => {
    const { teamSets, saveTeamSets, showToast } = useData();
    const { t } = useTranslation();
    const [editableTeams, setEditableTeams] = useState<Team[]>(() => JSON.parse(JSON.stringify(teams)));
    const [isOver, setIsOver] = useState<TeamId | null>(null);
    const [isSaving, setIsSaving] = useState(false);


    const handleDragStart = (e: React.DragEvent<HTMLLIElement>, playerId: string) => {
        if (!players[playerId] || players[playerId].isCaptain) {
            e.preventDefault();
            return;
        }
        e.dataTransfer.setData('playerId', playerId);
        e.currentTarget.style.opacity = '0.4';
    };

    const handleDragEnd = (e: React.DragEvent<HTMLLIElement>) => {
        e.currentTarget.style.opacity = '1';
    };
    
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };
    
    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, teamId: TeamId) => {
        e.preventDefault();
        setIsOver(teamId);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsOver(null);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetTeamId: TeamId) => {
        e.preventDefault();
        setIsOver(null);
        const playerId = e.dataTransfer.getData('playerId');
        if (!playerId) return;

        const playerToMove = players[playerId];
        if (playerToMove?.isCaptain) {
            showToast(t('toast_captain_cannot_move'), 'error');
            return;
        }

        let sourceTeamId: TeamId | null = null;
        for (const team of editableTeams) {
            if (team.playerIds.includes(playerId)) {
                sourceTeamId = team.id;
                break;
            }
        }

        if (sourceTeamId && sourceTeamId !== targetTeamId) {
            setEditableTeams(currentTeams => {
                const sourceTeam = currentTeams.find(t => t.id === sourceTeamId);
                const targetTeam = currentTeams.find(t => t.id === targetTeamId);
                if (!sourceTeam || !targetTeam) return currentTeams;

                const newSourcePlayerIds = sourceTeam.playerIds.filter(id => id !== playerId);
                const newTargetPlayerIds = [...targetTeam.playerIds, playerId];
                
                return currentTeams.map(t => {
                    if (t.id === sourceTeamId) return { ...t, playerIds: newSourcePlayerIds };
                    if (t.id === targetTeamId) return { ...t, playerIds: newTargetPlayerIds };
                    return t;
                });
            });
        }
    };
    
    const handleResetChanges = () => {
        setEditableTeams(JSON.parse(JSON.stringify(teams)));
    }


    const handleSaveData = async () => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            // 모든 선수를 TeamSet.players에 포함 (제외된 선수 포함)
            // 이렇게 하면 나중에 팀 관리 화면에서 제외되었던 선수도 추가할 수 있음
            const playersInSet: Record<string, Player> = { ...players };

            // Format current date as YYYY. MM. DD
            const today = new Date();
            const dateString = `${today.getFullYear()}. ${(today.getMonth() + 1).toString().padStart(2, '0')}. ${today.getDate().toString().padStart(2, '0')}`;

            const newTeamSet: TeamSet = {
                id: `set_${Date.now()}`,
                className: selectedClass === 'all' ? t('all') : t('class_format', { class: selectedClass }),
                savedAt: new Date().toISOString(),
                teams: editableTeams.map(team => ({
                    teamName: team.name,
                    captainId: team.captainId,
                    playerIds: team.playerIds,
                    color: team.color,
                    emblem: team.emblem,
                    slogan: undefined, 
                    cheerUrl: undefined,
                    cheerUrl2: undefined,
                    cheerName2: undefined,
                    memo: dateString,
                })),
                players: playersInSet,
                teamCount: editableTeams.length,
            };

            await saveTeamSets([newTeamSet, ...teamSets], t('toast_team_composition_saved'));
            onReset();
        } catch (error) {
            console.error("Error saving team sets:", error);
            showToast(t('toast_team_save_failed'), 'error');
            setIsSaving(false);
        }
    };

    const teamAverages = useMemo(() => {
        const averages: Record<TeamId, { total: number }> = {};
        editableTeams.forEach(team => {
            if (team.playerIds.length === 0) {
                averages[team.id] = { total: 0 };
                return;
            }
            const totalScore = team.playerIds.reduce((sum, id) => sum + (players[id]?.totalScore || 0), 0);
            averages[team.id] = { total: totalScore / team.playerIds.length };
        });
        return averages;
    }, [editableTeams, players]);

    return (
        <div className="space-y-6">
            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-700 p-6 rounded-lg shadow-lg text-center space-y-4">
                <h2 className="text-3xl font-bold text-[#00A3FF]">{t('final_teams_title')}</h2>
                <p className="text-slate-400">
                    {t('final_teams_desc').split('<br />')[0]}
                    <br />
                    {t('final_teams_desc').split('<br />')[1]}
                </p>
                 <div className="flex justify-center items-center gap-4 pt-4">
                    <button onClick={handleResetChanges} className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-3 px-6 rounded-lg transition duration-200 text-lg">
                        {t('reset_changes')}
                    </button>
                    <button onClick={handleSaveData} disabled={isSaving} className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-lg transition duration-200 text-lg disabled:bg-slate-600 disabled:cursor-not-allowed">
                        {isSaving ? t('saving') : t('save_team_composition')}
                    </button>
                    <button onClick={onReset} className="bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-6 rounded-lg transition duration-200 text-lg">
                        {t('reset')}
                    </button>
                </div>
            </div>

            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${teams.length} gap-6`}>
                {editableTeams.map(team => (
                    <div 
                        key={team.id}
                        onDragOver={handleDragOver}
                        onDragEnter={(e) => handleDragEnter(e, team.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, team.id)}
                        className={`bg-slate-900/50 p-4 rounded-xl border-2 border-dashed ${isOver === team.id ? 'border-sky-400' : ''} transition-all min-h-[200px]`}
                        style={{ borderColor: isOver === team.id ? '#38bdf8' : team.color }}
                    >
                        <div className="flex flex-col items-center gap-2 mb-4">
                            <TeamEmblem emblem={team.emblem} color={team.color} className="w-12 h-12" />
                            <h3 className="text-2xl font-bold text-center" style={{color: team.color}}>{team.name}</h3>
                             <span className="text-base font-bold text-sky-400 bg-slate-800 px-2 py-1 rounded-md" title={t('team_avg_score_title')}>
                                AVG {teamAverages[team.id]?.total.toFixed(1)}
                            </span>
                        </div>
                        <ul className="space-y-2">
                            {team.playerIds.map(id => players[id]).filter(Boolean).sort((a,b) => Number(b.isCaptain) - Number(a.isCaptain)).map(player => (
                                <li
                                    key={player.id}
                                    draggable={!player.isCaptain}
                                    onDragStart={(e) => handleDragStart(e, player.id)}
                                    onDragEnd={handleDragEnd}
                                    className={`flex items-center gap-2 p-2 rounded-md bg-slate-800 ${player.isCaptain ? 'cursor-not-allowed' : 'cursor-grab'}`}
                                >
                                    {player.isCaptain && <CrownIcon className="w-5 h-5 text-yellow-400 flex-shrink-0" />}
                                    <span className="font-semibold text-slate-200">{player.originalName}</span>
                                    <span className="text-xs font-mono bg-slate-700 text-[#99dfff] px-2 py-0.5 rounded-full ml-auto">{player.totalScore.toFixed(1)}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default FinalTeamsScreen;
