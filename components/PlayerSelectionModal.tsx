import React, { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { Player, TeamSet } from '../types';
import { useTranslation } from '../hooks/useTranslation';

interface PlayerSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    teamKey: string | null;
    className: string | null;
    onSelect: (playerId: string) => void;
}

const PlayerSelectionModal: React.FC<PlayerSelectionModalProps> = ({ isOpen, onClose, teamKey, className, onSelect }) => {
    const { teamSets, teamSetsMap } = useData();
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');

    // 현재 반의 모든 선수 가져오기
    const allPlayers = useMemo(() => {
        if (!className) return [];
        
        const set = teamSets.find(s => s.className === className);
        if (!set) return [];
        
        return Object.values(set.players).filter((p): p is Player => !!p);
    }, [teamSets, className]);

    // 이미 다른 팀에 속한 선수 찾기
    const assignedPlayers = useMemo(() => {
        if (!className) return new Set<string>();
        
        const set = teamSets.find(s => s.className === className);
        if (!set) return new Set<string>();
        
        const assigned = new Set<string>();
        set.teams.forEach(team => {
            team.playerIds.forEach(id => assigned.add(id));
        });
        return assigned;
    }, [teamSets, className]);

    // 현재 팀의 선수 ID (제외용)
    const currentTeamPlayerIds = useMemo(() => {
        if (!teamKey) return new Set<string>();
        const data = teamSetsMap.get(teamKey);
        if (!data) return new Set<string>();
        return new Set(data.team.playerIds);
    }, [teamKey, teamSetsMap]);

    // 필터링된 선수 목록
    const filteredPlayers = useMemo(() => {
        return allPlayers.filter(player => {
            const matchesSearch = player.originalName.toLowerCase().includes(searchTerm.toLowerCase());
            const isNotInCurrentTeam = !currentTeamPlayerIds.has(player.id);
            return matchesSearch && isNotInCurrentTeam;
        }).sort((a, b) => a.originalName.localeCompare(b.originalName));
    }, [allPlayers, searchTerm, currentTeamPlayerIds]);

    // 선수가 어느 팀에 속해있는지 찾기
    const getPlayerTeam = (playerId: string): string | null => {
        if (!className) return null;
        const set = teamSets.find(s => s.className === className);
        if (!set) return null;
        
        for (const team of set.teams) {
            if (team.playerIds.includes(playerId)) {
                return team.teamName;
            }
        }
        return null;
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 animate-fade-in"
            onClick={onClose}
        >
            <div 
                className="bg-slate-900 rounded-lg shadow-2xl p-6 w-full max-w-2xl text-white border border-sky-500 flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-2xl font-bold text-sky-400 mb-4 flex-shrink-0">
                    {t('player_selection_modal_title', { className: className || '' })}
                </h2>
                
                <div className="mb-4 flex-shrink-0">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={t('player_selection_search_placeholder')}
                        className="w-full bg-slate-800 border border-slate-600 rounded-md p-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                        autoFocus
                    />
                </div>

                <div className="flex-grow overflow-y-auto pr-2 -mr-2 mb-4">
                    {filteredPlayers.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">
                            {searchTerm ? t('player_selection_no_results') : t('player_selection_no_players')}
                        </div>
                    ) : (
                        <ul className="space-y-2">
                            {filteredPlayers.map(player => {
                                const assignedTeam = getPlayerTeam(player.id);
                                const isAssigned = assignedTeam !== null;
                                
                                return (
                                    <li 
                                        key={player.id} 
                                        onClick={() => {
                                            if (!isAssigned) {
                                                onSelect(player.id);
                                                onClose();
                                            }
                                        }}
                                        className={`flex items-center justify-between bg-slate-800 p-3 rounded-md transition-colors ${
                                            isAssigned 
                                                ? 'opacity-50 cursor-not-allowed' 
                                                : 'cursor-pointer hover:bg-slate-700'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-slate-200">{player.originalName}</span>
                                            {player.class && player.class !== '??' && (
                                                <span className="text-xs text-slate-400">{player.class}반</span>
                                            )}
                                        </div>
                                        {isAssigned && (
                                            <span className="text-xs text-yellow-400 bg-yellow-900/50 px-2 py-1 rounded-md">
                                                {assignedTeam} {t('player_selection_assigned')}
                                            </span>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                <div className="text-center mt-6 flex-shrink-0">
                    <button onClick={onClose} className="bg-slate-600 hover:bg-slate-500 font-bold py-2 px-6 rounded-lg">
                        {t('close')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PlayerSelectionModal;
