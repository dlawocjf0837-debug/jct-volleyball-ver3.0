import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { Player, SavedTeamInfo } from '../types';
import { TrashIcon, CrownIcon } from './icons';
import { useTranslation } from '../hooks/useTranslation';

interface RosterManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    teamKey: string | null;
    teamConfig: SavedTeamInfo | null;
    onTeamNameChange: (newName: string) => void;
    isTradeMode?: boolean;
    tradeSource?: { player: Player; teamKey: string } | null;
    onPlayerClick?: (player: Player, teamKey: string) => void;
}

const RosterManagementModal: React.FC<RosterManagementModalProps> = ({ isOpen, onClose, teamKey, teamConfig, onTeamNameChange, isTradeMode = false, tradeSource = null, onPlayerClick }) => {
    const { teamSetsMap, addPlayerToTeam, removePlayerFromTeam, bulkAddPlayersToTeam } = useData();
    const { t } = useTranslation();
    const [newPlayerName, setNewPlayerName] = useState('');
    const [isEditingName, setIsEditingName] = useState(false);
    const [editableName, setEditableName] = useState('');
    const [mode, setMode] = useState<'single' | 'bulk'>('single');
    const [bulkPlayerNames, setBulkPlayerNames] = useState('');
    const [bulkOverwrite, setBulkOverwrite] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { players, captainId } = useMemo(() => {
        if (!teamKey || !teamConfig) return { players: [], captainId: null };
        const data = teamSetsMap.get(teamKey);
        if (!data) return { players: [], captainId: null };
        
        const playerList = teamConfig.playerIds
            .map(id => data.set.players[id])
            .filter((p): p is Player => !!p)
            .sort((a, b) => {
                const isACaptain = a.id === teamConfig.captainId;
                const isBCaptain = b.id === teamConfig.captainId;
                if (isACaptain !== isBCaptain) {
                    return isACaptain ? -1 : 1;
                }
                return a.originalName.localeCompare(b.originalName);
            });

        return { players: playerList, captainId: teamConfig.captainId };
    }, [teamKey, teamConfig, teamSetsMap]);

    useEffect(() => {
        if (isOpen && teamConfig) {
            setEditableName(teamConfig.teamName.replace(/ 팀$/, '').replace(/ Team$/, ''));
        } else if (!isOpen) {
            setIsEditingName(false);
            setMode('single'); // Reset mode on close
            setBulkPlayerNames('');
            setBulkOverwrite(false);
        }
    }, [isOpen, teamConfig]);

    const handleAddPlayer = () => {
        if (newPlayerName.trim() && teamKey) {
            addPlayerToTeam(teamKey, newPlayerName.trim());
            setNewPlayerName('');
        }
    };

    const handleBulkAdd = async () => {
        if (bulkPlayerNames.trim() && teamKey) {
            setIsSubmitting(true);
            const names = bulkPlayerNames.split('\n').map(name => name.trim()).filter(Boolean);
            if (names.length > 0) {
                await bulkAddPlayersToTeam(teamKey, names, bulkOverwrite);
            }
            setIsSubmitting(false);
            setBulkPlayerNames('');
            setBulkOverwrite(false);
            setMode('single');
        }
    };

    const handleRemovePlayer = (playerId: string) => {
        if (teamKey) {
            removePlayerFromTeam(teamKey, playerId);
        }
    };
    
    const handleNameSave = () => {
        if (editableName.trim() && teamKey) {
            const newName = editableName.trim() + t('roster_team_suffix');
            onTeamNameChange(newName);
        }
        setIsEditingName(false);
    };

    if (!isOpen || !teamConfig) return null;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 animate-fade-in"
            onClick={onClose}
        >
            <div 
                className="bg-slate-900 rounded-lg shadow-2xl p-6 w-full max-w-md text-white border border-sky-500 flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {isEditingName ? (
                    <div className="flex items-center gap-2 mb-4 flex-shrink-0">
                        <input
                            type="text"
                            value={editableName}
                            onChange={(e) => setEditableName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleNameSave(); }}
                            onBlur={handleNameSave}
                            autoFocus
                            className="flex-grow bg-slate-700 text-white text-2xl font-bold rounded-md outline-none p-1"
                        />
                        <span className="text-2xl font-bold text-sky-400">{t('roster_team_suffix')}</span>
                    </div>
                ) : (
                    <h2
                        className="text-2xl font-bold text-sky-400 mb-4 flex-shrink-0 cursor-pointer group"
                        onClick={() => setIsEditingName(true)}
                    >
                        {t('roster_title', { teamName: teamConfig.teamName })}
                        <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity">✏️</span>
                    </h2>
                )}
                
                <div className="flex-grow overflow-y-auto pr-2 -mr-2 mb-4">
                    <ul className="space-y-2">
                        {players.map(player => {
                            const isSelected = tradeSource?.player.id === player.id && tradeSource?.teamKey === teamKey;
                            const isClickable = isTradeMode && onPlayerClick;
                            
                            return (
                                <li 
                                    key={player.id} 
                                    className={`flex items-center justify-between bg-slate-800 p-3 rounded-md transition-all ${
                                        isSelected 
                                            ? 'ring-4 ring-green-500 ring-offset-2 ring-offset-slate-900' 
                                            : isClickable 
                                                ? 'cursor-pointer hover:bg-slate-700' 
                                                : ''
                                    }`}
                                    onClick={() => {
                                        if (isClickable && teamKey) {
                                            onPlayerClick(player, teamKey);
                                        }
                                    }}
                                >
                                    <div className="flex items-center gap-2">
                                        {player.id === captainId && <CrownIcon className="w-5 h-5 text-yellow-400" />}
                                        <span className="font-semibold text-slate-200">{player.originalName}</span>
                                        {isSelected && <span className="text-xs text-green-400 font-bold">✓ 선택됨</span>}
                                    </div>
                                    {!isTradeMode && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRemovePlayer(player.id);
                                            }}
                                            disabled={player.id === captainId}
                                            className="text-slate-500 hover:text-red-500 disabled:text-slate-700 disabled:cursor-not-allowed"
                                            aria-label={t('roster_delete_player_aria', { playerName: player.originalName })}
                                        >
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </div>

                <div className="flex-shrink-0 pt-4 border-t border-slate-700">
                    {mode === 'single' ? (
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label htmlFor="new-player-name" className="text-sm font-semibold text-slate-300">{t('roster_add_new_player')}</label>
                                <button onClick={() => setMode('bulk')} className="text-xs bg-slate-600 hover:bg-slate-500 text-slate-200 font-semibold py-1 px-2 rounded-md transition-colors">
                                    📝 {t('roster_bulk_import_button')}
                                </button>
                            </div>
                            <div className="flex gap-2">
                                <input
                                    id="new-player-name"
                                    type="text"
                                    value={newPlayerName}
                                    onChange={(e) => setNewPlayerName(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddPlayer(); }}
                                    placeholder={t('player_name')}
                                    className="flex-grow bg-slate-800 border border-slate-600 rounded-md p-2 text-white"
                                />
                                <button
                                    onClick={handleAddPlayer}
                                    className="bg-sky-600 hover:bg-sky-500 font-semibold py-2 px-4 rounded-lg"
                                >
                                    {t('add')}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3 animate-fade-in">
                            <div className="flex justify-between items-center">
                                <h3 className="text-sm font-semibold text-slate-300">{t('bulk_import_title')}</h3>
                                <button onClick={() => setMode('single')} className="text-xs bg-slate-600 hover:bg-slate-500 text-slate-200 font-semibold py-1 px-2 rounded-md transition-colors">
                                    {t('roster_single_add_button')}
                                </button>
                            </div>
                            <textarea
                                value={bulkPlayerNames}
                                onChange={e => setBulkPlayerNames(e.target.value)}
                                placeholder={t('bulk_import_placeholder')}
                                className="w-full h-32 bg-slate-800 border border-slate-600 rounded-md p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                            />
                            <div className="my-2">
                                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                                    <input
                                        type="checkbox"
                                        checked={bulkOverwrite}
                                        onChange={e => setBulkOverwrite(e.target.checked)}
                                        className="h-4 w-4 bg-slate-700 border-slate-500 rounded text-sky-500 focus:ring-sky-500"
                                    />
                                    {t('bulk_import_overwrite_label')}
                                </label>
                                <p className="text-xs text-slate-500 mt-1 ml-6">{t('bulk_import_overwrite_desc')}</p>
                            </div>
                            <button
                                onClick={handleBulkAdd}
                                disabled={isSubmitting || bulkPlayerNames.trim() === ''}
                                className="w-full bg-sky-600 hover:bg-sky-500 font-semibold py-2 px-4 rounded-lg disabled:bg-slate-700 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? t('bulk_import_submitting') : t('bulk_import_submit_button')}
                            </button>
                        </div>
                    )}
                </div>

                <div className="text-center mt-6 flex-shrink-0">
                    <button onClick={onClose} className="bg-slate-600 hover:bg-slate-500 font-bold py-2 px-6 rounded-lg">{t('close')}</button>
                </div>
            </div>
        </div>
    );
};

export default RosterManagementModal;
