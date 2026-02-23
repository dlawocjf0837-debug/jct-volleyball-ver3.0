import React, { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { SavedTeamInfo, Player, TeamSet } from '../types';
import EmblemModal from '../components/EmblemModal';
import TeamEmblem from '../components/TeamEmblem';
import { TeamProfileCardModal } from '../components/TeamProfileCardModal';
import { IdentificationIcon, PencilIcon, TrashIcon, UsersIcon } from '../components/icons';
import ConfirmationModal from '../components/common/ConfirmationModal';
import RosterManagementModal from '../components/RosterManagementModal';
import PlayerSelectionModal from '../components/PlayerSelectionModal';
import { useTranslation } from '../hooks/useTranslation';

interface TeamWithSetId extends SavedTeamInfo {
    setId: string;
    key: string; // "setId___teamName"
}

type Config = SavedTeamInfo & { key: string };

const TEAM_COLORS_PALETTE = ['#3b82f6', '#ef4444', '#22c55e', '#eab308', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b', '#f472b6', '#06b6d4', '#f59e0b'];

const convertGithubUrl = (url: string | undefined): string | undefined => {
    if (!url) return undefined;
    if (url.includes('cdn.jsdelivr.net/gh/')) return url;

    const rawPattern = /https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)/;
    let match = url.match(rawPattern);
    if (match) {
        const [, user, repo, branch, path] = match;
        return `https://cdn.jsdelivr.net/gh/${user}/${repo}@${branch}/${path}`;
    }

    const blobPattern = /https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)/;
    match = url.match(blobPattern);
    if (match) {
        const [, user, repo, branch, path] = match;
        return `https://cdn.jsdelivr.net/gh/${user}/${repo}@${branch}/${path}`;
    }
    
    const rawRedirectPattern = /https:\/\/github\.com\/([^/]+)\/([^/]+)\/raw\/(.+)/;
    match = url.match(rawRedirectPattern);
    if (match) {
        const [, user, repo, fullPath] = match;
        const parts = fullPath.split('/');
        let branch = '';
        let path = '';
        if (parts.length >= 3 && parts[0] === 'refs' && parts[1] === 'heads') {
            branch = parts[2];
            path = parts.slice(3).join('/');
        } else {
            branch = parts[0];
            path = parts.slice(1).join('/');
        }
        if (branch) return `https://cdn.jsdelivr.net/gh/${user}/${repo}@${branch}/${path}`;
    }

    return url;
};

interface TeamManagementScreenProps {
    appMode?: 'CLASS' | 'CLUB';
}

const TeamManagementScreen: React.FC<TeamManagementScreenProps> = ({ appMode = 'CLASS' }) => {
    const { teamSets, saveTeamSets, deleteTeam, createTeamSet, addTeamToSet, copyTeamFromOtherSet, teamSetsMap, removePlayerFromTeam, addPlayerToTeam, setTeamCaptain } = useData();
    const isClub = appMode === 'CLUB';
    const { t } = useTranslation();
    const [configs, setConfigs] = useState<Record<string, Config>>({});
    const [isEmblemModalOpen, setIsEmblemModalOpen] = useState(false);
    const [currentTargetTeamKey, setCurrentTargetTeamKey] = useState<string | null>(null);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [viewingProfileTeam, setViewingProfileTeam] = useState<{ team: SavedTeamInfo, players: Player[] } | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [teamToDeleteKey, setTeamToDeleteKey] = useState<string | null>(null);
    const [isRosterModalOpen, setIsRosterModalOpen] = useState(false);
    const [managingRosterTeamKey, setManagingRosterTeamKey] = useState<string | null>(null);

    // New states for modals
    const [isNewSetModalOpen, setIsNewSetModalOpen] = useState(false);
    const [newSetName, setNewSetName] = useState('');
    const [isNewTeamModalOpen, setIsNewTeamModalOpen] = useState(false);
    const [newTeamName, setNewTeamName] = useState('');
    const [targetSetId, setTargetSetId] = useState<string | null>(null);

    // Filter states
    const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
    const [selectedFormatFilter, setSelectedFormatFilter] = useState<string>('all');

    // Trade mode states
    const [isTradeMode, setIsTradeMode] = useState(false);
    const [tradeSource, setTradeSource] = useState<{ player: Player; teamKey: string } | null>(null);

    // Player selection modal states
    const [isPlayerSelectionModalOpen, setIsPlayerSelectionModalOpen] = useState(false);
    const [selectingForTeamKey, setSelectingForTeamKey] = useState<string | null>(null);
    const [isLoadTeamModalOpen, setIsLoadTeamModalOpen] = useState(false);
    const [loadTeamTargetSetId, setLoadTeamTargetSetId] = useState<string | null>(null);

    React.useEffect(() => {
        const initialConfigs: Record<string, Config> = {};
        teamSets.forEach(set => {
            set.teams.forEach(team => {
                const key = `${set.id}___${team.teamName}`;
                const memo = team.memo || new Date(set.savedAt).toLocaleDateString();
                initialConfigs[key] = { ...team, key, memo };
            });
        });
        setConfigs(initialConfigs);
    }, [teamSets]);

    // 사용 가능한 반 목록 추출
    const availableClasses = useMemo(() => {
        const classSet = new Set<string>();
        teamSets.forEach(set => {
            if (set.className) {
                classSet.add(set.className);
            }
        });
        return Array.from(classSet).sort();
    }, [teamSets]);

    // 선택된 반에 해당하는 팀 세트만 필터링
    const filteredTeamSets = useMemo(() => {
        if (selectedClassFilter === 'all') {
            return teamSets;
        }
        return teamSets.filter(set => set.className === selectedClassFilter);
    }, [teamSets, selectedClassFilter]);

    // 선택된 반의 사용 가능한 포맷 목록 추출 (2팀제, 3팀제, 4팀제 항상 포함)
    const availableFormats = useMemo(() => {
        const formatSet = new Set<number>([2, 3, 4]);
        filteredTeamSets.forEach(set => {
            formatSet.add(set.teamCount ?? 4);
        });
        return Array.from(formatSet).sort((a, b) => a - b);
    }, [filteredTeamSets]);

    const groupedTeams = useMemo(() => {
        // AND 조건 필터링: 선택된 반 && 선택된 팀 수
        let filteredSets = [...filteredTeamSets];
        
        // 포맷 필터 적용 (AND 조건)
        if (selectedFormatFilter !== 'all') {
            filteredSets = filteredSets.filter(set => {
                const teamCount = set.teamCount ?? 4; // Legacy sets are 4 teams
                return String(teamCount) === selectedFormatFilter;
            });
        }
        
        const sortedSets = filteredSets.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
        return sortedSets.map(set => {
            const teamsInSet = set.teams.map(team => ({
                ...team,
                setId: set.id,
                key: `${set.id}___${team.teamName}`
            })).sort((a, b) => a.teamName.localeCompare(b.teamName));
            return { set, teams: teamsInSet };
        });
    }, [filteredTeamSets, selectedFormatFilter]);


    const colorConflicts = useMemo(() => {
        const conflicts = new Map<string, string[]>();
        const colorMap = new Map<string, string[]>();
        groupedTeams.forEach(({ teams }) => {
            teams.forEach(team => {
                const color = configs[team.key]?.color;
                if (color) {
                    if (!colorMap.has(color)) colorMap.set(color, []);
                    colorMap.get(color)?.push(team.teamName);
                }
            });
        });
        colorMap.forEach((teams, color) => {
            if (teams.length > 1) {
                teams.forEach(teamName => conflicts.set(teamName, teams.filter(t => t !== teamName)));
            }
        });
        return conflicts;
    }, [configs, groupedTeams]);

    const handleConfigChange = (key: string, field: keyof SavedTeamInfo, value: any) => {
        setConfigs(prev => ({
            ...prev,
            [key]: { ...(prev[key] || {} as Config), [field]: value }
        }));
    };

    const handleSave = async () => {
        try {
            const updatedTeamSets = teamSets.map(set => {
                const updatedTeams = set.teams.map(team => {
                    const key = `${set.id}___${team.teamName}`;
                    if (configs[key]) {
                        const { key: _key, ...configToSave } = configs[key];
                        configToSave.cheerUrl = convertGithubUrl(configToSave.cheerUrl);
                        configToSave.cheerUrl2 = convertGithubUrl(configToSave.cheerUrl2);
                        return configToSave;
                    }
                    return team;
                });
                return { ...set, teams: updatedTeams };
            });
            await saveTeamSets(updatedTeamSets, t('toast_all_changes_saved'));
        } catch (error) {
            // Error toast is shown in saveTeamSets
        }
    };

    const handleEmblemSelect = (emblem: string) => {
        if (currentTargetTeamKey) {
            handleConfigChange(currentTargetTeamKey, 'emblem', emblem);
        }
        setIsEmblemModalOpen(false);
        setCurrentTargetTeamKey(null);
    };

    const handleViewProfile = (teamKey: string) => {
        const config = configs[teamKey];
        const [setId] = teamKey.split('___');
        const set = teamSets.find(s => s.id === setId);
        if (config && set) {
            const players = config.playerIds.map(id => set.players[id]).filter(Boolean);
            setViewingProfileTeam({ team: config, players });
            setIsProfileModalOpen(true);
        }
    };

    const handleDeleteClick = (key: string) => {
        setTeamToDeleteKey(key);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (teamToDeleteKey) {
            await deleteTeam(teamToDeleteKey);
            setTeamToDeleteKey(null);
            setIsDeleteModalOpen(false);
        }
    };
    
    const handleOpenRosterModal = (key: string) => {
        setManagingRosterTeamKey(key);
        setIsRosterModalOpen(true);
    };

    const handleCreateNewSet = async () => {
        if (newSetName.trim()) {
            await createTeamSet(newSetName);
            setNewSetName('');
            setIsNewSetModalOpen(false);
        }
    };
    
    const handleAddNewTeam = async () => {
        if (newTeamName.trim() && targetSetId) {
            const finalTeamName = newTeamName.trim() + t('roster_team_suffix');
            await addTeamToSet(targetSetId, finalTeamName, { createDefaultPlayers: isClub });
            setNewTeamName('');
            setTargetSetId(null);
            setIsNewTeamModalOpen(false);
        }
    };

    // 트레이드 실행 함수: 불필요한 깊은 복사 제거, 필요한 부분만 수정
    const executeTrade = async (source: { player: Player; teamKey: string }, target: { player: Player; teamKey: string }) => {
        try {
            // 전체 깊은 복사 대신, 변경되는 팀만 얕은 복사로 최적화
            const newTeamSets = teamSets.map(set => {
                const [sourceSetId] = source.teamKey.split('___');
                const [targetSetId] = target.teamKey.split('___');
                
                // 변경이 필요한 세트만 복사
                if (set.id === sourceSetId || set.id === targetSetId) {
                    return {
                        ...set,
                        teams: set.teams.map(team => {
                            const teamKey = `${set.id}___${team.teamName}`;
                            if (teamKey === source.teamKey || teamKey === target.teamKey) {
                                return { ...team };
                            }
                            return team;
                        })
                    };
                }
                return set; // 변경 불필요한 세트는 그대로 반환
            });
            
            // 소스 팀 찾기
            const [sourceSetId, sourceTeamName] = source.teamKey.split('___');
            const sourceSetIndex = newTeamSets.findIndex((s: TeamSet) => s.id === sourceSetId);
            const sourceTeamIndex = newTeamSets[sourceSetIndex]?.teams.findIndex((t: SavedTeamInfo) => t.teamName === sourceTeamName);
            
            // 타겟 팀 찾기
            const [targetSetId, targetTeamName] = target.teamKey.split('___');
            const targetSetIndex = newTeamSets.findIndex((s: TeamSet) => s.id === targetSetId);
            const targetTeamIndex = newTeamSets[targetSetIndex]?.teams.findIndex((t: SavedTeamInfo) => t.teamName === targetTeamName);
            
            if (sourceSetIndex === -1 || sourceTeamIndex === -1 || targetSetIndex === -1 || targetTeamIndex === -1) {
                throw new Error('팀을 찾을 수 없습니다.');
            }
            
            const sourceTeam = newTeamSets[sourceSetIndex].teams[sourceTeamIndex];
            const targetTeam = newTeamSets[targetSetIndex].teams[targetTeamIndex];
            
            // 선수 교체 (배열 복사 후 수정)
            sourceTeam.playerIds = sourceTeam.playerIds.filter((id: string) => id !== source.player.id);
            targetTeam.playerIds = targetTeam.playerIds.filter((id: string) => id !== target.player.id);
            
            sourceTeam.playerIds.push(target.player.id);
            targetTeam.playerIds.push(source.player.id);
            
            // 주장 처리 (주장이 교체되면 첫 번째 선수를 주장으로)
            if (sourceTeam.captainId === source.player.id) {
                sourceTeam.captainId = targetTeam.playerIds[0] || source.player.id;
            }
            if (targetTeam.captainId === target.player.id) {
                targetTeam.captainId = sourceTeam.playerIds[0] || target.player.id;
            }
            
            await saveTeamSets(newTeamSets, `'${source.player.originalName}'과 '${target.player.originalName}'이 교체되었습니다.`);
            setTradeSource(null);
        } catch (error: any) {
            console.error("Trade failed:", error);
            alert(`교체 중 오류 발생: ${error.message}`);
        }
    };

    // 선수 클릭 핸들러 (트레이드 모드)
    const handlePlayerClick = (player: Player, teamKey: string) => {
        if (!isTradeMode) return;
        
        if (!tradeSource) {
            // 첫 번째 선수 선택
            setTradeSource({ player, teamKey });
        } else {
            // 두 번째 선수 선택 -> 교체 실행
            if (tradeSource.player.id === player.id && tradeSource.teamKey === teamKey) {
                // 같은 선수를 다시 클릭하면 취소
                setTradeSource(null);
                return;
            }
            
            executeTrade(tradeSource, { player, teamKey });
        }
    };

    // 명단에서 추가 모달 열기
    const handleOpenPlayerSelection = (teamKey: string) => {
        setSelectingForTeamKey(teamKey);
        setIsPlayerSelectionModalOpen(true);
    };

    // 명단에서 선수 선택 (중복 등록 허용)
    const handleSelectPlayer = async (playerId: string) => {
        if (!selectingForTeamKey) return;
        
        const [setId] = selectingForTeamKey.split('___');
        const set = teamSets.find(s => s.id === setId);
        if (!set) return;
        
        const player = set.players[playerId];
        if (!player) return;
        
        // 타겟 팀 찾기
        const targetTeam = set.teams.find(t => `${setId}___${t.teamName}` === selectingForTeamKey);
        if (!targetTeam) return;
        
        // 이미 해당 팀에 있으면 추가하지 않음
        if (targetTeam.playerIds.includes(playerId)) {
            return;
        }
        
        // 중복 등록 허용: 다른 팀에서 제거하지 않고 그대로 추가
        const newTeamSets = JSON.parse(JSON.stringify(teamSets));
        const setIndex = newTeamSets.findIndex((s: TeamSet) => s.id === setId);
        const teamIndex = newTeamSets[setIndex].teams.findIndex((t: SavedTeamInfo) => t.teamName === targetTeam.teamName);
        
        if (setIndex !== -1 && teamIndex !== -1) {
            newTeamSets[setIndex].teams[teamIndex].playerIds.push(playerId);
            
            // 다른 팀에도 속해있는지 확인하여 메시지 생성
            const otherTeams: string[] = [];
            for (const team of set.teams) {
                if (team.teamName !== targetTeam.teamName && team.playerIds.includes(playerId)) {
                    otherTeams.push(team.teamName);
                }
            }
            
            const message = otherTeams.length > 0 
                ? `'${player.originalName}' 선수가 추가되었습니다. (${otherTeams.join(', ')}에도 소속됨)`
                : `'${player.originalName}' 선수가 추가되었습니다.`;
            
            await saveTeamSets(newTeamSets, message);
        }
    };

    // 주장 설정 핸들러
    const handleSetCaptain = async (playerId: string) => {
        if (!managingRosterTeamKey) return;
        
        const [setId] = managingRosterTeamKey.split('___');
        const set = teamSets.find(s => s.id === setId);
        if (!set) return;
        
        const player = set.players[playerId];
        if (!player) return;
        
        // 확인 다이얼로그
        if (window.confirm(`'${player.originalName}' 학생을 주장으로 임명하시겠습니까?`)) {
            await setTeamCaptain(managingRosterTeamKey, playerId);
        }
    };

    return (
        <>
            <EmblemModal
                isOpen={isEmblemModalOpen}
                onClose={() => setIsEmblemModalOpen(false)}
                onSelect={handleEmblemSelect}
            />
            {viewingProfileTeam && (
                 <TeamProfileCardModal
                    isOpen={isProfileModalOpen}
                    onClose={() => setIsProfileModalOpen(false)}
                    team={viewingProfileTeam.team}
                    players={viewingProfileTeam.players}
                />
            )}
            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleConfirmDelete}
                title={t('delete_team_confirm_title')}
                message={t('delete_team_confirm_message', { teamName: configs[teamToDeleteKey!]?.teamName || '' })}
                confirmText={t('delete')}
            />
            <RosterManagementModal
                isOpen={isRosterModalOpen}
                onClose={() => {
                    setIsRosterModalOpen(false);
                    // 트레이드 모드 상태는 유지 (모달을 닫아도 tradeSource 유지)
                }}
                teamKey={managingRosterTeamKey}
                teamConfig={managingRosterTeamKey ? configs[managingRosterTeamKey] : null}
                onTeamNameChange={(newName: string) => {
                    if (managingRosterTeamKey) {
                        handleConfigChange(managingRosterTeamKey, 'teamName', newName);
                    }
                }}
                isTradeMode={isTradeMode}
                tradeSource={tradeSource}
                onPlayerClick={handlePlayerClick}
                onSetCaptain={handleSetCaptain}
            />
            {selectingForTeamKey && (
                <PlayerSelectionModal
                    isOpen={isPlayerSelectionModalOpen}
                    onClose={() => {
                        setIsPlayerSelectionModalOpen(false);
                        setSelectingForTeamKey(null);
                    }}
                    teamKey={selectingForTeamKey}
                    className={(() => {
                        const [setId] = selectingForTeamKey.split('___');
                        const set = teamSets.find(s => s.id === setId);
                        return set?.className || null;
                    })()}
                    onSelect={handleSelectPlayer}
                />
            )}
            <ConfirmationModal
                isOpen={isNewSetModalOpen}
                onClose={() => setIsNewSetModalOpen(false)}
                onConfirm={handleCreateNewSet}
                title={isClub ? '새 대회(조) 추가' : t('team_management_new_set_title')}
                message=""
                confirmText={t('add')}
            >
                <input
                    type="text"
                    value={newSetName}
                    onChange={e => setNewSetName(e.target.value)}
                    placeholder={isClub ? '예: 교육감배 A조' : t('team_management_new_set_placeholder')}
                    className="w-full bg-slate-800 border border-slate-600 rounded-md p-3 mt-4 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    autoFocus
                />
            </ConfirmationModal>
            <ConfirmationModal
                isOpen={isNewTeamModalOpen}
                onClose={() => setIsNewTeamModalOpen(false)}
                onConfirm={handleAddNewTeam}
                title={t('team_management_new_team_title')}
                message=""
                confirmText={t('add')}
            >
                <input
                    type="text"
                    value={newTeamName}
                    onChange={e => setNewTeamName(e.target.value)}
                    placeholder={t('team_management_new_team_placeholder')}
                    className="w-full bg-slate-800 border border-slate-600 rounded-md p-3 mt-4 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    autoFocus
                />
            </ConfirmationModal>

            {isLoadTeamModalOpen && loadTeamTargetSetId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => { setIsLoadTeamModalOpen(false); setLoadTeamTargetSetId(null); }}>
                    <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-full max-w-md max-h-[70vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-600 font-bold text-slate-200">기존 팀 불러오기</div>
                        <div className="p-4 overflow-auto max-h-[50vh] space-y-2">
                            {(() => {
                                const targetSet = teamSets.find(s => s.id === loadTeamTargetSetId);
                                const targetClassName = targetSet?.className ?? '';
                                const otherSetsTeams = teamSets
                                    .filter(s => s.className !== targetClassName)
                                    .flatMap(s => s.teams.map(t => ({ set: s, team: t, key: `${s.id}___${t.teamName}` })));
                                if (otherSetsTeams.length === 0) {
                                    return <p className="text-slate-400 text-sm">다른 대회(조)에 등록된 팀이 없습니다.</p>;
                                }
                                return otherSetsTeams.map(({ set, team, key }) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={async () => {
                                            await copyTeamFromOtherSet(loadTeamTargetSetId!, key);
                                            setIsLoadTeamModalOpen(false);
                                            setLoadTeamTargetSetId(null);
                                        }}
                                        className="w-full text-left p-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium"
                                    >
                                        <span className="font-semibold">{team.teamName}</span>
                                        <span className="text-slate-400 text-sm ml-2">({set.className}, {team.playerIds?.length ?? 0}명)</span>
                                    </button>
                                ));
                            })()}
                        </div>
                        <div className="p-4 border-t border-slate-600">
                            <button type="button" onClick={() => { setIsLoadTeamModalOpen(false); setLoadTeamTargetSetId(null); }} className="w-full py-2 bg-slate-600 hover:bg-slate-500 rounded-lg text-white text-sm">닫기</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-4xl mx-auto bg-slate-900/50 backdrop-blur-sm border border-slate-700 p-4 sm:p-6 rounded-lg shadow-2xl space-y-6 animate-fade-in px-4">
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center lg:justify-between gap-4">
                    <button onClick={() => setIsNewSetModalOpen(true)} className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 px-6 rounded-lg text-base min-h-[44px] w-full lg:w-auto">
                        {isClub ? '➕ 새 대회(조) 추가' : t('team_management_new_set_button')}
                    </button>
                    <div className="flex gap-2">
                        {!isClub && (
                            <button 
                                onClick={() => {
                                    setIsTradeMode(!isTradeMode);
                                    setTradeSource(null);
                                }}
                                className={`font-bold py-3 px-6 rounded-lg text-base min-h-[44px] transition-all ${
                                    isTradeMode 
                                        ? 'bg-green-600 hover:bg-green-500 text-white animate-pulse' 
                                        : 'bg-slate-600 hover:bg-slate-500 text-white'
                                }`}
                            >
                                {isTradeMode ? '교체 중...' : '트레이드 모드'}
                            </button>
                        )}
                        <button onClick={handleSave} className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-lg text-base min-h-[44px] w-full lg:w-auto">{t('team_management_save_all')}</button>
                    </div>
                </div>
                
                {isTradeMode && (
                    <div className="bg-blue-900/50 border border-blue-500 rounded-lg p-4 text-blue-200">
                        <p className="font-semibold">
                            {tradeSource 
                                ? `선택됨: ${tradeSource.player.originalName} → 교체할 선수를 클릭하세요`
                                : '교체할 첫 번째 선수를 클릭하세요'}
                        </p>
                    </div>
                )}

                {/* 필터 섹션 - 반/대회(조) 탭 UI */}
                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 space-y-4">
                    {/* 반 또는 대회(조) 선택 탭 */}
                    <div>
                        <label className="block font-semibold text-sm text-slate-300 mb-2">
                            {isClub ? '대회(조) 선택' : t('player_input_class_select_label')}
                        </label>
                        <div className="flex gap-2 flex-wrap">
                            <button
                                onClick={() => {
                                    setSelectedClassFilter('all');
                                    setSelectedFormatFilter('all');
                                }}
                                className={`px-4 py-2 text-sm rounded-md transition-colors min-h-[44px] font-semibold ${
                                    selectedClassFilter === 'all'
                                        ? 'bg-[#00A3FF] text-white'
                                        : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                                }`}
                            >
                                {t('player_input_class_all')}
                            </button>
                            {availableClasses.map(className => (
                                <button
                                    key={className}
                                    onClick={() => {
                                        setSelectedClassFilter(className);
                                        setSelectedFormatFilter('all');
                                    }}
                                    className={`px-4 py-2 text-sm rounded-md transition-colors min-h-[44px] font-semibold ${
                                        selectedClassFilter === className
                                            ? 'bg-[#00A3FF] text-white'
                                            : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                                    }`}
                                >
                                    {className}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    {/* 팀 구성 필터: 수업 모드에서만 표시 */}
                    {appMode === 'CLASS' && (
                        <div>
                            <label className="block font-semibold text-sm text-slate-300 mb-2">{t('record_all_formats')}</label>
                            <div className="flex gap-2 flex-wrap">
                                <button 
                                    onClick={() => setSelectedFormatFilter('all')} 
                                    className={`px-3 py-2 text-xs rounded transition-colors min-h-[44px] ${
                                        selectedFormatFilter === 'all' 
                                            ? 'bg-[#00A3FF] text-white font-bold' 
                                            : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                                    }`}
                                >
                                    {t('record_all_formats')}
                                </button>
                                {availableFormats.map(format => (
                                    <button 
                                        key={format}
                                        onClick={() => setSelectedFormatFilter(String(format))} 
                                        className={`px-3 py-2 text-xs rounded transition-colors min-h-[44px] ${
                                            selectedFormatFilter === String(format) 
                                                ? 'bg-[#00A3FF] text-white font-bold' 
                                                : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                                        }`}
                                    >
                                        {t('record_team_format', { count: format })}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {groupedTeams.length > 0 ? (
                    <div className="space-y-6">
                        {groupedTeams.map(({ set, teams }) => (
                            <div key={set.id} className="bg-slate-900 p-4 rounded-lg border border-slate-800">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-xl font-bold text-slate-300">
                                        {set.className}
                                        {isClub && <span className="text-sm text-slate-400 ml-2">(대회/조)</span>}
                                        {set.teamCount && (
                                            <span className="text-sm text-slate-400 ml-2">({t('record_team_format', { count: set.teamCount })})</span>
                                        )}
                                    </h3>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => { setTargetSetId(set.id); setIsNewTeamModalOpen(true); }}
                                            className="text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold py-1 px-3 rounded-md transition-colors"
                                        >
                                            {isClub ? '학교(팀) 추가' : t('team_management_add_team_button')}
                                        </button>
                                        {isClub && (
                                            <button
                                                onClick={() => { setLoadTeamTargetSetId(set.id); setIsLoadTeamModalOpen(true); }}
                                                className="text-sm bg-amber-700 hover:bg-amber-600 text-amber-100 font-semibold py-1 px-3 rounded-md transition-colors"
                                            >
                                                기존 팀 불러오기
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-4">
                                {teams.map((team) => {
                                    const config = configs[team.key];
                                    if (!config) return null;
                                    const conflict = colorConflicts.get(team.teamName);
                                    return (
                                    <div
                                        key={team.key}
                                        className={`bg-slate-800 p-4 rounded-lg space-y-4 transition-all ${
                                            conflict ? 'ring-2 ring-amber-400/70 ring-offset-2 ring-offset-slate-900' : ''
                                        }`}
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className="flex-shrink-0 flex flex-col items-center gap-2">
                                                <span className="text-xs text-slate-400">{t('team_management_emblem_label')}</span>
                                                <button 
                                                    onClick={() => { setCurrentTargetTeamKey(team.key); setIsEmblemModalOpen(true); }}
                                                    className="w-20 h-20 bg-slate-900 rounded-lg flex items-center justify-center border-2 border-dashed border-slate-600 hover:border-sky-500 transition-colors"
                                                    aria-label={t('team_management_change_emblem_aria', { teamName: team.teamName })}
                                                >
                                                    <TeamEmblem emblem={config.emblem} color={config.color} className="w-16 h-16"/>
                                                </button>
                                                <div className="flex w-full gap-1">
                                                     <button onClick={() => handleOpenRosterModal(team.key)} className="flex-1 flex items-center justify-center gap-1 text-xs bg-slate-600 hover:bg-slate-500 text-white font-semibold py-1 px-2 rounded-md">
                                                         <UsersIcon className="w-4 h-4" />
                                                         {t('team_management_roster_button')}
                                                     </button>
                                                     {!isClub && (
                                                        <button 
                                                            onClick={() => handleOpenPlayerSelection(team.key)} 
                                                            className="flex-1 flex items-center justify-center gap-1 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold py-1 px-2 rounded-md"
                                                        >
                                                            + {t('team_management_add_from_roster')}
                                                        </button>
                                                     )}
                                                    <button onClick={() => handleDeleteClick(team.key)} className="flex-shrink-0 flex items-center justify-center gap-1 text-xs bg-red-800 hover:bg-red-700 text-white font-semibold p-1 rounded-md">
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex-grow space-y-3">
                                                <div className="flex items-center gap-3 flex-wrap">
                                                    <button
                                                        onClick={() => handleOpenRosterModal(team.key)}
                                                        className="inline-flex items-center gap-1.5 font-semibold text-xl hover:underline hover:opacity-80 text-left transition-all group"
                                                        style={{ color: config.color || '#cbd5e1' }}
                                                    >
                                                        <span>{config.teamName}</span>
                                                        <PencilIcon className="w-5 h-5 text-slate-400 cursor-pointer group-hover:text-slate-300 transition-colors flex-shrink-0" />
                                                    </button>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-semibold text-slate-400 mb-1">{t('team_management_color_label')}</label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {TEAM_COLORS_PALETTE.map(color => (
                                                            <button 
                                                                key={color}
                                                                onClick={() => handleConfigChange(team.key, 'color', color)}
                                                                className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${config.color === color ? 'ring-2 ring-offset-2 ring-offset-slate-800 ring-white' : ''}`}
                                                                style={{ backgroundColor: color }}
                                                                aria-label={t('team_management_select_color_aria', { color })}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-3 pt-3 border-t border-slate-700">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-base font-semibold text-slate-300 mb-2">{t('team_management_slogan_label')}</label>
                                                    <input type="text" placeholder={t('team_management_slogan_placeholder')} value={config.slogan || ''} onChange={(e) => handleConfigChange(team.key, 'slogan', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-md p-3 text-base text-white focus:outline-none focus:ring-1 focus:ring-sky-500" />
                                                </div>
                                                <div>
                                                    <label className="block text-base font-semibold text-slate-300 mb-2">{t('team_management_memo_label')}</label>
                                                    <input type="text" placeholder={t('team_management_memo_placeholder')} value={config.memo || ''} onChange={(e) => handleConfigChange(team.key, 'memo', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-md p-3 text-base text-white focus:outline-none focus:ring-1 focus:ring-sky-500" />
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <label className="text-base font-semibold text-slate-300 w-20 flex-shrink-0">{t('cheer_song_1')}</label>
                                                <input type="text" placeholder={t('team_management_cheer_url_placeholder', { number: 1 })} value={config.cheerUrl || ''} onChange={(e) => handleConfigChange(team.key, 'cheerUrl', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-md p-3 text-base text-white focus:outline-none focus:ring-1 focus:ring-sky-500" />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input type="text" placeholder={t('team_management_cheer_name_placeholder', { number: 2 })} value={config.cheerName2 || ''} onChange={(e) => handleConfigChange(team.key, 'cheerName2', e.target.value)} className="w-32 flex-shrink-0 bg-slate-900 border border-slate-600 rounded-md p-3 text-base text-white focus:outline-none focus:ring-1 focus:ring-sky-500" />
                                                <input type="text" placeholder={t('team_management_cheer_url_placeholder', { number: 2 })} value={config.cheerUrl2 || ''} onChange={(e) => handleConfigChange(team.key, 'cheerUrl2', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-md p-3 text-base text-white focus:outline-none focus:ring-1 focus:ring-sky-500" />
                                            </div>
                                        </div>
                                    </div>
                                )})}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center p-6 bg-slate-800/50 border border-slate-700 rounded-lg animate-fade-in">
                        {selectedClassFilter === 'all' && selectedFormatFilter === 'all' ? (
                            <>
                                <h3 className="text-lg font-bold text-sky-400 mb-3">{t('team_management_no_sets_title')}</h3>
                                <p className="text-slate-300">{t('team_management_no_sets_desc')}</p>
                            </>
                        ) : (
                            <>
                                <h3 className="text-lg font-bold text-sky-400 mb-3">
                                    {selectedFormatFilter !== 'all' 
                                        ? `${selectedClassFilter === 'all' ? '전체' : selectedClassFilter}의 ${t('record_team_format', { count: parseInt(selectedFormatFilter) })} 정보가 없습니다.`
                                        : `${selectedClassFilter === 'all' ? '전체' : selectedClassFilter}의 팀 정보가 없습니다.`}
                                </h3>
                                <p className="text-slate-300">
                                    {selectedFormatFilter !== 'all'
                                        ? '다른 포맷을 선택하거나 반을 변경해보세요.'
                                        : selectedClassFilter === 'all'
                                            ? '팀을 생성해보세요.'
                                            : '다른 반을 선택하거나 팀을 생성해보세요.'}
                                </p>
                            </>
                        )}
                    </div>
                )}
            </div>
        </>
    );
};

export default TeamManagementScreen;
