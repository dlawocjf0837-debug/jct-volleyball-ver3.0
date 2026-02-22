import React, { useMemo, useState } from 'react';
import { useData } from '../contexts/DataContext';
import { Player, TeamSet } from '../types';

const MAX_ROLE_SELECT = 4;

interface RolePlayerPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** 출전 팀의 반 목록 (1팀·2팀 반이 다르면 둘 다, 같으면 하나) */
    selectedClasses: string[];
    /** 출전 선수 ID 목록 (비출전 학생 역할 배정용이므로 제외) */
    excludePlayerIds?: string[];
    roleLabel: string;
    onSelect?: (player: Player) => void;
    multiSelect?: boolean;
    selectedPlayers?: Player[];
    onSelectMultiple?: (players: Player[]) => void;
}

export const RolePlayerPickerModal: React.FC<RolePlayerPickerModalProps> = ({
    isOpen, onClose, selectedClasses, excludePlayerIds = [], roleLabel, onSelect, multiSelect = false, selectedPlayers = [], onSelectMultiple
}) => {
    const { teamSets } = useData();
    const [search, setSearch] = useState('');

    const playersInClasses = useMemo((): Player[] => {
        const keyBy = (p: Player) => `${(p.studentNumber ?? '').toString().trim()}-${(p.originalName ?? '').toString().trim()}`;
        if (!selectedClasses || selectedClasses.length === 0) return [];
        const classSet = new Set(selectedClasses);
        const all: Player[] = [];
        teamSets.forEach(set => {
            if (!classSet.has(set.className)) return;
            set.teams.forEach(team => {
                (team.playerIds ?? []).forEach(pid => {
                    const p = set.players?.[pid];
                    if (p) all.push(p);
                });
            });
        });
        const uniqueStudents = Array.from(
            new Map(all.map(s => [keyBy(s), s])).values()
        );
        const excludeKeys = new Set<string>();
        excludePlayerIds.forEach(pid => {
            for (const set of teamSets) {
                const p = set.players?.[pid];
                if (p) {
                    excludeKeys.add(keyBy(p));
                    break;
                }
            }
        });
        const available = uniqueStudents.filter(p => !excludeKeys.has(keyBy(p)));
        return available.sort((a, b) => parseInt(a.studentNumber || '0') - parseInt(b.studentNumber || '0'));
    }, [teamSets, selectedClasses, excludePlayerIds]);

    const filtered = useMemo(() => {
        if (!search.trim()) return playersInClasses;
        const s = search.toLowerCase();
        return playersInClasses.filter(p =>
            (p.originalName || '').toLowerCase().includes(s) ||
            (p.studentNumber || '').toString().includes(s) ||
            (p.class || '').toLowerCase().includes(s)
        );
    }, [playersInClasses, search]);

    const keyBy = (x: Player) => `${(x.studentNumber ?? '').toString().trim()}-${(x.originalName ?? '').toString().trim()}`;

    const handleClick = (p: Player) => {
        if (multiSelect && onSelectMultiple) {
            const pKey = keyBy(p);
            const alreadySelected = selectedPlayers.some(x => keyBy(x) === pKey);
            if (alreadySelected) {
                onSelectMultiple(selectedPlayers.filter(x => keyBy(x) !== pKey));
            } else if (selectedPlayers.length < MAX_ROLE_SELECT) {
                onSelectMultiple([...selectedPlayers, p]);
            }
        } else if (onSelect) {
            onSelect(p);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-md max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center px-5 py-4 border-b border-slate-700">
                    <h3 className="text-lg font-bold text-white">🎭 {roleLabel} - 학생 선택</h3>
                    <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700 text-gray-400 hover:text-white">✕</button>
                </div>
                {!selectedClasses || selectedClasses.length === 0 ? (
                    <div className="p-6 text-slate-500">먼저 대진(팀 A·B)을 선택해 주세요.</div>
                ) : (
                    <>
                        <div className="px-4 py-2">
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="이름·번호 검색"
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                            />
                        </div>
                        <div className="flex-grow overflow-y-auto p-4 space-y-2">
                            {filtered.map(p => {
                                const isSelected = multiSelect && selectedPlayers.some(x => keyBy(x) === keyBy(p));
                                return (
                                    <button
                                        key={`${p.studentNumber}-${p.originalName}`}
                                        type="button"
                                        onClick={() => handleClick(p)}
                                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                                            isSelected ? 'bg-sky-600/30 border-sky-500' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'
                                        }`}
                                    >
                                        <span className="font-semibold text-slate-200">{p.originalName}</span>
                                        <span className="text-slate-500 text-sm ml-2">({p.studentNumber}번)</span>
                                    </button>
                                );
                            })}
                            {filtered.length === 0 && <p className="text-slate-500 text-center py-6">해당 반에 학생이 없습니다.</p>}
                        </div>
                        {multiSelect && (
                            <div className="px-4 py-3 border-t border-slate-700 flex justify-between items-center">
                                <span className="text-sm text-slate-400">선택: {selectedPlayers.length}/{MAX_ROLE_SELECT}명</span>
                                <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold">완료</button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
