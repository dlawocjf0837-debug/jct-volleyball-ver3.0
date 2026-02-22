import React, { useState } from 'react';
import { Player } from '../types';

interface HustlePlayerModalProps {
    isOpen: boolean;
    onClose: () => void;
    teamAPlayers: Player[];
    teamBPlayers: Player[];
    teamAName: string;
    teamBName: string;
    onConfirm: (selectedPlayerIds: string[]) => void;
}

export const HustlePlayerModal: React.FC<HustlePlayerModalProps> = ({
    isOpen,
    onClose,
    teamAPlayers,
    teamBPlayers,
    teamAName,
    teamBName,
    onConfirm,
}) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const toggle = (playerId: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(playerId)) next.delete(playerId);
            else next.add(playerId);
            return next;
        });
    };

    const handleConfirm = () => {
        onConfirm(Array.from(selectedIds));
        setSelectedIds(new Set());
        onClose();
    };

    const handleSkip = () => {
        onConfirm([]);
        setSelectedIds(new Set());
        onClose();
    };

    if (!isOpen) return null;

    const PlayerList: React.FC<{ players: Player[]; teamName: string; teamColor: string }> = ({ players, teamName, teamColor }) => (
        <div className="space-y-2">
            <h4 className="text-sm font-bold text-slate-400">{teamName}</h4>
            <div className="space-y-1.5">
                {players.map(p => {
                    const isSelected = selectedIds.has(p.id);
                    return (
                        <label
                            key={p.id}
                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors border-2 ${
                                isSelected ? 'bg-amber-900/40 border-amber-500' : 'bg-slate-800/80 border-slate-700 hover:bg-slate-700/80'
                            }`}
                        >
                            <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggle(p.id)}
                                className="h-5 w-5 rounded accent-amber-500"
                            />
                            <span className="font-semibold text-slate-200">{p.originalName}</span>
                            <span className="text-slate-500 text-sm">({p.studentNumber}번)</span>
                        </label>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4" onClick={onClose}>
            <div className="bg-slate-900 rounded-2xl shadow-2xl border-2 border-amber-500/50 w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="px-5 py-4 border-b border-slate-700 bg-amber-900/20">
                    <h3 className="text-xl font-bold text-amber-400">🔥 오늘의 허슬 플레이어(노력상) 선정</h3>
                    <p className="text-sm text-slate-400 mt-1">가장 열심히 한 학생을 선택해 주세요. (다중 선택·미선택 가능)</p>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    <PlayerList players={teamAPlayers} teamName={teamAName} teamColor="#38bdf8" />
                    <PlayerList players={teamBPlayers} teamName={teamBName} teamColor="#f87171" />
                </div>
                <div className="px-4 py-3 border-t border-slate-700 flex justify-between gap-3">
                    <button type="button" onClick={handleSkip} className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold">
                        선택 안 함
                    </button>
                    <button type="button" onClick={handleConfirm} className="px-6 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold">
                        확인 ({selectedIds.size}명)
                    </button>
                </div>
            </div>
        </div>
    );
};
