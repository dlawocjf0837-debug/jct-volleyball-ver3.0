import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { LeagueStandingsData, LeagueStandingsMatch } from '../types';

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
        const rowA = map.get(m.teamA);
        const rowB = map.get(m.teamB);
        if (!rowA || !rowB) return;
        rowA.played += 1;
        rowB.played += 1;
        rowA.setsFor += m.setsA;
        rowA.setsAgainst += m.setsB;
        rowB.setsFor += m.setsB;
        rowB.setsAgainst += m.setsA;
        if (m.setsA > m.setsB) {
            rowA.won += 1;
            rowA.points += POINTS_WIN;
            rowB.lost += 1;
        } else if (m.setsB > m.setsA) {
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

const defaultData: LeagueStandingsData = { tournamentName: '', teams: [], matches: [] };

export const LeagueStandingsDashboard: React.FC = () => {
    const { leagueStandings, saveLeagueStandings, showToast } = useData();
    const [data, setData] = useState<LeagueStandingsData>(defaultData);
    const [newTeamName, setNewTeamName] = useState('');
    const [addTeamOpen, setAddTeamOpen] = useState(false);
    const [matchModal, setMatchModal] = useState<{ teamA: string; teamB: string; setsA: string; setsB: string } | null>(null);
    const [editingMatchIndex, setEditingMatchIndex] = useState<number | null>(null);

    useEffect(() => {
        if (leagueStandings) setData(leagueStandings);
        else setData(defaultData);
    }, [leagueStandings]);

    const persist = (next: LeagueStandingsData) => {
        setData(next);
        saveLeagueStandings(next);
    };

    const setTitle = (tournamentName: string) => persist({ ...data, tournamentName });
    const setOurSchool = (ourSchool: string | undefined) => persist({ ...data, ourSchool: ourSchool || undefined });

    const addTeam = () => {
        const name = newTeamName.trim();
        if (!name) return;
        if (data.teams.includes(name)) {
            showToast('이미 추가된 학교입니다.', 'error');
            return;
        }
        persist({ ...data, teams: [...data.teams, name] });
        setNewTeamName('');
        setAddTeamOpen(false);
    };

    const removeTeam = (name: string) => {
        const teams = data.teams.filter(t => t !== name);
        const matches = data.matches.filter(m => m.teamA !== name && m.teamB !== name);
        persist({ ...data, teams, matches });
    };

    const openMatchModal = (teamA: string, teamB: string, existing?: LeagueStandingsMatch, index?: number) => {
        setMatchModal({
            teamA,
            teamB,
            setsA: existing ? String(existing.setsA) : '',
            setsB: existing ? String(existing.setsB) : '',
        });
        setEditingMatchIndex(index ?? null);
    };

    const saveMatch = () => {
        if (!matchModal) return;
        const setsA = parseInt(matchModal.setsA, 10);
        const setsB = parseInt(matchModal.setsB, 10);
        if (isNaN(setsA) || isNaN(setsB) || setsA < 0 || setsB < 0) {
            showToast('세트 스코어를 0 이상 숫자로 입력하세요.', 'error');
            return;
        }
        const newMatch: LeagueStandingsMatch = { teamA: matchModal.teamA, teamB: matchModal.teamB, setsA, setsB };
        let matches: LeagueStandingsMatch[];
        if (editingMatchIndex !== null && data.matches[editingMatchIndex]) {
            matches = data.matches.map((m, i) => (i === editingMatchIndex ? newMatch : m));
        } else {
            const filtered = data.matches.filter(
                m => !(m.teamA === matchModal.teamA && m.teamB === matchModal.teamB)
            );
            matches = [...filtered, newMatch];
        }
        persist({ ...data, matches });
        setMatchModal(null);
        setEditingMatchIndex(null);
    };

    const removeMatch = (index: number) => {
        const matches = data.matches.filter((_, i) => i !== index);
        persist({ ...data, matches });
    };

    const standings = useMemo(() => computeStandings(data.teams, data.matches), [data.teams, data.matches]);

    const pairs = useMemo(() => {
        const out: { a: string; b: string }[] = [];
        for (let i = 0; i < data.teams.length; i++) {
            for (let j = i + 1; j < data.teams.length; j++) {
                out.push({ a: data.teams[i], b: data.teams[j] });
            }
        }
        return out;
    }, [data.teams]);

    const getMatchResult = (teamA: string, teamB: string) => {
        return data.matches.find(m => (m.teamA === teamA && m.teamB === teamB) || (m.teamA === teamB && m.teamB === teamA));
    };

    const remainingForTeam = (team: string) => {
        const played = data.matches.filter(m => m.teamA === team || m.teamB === team).length;
        const total = Math.max(0, data.teams.length - 1);
        return total - played;
    };

    const ourRow = data.ourSchool ? standings.find(r => r.team === data.ourSchool) : null;
    const ourRank = ourRow ? standings.findIndex(r => r.team === data.ourSchool) + 1 : 0;

    return (
        <div className="w-full max-w-5xl mx-auto mt-8 sm:mt-10 pt-8 border-t border-amber-500/30">
            <h2 className="text-xl sm:text-2xl font-bold text-amber-400/95 mb-4 flex items-center gap-2">
                🏆 조별 리그 순위표 (Standings)
            </h2>

            <div className="bg-slate-800/50 border border-amber-500/20 rounded-xl p-4 sm:p-6 space-y-6">
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">대회(조) 이름</label>
                    <input
                        type="text"
                        value={data.tournamentName}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="예: 교육감배 배구대회 예선 A조"
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                </div>

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

                {data.teams.length >= 2 && (
                    <>
                        <div>
                            <h3 className="text-sm font-medium text-slate-400 mb-2">경기 결과 입력 (세트 스코어)</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {pairs.map(({ a, b }) => {
                                    const m = getMatchResult(a, b);
                                    const idx = m ? data.matches.findIndex(x => (x.teamA === a && x.teamB === b) || (x.teamA === b && x.teamB === a)) : -1;
                                    return (
                                        <div key={`${a}-${b}`} className="flex items-center justify-between gap-2 p-2 bg-slate-700/50 rounded-lg">
                                            <span className="text-slate-300 text-sm truncate">{a} vs {b}</span>
                                            <div className="flex items-center gap-1 shrink-0">
                                                {m ? (
                                                    <>
                                                        <span className="text-amber-400 font-medium">{m.setsA}:{m.setsB}</span>
                                                        <button type="button" onClick={() => openMatchModal(a, b, m, idx)} className="text-xs text-sky-400 hover:underline">수정</button>
                                                        <button type="button" onClick={() => idx >= 0 && removeMatch(idx)} className="text-xs text-red-400 hover:underline">삭제</button>
                                                    </>
                                                ) : (
                                                    <button type="button" onClick={() => openMatchModal(a, b)} className="text-xs py-1 px-2 rounded bg-amber-600/70 hover:bg-amber-500 text-white">입력</button>
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

            {matchModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setMatchModal(null)}>
                    <div className="bg-slate-900 rounded-xl shadow-2xl p-6 w-full max-w-sm border border-slate-700" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-amber-400 mb-3">경기 결과 입력</h3>
                        <p className="text-slate-400 text-sm mb-3">{matchModal.teamA} vs {matchModal.teamB}</p>
                        <div className="flex items-center gap-2 mb-4">
                            <input
                                type="number"
                                min={0}
                                value={matchModal.setsA}
                                onChange={e => setMatchModal(prev => prev ? { ...prev, setsA: e.target.value } : null)}
                                placeholder="A 세트"
                                className="w-20 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-center"
                            />
                            <span className="text-slate-400">:</span>
                            <input
                                type="number"
                                min={0}
                                value={matchModal.setsB}
                                onChange={e => setMatchModal(prev => prev ? { ...prev, setsB: e.target.value } : null)}
                                placeholder="B 세트"
                                className="w-20 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-center"
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setMatchModal(null)} className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg">취소</button>
                            <button type="button" onClick={saveMatch} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium">저장</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
