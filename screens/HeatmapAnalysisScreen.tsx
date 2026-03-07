import React, { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { HeatmapViewer, HitRecord } from '../components/HeatmapViewer';

const ALL_COMPETITIONS = '';
const ALL_MATCHES = '';

interface HeatmapAnalysisScreenProps {
    appMode?: 'CLASS' | 'CLUB';
    onBack?: () => void;
}

/** 히트맵 전용 분석 대시보드: 팀·대회·경기 필터 → 풀코트 히트맵 시각화 */
const HeatmapAnalysisScreen: React.FC<HeatmapAnalysisScreenProps> = ({ appMode = 'CLASS', onBack }) => {
    const { matchHistory, leagueMatchHistory, teamSets } = useData();
    const [selectedTeamId, setSelectedTeamId] = useState<string>(ALL_COMPETITIONS);
    const [selectedCompetition, setSelectedCompetition] = useState<string>(ALL_COMPETITIONS);
    const [selectedMatchId, setSelectedMatchId] = useState<string>(ALL_MATCHES);

    const sourceMatches = appMode === 'CLUB' ? (leagueMatchHistory ?? matchHistory ?? []) : (matchHistory ?? []);
    const completedMatches = useMemo(() => (sourceMatches || []).filter((m: any) => m?.status === 'completed' && m?.winner), [sourceMatches]);

    const teamList = useMemo(() => {
        const set = new Set<string>();
        (teamSets ?? []).forEach((s: { teams: { teamName: string }[] }) => s.teams?.forEach((t: { teamName: string }) => t.teamName && set.add(t.teamName)));
        return Array.from(set).sort();
    }, [teamSets]);

    const getComp = useMemo(() => (key: string) => {
        if (!key) return null;
        const [setId] = String(key).split('___');
        return (teamSets ?? []).find((s: any) => s.id === setId)?.className ?? null;
    }, [teamSets]);

    const availableCompetitions = useMemo(() => {
        const list = [...new Set((teamSets ?? []).map((s: { className: string }) => s.className))].filter(Boolean).sort();
        return list;
    }, [teamSets]);

    const matchesByCompetition = useMemo(() => {
        let list = completedMatches;
        if (appMode === 'CLUB' && selectedCompetition) {
            list = list.filter((match: any) => {
                const keyA = match?.teamA?.key || match?.teamB?.key;
                const keyB = match?.teamB?.key;
                const compA = getComp(keyA || '');
                const compB = keyB ? getComp(keyB) : compA;
                return compA === selectedCompetition && compB === selectedCompetition;
            });
        }
        return list;
    }, [completedMatches, appMode, selectedCompetition, getComp]);

    const matchOptions = useMemo(() => {
        return matchesByCompetition.map((m: any, i: number) => {
            const a = m?.teamA?.name ?? 'A';
            const b = m?.teamB?.name ?? 'B';
            const date = m?.date ? new Date(m.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) : '';
            const id = `match-${i}-${m?.date ?? ''}-${a}-${b}`;
            return { id, label: `${a} vs ${b}${date ? ` (${date})` : ''}`, match: m };
        });
    }, [matchesByCompetition]);

    const filteredMatches = useMemo(() => {
        if (selectedMatchId === ALL_MATCHES) return matchesByCompetition;
        const opt = matchOptions.find(o => o.id === selectedMatchId);
        return opt ? [opt.match] : [];
    }, [matchesByCompetition, selectedMatchId, matchOptions]);

    const { scoreRecords, concedeRecords } = useMemo(() => {
        const teamScores: HitRecord[] = [];
        const teamConcedes: HitRecord[] = [];
        const targetId = String(selectedTeamId);
        if (!targetId || targetId === ALL_COMPETITIONS) return { scoreRecords: teamScores, concedeRecords: teamConcedes };

        const toHitRecord = (x: number, y: number, statType: string): HitRecord | null => {
            const t = String(statType || '').toUpperCase();
            if (t.includes('SPIKE') && (t.includes('SUCCESS') || t === 'SPIKE')) return { x, y, statType: 'SPIKE_SUCCESS' };
            if ((t.includes('SERVICE') && t.includes('ACE')) || t === 'SERVE_ACE') return { x, y, statType: 'SERVICE_ACE' };
            return null;
        };
        const hasHitLocation = (e: any) => e?.hitLocation || (e?.x != null && e?.y != null);
        const getHit = (e: any) => e?.hitLocation ?? { x: e?.x ?? 0, y: e?.y ?? 0 };
        const isSpikeOrAceType = (e: any) => {
            const type = String(e?.type ?? e?.statType ?? '').toUpperCase();
            return type === 'SPIKE' || type === 'SERVE_ACE' || (type.includes('SPIKE') && type.includes('SUCCESS')) || (type.includes('SERVICE') && type.includes('ACE'));
        };

        filteredMatches.forEach((match: any) => {
            if (!match) return;
            const homeId = String(match?.homeTeam?.id ?? match?.homeTeamId ?? match?.homeTeam ?? match?.teamA?.name ?? match?.teamA?.id ?? '');
            const awayId = String(match?.awayTeam?.id ?? match?.awayTeamId ?? match?.awayTeam ?? match?.teamB?.name ?? match?.teamB?.id ?? '');
            const isHome = homeId === targetId;
            const isAway = awayId === targetId;
            if (!isHome && !isAway) return;

            const rawHistory = Array.isArray(match?.scoreLocations) ? match.scoreLocations : (Array.isArray(match?.history) ? match.history : []);
            const fromEventHistory = Array.isArray(match?.eventHistory)
                ? match.eventHistory.filter((e: any) => hasHitLocation(e) && isSpikeOrAceType(e) && (e?.team === 'A' || e?.team === 'B'))
                : [];
            const combined: any[] = [...rawHistory];
            fromEventHistory.forEach((e: any) => {
                const hl = getHit(e);
                combined.push({ team: e.team, hitLocation: hl, x: hl.x, y: hl.y, type: e?.type, statType: e?.statType ?? e?.type });
            });

            combined.forEach((event: any) => {
                if (!hasHitLocation(event) || !isSpikeOrAceType(event)) return;
                const hl = getHit(event);
                const x = Number(hl.x) ?? 0;
                const y = Number(hl.y) ?? 0;
                const type = event?.type ?? event?.statType ?? '';
                const statType = String(type).toUpperCase().includes('SPIKE') ? 'SPIKE_SUCCESS' : 'SERVICE_ACE';
                const h = toHitRecord(x, y, statType);
                if (!h) return;

                const eventTeamStr = String(event?.team ?? '').toUpperCase();
                const isHomeEvent =
                    String(event?.team) === homeId || (eventTeamStr === 'HOME' || eventTeamStr === 'A') || event?.team === 'A';
                const isAwayEvent =
                    String(event?.team) === awayId || (eventTeamStr === 'AWAY' || eventTeamStr === 'B') || event?.team === 'B';

                if (isHomeEvent) {
                    if (isHome) teamScores.push(h); else teamConcedes.push(h);
                } else if (isAwayEvent) {
                    if (isAway) teamScores.push(h); else teamConcedes.push(h);
                }
            });
        });
        return { scoreRecords: teamScores, concedeRecords: teamConcedes };
    }, [selectedTeamId, filteredMatches]);

    const hasData = scoreRecords.length > 0 || concedeRecords.length > 0;

    return (
        <div className="max-w-5xl mx-auto w-full space-y-6">
            {onBack && (
                <button
                    type="button"
                    onClick={onBack}
                    className="text-slate-400 hover:text-white text-sm font-medium flex items-center gap-1"
                >
                    ← 메뉴로
                </button>
            )}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-6">
                <h1 className="text-xl font-bold text-slate-200 mb-4">🗺️ 히트맵 분석</h1>
                <p className="text-slate-400 text-sm mb-6">팀·대회·경기를 선택하면 해당 조건의 득점/실점 위치가 풀코트에 표시됩니다.</p>

                <div className="flex flex-wrap gap-4 items-end mb-6">
                    <div className="flex flex-col gap-1 min-w-[140px]">
                        <label className="text-xs font-medium text-slate-400">팀 선택</label>
                        <select
                            value={selectedTeamId}
                            onChange={(e) => setSelectedTeamId(e.target.value)}
                            className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                        >
                            <option value={ALL_COMPETITIONS}>팀을 선택하세요</option>
                            {teamList.map((name) => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1 min-w-[180px]">
                        <label className="text-xs font-medium text-slate-400">대회 선택</label>
                        <select
                            value={selectedCompetition}
                            onChange={(e) => {
                                setSelectedCompetition(e.target.value);
                                setSelectedMatchId(ALL_MATCHES);
                            }}
                            className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                        >
                            <option value={ALL_COMPETITIONS}>전체 대회(시즌 누적)</option>
                            {availableCompetitions.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1 min-w-[200px]">
                        <label className="text-xs font-medium text-slate-400">경기 선택</label>
                        <select
                            value={selectedMatchId}
                            onChange={(e) => setSelectedMatchId(e.target.value)}
                            className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                        >
                            <option value={ALL_MATCHES}>전체 경기</option>
                            {matchOptions.map((o) => (
                                <option key={o.id} value={o.id}>{o.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="rounded-xl overflow-hidden border border-slate-700 bg-slate-900/50 p-4">
                    {selectedTeamId && selectedTeamId !== ALL_COMPETITIONS ? (
                        hasData ? (
                            <HeatmapViewer
                                scoreRecords={scoreRecords}
                                concedeRecords={concedeRecords}
                                position="LEFT"
                                maxHeight={380}
                                showSkillFilter={true}
                                showResultFilter={true}
                                title={`${selectedTeamId} · ${selectedCompetition || '전체 대회'}${selectedMatchId !== ALL_MATCHES ? ' · 해당 경기' : ''}`}
                            />
                        ) : (
                            <div className="py-16 text-center text-slate-500">
                                선택한 조건에 해당하는 득점/실점 위치 데이터가 없습니다. 경기에서 스파이크·서브 에이스 위치를 기록하면 여기에 표시됩니다.
                            </div>
                        )
                    ) : (
                        <div className="py-16 text-center text-slate-500">
                            팀을 선택하면 히트맵이 표시됩니다.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HeatmapAnalysisScreen;
