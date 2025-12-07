
import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { SavedTeamInfo, Player } from '../types';
import EmblemModal from '../components/EmblemModal';
import TeamEmblem from '../components/TeamEmblem';
import { TeamProfileCardModal } from '../components/TeamProfileCardModal';
import { IdentificationIcon, TrashIcon, UsersIcon } from '../components/icons';
import ConfirmationModal from '../components/common/ConfirmationModal';
import RosterManagementModal from '../components/RosterManagementModal';
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

const TeamManagementScreen: React.FC = () => {
    const { teamSets, saveTeamSets, deleteTeam } = useData();
    const { t } = useTranslation();
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [teamCountFilter, setTeamCountFilter] = useState('all');
    const [configs, setConfigs] = useState<Record<string, Config>>({});
    const [isEmblemModalOpen, setIsEmblemModalOpen] = useState(false);
    const [currentTargetTeamKey, setCurrentTargetTeamKey] = useState<string | null>(null);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [viewingProfileTeam, setViewingProfileTeam] = useState<{ team: SavedTeamInfo, players: Player[] } | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [teamToDeleteKey, setTeamToDeleteKey] = useState<string | null>(null);
    const [isRosterModalOpen, setIsRosterModalOpen] = useState(false);
    const [managingRosterTeamKey, setManagingRosterTeamKey] = useState<string | null>(null);

    useEffect(() => {
        const initialConfigs: Record<string, Config> = {};
        teamSets.forEach(set => {
            set.teams.forEach(team => {
                const key = `${set.id}___${team.teamName}`;
                // Fallback for old teams without memo
                const memo = team.memo || new Date(set.savedAt).toLocaleDateString();
                initialConfigs[key] = { ...team, key, memo };
            });
        });
        setConfigs(initialConfigs);
    }, [teamSets]);

    const availableClasses = useMemo(() => {
        const classSet = new Set<string>();
        teamSets.forEach(set => {
            if (set.className) classSet.add(set.className);
        });
        return Array.from(classSet).sort((a, b) => a.localeCompare(b));
    }, [teamSets]);

    const availableTeamCounts = useMemo(() => {
        if (!selectedClass) return [];
        const counts = new Set<number>();
        teamSets.forEach(set => {
            if (set.className === selectedClass) {
                counts.add(set.teamCount ?? 4); 
            }
        });
        const validCounts = Array.from(counts).filter(c => c > 0);
        return validCounts.sort((a,b) => a - b).map(String);
    }, [teamSets, selectedClass]);


    const teamsInClass = useMemo((): TeamWithSetId[] => {
        if (!selectedClass) return [];
        const teams: TeamWithSetId[] = [];
        teamSets.forEach(set => {
            if (set.className === selectedClass) {
                const teamCount = set.teamCount ?? 4;
                if (teamCountFilter === 'all' || String(teamCount) === teamCountFilter) {
                    set.teams.forEach(team => teams.push({ ...team, setId: set.id, key: `${set.id}___${team.teamName}` }));
                }
            }
        });
        return teams.sort((a, b) => a.teamName.localeCompare(b.teamName));
    }, [teamSets, selectedClass, teamCountFilter]);

    const colorConflicts = useMemo(() => {
        const conflicts = new Map<string, string[]>();
        const colorMap = new Map<string, string[]>();
        teamsInClass.forEach(team => {
            const color = configs[team.key]?.color;
            if (color) {
                if (!colorMap.has(color)) colorMap.set(color, []);
                colorMap.get(color)?.push(team.teamName);
            }
        });
        colorMap.forEach((teams, color) => {
            if (teams.length > 1) {
                teams.forEach(teamName => conflicts.set(teamName, teams.filter(t => t !== teamName)));
            }
        });
        return conflicts;
    }, [configs, teamsInClass]);

    const handleConfigChange = (key: string, field: keyof SavedTeamInfo, value: any) => {
        setConfigs(prev => ({
            ...prev,
            [key]: { ...prev[key], [field]: value }
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
                onClose={() => setIsRosterModalOpen(false)}
                teamKey={managingRosterTeamKey}
                teamConfig={managingRosterTeamKey ? configs[managingRosterTeamKey] : null}
                onTeamNameChange={(newName: string) => {
                    if (managingRosterTeamKey) {
                        handleConfigChange(managingRosterTeamKey, 'teamName', newName);
                    }
                }}
            />
            <div className="max-w-4xl mx-auto bg-slate-900/50 backdrop-blur-sm border border-slate-700 p-6 rounded-lg shadow-2xl space-y-6 animate-fade-in">
                <div className="flex justify-between items-center flex-wrap gap-4">
                    <div className="flex-grow">
                        <label htmlFor="class-select" className="block text-sm font-bold text-slate-300 mb-2">
                            {t('team_management_select_class_label')}
                        </label>
                        <select
                            id="class-select"
                            value={selectedClass}
                            onChange={(e) => {
                                setSelectedClass(e.target.value);
                                setTeamCountFilter('all');
                            }}
                            className="w-full bg-slate-700 border border-slate-600 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-sky-500"
                        >
                            <option value="">{t('team_management_select_class_prompt')}</option>
                            {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="self-end">
                         <button onClick={handleSave} className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-lg text-base">{t('team_management_save_all')}</button>
                    </div>
                </div>

                {selectedClass && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-slate-700 pt-4">
                        <span className="text-sm font-semibold text-slate-400 mr-2">{t('record_format_filter')}</span>
                        <button onClick={() => setTeamCountFilter('all')} className={`px-3 py-1 text-sm rounded-md transition-colors ${teamCountFilter === 'all' ? 'bg-[#00A3FF] text-white font-bold' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}>{t('record_all_formats')}</button>
                        {availableTeamCounts.map(count => (
                            <button key={count} onClick={() => setTeamCountFilter(count)} className={`px-3 py-1 text-sm rounded-md transition-colors ${teamCountFilter === count ? 'bg-[#00A3FF] text-white font-bold' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}>
                                {t('record_team_format', { count })}
                            </button>
                        ))}
                    </div>
                )}

                {selectedClass ? (
                    <div className="space-y-4 animate-fade-in">
                        <h3 className="text-xl font-bold text-slate-300 border-b border-slate-700 pb-2">
                            {selectedClass} {t('team_management_title_suffix')}
                        </h3>
                        {teamsInClass.length > 0 ? (
                            <div className="space-y-4">
                                {teamsInClass.map((team) => {
                                    const config = configs[team.key];
                                    if (!config) return null;
                                    const conflict = colorConflicts.get(team.teamName);
                                    return (
                                    <div key={team.key} className="bg-slate-800 p-4 rounded-lg space-y-4">
                                        <div className="flex items-start gap-4">
                                            <div className="flex-shrink-0 flex flex-col items-center gap-2">
                                                <button 
                                                    onClick={() => { setCurrentTargetTeamKey(team.key); setIsEmblemModalOpen(true); }}
                                                    className="w-20 h-20 bg-slate-900 rounded-lg flex items-center justify-center border-2 border-dashed border-slate-600 hover:border-sky-500 transition-colors"
                                                    aria-label={t('team_management_change_emblem_aria', { teamName: team.teamName })}
                                                >
                                                    <TeamEmblem emblem={config.emblem} color={config.color} className="w-16 h-16"/>
                                                </button>
                                                <div className="flex w-full gap-1">
                                                    <button onClick={() => handleViewProfile(team.key)} className="flex-1 flex items-center justify-center gap-1 text-xs bg-sky-700 hover:bg-sky-600 text-white font-semibold py-1 px-2 rounded-md">
                                                         <IdentificationIcon className="w-4 h-4" />
                                                        {t('team_management_profile_button')}
                                                    </button>
                                                    <button onClick={() => handleDeleteClick(team.key)} className="flex-shrink-0 flex items-center justify-center gap-1 text-xs bg-red-800 hover:bg-red-700 text-white font-semibold p-1 rounded-md">
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex-grow space-y-3">
                                                <div className="flex items-center gap-3">
                                                    <button onClick={() => handleOpenRosterModal(team.key)} className="text-left p-0 bg-transparent border-none">
                                                        <h4 className="font-semibold text-xl hover:underline" style={{ color: config.color || '#cbd5e1' }}>{config.teamName}</h4>
                                                    </button>
                                                    {conflict && <span className="text-xs text-yellow-400 bg-yellow-900/50 px-2 py-1 rounded-md">{t('team_management_color_conflict', { teams: conflict.join(', ') })}</span>}
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
                                                    <label className="block text-base font-semibold text-slate-300 mb-2">팀 메모</label>
                                                    <input type="text" placeholder="날짜 또는 메모 입력" value={config.memo || ''} onChange={(e) => handleConfigChange(team.key, 'memo', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-md p-3 text-base text-white focus:outline-none focus:ring-1 focus:ring-sky-500" />
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
                        ) : (
                            <p className="text-center text-slate-400 p-4 bg-slate-800/50 rounded-lg">
                                {t('team_management_no_teams_in_class')}
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="text-center p-6 bg-slate-800/50 border border-slate-700 rounded-lg animate-fade-in">
                        <h3 className="text-lg font-bold text-sky-400 mb-3">{t('team_management_guide_title')}</h3>
                        <p className="text-slate-300">
                            {t('team_management_guide_desc1')}
                        </p>
                        <p className="text-slate-400 mt-2 text-sm">
                            {t('team_management_guide_desc2')}
                        </p>
                    </div>
                )}
            </div>
        </>
    );
};

export default TeamManagementScreen;
