import React, { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { Player, TeamSet } from '../types';
import { useTranslation } from '../hooks/useTranslation';

interface PlayerSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (playerId: string) => void;
    // TeamManagementScreen용 props
    teamKey?: string | null;
    className?: string | null;
    // ScoreboardScreen용 props
    players?: Record<string, Player>;
    teamName?: string;
    teamColor?: string;
    title?: string;
}

const PlayerSelectionModal: React.FC<PlayerSelectionModalProps> = ({ 
    isOpen, 
    onClose, 
    onSelect,
    teamKey = null,
    className = null,
    players: playersProp,
    teamName,
    teamColor = '#00A3FF',
    title
}) => {
    const { teamSets, teamSetsMap } = useData();
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');

    // ScoreboardScreen용: players prop이 있으면 사용
    // TeamManagementScreen용: teamKey와 className으로 선수 목록 생성
    const allPlayers = useMemo(() => {
        // ScoreboardScreen 케이스
        if (playersProp) {
            return Object.values(playersProp).filter((p): p is Player => !!p);
        }
        
        // TeamManagementScreen 케이스
        if (!className) return [];
        
        const set = teamSets.find(s => s.className === className);
        if (!set) return [];
        
        return Object.values(set.players).filter((p): p is Player => !!p);
    }, [playersProp, teamSets, className]);

    // 이미 다른 팀에 속한 선수 찾기 (TeamManagementScreen용)
    const assignedPlayers = useMemo(() => {
        if (!className || playersProp) return new Set<string>();
        
        const set = teamSets.find(s => s.className === className);
        if (!set) return new Set<string>();
        
        const assigned = new Set<string>();
        set.teams.forEach(team => {
            team.playerIds.forEach(id => assigned.add(id));
        });
        return assigned;
    }, [teamSets, className, playersProp]);

    // 현재 팀의 선수 ID (제외용) - TeamManagementScreen용
    const currentTeamPlayerIds = useMemo(() => {
        if (playersProp) return new Set<string>(); // ScoreboardScreen에서는 사용 안 함
        if (!teamKey) return new Set<string>();
        const data = teamSetsMap.get(teamKey);
        if (!data) return new Set<string>();
        return new Set(data.team.playerIds);
    }, [teamKey, teamSetsMap, playersProp]);

    // 필터링된 선수 목록
    const filteredPlayers = useMemo(() => {
        if (playersProp) {
            // ScoreboardScreen: 검색만 적용
            return allPlayers.filter(player => {
                return player.originalName.toLowerCase().includes(searchTerm.toLowerCase());
            }).sort((a, b) => a.originalName.localeCompare(b.originalName));
        }
        
        // TeamManagementScreen: 검색 + 현재 팀 제외
        return allPlayers.filter(player => {
            const matchesSearch = player.originalName.toLowerCase().includes(searchTerm.toLowerCase());
            const isNotInCurrentTeam = !currentTeamPlayerIds.has(player.id);
            return matchesSearch && isNotInCurrentTeam;
        }).sort((a, b) => a.originalName.localeCompare(b.originalName));
    }, [allPlayers, searchTerm, currentTeamPlayerIds, playersProp]);

    // 선수가 어느 팀에 속해있는지 찾기 (여러 팀 가능) - TeamManagementScreen용
    const getPlayerTeams = (playerId: string): string[] => {
        if (playersProp || !className) return [];
        const set = teamSets.find(s => s.className === className);
        if (!set) return [];
        
        const teams: string[] = [];
        for (const team of set.teams) {
            if (team.playerIds.includes(playerId)) {
                teams.push(team.teamName);
            }
        }
        return teams;
    };

    // 모달 제목 결정
    const modalTitle = title || (className ? t('player_selection_modal_title', { className }) : t('who_recorded'));

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 animate-fade-in"
            onClick={onClose}
        >
            <div 
                className="bg-slate-900 rounded-lg shadow-2xl p-6 w-full max-w-2xl text-white border flex flex-col max-h-[90vh]"
                style={{ borderColor: teamColor }}
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-2xl font-bold mb-4 flex-shrink-0" style={{ color: teamColor }}>
                    {modalTitle}
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
                                // TeamManagementScreen용 로직
                                const assignedTeams = getPlayerTeams(player.id);
                                const isInCurrentTeam = currentTeamPlayerIds.has(player.id);
                                const isInOtherTeams = assignedTeams.length > 0 && !isInCurrentTeam;
                                
                                // ScoreboardScreen에서는 항상 클릭 가능
                                const isClickable = playersProp ? true : !isInCurrentTeam;
                                
                                return (
                                    <li 
                                        key={player.id} 
                                        onClick={() => {
                                            if (isClickable) {
                                                onSelect(player.id);
                                                onClose();
                                            }
                                        }}
                                        className={`flex items-center justify-between bg-slate-800 p-3 rounded-md transition-colors ${
                                            isClickable 
                                                ? 'cursor-pointer hover:bg-slate-700' 
                                                : 'opacity-50 cursor-not-allowed'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-slate-200">{player.originalName}</span>
                                            {player.class && player.class !== '??' && (
                                                <span className="text-xs text-slate-400">{player.class}반</span>
                                            )}
                                        </div>
                                        {!playersProp && (
                                            <div className="flex items-center gap-2">
                                                {isInOtherTeams && (
                                                    <span className="text-xs text-blue-400 bg-blue-900/50 px-2 py-1 rounded-md">
                                                        ({assignedTeams.join(', ')} {t('player_selection_included')})
                                                    </span>
                                                )}
                                                {isInCurrentTeam && (
                                                    <span className="text-xs text-yellow-400 bg-yellow-900/50 px-2 py-1 rounded-md">
                                                        {t('player_selection_already_in_team')}
                                                    </span>
                                                )}
                                            </div>
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
