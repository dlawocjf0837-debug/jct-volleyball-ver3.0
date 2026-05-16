const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

// --- AnalysisMemoModal.tsx (UTF-8 + Portal + size) ---
const analysisPath = path.join(root, 'components', 'AnalysisMemoModal.tsx');
const analysisContent = `import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useData } from '../contexts/DataContext';
import localforage from 'localforage';
import type { SavedOpponentTeam } from '../types';
import { MemoTimelinePanel } from './MemoTimelinePanel';
import { MemoEntry, parseMemoEntries, serializeMemoEntries } from '../utils/memoTimeline';

const TACTICAL_MEMOS_KEY = 'jive_tactical_memos';

export type AnalysisMemoFocusTarget = {
    playerId: string;
    teamName: string;
    category?: string;
};

interface Props {
    isOpen: boolean;
    onClose: () => void;
    focusTarget?: AnalysisMemoFocusTarget | null;
    onFocusComplete?: () => void;
}

function getMemoForTeam(map: Record<string, string>, teamName: string): string {
    return map[\`red_\${teamName}\`] ?? map[\`blue_\${teamName}\`] ?? '';
}

async function setMemoForTeam(teamName: string, memo: string): Promise<void> {
    const map = (await localforage.getItem(TACTICAL_MEMOS_KEY) as Record<string, string> | null) ?? {};
    if (memo.trim()) {
        map[\`red_\${teamName}\`] = memo.trim();
        map[\`blue_\${teamName}\`] = memo.trim();
    } else {
        delete map[\`red_\${teamName}\`];
        delete map[\`blue_\${teamName}\`];
    }
    await localforage.setItem(TACTICAL_MEMOS_KEY, map);
}

function formatPlayerNumber(number?: string): string {
    if (!number || number === '??') return '';
    return \`#\${number} \`;
}

export const AnalysisMemoModal: React.FC<Props> = ({ isOpen, onClose, focusTarget, onFocusComplete }) => {
    const { opponentTeams, leagueStandingsList, updateOpponentTeam, teamSets, updatePlayerMemoInTeamSet, showToast } = useData();
    const [category, setCategory] = useState('');
    const [selectedTeamName, setSelectedTeamName] = useState('');
    const [teamMemoEntries, setTeamMemoEntries] = useState<MemoEntry[]>([]);
    const [playerMemoEntries, setPlayerMemoEntries] = useState<Record<string, MemoEntry[]>>({});
    const [storage, setStorage] = useState<Record<string, string>>({});
    const rightPanelRef = useRef<HTMLDivElement>(null);
    const focusHandledRef = useRef<string | null>(null);

    const leagueItems = leagueStandingsList?.list ?? [];
    const cats = useMemo(() => {
        const tournamentNames = [...new Set((teamSets ?? []).map((s) => s.className))].sort();
        return [
            ...tournamentNames,
            ...leagueItems.map((d) => d.tournamentName).filter((n) => !tournamentNames.includes(n)),
            ...(opponentTeams.length ? ['\uC0C1\uB300\uD300'] : []),
        ];
    }, [teamSets, leagueItems, opponentTeams]);

    type TeamPlayer = { id: string; number: string; name: string; memo?: string };
    type TeamItem = { teamName: string; label: string; isOpp?: SavedOpponentTeam; setId?: string; players?: TeamPlayer[] };

    const getTeamsForCat = (cat: string): TeamItem[] => {
        const out: TeamItem[] = [];
        if (cat === '\uC0C1\uB300\uD300') {
            opponentTeams.forEach((opp) => out.push({ teamName: opp.name, label: opp.name, isOpp: opp }));
            return out;
        }
        const targetSet = (teamSets ?? []).find((s) => s.className === cat);
        if (targetSet) {
            (targetSet.teams ?? []).forEach((team: { teamName: string; playerIds?: string[] }) => {
                const players: TeamPlayer[] | undefined = team.playerIds?.length
                    ? team.playerIds.map((pid: string) => {
                        const p = targetSet.players?.[pid];
                        return {
                            id: pid,
                            number: (p as { studentNumber?: string })?.studentNumber ?? '',
                            name: (p as { originalName?: string })?.originalName ?? '',
                            memo: (p as { memo?: string })?.memo ?? '',
                        };
                    })
                    : undefined;
                out.push({ teamName: team.teamName, label: team.teamName, setId: targetSet.id, players });
            });
            return out;
        }
        const ld = leagueItems.find((d) => d.tournamentName === cat);
        if (ld) {
            ld.teams.forEach((tn) => {
                const isOpp = opponentTeams.find((o) => o.name === tn);
                let setId: string | undefined;
                let players: TeamPlayer[] | undefined;
                for (const set of teamSets ?? []) {
                    const team = set.teams?.find((t: { teamName: string }) => t.teamName === tn);
                    if (team?.playerIds?.length) {
                        setId = set.id;
                        players = team.playerIds.map((pid: string) => {
                            const p = set.players?.[pid];
                            return {
                                id: pid,
                                number: (p as { studentNumber?: string })?.studentNumber ?? '',
                                name: (p as { originalName?: string })?.originalName ?? '',
                                memo: (p as { memo?: string })?.memo ?? '',
                            };
                        });
                        break;
                    }
                }
                out.push({ teamName: tn, label: tn, isOpp, setId, players });
            });
        }
        return out;
    };

    const teams = useMemo(() => getTeamsForCat(category || cats[0] || ''), [category, cats, leagueItems, opponentTeams, teamSets]);
    const uniqueTeams = useMemo(() => {
        const seen = new Set<string>();
        return teams.filter((t) => {
            const id = \`\${t.setId ?? 'x'}-\${t.teamName}\`;
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
        });
    }, [teams]);
    const selectedTeam = uniqueTeams.find((t) => t.teamName === selectedTeamName) ?? teams.find((t) => t.teamName === selectedTeamName);

    useEffect(() => {
        if (isOpen) {
            const prev = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => { document.body.style.overflow = prev; };
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            setCategory((prev) => prev || (cats[0] ?? ''));
        } else {
            setCategory('');
            setSelectedTeamName('');
            focusHandledRef.current = null;
        }
    }, [isOpen, cats]);

    useEffect(() => {
        if (!isOpen || !focusTarget) return;
        if (focusTarget.category && cats.includes(focusTarget.category)) {
            setCategory(focusTarget.category);
        }
        setSelectedTeamName(focusTarget.teamName);
        focusHandledRef.current = null;
    }, [isOpen, focusTarget, cats]);

    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        (async () => {
            const map = (await localforage.getItem(TACTICAL_MEMOS_KEY) as Record<string, string> | null) ?? {};
            if (!cancelled) setStorage(map);
        })();
        return () => { cancelled = true; };
    }, [isOpen]);

    useEffect(() => {
        if (cats[0] && !category) setCategory(cats[0]);
    }, [cats, category]);

    useEffect(() => {
        if (selectedTeamName) {
            setTeamMemoEntries(parseMemoEntries(getMemoForTeam(storage, selectedTeamName)));
        } else {
            setTeamMemoEntries([]);
        }
    }, [selectedTeamName, storage]);

    useEffect(() => {
        const next: Record<string, MemoEntry[]> = {};
        if (selectedTeam?.isOpp?.players?.length) {
            selectedTeam.isOpp.players.forEach((p) => { next[\`\${p.number ?? p.name}\`] = parseMemoEntries(p.memo); });
        } else if (selectedTeam?.players?.length) {
            selectedTeam.players.forEach((p) => { next[p.id] = parseMemoEntries(p.memo); });
        }
        setPlayerMemoEntries(next);
    }, [selectedTeamName, selectedTeam?.isOpp?.id, selectedTeam?.isOpp?.players, selectedTeam?.setId, selectedTeam?.players]);

    useEffect(() => {
        if (!isOpen || !focusTarget || selectedTeamName !== focusTarget.teamName) return;
        const focusKey = \`\${focusTarget.teamName}-\${focusTarget.playerId}\`;
        if (focusHandledRef.current === focusKey) return;
        const timer = window.setTimeout(() => {
            const el = document.getElementById(\`analysis-memo-player-\${focusTarget.playerId}\`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.classList.add('ring-2', 'ring-sky-400', 'ring-offset-2', 'ring-offset-slate-800');
                window.setTimeout(() => {
                    el.classList.remove('ring-2', 'ring-sky-400', 'ring-offset-2', 'ring-offset-slate-800');
                }, 2200);
                focusHandledRef.current = focusKey;
                onFocusComplete?.();
            }
        }, 200);
        return () => clearTimeout(timer);
    }, [isOpen, focusTarget, selectedTeamName, playerMemoEntries, onFocusComplete]);

    const persistTeamMemos = useCallback(async (entries: MemoEntry[]) => {
        if (!selectedTeamName) return;
        const payload = serializeMemoEntries(entries);
        await setMemoForTeam(selectedTeamName, payload);
        setStorage((prev) => {
            const next = { ...prev };
            if (payload.trim()) {
                next[\`red_\${selectedTeamName}\`] = payload;
                next[\`blue_\${selectedTeamName}\`] = payload;
            } else {
                delete next[\`red_\${selectedTeamName}\`];
                delete next[\`blue_\${selectedTeamName}\`];
            }
            return next;
        });
        showToast?.('\uBA54\uBAA8\uAC00 \uC131\uACF5\uC801\uC73C\uB85C \uC800\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4.', 'success');
    }, [selectedTeamName, showToast]);

    const persistPlayerMemos = useCallback(async (playerKey: string, entries: MemoEntry[]) => {
        const payload = serializeMemoEntries(entries);
        const opp = selectedTeam?.isOpp;
        if (opp?.id && opp?.players) {
            const updated = (opp.players ?? []).map((p) => {
                const key = \`\${p?.number ?? p?.name}\`;
                return key === playerKey ? { ...p, memo: payload } : p;
            });
            await updateOpponentTeam(opp.id, { players: updated });
        } else if (selectedTeam?.setId) {
            await updatePlayerMemoInTeamSet(selectedTeam.setId, playerKey, payload);
        } else return;
        setPlayerMemoEntries((prev) => ({ ...prev, [playerKey]: entries }));
        showToast?.('\uBA54\uBAA8\uAC00 \uC131\uACF5\uC801\uC73C\uB85C \uC800\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4.', 'success');
    }, [selectedTeam, updateOpponentTeam, updatePlayerMemoInTeamSet, showToast]);

    if (!isOpen) return null;

    const modalContent = (
        <motion.div
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 font-sans antialiased"
            style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans KR", "Apple SD Gothic Neo", sans-serif' }}
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label="\uC804\uB825 \uBD84\uC11D \uBA54\uBAA8"
        >
            <motion.div
                className="bg-slate-800 rounded-xl border border-slate-600 w-[800px] max-w-[90vw] max-h-[90vh] overflow-hidden flex flex-col shadow-2xl font-sans"
                onClick={(e) => e.stopPropagation()}
            >
                <motion.div className="p-4 border-b border-slate-600 font-semibold text-slate-200 text-center text-xl">
                    \uD83D\uDCCA \uC804\uB825 \uBD84\uC11D \uBA54\uBAA8
                </motion.div>

                <motion.div className="flex-1 flex min-h-0">
                    <motion.div className="w-64 flex-shrink-0 flex flex-col border-r border-slate-600 p-3 bg-slate-800/50">
                        <label className="text-slate-400 text-xs font-medium mb-1">\uB300\uD68C</label>
                        <select
                            value={category || (cats[0] ?? '')}
                            onChange={(e) => { setCategory(e.target.value); setSelectedTeamName(''); focusHandledRef.current = null; }}
                            className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-slate-200 text-sm mb-3 font-sans"
                        >
                            {cats.map((c, idx) => (
                                <option key={\`cat-\${idx}-\${c}\`} value={c}>{c}</option>
                            ))}
                        </select>
                        <label className="text-slate-400 text-xs font-medium mb-1">\uD300 \uC120\uD0DD</label>
                        <motion.div className="flex-1 overflow-y-auto rounded-lg bg-slate-700/50 border border-slate-600 min-h-0">
                            {uniqueTeams.length === 0 ? (
                                <p className="p-3 text-slate-500 text-sm">\uD300\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</p>
                            ) : (
                                uniqueTeams.map((t) => (
                                    <button
                                        key={\`\${t.setId ?? 'no-set'}-\${t.teamName}\`}
                                        type="button"
                                        onClick={() => { setSelectedTeamName(t.teamName); focusHandledRef.current = null; }}
                                        className={\`block w-full text-left px-3 py-2 text-sm rounded-none border-b border-slate-600/50 last:border-b-0 \${selectedTeamName === t.teamName ? 'bg-sky-600/30 text-sky-200' : 'text-slate-300 hover:bg-slate-600/50'}\`}
                                    >
                                        {t.label}
                                    </button>
                                ))
                            )}
                        </motion.div>
                    </motion.div>

                    <motion.div ref={rightPanelRef} className="flex-1 flex flex-col min-w-0 p-4 overflow-y-auto font-sans">
                        {selectedTeamName ? (
                            <>
                                <p className="text-slate-300 font-medium mb-1">\uD300 \uC804\uCCB4 \uC804\uB825 \uBD84\uC11D</p>
                                <p className="text-slate-500 text-xs mb-3">{(selectedTeam?.label ?? selectedTeamName)} \u00B7 \uC804\uC220\uD310/\uC804\uAD11\uD310 \uBA54\uBAA8\uC640 \uB3D9\uC77C</p>
                                <MemoTimelinePanel
                                    entries={teamMemoEntries}
                                    onChange={setTeamMemoEntries}
                                    onSave={persistTeamMemos}
                                    placeholder="\uD300 \uC804\uCCB4\uC5D0 \uB300\uD55C \uC804\uB825 \uBD84\uC11D\uC744 \uC791\uC131\uD558\uC138\uC694."
                                />

                                <motion.div className="mt-6 border-t border-slate-600 pt-4">
                                    <p className="text-slate-300 font-medium mb-2">\uC120\uC218 \uAC1C\uC778\uBCC4 \uC804\uB825 \uBD84\uC11D</p>
                                    <p className="text-slate-500 text-xs mb-3">\uC120\uC218\uBCC4 \uBA54\uBAA8\uB294 \uC804\uC220\uD310\u00B7\uC804\uAD11\uD310 \uC120\uC218 \uC790\uC11D \uBA54\uBAA8\uC640 \uB3D9\uC77C\uD558\uAC8C \uACF5\uC720\uB429\uB2C8\uB2E4.</p>
                                    <motion.div className="space-y-6 max-h-[40vh] overflow-y-auto pr-1">
                                        {(selectedTeam?.isOpp?.players ?? []).map((p, idx) => {
                                            const key = \`\${p?.number ?? p?.name ?? ''}\`;
                                            const domId = \`analysis-memo-player-opp-\${key}\`;
                                            const isFocus = focusTarget?.playerId === key;
                                            return (
                                                <motion.div
                                                    id={isFocus ? \`analysis-memo-player-\${focusTarget!.playerId}\` : domId}
                                                    key={\`opp-\${selectedTeam?.isOpp?.id ?? 'opp'}-\${idx}-\${key}\`}
                                                    className="bg-slate-700/50 rounded-lg p-3 border border-slate-600 scroll-mt-4"
                                                >
                                                    <label className="block text-slate-300 text-sm font-medium mb-2">{formatPlayerNumber(p?.number)}{p?.name}</label>
                                                    <MemoTimelinePanel
                                                        compact
                                                        entries={playerMemoEntries[key] ?? []}
                                                        onChange={(entries) => setPlayerMemoEntries((prev) => ({ ...prev, [key]: entries }))}
                                                        onSave={(entries) => persistPlayerMemos(key, entries)}
                                                        placeholder="\uAC1C\uC778 \uC804\uB825 \uBD84\uC11D \uBA54\uBAA8"
                                                    />
                                                </motion.div>
                                            );
                                        })}
                                        {(selectedTeam?.players ?? []).map((p, idx) => (
                                            <motion.div
                                                id={\`analysis-memo-player-\${p.id}\`}
                                                key={\`club-\${p.id}-\${idx}\`}
                                                className="bg-slate-700/50 rounded-lg p-3 border border-slate-600 scroll-mt-4"
                                            >
                                                <label className="block text-slate-300 text-sm font-medium mb-2">{formatPlayerNumber(p?.number)}{p?.name}</label>
                                                <MemoTimelinePanel
                                                    compact
                                                    entries={playerMemoEntries[p.id] ?? []}
                                                    onChange={(entries) => setPlayerMemoEntries((prev) => ({ ...prev, [p.id]: entries }))}
                                                    onSave={(entries) => persistPlayerMemos(p.id, entries)}
                                                    placeholder="\uAC1C\uC778 \uC804\uB825 \uBD84\uC11D \uBA54\uBAA8"
                                                />
                                            </motion.div>
                                        ))}
                                        {((selectedTeam?.isOpp?.players?.length ?? 0) === 0 && (selectedTeam?.players?.length ?? 0) === 0) && (
                                            <p className="p-3 text-slate-500 text-sm">\uB4F1\uB85D\uB41C \uC120\uC218\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. \uD300 \uAD00\uB9AC\uC5D0\uC11C \uC120\uC218\uB97C \uCD94\uAC00\uD558\uC138\uC694.</p>
                                        )}
                                    </motion.div>
                                </motion.div>
                            </>
                        ) : (
                            <motion.div className="flex-1 flex items-center justify-center text-slate-500 text-sm">\uC67C\uCABD\uC5D0\uC11C \uD300\uC744 \uC120\uD0DD\uD558\uC138\uC694.</motion.div>
                        )}
                    </motion.div>
                </motion.div>

                <motion.div className="p-3 border-t border-slate-600">
                    <button type="button" onClick={onClose} className="w-full py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-slate-200 text-sm">\uB2EB\uAE30</button>
                </motion.div>
            </motion.div>
        </motion.div>
    );

    return typeof document !== 'undefined' ? ReactDOM.createPortal(modalContent, document.body) : null;
};
`;

// Fix motion.div typo - use div not motion.div in script
const analysisFixed = analysisContent.replace(/motion\.div/g, 'motion.div').replace(/<motion\.motion\.div/g, '<motion.div');
// Actually I accidentally used motion.div - need to use div only!
const analysisFinal = analysisContent.replace(/motion\.div/g, 'div');

fs.writeFileSync(analysisPath, analysisFinal, 'utf8');

// --- MemoTimelinePanel.tsx ---
const memoPanelPath = path.join(root, 'components', 'MemoTimelinePanel.tsx');
let memoPanel = fs.readFileSync(memoPanelPath, 'utf8');
memoPanel = memoPanel.replace(
    "placeholder={placeholder ?? '??? ?????.'}",
    "placeholder={placeholder ?? '\uBA54\uBAA8\uB97C \uC785\uB825\uD558\uC138\uC694.'}"
);
memoPanel = memoPanel.replace(
    '<p className="text-slate-500 text-sm text-center py-4">??? ??? ????.</p>',
    '<p className="text-slate-500 text-sm text-center py-4">\uC800\uC7A5\uB41C \uBA54\uBAA8\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</p>'
);
memoPanel = memoPanel.replace(
    'className="text-xs px-2 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white">??</button>',
    'className="text-xs px-2 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white">\uC800\uC7A5</button>'
);
memoPanel = memoPanel.replace(
    'setEditingContent(\'\'); }} className="text-xs px-2 py-1 rounded bg-slate-600 text-slate-300">??</button>',
    'setEditingContent(\'\'); }} className="text-xs px-2 py-1 rounded bg-slate-600 text-slate-300">\uCDE8\uC18C</button>'
);
memoPanel = memoPanel.replace(
    'className="text-xs px-2 py-1 rounded bg-slate-600 hover:bg-slate-500 text-slate-300">??</button>',
    'className="text-xs px-2 py-1 rounded bg-slate-600 hover:bg-slate-500 text-slate-300">\uC218\uC815</button>'
);
memoPanel = memoPanel.replace(
    'className="text-xs px-2 py-1 rounded bg-red-900/50 hover:bg-red-800/50 text-red-300">??</button>',
    'className="text-xs px-2 py-1 rounded bg-red-900/50 hover:bg-red-800/50 text-red-300">\uC0AD\uC81C</button>'
);
if (!memoPanel.includes('font-sans')) {
    memoPanel = memoPanel.replace(
        "return (\n        <div className={compact ? 'space-y-2' : 'space-y-3'}",
        "return (\n        <div className={`font-sans antialiased ${compact ? 'space-y-2' : 'space-y-3'}`}"
    );
}
fs.writeFileSync(memoPanelPath, memoPanel, 'utf8');

console.log('Fixed:', analysisPath, memoPanelPath);
