import React, { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { Player } from '../types';
import { useTranslation } from '../hooks/useTranslation';

interface RoleRecordScreenProps {
    onBack: () => void;
}

type RoleEntry = { role: string; date: string; matchInfo: string; teamCount?: number };

const TEAM_FILTER_VALUES = ['ALL', '2', '3', '4'] as const;
type TeamFilterValue = typeof TEAM_FILTER_VALUES[number];

export default function RoleRecordScreen({ onBack }: RoleRecordScreenProps) {
    const { teamSets } = useData();
    const { t } = useTranslation();
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [teamFilter, setTeamFilter] = useState<TeamFilterValue>('ALL');

    const availableClasses = useMemo(() => {
        const classes = new Set<string>();
        teamSets.forEach(set => {
            if (set.className) classes.add(set.className);
        });
        return Array.from(classes).sort();
    }, [teamSets]);

    const studentsAll = useMemo(() => {
        if (!selectedClass) return [];
        const mergeKey = (p: Player) => {
            const nameNum = `${(p.originalName || '').trim()}|${(p.studentNumber || '').toString()}`;
            return nameNum !== '|' ? nameNum : p.id;
        };
        const mergedByKey = teamSets
            .filter(set => set.className === selectedClass)
            .flatMap(set => Object.values(set.players ?? {}))
            .filter((p): p is Player => !!p)
            .reduce<Map<string, Player & { roleHistory?: RoleEntry[] }>>((acc, p) => {
                const key = mergeKey(p);
                const existing = acc.get(key);
                const history = (p as Player & { roleHistory?: RoleEntry[] }).roleHistory ?? [];
                if (!existing) {
                    acc.set(key, { ...p, roleHistory: [...history] });
                } else {
                    const existingHistory = existing.roleHistory ?? [];
                    const combined = [...new Map(
                        [...existingHistory, ...history].map(e => [`${e.date}|${e.role}|${e.matchInfo}`, e] as const)
                    ).values()];
                    acc.set(key, { ...existing, roleHistory: combined });
                }
                return acc;
            }, new Map());
        return Array.from(mergedByKey.values()).sort(
            (a, b) => parseInt(a.studentNumber || '0') - parseInt(b.studentNumber || '0')
        );
    }, [teamSets, selectedClass]);

    const studentsWithRoles = useMemo(() => {
        return studentsAll
            .filter(p => ((p as Player & { roleHistory?: RoleEntry[] }).roleHistory ?? []).length > 0)
            .map(p => ({
                player: p,
                roleHistory: (p as Player & { roleHistory?: RoleEntry[] }).roleHistory ?? [],
                id: p.id,
            }));
    }, [studentsAll]);

    /** teamFilter에 맞게 걸러낸 역할 이력 (표시·집계용) */
    const studentsWithFilteredRoles = useMemo(() => {
        return studentsWithRoles.map(({ player, roleHistory }) => {
            const filtered = teamFilter === 'ALL'
                ? roleHistory
                : roleHistory.filter(e => String(e.teamCount ?? 4) === teamFilter);
            return { player, roleHistory: filtered, id: player.id };
        });
    }, [studentsWithRoles, teamFilter]);

    const roleCounts = useMemo(() => {
        const counts: Record<string, Record<string, number>> = {};
        studentsWithFilteredRoles.forEach(({ player, roleHistory }) => {
            const id = player.id;
            if (!counts[id]) counts[id] = {};
            roleHistory.forEach(e => {
                counts[id][e.role] = (counts[id][e.role] ?? 0) + 1;
            });
        });
        return counts;
    }, [studentsWithFilteredRoles]);

    const [expandedId, setExpandedId] = useState<string | null>(null);

    const getRoleHistoryForPlayer = (playerId: string): RoleEntry[] => {
        const found = studentsWithFilteredRoles.find(s => s.player.id === playerId);
        const raw = found?.roleHistory ?? [];
        const seen = new Set<string>();
        return raw.filter(e => {
            const key = `${e.date}|${e.role}|${e.matchInfo}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    };

    return (
        <div className="max-w-4xl mx-auto bg-slate-900/50 backdrop-blur-sm border border-slate-700 p-4 sm:p-6 rounded-lg shadow-2xl space-y-6 animate-fade-in px-4">
            <div>
                <label className="block text-base sm:text-lg font-semibold text-slate-300 mb-2">반 선택</label>
                <select
                    value={selectedClass}
                    onChange={e => setSelectedClass(e.target.value)}
                    className="w-full sm:w-72 bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-base sm:text-lg text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                    <option value="">선택하세요</option>
                    {availableClasses.map(c => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                </select>
            </div>

            {selectedClass && (
                <div className="no-print">
                    <label className="block text-sm font-semibold text-slate-400 mb-2">팀 구성 기준</label>
                    <div className="flex flex-wrap gap-2">
                        {TEAM_FILTER_VALUES.map((value) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setTeamFilter(value)}
                                className={`px-3 py-2 text-sm rounded-lg transition-colors min-h-[44px] ${
                                    teamFilter === value
                                        ? 'bg-sky-600 text-white font-semibold'
                                        : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                                }`}
                            >
                                {value === 'ALL' ? '전체' : t('record_team_format', { count: parseInt(value, 10) })}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {!selectedClass && (
                <p className="text-slate-500 text-center py-12">반을 선택하면 학생별 역할 수행 이력이 표시됩니다.</p>
            )}

            {selectedClass && (
                <div className="space-y-4">
                    {studentsAll.map(player => {
                        const history = getRoleHistoryForPlayer(player.id);
                        const counts = roleCounts[player.id] ?? {};
                        const isExpanded = expandedId === player.id;

                        return (
                            <div key={player.id} className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setExpandedId(isExpanded ? null : player.id)}
                                    className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-slate-700/50 transition-colors"
                                >
                                    <div>
                                        <span className="font-semibold text-base sm:text-lg text-slate-200">{player.originalName}</span>
                                        <span className="text-slate-500 text-sm sm:text-base ml-2">({player.studentNumber}번)</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2 justify-end max-w-[280px]">
                                        {Object.entries(counts).map(([role, n]) => (
                                            <span key={role} className="inline-flex px-2.5 py-1 rounded-full text-sm font-semibold bg-sky-600/30 text-sky-300 border border-sky-500/50">
                                                {role}: {n}회
                                            </span>
                                        ))}
                                        {history.length === 0 && (
                                            <span className="text-slate-500 text-sm">없음</span>
                                        )}
                                    </div>
                                    <span className="text-slate-500 ml-2 text-base">{isExpanded ? '▼' : '▶'}</span>
                                </button>

                                {isExpanded && history.length > 0 && (
                                    <div className="border-t border-slate-700 p-4 sm:p-5 space-y-2 bg-slate-900/50">
                                        <h4 className="text-base font-semibold text-slate-400 mb-2">참여 내역</h4>
                                        {history.map((e, i) => (
                                            <div key={i} className="flex items-center gap-3 text-base py-2.5 px-3 rounded-lg bg-slate-800/80">
                                                <span className="text-slate-500 shrink-0">{e.date}</span>
                                                <span className="text-sky-400 font-medium shrink-0">{e.role}</span>
                                                <span className="text-slate-300 truncate">({e.matchInfo})</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {studentsAll.length === 0 && (
                        <p className="text-slate-500 text-center py-12">해당 반에 학생이 없습니다.</p>
                    )}
                </div>
            )}
        </div>
    );
}
