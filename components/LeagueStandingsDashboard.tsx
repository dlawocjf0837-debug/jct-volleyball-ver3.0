import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { LeagueStandingsData, LeagueStandingsMatch, getSetsWonFromMatch, SetScore, TeamSet } from '../types';

const POINTS_WIN = 3;
const POINTS_DRAW = 1;
const POINTS_LOSS = 0;

function computeStandings(teams: string[], matches: LeagueStandingsMatch[]) {
    const rows: { team: string; played: number; won: number; draw: number; lost: number; setsFor: number; setsAgainst: number; setDiff: number; points: number }[] = teams.map(team => ({
        team,
        played: 0,
        won: 0,
        draw: 0,
        lost: 0,
        setsFor: 0,
        setsAgainst: 0,
        setDiff: 0,
        points: 0,
    }));
    const map = new Map(rows.map(r => [r.team, r]));

    matches.forEach(m => {
        const { setsA, setsB } = getSetsWonFromMatch(m);
        const rowA = map.get(m.teamA);
        const rowB = map.get(m.teamB);
        if (!rowA || !rowB) return;
        rowA.played += 1;
        rowB.played += 1;
        rowA.setsFor += setsA;
        rowA.setsAgainst += setsB;
        rowB.setsFor += setsB;
        rowB.setsAgainst += setsA;
        if (setsA > setsB) {
            rowA.won += 1;
            rowA.points += POINTS_WIN;
            rowB.lost += 1;
        } else if (setsB > setsA) {
            rowB.won += 1;
            rowB.points += POINTS_WIN;
            rowA.lost += 1;
        } else {
            rowA.draw += 1;
            rowB.draw += 1;
            rowA.points += POINTS_DRAW;
            rowB.points += POINTS_DRAW;
        }
    });

    rows.forEach(r => { r.setDiff = r.setsFor - r.setsAgainst; });
    rows.sort((a, b) => b.points - a.points || b.setDiff - a.setDiff);
    return rows;
}

export interface LeagueStandingsDashboardProps {
    appMode?: 'CLASS' | 'CLUB';
    onStartLeagueLive?: (teamA: string, teamB: string) => void;
}

export const LeagueStandingsDashboard: React.FC<LeagueStandingsDashboardProps> = ({ appMode = 'CLASS', onStartLeagueLive }) => {
    const { leagueStandingsList, saveLeagueStandingsList, showToast, teamSets } = useData();
    const isClub = appMode === 'CLUB';

    const data = useMemo(() => {
        if (isClub && teamSets.length > 0) {
            const listFromTeamSets: LeagueStandingsData[] = teamSets.map((set: TeamSet) => ({
                id: set.id,
                tournamentName: set.className,
                teams: set.teams.map((t: { teamName: string }) => t.teamName),
                matches: leagueStandingsList.list.find(d => d.id === set.id)?.matches ?? [],
                ourSchool: leagueStandingsList.list.find(d => d.id === set.id)?.ourSchool,
            }));
            const selectedId = leagueStandingsList.selectedId && listFromTeamSets.some(d => d.id === leagueStandingsList.selectedId)
                ? leagueStandingsList.selectedId
                : listFromTeamSets[0]?.id ?? null;
            return listFromTeamSets.find(d => d.id === selectedId) ?? listFromTeamSets[0] ?? null;
        }
        const cur = leagueStandingsList.list.find(d => d.id === leagueStandingsList.selectedId) ?? leagueStandingsList.list[0] ?? null;
        return cur;
    }, [leagueStandingsList, teamSets, isClub]);
    const [newTeamName, setNewTeamName] = useState('');
    const [addTeamOpen, setAddTeamOpen] = useState(false);
    const [newTournamentName, setNewTournamentName] = useState('');
    const [tournamentNameLocal, setTournamentNameLocal] = useState('');
    const isComposingRef = useRef(false);
    const [matchModal, setMatchModal] = useState<{ teamA: string; teamB: string; setScores: SetScore[] } | null>(null);
    const [editingMatchIndex, setEditingMatchIndex] = useState<number | null>(null);
    const [inputModeModal, setInputModeModal] = useState<{ teamA: string; teamB: string } | null>(null);

    useEffect(() => {
        if (data) setTournamentNameLocal(data.tournamentName);
        else setTournamentNameLocal('');
    }, [data?.id, data?.tournamentName]);

    const persist = (next: LeagueStandingsData) => {
        if (!next) return;
        const list = leagueStandingsList.list.map(d => d.id === next.id ? next : d);
        const idx = list.findIndex(d => d.id === next.id);
        if (idx < 0) return;
        saveLeagueStandingsList({ list, selectedId: leagueStandingsList.selectedId });
    };

    const persistData = (next: LeagueStandingsData) => {
        let list = leagueStandingsList.list;
        if (isClub && !list.some(d => d.id === next.id)) {
            list = [...list, next];
        } else {
            list = list.map(d => d.id === next.id ? next : d);
        }
        saveLeagueStandingsList({ ...leagueStandingsList, list });
    };

    const setTitle = (tournamentName: string) => data && persistData({ ...data, tournamentName });
    const setOurSchool = (ourSchool: string | undefined) => data && persistData({ ...data, ourSchool: ourSchool || undefined });
    const handleTournamentNameBlur = () => {
        if (isComposingRef.current) return;
        const v = tournamentNameLocal.trim();
        if (data && v !== data.tournamentName) setTitle(v);
    };

    const addTournament = () => {
        const name = newTournamentName.trim();
        if (!name) return;
        const id = `leg_${Date.now()}`;
        const newData: LeagueStandingsData = { id, tournamentName: name, teams: [], matches: [] };
        const list = [...leagueStandingsList.list, newData];
        saveLeagueStandingsList({ list, selectedId: id });
        setNewTournamentName('');
    };

    const addTeam = () => {
        if (!data) return;
        const name = newTeamName.trim();
        if (!name) return;
        if (data.teams.includes(name)) {
            showToast('이미 추가된 학교입니다.', 'error');
            return;
        }
        persistData({ ...data, teams: [...data.teams, name] });
        setNewTeamName('');
        setAddTeamOpen(false);
    };

    const removeTeam = (name: string) => {
        if (!data) return;
        const teams = data.teams.filter(t => t !== name);
        const matches = data.matches.filter(m => m.teamA !== name && m.teamB !== name);
        persistData({ ...data, teams, matches });
    };

    const openInputModeModal = (teamA: string, teamB: string) => setInputModeModal({ teamA, teamB });

    const openMatchModal = (teamA: string, teamB: string, existing?: LeagueStandingsMatch, index?: number) => {
        const setScores = existing?.setScores?.length ? [...existing.setScores] : [{ teamA: 0, teamB: 0 }, { teamA: 0, teamB: 0 }, { teamA: 0, teamB: 0 }];
        while (setScores.length < 3) setScores.push({ teamA: 0, teamB: 0 });
        setMatchModal({ teamA, teamB, setScores });
        setEditingMatchIndex(index ?? null);
    };

    const saveMatch = () => {
        if (!matchModal || !data) return;
        const setScores = matchModal.setScores
            .map(s => ({ teamA: Number(s.teamA) || 0, teamB: Number(s.teamB) || 0 }))
            .filter(s => s.teamA > 0 || s.teamB > 0);
        if (setScores.length === 0) {
            showToast('최소 1세트 이상 점수를 입력하세요.', 'error');
            return;
        }
        const newMatch: LeagueStandingsMatch = { teamA: matchModal.teamA, teamB: matchModal.teamB, setScores };
        let matches: LeagueStandingsMatch[];
        if (editingMatchIndex !== null && data.matches[editingMatchIndex]) {
            matches = data.matches.map((m, i) => (i === editingMatchIndex ? newMatch : m));
        } else {
            const filtered = data.matches.filter(
                m => !(m.teamA === matchModal.teamA && m.teamB === matchModal.teamB)
            );
            matches = [...filtered, newMatch];
        }
        persistData({ ...data, matches });
        setMatchModal(null);
        setEditingMatchIndex(null);
    };

    const removeMatch = (index: number) => {
        if (!data) return;
        const matches = data.matches.filter((_, i) => i !== index);
        persistData({ ...data, matches });
    };

    const standings = useMemo(() => (data ? computeStandings(data.teams, data.matches) : []), [data?.teams, data?.matches]);

    const pairs = useMemo(() => {
        if (!data) return [];
        const out: { a: string; b: string }[] = [];
        for (let i = 0; i < data.teams.length; i++) {
            for (let j = i + 1; j < data.teams.length; j++) {
                out.push({ a: data.teams[i], b: data.teams[j] });
            }
        }
        return out;
    }, [data?.teams]);

    const getMatchResult = (teamA: string, teamB: string) => {
        return data?.matches.find(m => (m.teamA === teamA && m.teamB === teamB) || (m.teamA === teamB && m.teamB === teamA));
    };

    const remainingForTeam = (team: string) => {
        if (!data) return 0;
        const played = data.matches.filter(m => m.teamA === team || m.teamB === team).length;
        const total = Math.max(0, data.teams.length - 1);
        return total - played;
    };

    const ourRow = data?.ourSchool ? standings.find(r => r.team === data.ourSchool) : null;
    const ourRank = ourRow && data?.ourSchool ? standings.findIndex(r => r.team === data.ourSchool) + 1 : 0;

    if (!data && (isClub ? teamSets.length === 0 : leagueStandingsList.list.length === 0)) {
        return (
            <div className="w-full max-w-5xl mx-auto mt-8 sm:mt-10 pt-8 border-t border-amber-500/30">
                <h2 className="text-xl sm:text-2xl font-bold text-amber-400/95 mb-4">🏆 조별 리그 순위표</h2>
                <div className="bg-slate-800/50 border border-amber-500/20 rounded-xl p-4 sm:p-6">
                    {isClub ? (
                        <p className="text-slate-300">팀 관리에서 <strong>대회(조)</strong>와 <strong>학교(팀)</strong>를 추가한 뒤 순위표를 이용하세요.</p>
                    ) : (
                        <>
                            <label className="block text-sm font-medium text-slate-400 mb-1">대회 이름</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newTournamentName}
                                    onChange={e => setNewTournamentName(e.target.value)}
                                    placeholder="예: 교육감배 배구대회 예선 A조"
                                    className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500"
                                />
                                <button type="button" onClick={addTournament} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium whitespace-nowrap">
                                    ✅ 새 대회 추가
                                </button>
                            </div>
                            <p className="text-slate-500 text-sm mt-2">대회 이름을 입력한 뒤 [새 대회 추가]를 누르세요.</p>
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <>
        <div className="w-full max-w-5xl mx-auto mt-8 sm:mt-10 pt-8 border-t border-amber-500/30">
            <h2 className="text-xl sm:text-2xl font-bold text-amber-400/95 mb-4 flex items-center gap-2">
                🏆 조별 리그 순위표 (Standings)
            </h2>

            <div className="bg-slate-800/50 border border-amber-500/20 rounded-xl p-4 sm:p-6 space-y-6">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-sm font-medium text-slate-400 mb-1">대회 선택</label>
                        <select
                            value={(isClub ? (data?.id ?? leagueStandingsList.selectedId) : leagueStandingsList.selectedId) ?? ''}
                            onChange={e => saveLeagueStandingsList({ ...leagueStandingsList, selectedId: e.target.value || null })}
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-amber-500"
                        >
                            {isClub
                                ? teamSets.map((d: TeamSet) => (
                                    <option key={d.id} value={d.id}>{d.className || '(이름 없음)'}</option>
                                  ))
                                : leagueStandingsList.list.map(d => (
                                    <option key={d.id} value={d.id}>{d.tournamentName || '(이름 없음)'}</option>
                                  ))}
                        </select>
                    </div>
                    {!isClub && (
                        <>
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-sm font-medium text-slate-400 mb-1">대회(조) 이름</label>
                                <input
                                    type="text"
                                    value={tournamentNameLocal}
                                    onChange={e => setTournamentNameLocal(e.target.value)}
                                    onCompositionStart={() => { isComposingRef.current = true; }}
                                    onCompositionEnd={(e) => { isComposingRef.current = false; setTournamentNameLocal(e.currentTarget.value); handleTournamentNameBlur(); }}
                                    onBlur={handleTournamentNameBlur}
                                    placeholder="예: 교육감배 배구대회 예선 A조"
                                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">&nbsp;</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newTournamentName}
                                        onChange={e => setNewTournamentName(e.target.value)}
                                        placeholder="새 대회 이름"
                                        className="w-40 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 text-sm focus:ring-2 focus:ring-amber-500"
                                    />
                                    <button type="button" onClick={addTournament} className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium text-sm whitespace-nowrap">
                                        ✅ 새 대회 추가
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {data && !isClub && (
                <div>
                    <div>
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="text-sm font-medium text-slate-400">참가 학교</span>
                            <button
                                type="button"
                                onClick={() => setAddTeamOpen(true)}
                                className="text-sm py-1.5 px-3 rounded-lg bg-amber-600/80 hover:bg-amber-500 text-white font-medium"
                            >
                                + 참가 학교 추가
                            </button>
                        </div>
                    </div>
                    {addTeamOpen && (
                        <div className="flex gap-2 mb-3">
                            <input
                                type="text"
                                value={newTeamName}
                                onChange={e => setNewTeamName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addTeam()}
                                placeholder="학교 이름 입력"
                                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500"
                            />
                            <button type="button" onClick={addTeam} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium">추가</button>
                            <button type="button" onClick={() => { setAddTeamOpen(false); setNewTeamName(''); }} className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg">취소</button>
                        </div>
                    )}
                    <ul className="flex flex-wrap gap-2">
                        {data.teams.map(name => (
                            <li key={name} className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-700/80 rounded-lg text-slate-200 text-sm">
                                {name}
                                <button type="button" onClick={() => removeTeam(name)} className="text-red-400 hover:text-red-300 ml-1" aria-label="삭제">×</button>
                            </li>
                        ))}
                        {data.teams.length === 0 && <span className="text-slate-500 text-sm">참가 학교를 추가하세요.</span>}
                    </ul>
                </div>
                )}

                {data && data.teams.length >= 2 && (
                    <>
                        <div>
                            <h3 className="text-sm font-medium text-slate-400 mb-2">경기 결과 입력 (세트 스코어)</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {pairs.map((item) => {
                                    const { a, b } = item;
                                    const m = getMatchResult(a, b);
                                    const { setsA, setsB } = m ? getSetsWonFromMatch(m) : { setsA: 0, setsB: 0 };
                                    const idx = m ? data.matches.findIndex(x => (x.teamA === a && x.teamB === b) || (x.teamA === b && x.teamB === a)) : -1;
                                    return (
                                        <div key={`${a}-${b}`} className="flex items-center justify-between gap-2 p-2 bg-slate-700/50 rounded-lg">
                                            <span className="text-slate-300 text-sm truncate">{a} vs {b}</span>
                                            <div className="flex items-center gap-1 shrink-0">
                                                {m ? (
                                                    <>
                                                        <span className="text-amber-400 font-medium">{setsA}:{setsB}</span>
                                                        <button type="button" onClick={() => openMatchModal(a, b, m, idx)} className="text-xs text-sky-400 hover:underline">수정</button>
                                                        <button type="button" onClick={() => idx >= 0 && removeMatch(idx)} className="text-xs text-red-400 hover:underline">삭제</button>
                                                    </>
                                                ) : (
                                                    <button type="button" onClick={() => openInputModeModal(a, b)} className="text-xs py-1 px-2 rounded bg-amber-600/70 hover:bg-amber-500 text-white">입력</button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <h3 className="text-sm font-medium text-slate-400 mb-2">순위표</h3>
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-600">
                                        <th className="text-left py-2 px-2 text-slate-400 font-semibold">순위</th>
                                        <th className="text-left py-2 px-2 text-slate-400 font-semibold">팀</th>
                                        <th className="text-center py-2 px-2 text-slate-400 font-semibold">경기</th>
                                        <th className="text-center py-2 px-2 text-slate-400 font-semibold">승</th>
                                        <th className="text-center py-2 px-2 text-slate-400 font-semibold">무</th>
                                        <th className="text-center py-2 px-2 text-slate-400 font-semibold">패</th>
                                        <th className="text-center py-2 px-2 text-slate-400 font-semibold">세트 득실</th>
                                        <th className="text-center py-2 px-2 text-slate-400 font-semibold">승점</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {standings.map((row, i) => (
                                        <tr
                                            key={row.team}
                                            className={`border-b border-slate-700/70 ${row.team === data.ourSchool ? 'bg-amber-500/10' : ''}`}
                                        >
                                            <td className="py-2 px-2 font-medium text-slate-300">{i + 1}</td>
                                            <td className="py-2 px-2 font-medium text-slate-200">{row.team}</td>
                                            <td className="py-2 px-2 text-center text-slate-400">{row.played}</td>
                                            <td className="py-2 px-2 text-center text-green-400">{row.won}</td>
                                            <td className="py-2 px-2 text-center text-slate-400">{row.draw}</td>
                                            <td className="py-2 px-2 text-center text-red-400">{row.lost}</td>
                                            <td className="py-2 px-2 text-center text-slate-300">{row.setDiff >= 0 ? `+${row.setDiff}` : row.setDiff}</td>
                                            <td className="py-2 px-2 text-center font-bold text-amber-400">{row.points}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">우리 학교 (진출 시나리오 기준)</label>
                            <select
                                value={data.ourSchool ?? ''}
                                onChange={e => setOurSchool(e.target.value || undefined)}
                                className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-amber-500"
                            >
                                <option value="">선택 안 함</option>
                                {data.teams.map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                            {ourRow && (
                                <p className="mt-2 text-sm text-amber-300/90">
                                    현재 <strong>{ourRank}위</strong> (승점 {ourRow.points}, 세트 득실 {ourRow.setDiff >= 0 ? `+${ourRow.setDiff}` : ourRow.setDiff}). 
                                    남은 경기 <strong>{remainingForTeam(data.ourSchool!)}</strong>경기. 
                                    전승 시 승점 +{remainingForTeam(data.ourSchool!) * POINTS_WIN} (최대 {ourRow.points + remainingForTeam(data.ourSchool!) * POINTS_WIN}점).
                                </p>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* 경기 진행 방식 선택 모달 */}
            {inputModeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-slate-900 rounded-xl shadow-2xl p-6 w-full max-w-sm border border-slate-700">
                        <h3 className="text-lg font-bold text-amber-400 mb-2">경기 진행 방식 선택</h3>
                        <p className="text-slate-400 text-sm mb-6">
                            {inputModeModal.teamA} vs {inputModeModal.teamB}
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    openMatchModal(inputModeModal.teamA, inputModeModal.teamB);
                                    setInputModeModal(null);
                                }}
                                className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
                            >
                                ✍️ 수기 결과 입력
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    onStartLeagueLive?.(inputModeModal.teamA, inputModeModal.teamB);
                                    setInputModeModal(null);
                                }}
                                className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg font-bold transition-colors"
                            >
                                📺 라이브 전광판 켜기
                            </button>
                            <button
                                type="button"
                                onClick={() => setInputModeModal(null)}
                                className="w-full py-3 px-4 bg-transparent hover:bg-slate-800 text-slate-400 rounded-lg font-medium transition-colors mt-2"
                            >
                                취소
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {matchModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setMatchModal(null)}>
                    <div className="bg-slate-900 rounded-xl shadow-2xl p-6 w-full max-w-sm border border-slate-700" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-amber-400 mb-3">경기 결과 입력 (3판 2선승제)</h3>
                        <p className="text-slate-400 text-sm mb-3">{matchModal.teamA} vs {matchModal.teamB}</p>
                        <div className="space-y-3 mb-4">
                            {[0, 1, 2].map(i => (
                                <div key={i} className="flex items-center gap-2">
                                    <span className="text-slate-500 text-sm w-12">세트{i + 1}</span>
                                    <input
                                        type="number"
                                        min={0}
                                        value={matchModal.setScores[i]?.teamA ?? ''}
                                        onChange={e => {
                                            const v = e.target.value;
                                            setMatchModal(prev => prev ? { ...prev, setScores: prev.setScores.map((s, j) => j === i ? { ...s, teamA: v === '' ? 0 : parseInt(v, 10) || 0 } : s) } : null);
                                        }}
                                        placeholder="A"
                                        className="w-16 bg-slate-800 border border-slate-600 rounded-lg px-2 py-2 text-white text-center"
                                    />
                                    <span className="text-slate-400">:</span>
                                    <input
                                        type="number"
                                        min={0}
                                        value={matchModal.setScores[i]?.teamB ?? ''}
                                        onChange={e => {
                                            const v = e.target.value;
                                            setMatchModal(prev => prev ? { ...prev, setScores: prev.setScores.map((s, j) => j === i ? { ...s, teamB: v === '' ? 0 : parseInt(v, 10) || 0 } : s) } : null);
                                        }}
                                        placeholder="B"
                                        className="w-16 bg-slate-800 border border-slate-600 rounded-lg px-2 py-2 text-white text-center"
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setMatchModal(null)} className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg">취소</button>
                            <button type="button" onClick={saveMatch} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium">저장</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
        </>
    );
};
