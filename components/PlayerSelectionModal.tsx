import React from 'react';
import { Player } from '../types';
import { useTranslation } from '../hooks/useTranslation';

interface PlayerSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (playerId: string) => void;
    players: Record<string, Player>;
    teamName: string;
    teamColor: string;
    title?: string;
}

const PlayerSelectionModal: React.FC<PlayerSelectionModalProps> = ({
    isOpen,
    onClose,
    onSelect,
    players,
    teamName,
    teamColor,
    title,
}) => {
    const { t } = useTranslation();
    
    if (!isOpen) return null;
    
    // Sort players by student number
    const sortedPlayers = Object.values(players).sort((a: Player, b: Player) => {
        return parseInt(a.studentNumber, 10) - parseInt(b.studentNumber, 10);
    });

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 animate-fade-in"
            onClick={onClose}
        >
            <div 
                className="bg-slate-900 rounded-lg shadow-2xl p-8 w-full max-w-lg text-white border-2"
                style={{ borderColor: teamColor }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="text-center mb-6">
                    <h2 className="text-3xl font-bold mb-2" style={{ color: teamColor }}>{teamName}</h2>
                    <p className="text-xl text-slate-300">{title || t('who_recorded')}</p>
                </div>
                <div className="max-h-[60vh] overflow-y-auto grid grid-cols-2 gap-4 p-1">
                    {sortedPlayers.map((player: Player) => (
                        <button
                            key={player.id}
                            onClick={() => onSelect(player.id)}
                            className="p-6 bg-slate-800 hover:bg-slate-700 rounded-xl text-center transition-colors border border-slate-700 hover:border-slate-500 shadow-md"
                        >
                            <span className="block text-2xl font-bold mb-1 truncate">{player.originalName}</span>
                            <span className="block text-base text-slate-400 font-medium">{player.class}{t('class')} {player.studentNumber}{t('student_number')}</span>
                        </button>
                    ))}
                </div>
                 <div className="mt-8 text-center">
                    <button 
                        onClick={onClose} 
                        className="text-slate-400 hover:text-white text-lg font-semibold py-2 px-6 rounded hover:bg-slate-800 transition-colors"
                    >
                        {t('cancel')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PlayerSelectionModal;