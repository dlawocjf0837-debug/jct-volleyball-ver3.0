import type { EnrichedMatch, PlayerStats, ScoreEvent, ScoreEventType, TeamMatchState } from '../types';

export function emptyPlayerStats(): PlayerStats {
    return {
        points: 0,
        serviceAces: 0,
        serviceFaults: 0,
        blockingPoints: 0,
        spikeSuccesses: 0,
        directSuccesses: 0,
        defenseFaults: 0,
        serveIn: 0,
        digs: 0,
        assists: 0,
    };
}

function findPlayerInMatch(match: EnrichedMatch, description: string): { teamKey: 'teamA' | 'teamB'; playerId: string } | null {
    const teams: ('teamA' | 'teamB')[] = ['teamA', 'teamB'];
    let best: { teamKey: 'teamA' | 'teamB'; playerId: string; len: number } | null = null;
    for (const teamKey of teams) {
        const players = match[teamKey].players ?? {};
        for (const [playerId, player] of Object.entries(players)) {
            const name = player?.originalName?.trim();
            if (!name || !description.includes(name)) continue;
            if (!best || name.length > best.len) {
                best = { teamKey, playerId, len: name.length };
            }
        }
    }
    return best ? { teamKey: best.teamKey, playerId: best.playerId } : null;
}

function applyEventStat(stats: PlayerStats, type: ScoreEventType) {
    switch (type) {
        case 'ACE':
            stats.serviceAces += 1;
            stats.points += 1;
            break;
        case 'FAULT':
            stats.serviceFaults += 1;
            break;
        case 'BLOCK':
            stats.blockingPoints += 1;
            stats.points += 1;
            break;
        case 'SPIKE':
            stats.spikeSuccesses += 1;
            stats.points += 1;
            break;
        case 'DIRECT':
            stats.directSuccesses = (stats.directSuccesses ?? 0) + 1;
            stats.points += 1;
            break;
        case 'DEFENSE_FAULT':
            stats.defenseFaults = (stats.defenseFaults ?? 0) + 1;
            break;
        case 'SERVE_IN':
            stats.serveIn += 1;
            break;
        case 'DIG':
            stats.digs += 1;
            break;
        case 'ASSIST':
            stats.assists += 1;
            break;
        default:
            break;
    }
}

/** 세트 구간 eventHistory로 선수별 스탯 재계산 */
export function derivePlayerStatsFromEvents(
    match: EnrichedMatch,
    events: ScoreEvent[]
): { teamA: Record<string, PlayerStats>; teamB: Record<string, PlayerStats> } {
    const teamA: Record<string, PlayerStats> = {};
    const teamB: Record<string, PlayerStats> = {};
    const allIds = new Set([
        ...Object.keys(match.teamA.players ?? {}),
        ...Object.keys(match.teamB.players ?? {}),
    ]);
    allIds.forEach((id) => {
        if (match.teamA.players?.[id]) teamA[id] = emptyPlayerStats();
        if (match.teamB.players?.[id]) teamB[id] = emptyPlayerStats();
    });

    events.forEach((event) => {
        const type = event.type;
        if (!type || type === 'SCORE' || type === 'MANUAL_SCORE' || type === 'GAME_END' || type === 'TIMEOUT' || type === 'SUB' || type === 'UNKNOWN' || type === 'FAIRPLAY' || type === '3HIT') {
            return;
        }
        const desc = event.descriptionKey ?? '';
        const found = findPlayerInMatch(match, desc);
        if (!found) return;
        const bucket = found.teamKey === 'teamA' ? teamA : teamB;
        if (!bucket[found.playerId]) bucket[found.playerId] = emptyPlayerStats();
        applyEventStat(bucket[found.playerId], type);
    });

    return { teamA, teamB };
}

function sumTeamFromPlayers(team: TeamMatchState, playerStats: Record<string, PlayerStats>): Partial<TeamMatchState> {
    const agg = {
        serviceAces: 0,
        serviceFaults: 0,
        blockingPoints: 0,
        spikeSuccesses: 0,
        directSuccesses: 0,
    };
    Object.keys(team.players ?? {}).forEach((id) => {
        const s = playerStats[id];
        if (!s) return;
        agg.serviceAces += s.serviceAces ?? 0;
        agg.serviceFaults += s.serviceFaults ?? 0;
        agg.blockingPoints += s.blockingPoints ?? 0;
        agg.spikeSuccesses += s.spikeSuccesses ?? 0;
        agg.directSuccesses += (s.directSuccesses ?? 0);
    });
    return agg;
}

/** CLUB: 세트 탭용 match 뷰 (팀 점수·선수 스탯·팀 합산 스탯) */
export function buildSetScopedMatchView(
    match: EnrichedMatch,
    setIndex: number,
    events: ScoreEvent[]
): EnrichedMatch {
    const setScore = match.setScores?.[setIndex];
    const { teamA: psA, teamB: psB } = derivePlayerStatsFromEvents(match, events);
    const teamAExtras = sumTeamFromPlayers(match.teamA, psA);
    const teamBExtras = sumTeamFromPlayers(match.teamB, psB);
    return {
        ...match,
        teamA: {
            ...match.teamA,
            score: setScore?.teamA ?? 0,
            playerStats: { ...match.teamA.playerStats, ...psA },
            ...teamAExtras,
        },
        teamB: {
            ...match.teamB,
            score: setScore?.teamB ?? 0,
            playerStats: { ...match.teamB.playerStats, ...psB },
            ...teamBExtras,
        },
    };
}

function resolveTeamFromDescription(description: string, teamAName: string, teamBName: string): 'A' | 'B' | null {
    const m = description.match(/\(([^)]+)\)/);
    if (!m) return null;
    const label = m[1].trim();
    if (label === teamAName || (teamAName && label.includes(teamAName))) return 'A';
    if (label === teamBName || (teamBName && label.includes(teamBName))) return 'B';
    return null;
}

/** 전광판 [+] 수동 득점: "팀이름, N점 득점" 형식 */
function resolveScoringTeamFromManualScore(description: string, teamAName: string, teamBName: string): 'A' | 'B' | null {
    if (!description.includes('득점')) return null;
    const namePart = description.split(',')[0]?.trim() ?? '';
    if (namePart === teamAName || (teamAName && namePart.startsWith(teamAName))) return 'A';
    if (namePart === teamBName || (teamBName && namePart.startsWith(teamBName))) return 'B';
    return null;
}

export type ScoreTrendPoint = { rally: number; a: number; b: number };

/** CLUB 세트 탭: 득점 이벤트마다 랠리 인덱스 + 누적 점수 객체 추가 (0:0 시작, 음수 없음) */
export function buildSetScoreTrendFromEvents(
    events: ScoreEvent[],
    teamAName: string,
    teamBName: string,
): ScoreTrendPoint[] {
    const trend: ScoreTrendPoint[] = [{ rally: 0, a: 0, b: 0 }];
    let scoreA = 0;
    let scoreB = 0;
    let rally = 0;

    for (const event of events) {
        let deltaA = 0;
        let deltaB = 0;
        const desc = event.descriptionKey ?? '';

        switch (event.type) {
            case 'ACE':
            case 'BLOCK':
            case 'SPIKE':
            case 'DIRECT': {
                const scorer = event.team ?? resolveTeamFromDescription(desc, teamAName, teamBName);
                if (scorer === 'A') deltaA = 1;
                else if (scorer === 'B') deltaB = 1;
                break;
            }
            case 'FAULT':
            case 'DEFENSE_FAULT': {
                const faulting = resolveTeamFromDescription(desc, teamAName, teamBName);
                if (faulting === 'A') deltaB = 1;
                else if (faulting === 'B') deltaA = 1;
                break;
            }
            case 'MANUAL_SCORE':
            case 'SCORE': {
                const scorer = event.team ?? resolveScoringTeamFromManualScore(desc, teamAName, teamBName);
                if (scorer === 'A') deltaA = 1;
                else if (scorer === 'B') deltaB = 1;
                break;
            }
            default:
                break;
        }

        if (deltaA > 0 || deltaB > 0) {
            scoreA += deltaA;
            scoreB += deltaB;
            rally += 1;
            trend.push({ rally, a: scoreA, b: scoreB });
        }
    }

    return trend;
}
