import React, { useState } from 'react';
import { useTranslation } from '../hooks/useTranslation';

interface AddNewPlayerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (name: string, team: 'A' | 'B') => void;
    teamAName: string;
    teamBName: string;
}

const AddNewPlayerModal: React.FC<AddNewPlayerModalProps> = ({ isOpen, onClose, onAdd, teamAName, teamBName }) => {
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [team, setTeam] = useState<'A' | 'B'>('A');

    const handleAdd = () => {
        if (name.trim()) {
            onAdd(name.trim(), team);
            onClose();
            setName('');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-slate-900 rounded-lg shadow-2xl p-6 w-full max-w-sm text-white border border-sky-500" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-sky-400 mb-4">{t('new_player_registration')}</h2>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="player-name" className="block text-sm font-medium text-slate-300 mb-1">{t('player_name')}</label>
                        <input
                            id="player-name"
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-600 rounded-md p-2"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">{t('team_selection')}</label>
                        <select
                            value={team}
                            onChange={e => setTeam(e.target.value as 'A' | 'B')}
                            className="w-full bg-slate-800 border border-slate-600 rounded-md p-2"
                        >
                            <option value="A">{teamAName}</option>
                            <option value="B">{teamBName}</option>
                        </select>
                    </div>
                </div>
                <div className="flex justify-end gap-4 mt-6">
                    <button onClick={onClose} className="bg-slate-600 hover:bg-slate-500 font-bold py-2 px-6 rounded-lg">{t('cancel')}</button>
                    <button onClick={handleAdd} className="bg-sky-600 hover:bg-sky-500 font-bold py-2 px-6 rounded-lg">{t('save')}</button>
                </div>
            </div>
        </div>
    );
};

export default AddNewPlayerModal;
