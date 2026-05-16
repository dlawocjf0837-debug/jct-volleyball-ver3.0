# -*- coding: utf-8 -*-
import subprocess
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "components" / "AnalysisMemoModal.tsx"
text = subprocess.check_output(["git", "show", "HEAD:components/AnalysisMemoModal.tsx"], cwd=path.parents[1]).decode("utf-8")

text = text.replace(
    "import React, { useState, useEffect, useMemo } from 'react';",
    "import React, { useState, useEffect, useMemo, useCallback } from 'react';",
)
text = text.replace(
    "import type { SavedOpponentTeam } from '../types';\n",
    "import type { SavedOpponentTeam } from '../types';\n"
    "import { MemoTimelinePanel } from './MemoTimelinePanel';\n"
    "import { MemoEntry, parseMemoEntries, serializeMemoEntries } from '../utils/memoTimeline';\n",
)

text = text.replace(
    "await localforage.setItem(TACTICAL_MEMOS_KEY, map);\n}\n\n/** ",
    "await localforage.setItem(TACTICAL_MEMOS_KEY, map);\n}\n\n"
    "function formatPlayerNumber(number?: string): string {\n"
    "    if (!number || number === '??') return '';\n"
    "    return `#${number} `;\n"
    "}\n\n/** ",
)

text = text.replace(
    "const [memo, setMemo] = useState('');\n    const [playerMemos, setPlayerMemos] = useState<Record<string, string>>({});",
    "const [teamMemoEntries, setTeamMemoEntries] = useState<MemoEntry[]>([]);\n"
    "    const [playerMemoEntries, setPlayerMemoEntries] = useState<Record<string, MemoEntry[]>>({});",
)
text = text.replace("        setMemo('');\n", "")

old_handlers = """    useEffect(() => {
        if (selectedTeamName) setMemo(getMemoForTeam(storage, selectedTeamName));
        else setMemo('');
    }, [selectedTeamName, storage]);

    useEffect(() => {
        const next: Record<string, string> = {};
        if (selectedTeam?.isOpp?.players?.length) {
            selectedTeam.isOpp.players.forEach((p) => { next[`${p.number ?? p.name}`] = p.memo ?? ''; });
        } else if (selectedTeam?.players?.length) {
            selectedTeam.players.forEach((p) => { next[p.id] = p.memo ?? ''; });
        }
        setPlayerMemos(next);
    }, [selectedTeamName, selectedTeam?.isOpp?.id, selectedTeam?.isOpp?.players, selectedTeam?.setId, selectedTeam?.players]);

    const handleSave = async () => {
        if (!selectedTeamName) return;
        await setMemoForTeam(selectedTeamName, memo);
        setStorage((prev) => {
            const next = { ...prev };
            if (memo.trim()) {
                next[`red_${selectedTeamName}`] = memo.trim();
                next[`blue_${selectedTeamName}`] = memo.trim();
            } else {
                delete next[`red_${selectedTeamName}`];
                delete next[`blue_${selectedTeamName}`];
            }
            return next;
        });
        showToast?.('메모가 성공적으로 저장되었습니다.', 'success');
    };

    const handleSavePlayerMemo = async (playerKey: string, value: string) => {
        const opp = selectedTeam?.isOpp;
        if (opp?.id && opp?.players) {
            const updated = (opp.players ?? []).map((p) => {
                const key = `${p?.number ?? p?.name}`;
                return key === playerKey ? { ...p, memo: value } : p;
            });
            await updateOpponentTeam(opp.id, { players: updated });
        } else if (selectedTeam?.setId && selectedTeam?.players) {
            await updatePlayerMemoInTeamSet(selectedTeam.setId, playerKey, value);
        } else return;
        setPlayerMemos((prev) => ({ ...prev, [playerKey]: value }));
        showToast?.('메모가 성공적으로 저장되었습니다.', 'success');
    };

    useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);"""

new_handlers = """    useEffect(() => {
        if (selectedTeamName) {
            setTeamMemoEntries(parseMemoEntries(getMemoForTeam(storage, selectedTeamName)));
        } else {
            setTeamMemoEntries([]);
        }
    }, [selectedTeamName, storage]);

    useEffect(() => {
        const next: Record<string, MemoEntry[]> = {};
        if (selectedTeam?.isOpp?.players?.length) {
            selectedTeam.isOpp.players.forEach((p) => { next[`${p.number ?? p.name}`] = parseMemoEntries(p.memo); });
        } else if (selectedTeam?.players?.length) {
            selectedTeam.players.forEach((p) => { next[p.id] = parseMemoEntries(p.memo); });
        }
        setPlayerMemoEntries(next);
    }, [selectedTeamName, selectedTeam?.isOpp?.id, selectedTeam?.isOpp?.players, selectedTeam?.setId, selectedTeam?.players]);

    const persistTeamMemos = useCallback(async (entries: MemoEntry[]) => {
        if (!selectedTeamName) return;
        const payload = serializeMemoEntries(entries);
        await setMemoForTeam(selectedTeamName, payload);
        setStorage((prev) => {
            const next = { ...prev };
            if (payload.trim()) {
                next[`red_${selectedTeamName}`] = payload;
                next[`blue_${selectedTeamName}`] = payload;
            } else {
                delete next[`red_${selectedTeamName}`];
                delete next[`blue_${selectedTeamName}`];
            }
            return next;
        });
        showToast?.('메모가 성공적으로 저장되었습니다.', 'success');
    }, [selectedTeamName, showToast]);

    const persistPlayerMemos = useCallback(async (playerKey: string, entries: MemoEntry[]) => {
        const payload = serializeMemoEntries(entries);
        const opp = selectedTeam?.isOpp;
        if (opp?.id && opp?.players) {
            const updated = (opp.players ?? []).map((p) => {
                const key = `${p?.number ?? p?.name}`;
                return key === playerKey ? { ...p, memo: payload } : p;
            });
            await updateOpponentTeam(opp.id, { players: updated });
        } else if (selectedTeam?.setId) {
            await updatePlayerMemoInTeamSet(selectedTeam.setId, playerKey, payload);
        } else return;
        setPlayerMemoEntries((prev) => ({ ...prev, [playerKey]: entries }));
        showToast?.('메모가 성공적으로 저장되었습니다.', 'success');
    }, [selectedTeam, updateOpponentTeam, updatePlayerMemoInTeamSet, showToast]);"""

if old_handlers not in text:
    raise SystemExit("handlers block not found")
text = text.replace(old_handlers, new_handlers)

old_team_ui = """                                <p className="text-slate-500 text-xs mb-2">{(selectedTeam?.label ?? selectedTeamName)} · 전술판/전광판 메모와 동일</p>
                                <textarea
                                    value={memo}
                                    onChange={(e) => setMemo(e.target.value)}
                                    placeholder="팀 전체에 대한 전력 분석을 작성하세요."
                                    className="min-h-[120px] w-full rounded-lg bg-slate-700 border border-slate-600 p-3 text-slate-200 text-sm resize-none placeholder:text-slate-500"
                                    rows={5}
                                />
                                <motion className="mt-2 flex justify-end">
                                    <button type="button" onClick={handleSave} className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium">팀 메모 저장</button>
                                </div>"""

new_team_ui = """                                <p className="text-slate-500 text-xs mb-3">{(selectedTeam?.label ?? selectedTeamName)} · 전술판/전광판 메모와 동일</p>
                                <MemoTimelinePanel
                                    entries={teamMemoEntries}
                                    onChange={setTeamMemoEntries}
                                    onSave={persistTeamMemos}
                                    placeholder="팀 전체에 대한 전력 분석을 작성하세요."
                                />"""

old_team_ui = old_team_ui.replace("<motion", "<div").replace("</motion>", "</div>")
new_team_ui = new_team_ui  # already div

if old_team_ui not in text:
    raise SystemExit("team ui block not found")
text = text.replace(old_team_ui, new_team_ui)

text = text.replace(
    '<label className="block text-slate-300 text-sm font-medium mb-1">#{p?.number} {p?.name}</label>',
    '<label className="block text-slate-300 text-sm font-medium mb-2">{formatPlayerNumber(p?.number)}{p?.name}</label>',
)

old_player_block = """                                                    <textarea value={playerMemos[key] ?? ''} onChange={(e) => setPlayerMemos((prev) => ({ ...prev, [key]: e.target.value }))} placeholder="개인 전력 분석 메모" className="w-full min-h-[60px] rounded-lg bg-slate-700 border border-slate-600 p-2 text-slate-200 text-sm resize-none placeholder:text-slate-500" rows={2} />
                                                    <div className="mt-2 flex justify-end">
                                                        <button type="button" onClick={() => handleSavePlayerMemo(key, playerMemos[key] ?? '')} className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium">저장</button>
                                                    </div>"""

new_player_block = """                                                    <MemoTimelinePanel
                                                        compact
                                                        entries={playerMemoEntries[key] ?? []}
                                                        onChange={(entries) => setPlayerMemoEntries((prev) => ({ ...prev, [key]: entries }))}
                                                        onSave={(entries) => persistPlayerMemos(key, entries)}
                                                        placeholder="개인 전력 분석 메모"
                                                    />"""

if old_player_block not in text:
    raise SystemExit("player block not found")
text = text.replace(old_player_block, new_player_block)
text = text.replace('className="space-y-4 max-h-[40vh]', 'className="space-y-6 max-h-[40vh]')

path.write_text(text, encoding="utf-8")
print("AnalysisMemoModal patched OK")
