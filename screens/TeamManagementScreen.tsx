import React, { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { SavedTeamInfo, Player, TeamSet } from '../types';
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
    const { teamSets, saveTeamSets, deleteTeam, createTeamSet, addTeamToSet } = useData();
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

    const groupedTeams = useMemo(() => {
        const sortedSets = [...teamSets].sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
        return sortedSets.map(set => {
            const teamsInSet = set.teams.map(team => ({
                ...team,
                setId: set.id,
                key: `${set.id}___${team.teamName}`
            })).sort((a, b) => a.teamName.localeCompare(b.teamName));
            return { set, teams: teamsInSet };
        });
    }, [teamSets]);


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
            await addTeamToSet(targetSetId, finalTeamName);
            setNewTeamName('');
            setTargetSetId(null);
            setIsNewTeamModalOpen(false);
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
                onClose={() => setIsRosterModalOpen(false)}
                teamKey={managingRosterTeamKey}
                teamConfig={managingRosterTeamKey ? configs[managingRosterTeamKey] : null}
                onTeamNameChange={(newName: string) => {
                    if (managingRosterTeamKey) {
                        handleConfigChange(managingRosterTeamKey, 'teamName', newName);
                    }
                }}
            />
            <ConfirmationModal
                isOpen={isNewSetModalOpen}
                onClose={() => setIsNewSetModalOpen(false)}
                onConfirm={handleCreateNewSet}
                title={t('team_management_new_set_title')}
                message=""
                confirmText={t('add')}
            >
                <input
                    type="text"
                    value={newSetName}
                    onChange={e => setNewSetName(e.target.value)}
                    placeholder={t('team_management_new_set_placeholder')}
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

            <div className="max-w-4xl mx-auto bg-slate-900/50 backdrop-blur-sm border border-slate-700 p-6 rounded-lg shadow-2xl space-y-6 animate-fade-in">
                <div className="flex justify-between items-center flex-wrap gap-4">
                    <button onClick={() => setIsNewSetModalOpen(true)} className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 px-6 rounded-lg text-base">
                        {t('team_management_new_set_button')}
                    </button>
                    <button onClick={handleSave} className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-lg text-base">{t('team_management_save_all')}</button>
                </div>

                {groupedTeams.length > 0 ? (
                    <div className="space-y-6">
                        {groupedTeams.map(({ set, teams }) => (
                            <div key={set.id} className="bg-slate-900 p-4 rounded-lg border border-slate-800">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-xl font-bold text-slate-300">{set.className}</h3>
                                    <button
                                        onClick={() => { setTargetSetId(set.id); setIsNewTeamModalOpen(true); }}
                                        className="text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold py-1 px-3 rounded-md transition-colors"
                                    >
                                        {t('team_management_add_team_button')}
                                    </button>
                                </div>
                                <div className="space-y-4">
                                {teams.map((team) => {
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
                                                     <button onClick={() => handleOpenRosterModal(team.key)} className="flex-1 flex items-center justify-center gap-1 text-xs bg-slate-600 hover:bg-slate-500 text-white font-semibold py-1 px-2 rounded-md">
                                                         <UsersIcon className="w-4 h-4" />
                                                         {t('team_management_roster_button')}
                                                     </button>
                                                    <button onClick={() => handleDeleteClick(team.key)} className="flex-shrink-0 flex items-center justify-center gap-1 text-xs bg-red-800 hover:bg-red-700 text-white font-semibold p-1 rounded-md">
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex-grow space-y-3">
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={() => handleOpenRosterModal(team.key)}
                                                        className="font-semibold text-xl hover:underline hover:opacity-80 text-left transition-all"
                                                        style={{ color: config.color || '#cbd5e1' }}
                                                    >
                                                        {config.teamName}
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
                        <h3 className="text-lg font-bold text-sky-400 mb-3">{t('team_management_no_sets_title')}</h3>
                        <p className="text-slate-300">{t('team_management_no_sets_desc')}</p>
                    </div>
                )}
            </div>
        </>
    );
};

export default TeamManagementScreen;
