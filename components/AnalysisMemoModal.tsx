import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import localforage from 'localforage';
import type { SavedOpponentTeam } from '../types';

/** 전술판과 동일한 저장소·키 사용 → 양방향 동기화 */
const TACTICAL_MEMOS_KEY = 'jive_tactical_memos';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

/** 팀 이름 기준 메모 읽기 (red/blue 중 하나만 있어도 표시) */
function getMemoForTeam(map: Record<string, string>, teamName: string): string {
    return map[`red_${teamName}`] ?? map[`blue_${teamName}`] ?? '';
}

/** 팀 이름 기준 메모 저장 (전술판에서 어느 쪽으로 불러와도 동일하게 보이도록 red/blue 둘 다 저장) */
async function setMemoForTeam(teamName: string, memo: string): Promise<void> {
    const map = (await localforage.getItem(TACTICAL_MEMOS_KEY) as Record<string, string> | null) ?? {};
    if (memo.trim()) {
        map[`red_${teamName}`] = memo.trim();
        map[`blue_${teamName}`] = memo.trim();
    } else {
        delete map[`red_${teamName}`];
        delete map[`blue_${teamName}`];
    }
    await localforage.setItem(TACTICAL_MEMOS_KEY, map);
}

/** 스포츠클럽(CLUB) 전용 전력 분석 메모 모달. 전술판 메모와 동일 필드(jive_tactical_memos) 사용. */
export const AnalysisMemoModal: React.FC<Props> = ({ isOpen, onClose }) => {
    const { opponentTeams, leagueStandingsList, updateOpponentTeam, teamSets, updatePlayerMemoInTeamSet, showToast } = useData();
    const [category, setCategory] = useState('');
    const [selectedTeamName, setSelectedTeamName] = useState('');
    const [memo, setMemo] = useState('');
    const [playerMemos, setPlayerMemos] = useState<Record<string, string>>({});
    const [storage, setStorage] = useState<Record<string, string>>({});

    const leagueItems = leagueStandingsList?.list ?? [];
    /** CLUB 모드: teamSets의 실제 대회명(className)을 Set으로 중복 제거 후 드롭다운에 매핑 */
    const cats = useMemo(() => {
        const tournamentNames = [...new Set((teamSets ?? []).map((s) => s.className))].sort();
        return [...tournamentNames, ...leagueItems.map((d) => d.tournamentName).filter((n) => !tournamentNames.includes(n)), ...(opponentTeams.length ? ['상대팀'] : [])];
    }, [teamSets, leagueItems, opponentTeams]);

    type TeamPlayer = { id: string; number: string; name: string; memo?: string };
    type TeamItem = { teamName: string; label: string; isOpp?: SavedOpponentTeam; setId?: string; players?: TeamPlayer[] };

    const getTeamsForCat = (cat: string): TeamItem[] => {
        const out: TeamItem[] = [];
        if (cat === '상대팀') {
            opponentTeams.forEach((opp) => out.push({ teamName: opp.name, label: opp.name, isOpp: opp }));
            return out;
        }
        const targetSet = (teamSets ?? []).find((s) => s.className === cat);
        if (targetSet) {
            (targetSet.teams ?? []).forEach((team: { teamName: string; playerIds?: string[] }) => {
                const players: TeamPlayer[] | undefined = team.playerIds?.length
                    ? team.playerIds.map((pid: string) => {
                        const p = targetSet.players?.[pid];
                        return { id: pid, number: (p as { studentNumber?: string })?.studentNumber ?? '', name: (p as { originalName?: string })?.originalName ?? '', memo: (p as { memo?: string })?.memo ?? '' };
                    })
                    : undefined;
                out.push({ teamName: team.teamName, label: team.teamName, setId: targetSet.id, players });
            });
            return out;
        }
        const ld = leagueItems.find((d) => d.tournamentName === cat);
        if (ld) ld.teams.forEach((tn) => {
            const isOpp = opponentTeams.find((o) => o.name === tn);
            let setId: string | undefined;
            let players: TeamPlayer[] | undefined;
            for (const set of teamSets ?? []) {
                const team = set.teams?.find((t: { teamName: string }) => t.teamName === tn);
                if (team?.playerIds?.length) {
                    setId = set.id;
                    players = team.playerIds.map((pid: string) => {
                        const p = set.players?.[pid];
                        return { id: pid, number: (p as { studentNumber?: string })?.studentNumber ?? '', name: (p as { originalName?: string })?.originalName ?? '', memo: (p as { memo?: string })?.memo ?? '' };
                    });
                    break;
                }
            }
            out.push({ teamName: tn, label: tn, isOpp, setId, players });
        });
        return out;
    };

    const teams = useMemo(() => getTeamsForCat(category || cats[0] || ''), [category, cats, leagueItems, opponentTeams, teamSets]);
    /** id(setId+teamName) 기준 중복 제거하여 좌측 팀 리스트 렌더 시 동일 key 방지 */
    const uniqueTeams = useMemo(() => {
        const seen = new Set<string>();
        return teams.filter((t) => {
            const id = `${t.setId ?? 'x'}-${t.teamName}`;
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
        if (!isOpen) return;
        setCategory(cats[0] ?? '');
        setSelectedTeamName('');
        setMemo('');
    }, [isOpen, cats]);

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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/95 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="전력 분석 메모">
            <div className="bg-slate-800 rounded-xl border border-slate-600 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 border-b border-slate-600 font-semibold text-slate-200 text-center text-xl">📊 전력 분석 메모</div>

                <div className="flex-1 flex min-h-0">
                    {/* 왼쪽: 대회 & 팀 리스트 (CLUB 전용) */}
                    <div className="w-64 flex-shrink-0 flex flex-col border-r border-slate-600 p-3 bg-slate-800/50">
                        <label className="text-slate-400 text-xs font-medium mb-1">대회</label>
                        <select
                            value={category || (cats[0] ?? '')}
                            onChange={(e) => { setCategory(e.target.value); setSelectedTeamName(''); }}
                            className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-slate-200 text-sm mb-3"
                        >
                            {cats.map((c, idx) => (
                                <option key={`cat-${idx}-${c}`} value={c}>{c}</option>
                            ))}
                        </select>
                        <label className="text-slate-400 text-xs font-medium mb-1">팀 선택</label>
                        <div className="flex-1 overflow-y-auto rounded-lg bg-slate-700/50 border border-slate-600 min-h-0">
                            {uniqueTeams.length === 0 ? (
                                <p className="p-3 text-slate-500 text-sm">팀이 없습니다.</p>
                            ) : (
                                uniqueTeams.map((t) => (
                                    <button
                                        key={`${t.setId ?? 'no-set'}-${t.teamName}`}
                                        type="button"
                                        onClick={() => setSelectedTeamName(t.teamName)}
                                        className={`block w-full text-left px-3 py-2 text-sm rounded-none border-b border-slate-600/50 last:border-b-0 ${selectedTeamName === t.teamName ? 'bg-sky-600/30 text-sky-200' : 'text-slate-300 hover:bg-slate-600/50'}`}
                                    >
                                        {t.label}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* 오른쪽: 팀 전체 전력 분석 + 선수별 개인 전력 분석 (전술판·전광판과 동일 필드) */}
                    <div className="flex-1 flex flex-col min-w-0 p-4 overflow-y-auto">
                        {selectedTeamName ? (
                            <>
                                <p className="text-slate-300 font-medium mb-1">팀 전체 전력 분석</p>
                                <p className="text-slate-500 text-xs mb-2">{(selectedTeam?.label ?? selectedTeamName)} · 전술판/전광판 메모와 동일</p>
                                <textarea
                                    value={memo}
                                    onChange={(e) => setMemo(e.target.value)}
                                    placeholder="팀 전체에 대한 전력 분석을 작성하세요."
                                    className="min-h-[120px] w-full rounded-lg bg-slate-700 border border-slate-600 p-3 text-slate-200 text-sm resize-none placeholder:text-slate-500"
                                    rows={5}
                                />
                                <div className="mt-2 flex justify-end">
                                    <button type="button" onClick={handleSave} className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium">팀 메모 저장</button>
                                </div>

                                {/* 선수 개인별 전력 분석: 선택된 팀의 players를 항상 렌더 (player.memo 바인딩) */}
                                <div className="mt-6 border-t border-slate-600 pt-4">
                                    <p className="text-slate-300 font-medium mb-2">선수 개인별 전력 분석</p>
                                    <p className="text-slate-500 text-xs mb-3">선수별 메모는 전술판·전광판 선수 자석 메모와 동일하게 공유됩니다.</p>
                                    <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-1">
                                        {(selectedTeam?.isOpp?.players ?? []).map((p, idx) => {
                                            const key = `${p?.number ?? p?.name ?? ''}`;
                                            return (
                                                <div key={`opp-${selectedTeam?.isOpp?.id ?? 'opp'}-${idx}-${key}`} className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
                                                    <label className="block text-slate-300 text-sm font-medium mb-1">#{p?.number} {p?.name}</label>
                                                    <textarea value={playerMemos[key] ?? ''} onChange={(e) => setPlayerMemos((prev) => ({ ...prev, [key]: e.target.value }))} placeholder="개인 전력 분석 메모" className="w-full min-h-[60px] rounded-lg bg-slate-700 border border-slate-600 p-2 text-slate-200 text-sm resize-none placeholder:text-slate-500" rows={2} />
                                                    <div className="mt-2 flex justify-end">
                                                        <button type="button" onClick={() => handleSavePlayerMemo(key, playerMemos[key] ?? '')} className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium">저장</button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {(selectedTeam?.players ?? []).map((p, idx) => {
                                            const key = p.id;
                                            return (
                                                <div key={`club-${key}-${idx}`} className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
                                                    <label className="block text-slate-300 text-sm font-medium mb-1">#{p?.number} {p?.name}</label>
                                                    <textarea value={playerMemos[key] ?? ''} onChange={(e) => setPlayerMemos((prev) => ({ ...prev, [key]: e.target.value }))} placeholder="개인 전력 분석 메모" className="w-full min-h-[60px] rounded-lg bg-slate-700 border border-slate-600 p-2 text-slate-200 text-sm resize-none placeholder:text-slate-500" rows={2} />
                                                    <div className="mt-2 flex justify-end">
                                                        <button type="button" onClick={() => handleSavePlayerMemo(key, playerMemos[key] ?? '')} className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium">저장</button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {((selectedTeam?.isOpp?.players?.length ?? 0) === 0 && (selectedTeam?.players?.length ?? 0) === 0) && (
                                            <p className="p-3 text-slate-500 text-sm">등록된 선수가 없습니다. 팀 관리에서 선수를 추가하세요.</p>
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">왼쪽에서 팀을 선택하세요.</div>
                        )}
                    </div>
                </div>

                <div className="p-3 border-t border-slate-600">
                    <button type="button" onClick={onClose} className="w-full py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-slate-200 text-sm">닫기</button>
                </div>
            </div>
        </div>
    );
};
