import React, { useState } from 'react';
import { SavedTeamInfo, Player } from '../types';
import TeamEmblem from './TeamEmblem';
import { CrownIcon } from './icons';
import StatModal from './StatModal';
import { useTranslation } from '../hooks/useTranslation';

interface TeamProfileCardModalProps {
    isOpen: boolean;
    onClose: () => void;
    team: SavedTeamInfo;
    players: Player[];
}

export const TeamProfileCardModal: React.FC<TeamProfileCardModalProps> = ({ isOpen, onClose, team, players }) => {
    const { t } = useTranslation();
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
    
    if (!isOpen) return null;

    const teamColor = team.color || '#3b82f6';

    return (
        <>
            <div 
                className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 animate-fade-in"
                onClick={onClose}
            >
                <div 
                    className="bg-slate-900 rounded-lg shadow-2xl p-6 w-full max-w-lg text-white border border-slate-700 flex flex-col items-center"
                    onClick={(e) => e.stopPropagation()}
                >
                    <h2 className="text-2xl font-bold text-[#00A3FF] mb-4">{t('profile_card_title')}</h2>

                    {/* Card Area */}
                    <div className="bg-slate-800 p-6 rounded-lg w-full max-w-md flex flex-col" style={{ borderColor: teamColor, borderStyle: 'solid', borderWidth: '2px' }}>
                        <div className="flex items-center gap-4 border-b-2 pb-4" style={{ borderColor: teamColor }}>
                            <TeamEmblem emblem={team.emblem} color={teamColor} className="w-20 h-20 flex-shrink-0" />
                            <div className="flex-grow">
                                <h3 className="text-4xl font-black truncate text-white">{team.teamName}</h3>
                                {team.slogan && <p className="text-lg italic mt-1" style={{ color: teamColor }}>"{team.slogan}"</p>}
                            </div>
                        </div>
                        <div className="flex-grow mt-4">
                            <h4 className="font-bold text-lg text-slate-300 mb-2">{t('profile_card_roster')}</h4>
                            <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-slate-200">
                                {players.map(player => (
                                    <li key={player.id} className="flex items-center gap-2">
                                        {player.id === team.captainId && <CrownIcon className="w-5 h-5 text-yellow-400" />}
                                        <button 
                                            onClick={() => setSelectedPlayer(player)}
                                            className={`text-left truncate transition-colors hover:text-sky-400 ${player.id === team.captainId ? 'font-bold' : ''}`}
                                        >
                                            {player.originalName}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    <div className="flex justify-center gap-4 mt-6 w-full max-w-md">
                        <button onClick={onClose} className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-6 rounded-lg">{t('close')}</button>
                    </div>
                </div>
            </div>
            {selectedPlayer && (
                <StatModal
                    player={selectedPlayer}
                    onClose={() => setSelectedPlayer(null)}
                    showRealNames={true}
                />
            )}
        </>
    );
};
