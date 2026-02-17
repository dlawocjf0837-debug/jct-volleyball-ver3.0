import React, { useState, useMemo } from 'react';
import { TeamMatchState, Player, Action } from '../types';
import { useTranslation } from '../hooks/useTranslation';
import { PlayerMemoModal } from './PlayerMemoModal';

interface SubstitutionModalProps {
    isOpen: boolean;
    onClose: () => void;
    teamA: TeamMatchState;
    teamB: TeamMatchState;
    dispatch: React.Dispatch<Action>;
}

const SubstitutionModal: React.FC<SubstitutionModalProps> = ({ isOpen, onClose, teamA, teamB, dispatch }) => {
    const { t } = useTranslation();
    const [selectedTeam, setSelectedTeam] = useState<'A' | 'B'>('A');
    const [playerOut, setPlayerOut] = useState<string | null>(null);
    const [playerIn, setPlayerIn] = useState<string | null>(null);
    const [memoPlayer, setMemoPlayer] = useState<{ team: 'A' | 'B'; player: Player } | null>(null);

    const team = selectedTeam === 'A' ? teamA : teamB;

    const onCourtPlayers = useMemo(() =>
        team.onCourtPlayerIds.map(id => team.players[id]).filter(Boolean),
        [team]
    );

    const benchPlayers = useMemo(() =>
        team.benchPlayerIds.map(id => team.players[id]).filter(Boolean),
        [team]
    );
    
    const handleSubstitute = () => {
        if (playerIn && playerOut) {
            dispatch({ type: 'SUBSTITUTE_PLAYER', team: selectedTeam, playerIn, playerOut });
            handleClose();
        }
    };

    const handleClose = () => {
        setPlayerIn(null);
        setPlayerOut(null);
        onClose();
    }

    if (!isOpen) return null;

    return (
        <>
            <div 
                className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 animate-fade-in"
                onClick={handleClose}
            >
                <div 
                    className="bg-slate-900 rounded-lg shadow-2xl p-6 w-full max-w-2xl text-white border border-slate-700 flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-bold text-[#00A3FF]">{t('substitute_player')}</h2>
                        <button onClick={handleClose} className="text-2xl font-bold text-slate-500 hover:text-white">&times;</button>
                    </div>

                    <div className="flex justify-center gap-4 mb-4 border-b border-slate-700">
                        <button onClick={() => setSelectedTeam('A')} className={`py-2 px-4 text-lg font-semibold border-b-2 ${selectedTeam === 'A' ? 'border-sky-500 text-sky-400' : 'border-transparent text-slate-400'}`}>{teamA.name}</button>
                        <button onClick={() => setSelectedTeam('B')} className={`py-2 px-4 text-lg font-semibold border-b-2 ${selectedTeam === 'B' ? 'border-red-500 text-red-400' : 'border-transparent text-slate-400'}`}>{teamB.name}</button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 h-80 overflow-y-auto">
                        <div>
                            <h3 className="text-lg font-semibold text-center mb-2">{t('on_court_players')} ({t('player_to_remove')})</h3>
                            <div className="space-y-2 bg-slate-800 p-2 rounded-lg">
                                {onCourtPlayers.map(p => (
                                    <div key={p.id} className="flex items-center gap-2">
                                        <button onClick={() => setPlayerOut(p.id)} className={`flex-1 text-left p-3 rounded-md ${playerOut === p.id ? 'bg-red-600 text-white' : 'bg-slate-700 hover:bg-slate-600'}`}>{p.originalName}</button>
                                        <button type="button" onClick={e => { e.stopPropagation(); setMemoPlayer({ team: selectedTeam, player: p }); }} className="p-1.5 rounded hover:bg-slate-600 text-amber-400/90 shrink-0" title="전력 분석 메모">📝</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-center mb-2">{t('bench_players')} ({t('player_to_add')})</h3>
                            <div className="space-y-2 bg-slate-800 p-2 rounded-lg">
                                {benchPlayers.map(p => (
                                    <div key={p.id} className="flex items-center gap-2">
                                        <button onClick={() => setPlayerIn(p.id)} className={`flex-1 text-left p-3 rounded-md ${playerIn === p.id ? 'bg-green-600 text-white' : 'bg-slate-700 hover:bg-slate-600'}`}>{p.originalName}</button>
                                        <button type="button" onClick={e => { e.stopPropagation(); setMemoPlayer({ team: selectedTeam, player: p }); }} className="p-1.5 rounded hover:bg-slate-600 text-amber-400/90 shrink-0" title="전력 분석 메모">📝</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    {memoPlayer && (
                        <PlayerMemoModal
                            isOpen={!!memoPlayer}
                            onClose={() => setMemoPlayer(null)}
                            playerName={memoPlayer.player.originalName}
                            initialMemo={memoPlayer.player.memo ?? ''}
                            onSave={memo => { dispatch({ type: 'UPDATE_PLAYER_MEMO', team: memoPlayer.team, playerId: memoPlayer.player.id, memo }); setMemoPlayer(null); }}
                        />
                    )}

                    <div className="mt-6 flex justify-end gap-4">
                        <button onClick={handleClose} className="bg-slate-600 hover:bg-slate-500 font-bold py-2 px-6 rounded-lg">{t('cancel')}</button>
                        <button onClick={handleSubstitute} disabled={!playerIn || !playerOut} className="bg-green-600 hover:bg-green-500 font-bold py-2 px-6 rounded-lg disabled:bg-slate-700 disabled:cursor-not-allowed">{t('substitute')}</button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default SubstitutionModal;