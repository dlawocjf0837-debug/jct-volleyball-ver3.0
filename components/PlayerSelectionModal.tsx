import React, { useState, useMemo, useEffect } from 'react';
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
    // UI variant
    variant?: 'list' | 'grid';
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
    title,
    variant = 'list'
}) => {
    const { teamSets, teamSetsMap } = useData();
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');

    // ScoreboardScreen용: players prop이 있으면 사용
    // TeamManagementScreen용: selectedClass의 전체 학생 리스트 수집 (모든 TeamSet에서)
    const allPlayers = useMemo(() => {
        // ScoreboardScreen 케이스
        if (playersProp) {
            return Object.values(playersProp).filter((p): p is Player => !!p);
        }
        
        // TeamManagementScreen 케이스: selectedClass의 전체 학생 리스트 수집
        // 같은 className을 가진 모든 TeamSet에서 선수를 수집하여 전체 학생 리스트 구성
        // 이렇게 하면 제외되었던 학생(결석생)도 포함됨
        if (!className) return [];
        
        // 같은 className을 가진 모든 TeamSet에서 선수 수집
        const playersMap = new Map<string, Player>();
        teamSets.forEach(set => {
            if (set.className === className) {
                Object.values(set.players).forEach((player: Player) => {
                    // 중복 제거: 같은 id를 가진 선수는 한 번만 추가
                    // (여러 TeamSet에 같은 선수가 있을 수 있음)
                    if (player && !playersMap.has(player.id)) {
                        playersMap.set(player.id, player);
                    }
                });
            }
        });
        
        return Array.from(playersMap.values());
    }, [playersProp, teamSets, className]);

    // 이미 다른 팀에 속한 선수 찾기 (TeamManagementScreen용)
    // 같은 className을 가진 모든 TeamSet의 모든 팀에서 선수 수집
    const assignedPlayers = useMemo(() => {
        if (!className || playersProp) return new Set<string>();
        
        const assigned = new Set<string>();
        // 같은 className을 가진 모든 TeamSet에서 선수 수집
        teamSets.forEach(set => {
            if (set.className === className) {
                set.teams.forEach(team => {
                    team.playerIds.forEach(id => assigned.add(id));
                });
            }
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

    // 성별 우선순위 함수 (남 -> 여)
    const getGenderPriority = (gender: string): number => {
        const normalized = gender?.toLowerCase().trim() || '';
        if (normalized.includes('남') || normalized === 'm' || normalized === 'male') return 1;
        if (normalized.includes('여') || normalized === 'f' || normalized === 'female') return 2;
        return 3; // 기타/알 수 없음은 마지막
    };

    // 필터링된 선수 목록
    // TeamManagementScreen용: selectedClass의 전체 학생 중 '현재 편집 중인 팀'에 있는 학생만 제외
    // 제한 없는 검색: 다른 팀에 있어도 추가 가능 (중복 허용), 제외되었던 학생도 모두 표시
    const filteredPlayers = useMemo(() => {
        let filtered: Player[] = [];
        
        if (playersProp) {
            // ScoreboardScreen: 검색만 적용
            filtered = allPlayers.filter(player => {
                return player.originalName.toLowerCase().includes(searchTerm.toLowerCase());
            });
        } else {
            // TeamManagementScreen: 검색 + 현재 편집 중인 팀에 있는 학생만 제외
            // 조건: "우리 반 학생이고, 이 팀에 아직 안 들어왔다면" 무조건 추가 가능
            // - 다른 팀에 있어도 추가 가능 (중복 허용)
            // - 제외되었던 학생(결석생)도 모두 표시
            // - 이름이나 번호로 검색 가능
            filtered = allPlayers.filter(player => {
                const matchesSearch = searchTerm === '' || 
                    player.originalName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (player.studentNumber && player.studentNumber.includes(searchTerm));
                
                // 현재 편집 중인 팀에 이미 있는 학생만 제외
                const isInCurrentTeam = currentTeamPlayerIds.has(player.id);
                
                // 현재 팀에 없는 학생만 표시 (다른 팀에 있어도 표시됨)
                return matchesSearch && !isInCurrentTeam;
            });
        }
        
        // 정렬: 성별(남->여) -> 번호 오름차순
        return filtered.sort((a, b) => {
            const genderA = getGenderPriority(a.gender);
            const genderB = getGenderPriority(b.gender);
            
            if (genderA !== genderB) {
                return genderA - genderB;
            }
            
            // 같은 성별이면 번호로 정렬
            const numA = parseInt(a.studentNumber) || 999;
            const numB = parseInt(b.studentNumber) || 999;
            return numA - numB;
        });
    }, [allPlayers, searchTerm, currentTeamPlayerIds, assignedPlayers, playersProp]);

    // 선수가 어느 팀에 속해있는지 찾기 (여러 팀 가능) - TeamManagementScreen용
    // 같은 className을 가진 모든 TeamSet에서 확인
    const getPlayerTeams = (playerId: string): string[] => {
        if (playersProp || !className) return [];
        
        const teams: string[] = [];
        // 같은 className을 가진 모든 TeamSet에서 확인
        teamSets.forEach(set => {
            if (set.className === className) {
                for (const team of set.teams) {
                    if (team.playerIds.includes(playerId)) {
                        teams.push(team.teamName);
                    }
                }
            }
        });
        return teams;
    };

    // 모달 제목 결정
    const modalTitle = title || (className ? t('player_selection_modal_title', { className }) : t('who_recorded'));

    useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
            <div
                className={`bg-slate-900 rounded-lg shadow-2xl p-6 w-full max-h-[90vh] overflow-y-auto text-white border flex flex-col ${variant === 'grid' ? 'max-w-4xl' : 'max-w-2xl'}`}
                style={{ borderColor: teamColor }}
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-2xl font-bold mb-4 flex-shrink-0" style={{ color: teamColor }}>
                    {modalTitle}
                </h2>
                
                {/* 검색창: list variant일 때만 표시 */}
                {variant === 'list' && (
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
                )}

                <div className="flex-grow overflow-y-auto pr-2 -mr-2 mb-4">
                    {filteredPlayers.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">
                            {searchTerm ? t('player_selection_no_results') : t('player_selection_no_players')}
                        </div>
                    ) : variant === 'grid' ? (
                        // Grid 형태 (ScoreboardScreen용) - 성별별 색상 구분
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
                            {filteredPlayers.map(player => {
                                // 성별 판단
                                const normalizedGender = player.gender?.toLowerCase().trim() || '';
                                const isMale = normalizedGender.includes('남') || normalizedGender === 'm' || normalizedGender === 'male';
                                const isFemale = normalizedGender.includes('여') || normalizedGender === 'f' || normalizedGender === 'female';
                                
                                // 남학생 스타일
                                const maleClasses = "bg-slate-800 border-indigo-500 hover:bg-indigo-900/50 active:bg-indigo-900/70";
                                const maleTextClasses = "text-indigo-100";
                                const maleSubTextClasses = "text-indigo-300";
                                
                                // 여학생 스타일
                                const femaleClasses = "bg-slate-800 border-rose-500 hover:bg-rose-900/50 active:bg-rose-900/70";
                                const femaleTextClasses = "text-rose-100";
                                const femaleSubTextClasses = "text-rose-300";
                                
                                // 기본 스타일 (성별 불명)
                                const defaultClasses = "bg-slate-800 border-slate-700 hover:bg-slate-700 active:bg-slate-600";
                                const defaultTextClasses = "text-slate-100";
                                const defaultSubTextClasses = "text-slate-400";
                                
                                const buttonClasses = isMale ? maleClasses : isFemale ? femaleClasses : defaultClasses;
                                const textClasses = isMale ? maleTextClasses : isFemale ? femaleTextClasses : defaultTextClasses;
                                const subTextClasses = isMale ? maleSubTextClasses : isFemale ? femaleSubTextClasses : defaultSubTextClasses;
                                
                                return (
                                    <button
                                        key={player.id}
                                        onClick={() => {
                                            onSelect(player.id);
                                            onClose();
                                        }}
                                        className={`${buttonClasses} h-28 rounded-xl transition-all cursor-pointer border-2 active:scale-95 flex flex-col items-center justify-center text-center shadow-lg hover:shadow-xl`}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span className={`font-bold text-2xl ${textClasses} break-words leading-tight px-2`}>
                                                {player.originalName}
                                            </span>
                                            {(isMale || isFemale) && (
                                                <span className={`text-xs ${subTextClasses} font-semibold opacity-70`}>
                                                    {isMale ? '🔹' : '🔸'}
                                                </span>
                                            )}
                                        </div>
                                        {(player.studentNumber && player.studentNumber !== '??') || (player.class && player.class !== '??') ? (
                                            <div className="flex items-center gap-2 mt-1">
                                                {player.studentNumber && player.studentNumber !== '??' && (
                                                    <span className={`text-sm ${subTextClasses} font-medium`}>
                                                        {player.studentNumber}번
                                                    </span>
                                                )}
                                                {player.class && player.class !== '??' && (
                                                    <span className={`text-sm ${subTextClasses} font-medium`}>
                                                        {player.class}반
                                                    </span>
                                                )}
                                            </div>
                                        ) : null}
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        // List 형태 (TeamManagementScreen용)
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
