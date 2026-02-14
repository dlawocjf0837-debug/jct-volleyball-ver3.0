import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback, useReducer, useRef, PropsWithChildren, useMemo } from 'react';
import { MatchState, TeamSet, TeamMatchState, Player, PlayerStats, Action, UserEmblem, SavedTeamInfo, ScoreEvent, PlayerAchievements, PlayerCumulativeStats, ToastState, AppSettings, Tournament, League, PlayerCoachingLogs, CoachingLog, TeamStats, DataContextType, Badge, P2PState, DataConnection, P2PMessage, Language, ScoreEventType } from '../types';
import { BADGE_DEFINITIONS } from '../data/badges';
import { translations } from '../data/translations';
import localforage from 'localforage';

const TEAM_SETS_KEY = 'jct_volleyball_team_sets';
const MATCH_HISTORY_KEY = 'jct_volleyball_match_history';
const USER_EMBLEMS_KEY = 'jct_volleyball_user_emblems';
const ACHIEVEMENTS_KEY = 'jct_volleyball_achievements';
const SETTINGS_KEY = 'jct_volleyball_settings';
const TOURNAMENTS_KEY = 'jct_volleyball_tournaments';
const LEAGUES_KEY = 'jct_volleyball_leagues';
const COACHING_LOGS_KEY = 'jct_volleyball_coaching_logs';
const BACKUP_KEY = 'jct_volleyball_backup_autosave';
const LANGUAGE_KEY = 'jct_volleyball_language';
const TEAM_COLORS_PALETTE = ['#3b82f6', '#ef4444', '#22c55e', '#eab308', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b', '#f472b6', '#06b6d4', '#f59e0b'];


const DataContext = createContext<DataContextType | undefined>(undefined);

export const isValidTeamSet = (set: any): set is TeamSet => {
    return set && typeof set.id === 'string' &&
           typeof set.className === 'string' &&
           Array.isArray(set.teams) &&
           typeof set.players === 'object' && set.players !== null &&
           !Array.isArray(set.players) &&
           set.teams.every((t: any) => 
               t && typeof t.teamName === 'string' && 
               typeof t.captainId === 'string' &&
               Array.isArray(t.playerIds)
           );
};

export const isValidMatchState = (match: any): match is MatchState => {
    const isValidTeam = (team: any): team is TeamMatchState => {
        return team && typeof team.name === 'string' &&
               typeof team.score === 'number' &&
               typeof team.timeouts === 'number';
    };

    return match &&
           typeof match === 'object' &&
           isValidTeam(match.teamA) &&
           isValidTeam(match.teamB) &&
           (match.status === 'in_progress' || match.status === 'completed' || match.status === undefined);
};

const isValidUserEmblems = (emblems: any): emblems is UserEmblem[] => {
    return Array.isArray(emblems) && emblems.every(e => e && typeof e.id === 'string' && typeof e.data === 'string');
};

const isValidTournaments = (tournaments: any): tournaments is Tournament[] => {
    return Array.isArray(tournaments) && tournaments.every(t => t && typeof t.id === 'string' && typeof t.name === 'string' && Array.isArray(t.rounds));
};

const isValidLeagues = (leagues: any): leagues is League[] => {
    return Array.isArray(leagues) && leagues.every(l => l && typeof l.id === 'string' && typeof l.name === 'string' && Array.isArray(l.schedule));
};

const isValidCoachingLogs = (logs: any): logs is PlayerCoachingLogs => {
    return typeof logs === 'object' && logs !== null && !Array.isArray(logs);
}

const getInitialLanguage = (): Language => {
    // Force default language to Korean 'ko' for initial load as requested
    return 'ko';
};

export const DataProvider = ({ children }: PropsWithChildren) => {
    const [teamSets, setTeamSets] = useState<TeamSet[]>([]);
    const [matchHistory, setMatchHistory] = useState<(MatchState & { date: string; time?: number })[]>([]);
    const [userEmblems, setUserEmblems] = useState<UserEmblem[]>([]);
    const [playerAchievements, setPlayerAchievements] = useState<PlayerAchievements>({});
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [leagues, setLeagues] = useState<League[]>([]);
    const [coachingLogs, setCoachingLogs] = useState<PlayerCoachingLogs>({});
    const [isLoading, setIsLoading] = useState(true);
    const [toast, setToast] = useState<ToastState>({ message: '', type: 'success' });
    const [recoveryData, setRecoveryData] = useState<any | null>(null);
    const [settings, setSettings] = useState<AppSettings>(
        { winningScore: 11, includeBonusPointsInWinner: true, googleSheetUrl: '' }
    );
    
    const [matchTime, setMatchTime] = useState(0);
    const [timerOn, setTimerOn] = useState(false);
    
    const [language, setLanguageState] = useState<Language>('ko');
    
    // 언어 초기화
    useEffect(() => {
        const initLanguage = async () => {
            try {
                const lang = await localforage.getItem(LANGUAGE_KEY) as Language | null;
                if (lang) setLanguageState(lang);
            } catch (error) {
                console.error("Failed to load language:", error);
            }
        };
        initLanguage();
    }, []);
    
    const [p2p, setP2p] = useState<P2PState>({ peerId: null, isHost: false, isConnected: false, connections: [], status: 'disconnected' });
    const peerRef = useRef<any>(null); // Using 'any' for PeerJS object
    const connRef = useRef<DataConnection[]>([]);
    const isIntentionallyClosing = useRef(false);
    
    const t = useCallback((key: string, replacements?: Record<string, string | number>): string => {
        let translation = translations[key]?.[language] || key;
        if (replacements) {
            Object.keys(replacements).forEach(rKey => {
                translation = translation.replace(`{${rKey}}`, String(replacements[rKey]));
            });
        }
        return translation;
    }, [language]);

    const showToast = useCallback((message: string, type: 'success' | 'error' = 'success', replacements?: Record<string, string | number>) => {
        let finalMessage = t(message); // Use translation hook
        if (replacements) {
            Object.keys(replacements).forEach(rKey => {
                finalMessage = finalMessage.replace(`{${rKey}}`, String(replacements[rKey]));
            });
        }
        setToast({ message: finalMessage, type });
    }, [t]);

    const setLanguage = useCallback(async (lang: Language) => {
        try {
            await localforage.setItem(LANGUAGE_KEY, lang);
            setLanguageState(lang);
        } catch (error) {
            console.error("Failed to save language preference:", error);
        }
    }, []);

    const broadcast = useCallback((message: P2PMessage) => {
        connRef.current.forEach(conn => conn.send(message));
    }, []);

    const saveSettings = async (newSettings: AppSettings) => {
        try {
            await localforage.setItem(SETTINGS_KEY, newSettings);
            setSettings(newSettings);
            if (p2p.isHost) {
                broadcast({ type: 'settings_sync', payload: newSettings });
            }
            showToast('설정이 저장되었습니다.', 'success');
        } catch (error) {
            console.error("Error saving settings:", error);
            showToast("설정 저장 중 오류가 발생했습니다.", 'error');
            throw error;
        }
    };
    
    const getInitialState = useCallback((teams: {
        teamA: string;
        teamB: string;
        teamAKey?: string;
        teamBKey?: string;
        teamAPlayers: Record<string, Player>;
        teamBPlayers: Record<string, Player>;
        teamADetails?: Partial<TeamMatchState>;
        teamBDetails?: Partial<TeamMatchState>;
    }, tournamentInfo?: { tournamentId: string, tournamentMatchId: string }, onCourtIds?: { teamA: Set<string>, teamB: Set<string> }, leagueInfo?: { leagueId: string, leagueMatchId: string }): MatchState => {
        const initPlayerStats = (players: Record<string, Player>): Record<string, PlayerStats> =>
            Object.keys(players).reduce((acc, playerId) => {
                acc[playerId] = { 
                    points: 0, 
                    serviceAces: 0, 
                    serviceFaults: 0, 
                    blockingPoints: 0, 
                    spikeSuccesses: 0,
                    serveIn: 0,
                    digs: 0,
                    assists: 0
                };
                return acc;
            }, {} as Record<string, PlayerStats>);

        const onCourtASet = onCourtIds?.teamA ?? new Set(Object.keys(teams.teamAPlayers));
        const onCourtBSet = onCourtIds?.teamB ?? new Set(Object.keys(teams.teamBPlayers));
        const allTeamAPlayerIds = Object.keys(teams.teamAPlayers);
        const allTeamBPlayerIds = Object.keys(teams.teamBPlayers);

        return {
            teamA: { name: teams.teamA, key: teams.teamAKey, ...teams.teamADetails, score: 0, setsWon: 0, timeouts: 2, fairPlay: 0, threeHitPlays: 0, serviceAces: 0, serviceFaults: 0, blockingPoints: 0, spikeSuccesses: 0, players: teams.teamAPlayers, playerStats: initPlayerStats(teams.teamAPlayers), onCourtPlayerIds: allTeamAPlayerIds.filter(id => onCourtASet.has(id)), benchPlayerIds: allTeamAPlayerIds.filter(id => !onCourtASet.has(id)) },
            teamB: { name: teams.teamB, key: teams.teamBKey, ...teams.teamBDetails, score: 0, setsWon: 0, timeouts: 2, fairPlay: 0, threeHitPlays: 0, serviceAces: 0, serviceFaults: 0, blockingPoints: 0, spikeSuccesses: 0, players: teams.teamBPlayers, playerStats: initPlayerStats(teams.teamBPlayers), onCourtPlayerIds: allTeamBPlayerIds.filter(id => onCourtBSet.has(id)), benchPlayerIds: allTeamBPlayerIds.filter(id => !onCourtBSet.has(id)) },
            servingTeam: null,
            currentSet: 1,
            isDeuce: false,
            gameOver: false,
            winner: null,
            scoreHistory: [{ a: 0, b: 0 }],
            eventHistory: [{ score: { a: 0, b: 0 }, descriptionKey: "경기가 시작되었습니다.", time: 0, type: 'UNKNOWN' }],
            scoreLocations: [],
            status: 'in_progress',
            timeout: null,
            undoStack: [],
            ...tournamentInfo,
            ...leagueInfo
        };
    }, []);
        
    const updatePlayerStat = (
        playerStats: Record<string, PlayerStats>,
        playerId: string,
        stat: keyof PlayerStats,
        amount: number
    ): Record<string, PlayerStats> => {
        const newStats = { ...(playerStats[playerId] || { points: 0, serviceAces: 0, serviceFaults: 0, blockingPoints: 0, spikeSuccesses: 0, serveIn: 0, digs: 0, assists: 0 }) };
        newStats[stat] = (newStats[stat] || 0) + amount;
        return { ...playerStats, [playerId]: newStats };
    };

    const matchReducer = useCallback((state: MatchState | null, action: Action): MatchState | null => {
        if (!state && action.type !== 'LOAD_STATE') return null;
        if (state && state.gameOver && !['LOAD_STATE', 'RESET_STATE', 'UNDO'].includes(action.type)) return state;
    
        switch (action.type) {
            case 'LOAD_STATE':
                return action.state;
            case 'RESET_STATE':
                return null;
            case 'UNDO':
                if (!state || !state.undoStack || state.undoStack.length === 0) return state;
                const previousState = state.undoStack[state.undoStack.length - 1];
                // Keep the current undoStack but remove the last entry
                const newUndoStack = state.undoStack.slice(0, -1);
                return { ...previousState, undoStack: newUndoStack };
            default:
                if (!state) return null;
                
                // --- Save current state for Undo before modification ---
                const { undoStack: _currentStack, ...stateToSave } = state;
                const currentUndoStack = state.undoStack || [];
                // structuredClone 사용: JSON.parse(JSON.stringify())보다 빠르고 안전함
                const updatedUndoStack = [...currentUndoStack, structuredClone(stateToSave)].slice(-20);

                // matchReducer 최적화: 필요한 부분만 얕은 복사, 변경되는 부분만 깊은 복사
                // 전체 깊은 복사 대신 필요한 객체만 선택적 복사
                let newState: MatchState = {
                    ...state,
                    undoStack: updatedUndoStack,
                    teamA: { ...state.teamA },
                    teamB: { ...state.teamB },
                    eventHistory: [...state.eventHistory],
                    scoreHistory: [...state.scoreHistory]
                };

                let scoreChanged = false;
                let newEventDescription: string | null = null;
                let newEventType: ScoreEventType = 'UNKNOWN';
                let newEvent: Partial<ScoreEvent> = {};
    
                switch (action.type) {
                    case 'SCORE': {
                        const target = action.team === 'A' ? 'teamA' : 'teamB';
                        const newScore = Math.max(0, newState[target].score + action.amount);
                        if (newState[target].score !== newScore) {
                            const teamName = newState[target].name;
                            const pointChange = action.amount > 0 ? `${action.amount}점 득점` : `${Math.abs(action.amount)}점 조정`;
                            newEventDescription = `${teamName}, ${pointChange}`;
                            newEventType = 'SCORE';
                            newState[target].score = newScore;
                            if (action.amount > 0) newState.servingTeam = action.team;
                            scoreChanged = true;
                        }
                        break;
                    }
                     case 'SERVICE_ACE': {
                        const { team, playerId } = action;
                        const target = team === 'A' ? 'teamA' : 'teamB';
                        const playerName = newState[target].players[playerId]?.originalName || '선수';
                        newEventDescription = `${playerName}(${newState[target].name})의 환상적인 서브 에이스!`;
                        newEventType = 'ACE';
                        newState[target].score += 1;
                        newState[target].serviceAces += 1;
                        newState[target].playerStats = updatePlayerStat(newState[target].playerStats, playerId, 'serviceAces', 1);
                        newState[target].playerStats = updatePlayerStat(newState[target].playerStats, playerId, 'points', 1);
                        newState.servingTeam = team;
                        scoreChanged = true;
                        break;
                    }
                    case 'SERVICE_FAULT': {
                        const { team: faultingTeamKey, playerId } = action;
                        const scoringTeamKey = faultingTeamKey === 'A' ? 'B' : 'A';
                        const faultingTarget = faultingTeamKey === 'A' ? 'teamA' : 'teamB';
                        const scoringTarget = scoringTeamKey === 'A' ? 'teamA' : 'teamB';
    
                        const playerName = newState[faultingTarget].players[playerId]?.originalName || '선수';
                        newEventDescription = `${playerName}(${newState[faultingTarget].name}), 서브 범실.`;
                        newEventType = 'FAULT';
    
                        newState[faultingTarget].serviceFaults += 1;
                        newState[faultingTarget].playerStats = updatePlayerStat(newState[faultingTarget].playerStats, playerId, 'serviceFaults', 1);
                        
                        newState[scoringTarget].score += 1;
                        newState.servingTeam = scoringTeamKey;
                        scoreChanged = true;
                        break;
                    }
                    case 'BLOCKING_POINT': {
                        const { team, playerId } = action;
                        const target = team === 'A' ? 'teamA' : 'teamB';
                        const playerName = newState[target].players[playerId]?.originalName || '선수';
                        newEventDescription = `${playerName}(${newState[target].name})의 완벽한 블로킹 득점!`;
                        newEventType = 'BLOCK';
                        newState[target].score += 1;
                        newState[target].blockingPoints += 1;
                        newState[target].playerStats = updatePlayerStat(newState[target].playerStats, playerId, 'blockingPoints', 1);
                        newState[target].playerStats = updatePlayerStat(newState[target].playerStats, playerId, 'points', 1);
                        newState.servingTeam = team;
                        scoreChanged = true;
                        break;
                    }
                    case 'SPIKE_SUCCESS': {
                        const { team, playerId } = action;
                        const target = team === 'A' ? 'teamA' : 'teamB';
                        const playerName = newState[target].players[playerId]?.originalName || '선수';
                        newEventDescription = `${playerName}(${newState[target].name}), 강력한 스파이크 성공!`;
                        newEventType = 'SPIKE';
                        newState[target].score += 1;
                        newState[target].spikeSuccesses += 1;
                        newState[target].playerStats = updatePlayerStat(newState[target].playerStats, playerId, 'spikeSuccesses', 1);
                        newState[target].playerStats = updatePlayerStat(newState[target].playerStats, playerId, 'points', 1);
                        newState.servingTeam = team;
                        scoreChanged = true;
                        break;
                    }
                    case 'SERVE_IN': {
                        const { team, playerId } = action;
                        const target = team === 'A' ? 'teamA' : 'teamB';
                        // Serve In does not increase team score, just player stats
                        const playerName = newState[target].players[playerId]?.originalName || '선수';
                        newEventDescription = `${playerName}(${newState[target].name}), 안정적인 서브 성공.`;
                        newEventType = 'SERVE_IN';
                        newState[target].playerStats = updatePlayerStat(newState[target].playerStats, playerId, 'serveIn', 1);
                        break;
                    }
                    case 'DIG_SUCCESS': {
                        const { team, playerId } = action;
                        const target = team === 'A' ? 'teamA' : 'teamB';
                        const playerName = newState[target].players[playerId]?.originalName || '선수';
                        newEventDescription = `${playerName}(${newState[target].name}), 멋진 디그(수비) 성공!`;
                        newEventType = 'DIG';
                        newState[target].playerStats = updatePlayerStat(newState[target].playerStats, playerId, 'digs', 1);
                        break;
                    }
                    case 'ASSIST_SUCCESS': {
                        const { team, playerId } = action;
                        const target = team === 'A' ? 'teamA' : 'teamB';
                        const playerName = newState[target].players[playerId]?.originalName || '선수';
                        newEventDescription = `${playerName}(${newState[target].name}), 완벽한 어시스트!`;
                        newEventType = 'ASSIST';
                        newState[target].playerStats = updatePlayerStat(newState[target].playerStats, playerId, 'assists', 1);
                        break;
                    }
                    case 'TAKE_TIMEOUT': {
                        const target = action.team === 'A' ? 'teamA' : 'teamB';
                        if (newState[target].timeouts > 0) {
                            newEventDescription = `${newState[target].name}, 작전 타임 요청.`;
                            newEventType = 'TIMEOUT';
                            newState[target].timeouts -= 1;
                            newState.timeout = { team: action.team, timeLeft: 30 };
                        }
                        break;
                    }
                    case 'END_TIMEOUT': {
                        if (newState.timeout) {
                            const teamName = newState.timeout.team === 'A' ? newState.teamA.name : newState.teamB.name;
                            newEventDescription = `${teamName}의 작전 타임 종료.`;
                            newEventType = 'TIMEOUT';
                            newState.timeout = null;
                        }
                        break;
                    }
                    case 'UPDATE_TIMEOUT_TIMER': {
                        if (newState.timeout) {
                            newState.timeout.timeLeft = action.timeLeft;
                        }
                        break;
                    }
                    case 'ADJUST_FAIR_PLAY': {
                        const target = action.team === 'A' ? 'teamA' : 'teamB';
                        if (action.amount > 0) {
                            newEventDescription = `${newState[target].name}, 페어플레이 점수 획득!`;
                            newEventType = 'FAIRPLAY';
                        }
                        newState[target].fairPlay += action.amount;
                        break;
                    }
                    case 'INCREMENT_3_HIT': {
                        const target = action.team === 'A' ? 'teamA' : 'teamB';
                        newEventDescription = `${newState[target].name}, 멋진 3단 플레이 성공!`;
                        newEventType = '3HIT';
                        newState[target].threeHitPlays += 1;
                        break;
                    }
                    case 'SET_SERVING_TEAM': {
                        newEventDescription = `${newState[action.team === 'A' ? 'teamA' : 'teamB'].name}, 서브 시작.`;
                        newEventType = 'UNKNOWN'; // Just an info log
                        newState.servingTeam = action.team;
                        break;
                    }
                    case 'SUBSTITUTE_PLAYER': {
                        const { team, playerIn, playerOut } = action;
                        const target = team === 'A' ? 'teamA' : 'teamB';
                        const teamState = newState[target];
                
                        if (!teamState.players || !teamState.onCourtPlayerIds || !teamState.benchPlayerIds) break;
                
                        const onCourt = new Set(teamState.onCourtPlayerIds);
                        const onBench = new Set(teamState.benchPlayerIds);
                
                        if (onCourt.has(playerOut) && onBench.has(playerIn)) {
                            onCourt.delete(playerOut);
                            onCourt.add(playerIn);
                            onBench.delete(playerIn);
                            onBench.add(playerOut);
                
                            newState[target].onCourtPlayerIds = Array.from(onCourt);
                            newState[target].benchPlayerIds = Array.from(onBench);
                            
                            const playerOutName = teamState.players[playerOut]?.originalName || 'Unknown';
                            const playerInName = teamState.players[playerIn]?.originalName || 'Unknown';
                            newEventDescription = `${teamState.name}: ${playerOutName} 선수와 ${playerInName} 선수를 교체합니다.`;
                            newEventType = 'SUB';
                            newEvent.substitution = { team, playerIn, playerOut };
                        }
                        break;
                    }
                }
                if (scoreChanged) {
                    newState.scoreHistory.push({ a: newState.teamA.score, b: newState.teamB.score });
                }
    
                newState.isDeuce = newState.teamA.score >= settings.winningScore - 1 && newState.teamA.score === newState.teamB.score;
                
                const { teamA, teamB } = newState;
                // FIX: Corrected typo 'a.score' to 'teamA.score' for game over condition.
                const isGameOver = (teamA.score >= settings.winningScore && teamA.score >= teamB.score + 2) || (teamB.score >= settings.winningScore && teamB.score >= teamA.score + 2);
    
                if (isGameOver && !newState.gameOver) {
                    const winner = teamA.score > teamB.score ? 'A' : 'B';
                    const winnerName = winner === 'A' ? teamA.name : teamB.name;
                    newEventDescription = `경기 종료! ${winnerName} 팀 승리!`;
                    newEventType = 'GAME_END';
                    newState.winner = winner;
                    newState.gameOver = true;
                    newState[winner === 'A' ? 'teamA' : 'teamB'].setsWon += 1;
                }
    
                if (newEventDescription) {
                    const finalEvent: ScoreEvent = {
                        ...newEvent,
                        score: { a: newState.teamA.score, b: newState.teamB.score },
                        descriptionKey: newEventDescription,
                        time: matchTime,
                        type: newEventType
                    };
                    newState.eventHistory.push(finalEvent);
                }
    
                return newState;
        }
    }, [settings, matchTime]);

    const [matchState, dispatch] = useReducer(matchReducer, null);
    
    const playerAchievementsRef = useRef(playerAchievements);
    
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [onSuccessCallback, setOnSuccessCallback] = useState<(() => void) | null>(null);

    const requestPassword = (onSuccess: () => void) => {
        setOnSuccessCallback(() => onSuccess);
        setIsPasswordModalOpen(true);
    };

    const generateAiResponse = useCallback((prompt: string): Promise<string> => {
        return new Promise((resolve) => {
            const wrappedOnSuccess = () => {
                setTimeout(() => {
                    resolve("AI 분석 리포트 생성이 현재 지원되지 않습니다. 데모 버전입니다.");
                }, 1000);
            };
            requestPassword(wrappedOnSuccess);
        });
    }, []);
    
    const handlePasswordSuccess = () => {
        setIsPasswordModalOpen(false);
        if (onSuccessCallback) {
            onSuccessCallback();
        }
        setOnSuccessCallback(null);
    };

    const handlePasswordCancel = () => {
        setIsPasswordModalOpen(false);
        setOnSuccessCallback(null);
    };

    const teamSetsMap = useMemo(() => {
        const map = new Map<string, { set: TeamSet, team: SavedTeamInfo }>();
        teamSets.forEach(set => {
            set.teams.forEach(team => {
                const key = `${set.id}___${team.teamName}`;
                map.set(key, { set, team });
            });
        });
        return map;
    }, [teamSets]);

    // playerCumulativeStats 계산 최적화: 초기화 로직 간소화 및 성능 개선
    const playerCumulativeStats = useMemo(() => {
        const stats: Record<string, Partial<PlayerCumulativeStats>> = {};
    
        // 초기값을 한 번만 생성하는 헬퍼 함수
        const getInitialStats = (): Partial<PlayerCumulativeStats> => ({
            serviceAces: 0,
            serviceFaults: 0,
            spikeSuccesses: 0,
            blockingPoints: 0,
            matchesPlayed: 0,
            wins: 0,
            points: 0,
            badgeCount: 0,
            plusMinus: 0,
            serveIn: 0,
            digs: 0,
            assists: 0,
        });
    
        // 완료된 일반 경기만 필터링 (리그/토너먼트 경기는 제외)
        const completedMatches = matchHistory.filter(
            m => m.status === 'completed' && !m.leagueId && !m.tournamentId
        );
        
        completedMatches.forEach(match => {
            const processedPlayersInMatch = new Set<string>();
    
            const processTeam = (teamState: TeamMatchState, isWinner: boolean) => {
                if (!teamState.players || !teamState.playerStats) return;
                Object.keys(teamState.playerStats).forEach(playerId => {
                    if (processedPlayersInMatch.has(playerId)) return;
                    
                    // 초기화가 필요한 경우에만 실행
                    if (!stats[playerId]) {
                        stats[playerId] = getInitialStats();
                    }
                    
                    const playerStats = teamState.playerStats[playerId];
                    const stat = stats[playerId]!;
                    
                    stat.matchesPlayed = (stat.matchesPlayed || 0) + 1;
                    if (isWinner) {
                        stat.wins = (stat.wins || 0) + 1;
                    }
                    stat.points = (stat.points || 0) + (playerStats.points || 0);
                    stat.serviceAces = (stat.serviceAces || 0) + (playerStats.serviceAces || 0);
                    stat.serviceFaults = (stat.serviceFaults || 0) + (playerStats.serviceFaults || 0);
                    stat.spikeSuccesses = (stat.spikeSuccesses || 0) + (playerStats.spikeSuccesses || 0);
                    stat.blockingPoints = (stat.blockingPoints || 0) + (playerStats.blockingPoints || 0);
                    stat.serveIn = (stat.serveIn || 0) + (playerStats.serveIn || 0);
                    stat.digs = (stat.digs || 0) + (playerStats.digs || 0);
                    stat.assists = (stat.assists || 0) + (playerStats.assists || 0);
    
                    processedPlayersInMatch.add(playerId);
                });
            };
    
            processTeam(match.teamA, match.winner === 'A');
            processTeam(match.teamB, match.winner === 'B');
        });
    
        // 배지 카운트는 별도로 처리 (성능 최적화)
        for (const playerId in playerAchievements) {
            if (!stats[playerId]) {
                stats[playerId] = getInitialStats();
            }
            stats[playerId]!.badgeCount = playerAchievements[playerId].earnedBadgeIds.size;
        }
    
        return stats;
    }, [matchHistory, playerAchievements]);
    
    const teamPerformanceData: TeamStats[] = useMemo(() => {
        const stats: { [key: string]: any } = {};

        matchHistory.filter(m => m.status === 'completed').forEach(match => {
            const winnerKey = match.winner;
            const teams = [{ key: 'A', data: match.teamA }, { key: 'B', data: match.teamB }];

            teams.forEach(item => {
                const teamData = item.data;
                const teamKey = teamData.key;
                if (!teamKey) return;

                if (!stats[teamKey]) {
                    stats[teamKey] = {
                        gamesPlayed: 0, wins: 0, losses: 0, ties: 0,
                        pointsFor: 0, pointsAgainst: 0, pointDifference: 0,
                        serviceAces: 0, serviceFaults: 0, blockingPoints: 0, spikeSuccesses: 0, threeHitPlays: 0, fairPlay: 0,
                        serveIn: 0
                    };
                }
                const opponent = teams.find(t => t.key !== item.key)!.data;
                stats[teamKey].gamesPlayed++;
                if (winnerKey === item.key) stats[teamKey].wins++;
                else if (winnerKey === null) stats[teamKey].ties++;
                else stats[teamKey].losses++;
                stats[teamKey].pointsFor += teamData.score;
                stats[teamKey].pointsAgainst += opponent.score;
                
                stats[teamKey].serviceAces += teamData.serviceAces || 0;
                stats[teamKey].serviceFaults += teamData.serviceFaults || 0;
                stats[teamKey].blockingPoints += teamData.blockingPoints || 0;
                stats[teamKey].spikeSuccesses += teamData.spikeSuccesses || 0;
                stats[teamKey].threeHitPlays += teamData.threeHitPlays || 0;
                stats[teamKey].fairPlay += teamData.fairPlay || 0;
                
                // Aggregate team-level serveIn (sum of players)
                let teamServeIn = 0;
                if (teamData.playerStats) {
                    teamServeIn = Object.values(teamData.playerStats).reduce<number>((sum: number, p: any) => sum + (p.serveIn || 0), 0);
                }
                stats[teamKey].serveIn += teamServeIn;
            });
        });
        
        return Object.keys(stats).map(teamKey => {
            const teamInfo = teamSetsMap.get(teamKey);
            if (!teamInfo) return null;
            const s = stats[teamKey];
            const pointDifference = s.pointsFor - s.pointsAgainst;
            const points = s.wins * 3 + s.ties;

            const gamesPlayed = s.gamesPlayed;

            return {
                teamName: teamInfo.team.teamName,
                className: teamInfo.set.className,
                teamCount: teamInfo.set.teamCount || 0,
                emblem: teamInfo.team.emblem,
                slogan: teamInfo.team.slogan,
                color: teamInfo.team.color,
                gamesPlayed,
                wins: s.wins,
                losses: s.losses,
                ties: s.ties,
                winRate: gamesPlayed > 0 ? (s.wins / gamesPlayed) * 100 : 0,
                points,
                pointsFor: s.pointsFor,
                pointsAgainst: s.pointsAgainst,
                pointDifference,
                
                avgPointsFor: gamesPlayed > 0 ? s.pointsFor / gamesPlayed : 0,
                avgPointsAgainst: gamesPlayed > 0 ? s.pointsAgainst / gamesPlayed : 0,
                serviceAces: gamesPlayed > 0 ? s.serviceAces / gamesPlayed : 0,
                serviceFaults: s.serviceFaults,
                blockingPoints: s.blockingPoints,
                spikeSuccesses: gamesPlayed > 0 ? s.spikeSuccesses / gamesPlayed : 0,
                threeHitPlays: gamesPlayed > 0 ? s.threeHitPlays / gamesPlayed : 0,
                fairPlay: gamesPlayed > 0 ? s.fairPlay / gamesPlayed : 0,
                serveIn: s.serveIn
            } as TeamStats;
        }).filter((t): t is TeamStats => t !== null);
    }, [matchHistory, teamSetsMap]);


    useEffect(() => { playerAchievementsRef.current = playerAchievements; }, [playerAchievements]);

    // ... (Rest of the file remains similar, just ensuring data loading handles new fields implicitly by JSON.parse)

    const hideToast = () => setToast({ message: '', type: 'success' });

    const createBackup = useCallback(async () => {
        try {
            const backupData = {
                teamSets, matchHistory, userEmblems, tournaments, leagues, coachingLogs
            };
            await localforage.setItem(BACKUP_KEY, backupData);
        } catch (error) {
            console.error("Auto backup failed:", error);
        }
    }, [teamSets, matchHistory, userEmblems, tournaments, leagues, coachingLogs]);
    
    // ... (badge logic is mostly unaffected unless we add badges for new stats, but keeping it as is for now to avoid complexity overload in this step)
    
    const savePlayerAchievements = useCallback(async (newAchievements: PlayerAchievements) => {
        try {
            const serializable = Object.fromEntries(
                Object.entries(newAchievements).map(([playerId, data]) => [playerId, { ...data, earnedBadgeIds: Array.from(data.earnedBadgeIds) }])
            );
            await localforage.setItem(ACHIEVEMENTS_KEY, serializable);
            setPlayerAchievements(newAchievements);
        } catch (error) {
            console.error("Error saving player achievements:", error);
            showToast("업적 데이터 저장 중 오류가 발생했습니다.", 'error');
        }
    }, [showToast]);

    const recalculateSpecialBadges = (allHistory: (MatchState & { date: string })[], currentAchievements: PlayerAchievements): [PlayerAchievements, boolean] => {
        const newAchievements: PlayerAchievements = {};
        for (const playerId in currentAchievements) {
            newAchievements[playerId] = {
                earnedBadgeIds: new Set(currentAchievements[playerId].earnedBadgeIds)
            };
        }

        const stats: Record<string, Partial<PlayerCumulativeStats>> = {};
        const ensurePlayer = (playerId: string) => {
            if (!stats[playerId]) {
                stats[playerId] = { serviceAces: 0, spikeSuccesses: 0, blockingPoints: 0 };
            }
        };
        
        allHistory.filter(m => m.status === 'completed').forEach(match => {
            const processTeam = (teamState: TeamMatchState) => {
                if (!teamState.players || !teamState.playerStats) return;
                Object.keys(teamState.playerStats).forEach(playerId => {
                    ensurePlayer(playerId);
                    const playerStats = teamState.playerStats[playerId];
                    stats[playerId]!.serviceAces! += playerStats.serviceAces || 0;
                    stats[playerId]!.spikeSuccesses! += playerStats.spikeSuccesses || 0;
                    stats[playerId]!.blockingPoints! += playerStats.blockingPoints || 0;
                });
            };
            processTeam(match.teamA);
            processTeam(match.teamB);
        });

        const competitiveBadges = BADGE_DEFINITIONS.filter(b => b.isCompetitive);
        const badgeIdToStatKey: Record<string, keyof PlayerCumulativeStats> = {
            'serve_king': 'serviceAces',
            'spike_master': 'spikeSuccesses',
            'iron_wall_guardian': 'blockingPoints',
        };

        let changed = false;
        
        const originalBadges = new Map<string, Set<string>>();
        for(const playerId in newAchievements) {
            originalBadges.set(playerId, new Set(newAchievements[playerId].earnedBadgeIds));
        }

        const competitiveBadgeIds = competitiveBadges.map(b => b.id);
        for (const playerId in newAchievements) {
            competitiveBadgeIds.forEach(badgeId => {
                if (newAchievements[playerId].earnedBadgeIds.has(badgeId)) {
                    newAchievements[playerId].earnedBadgeIds.delete(badgeId);
                }
            });
        }

        competitiveBadges.forEach(badge => {
            const statKey = badgeIdToStatKey[badge.id];
            if (!statKey) return;

            const rankedPlayers = Object.keys(stats)
                .map(playerId => ({ playerId, value: stats[playerId][statKey] || 0 }))
                .filter(p => p.value > 0)
                .sort((a, b) => b.value - a.value);

            if (rankedPlayers.length === 0) return;

            const top3Values = [...new Set(rankedPlayers.map(p => p.value))].slice(0, 3);
            const topPlayers = rankedPlayers.filter(p => top3Values.includes(p.value));

            topPlayers.forEach(p => {
                if (!newAchievements[p.playerId]) {
                    newAchievements[p.playerId] = { earnedBadgeIds: new Set() };
                }
                newAchievements[p.playerId].earnedBadgeIds.add(badge.id);
            });
        });

        for (const playerId in newAchievements) {
            const oldSet = originalBadges.get(playerId) || new Set();
            const newSet = newAchievements[playerId].earnedBadgeIds;
            if (oldSet.size !== newSet.size) {
                changed = true;
                break;
            }
            for (const badge of oldSet) {
                if (!newSet.has(badge)) {
                    changed = true;
                    break;
                }
            }
            if(changed) break;
             for (const badge of newSet) {
                if (!oldSet.has(badge)) {
                    changed = true;
                    break;
                }
            }
            if(changed) break;
        }

        return [newAchievements, changed];
    };

    /**
     * Helper to fully rebuild achievements from match history.
     * This is crucial when importing legacy data that might not contain the achievements snapshot.
     */
    const recalculateAllAchievements = useCallback(async (allHistory: (MatchState & { date: string })[]) => {
        const newAchievements: PlayerAchievements = {};
        
        // 1. Process Per-Match Badges
        allHistory.filter(m => m.status === 'completed').forEach(completedMatch => {
            const allPlayersInMatch: { player: Player, stats: PlayerStats, team: 'A' | 'B' }[] = [];
            
            // Safety check for players object
            if (completedMatch.teamA.players) {
                Object.entries(completedMatch.teamA.players).forEach(([id, player]) => {
                    if (completedMatch.teamA.playerStats[id]) allPlayersInMatch.push({ player, stats: completedMatch.teamA.playerStats[id], team: 'A' });
                });
            }
            if (completedMatch.teamB.players) {
                Object.entries(completedMatch.teamB.players).forEach(([id, player]) => {
                    if (completedMatch.teamB.playerStats[id]) allPlayersInMatch.push({ player, stats: completedMatch.teamB.playerStats[id], team: 'B' });
                });
            }

            for (const { player, stats, team } of allPlayersInMatch) {
                if (!newAchievements[player.id]) {
                    newAchievements[player.id] = { earnedBadgeIds: new Set() };
                }

                const checkAndAddBadge = (badgeId: string) => {
                    newAchievements[player.id].earnedBadgeIds.add(badgeId);
                };

                if (stats.points > 0) checkAndAddBadge('first_score');
                if (completedMatch[team === 'A' ? 'teamA' : 'teamB'].threeHitPlays >= 5) checkAndAddBadge('three_hit_master');
                if (stats.serviceAces >= 3) checkAndAddBadge('serve_ace_pro');
                if (stats.blockingPoints >= 3) checkAndAddBadge('iron_wall');
                if (stats.spikeSuccesses >= 5) checkAndAddBadge('power_spiker');
                if (completedMatch[team === 'A' ? 'teamA' : 'teamB'].fairPlay >= 3) checkAndAddBadge('fair_play_master');
                if (stats.serviceAces >= 1 && stats.serviceFaults === 0) checkAndAddBadge('flawless_serve');
                if (completedMatch.winner === team && completedMatch[team === 'A' ? 'teamB' : 'teamA'].score === 0) checkAndAddBadge('perfect_game');
                
                const playerHistory = allHistory.filter(m => 
                    (m.teamA.players && m.teamA.players[player.id]) || (m.teamB.players && m.teamB.players[player.id])
                );
                if (playerHistory.length >= 5) checkAndAddBadge('consistency_symbol');
                
                const wins = playerHistory.filter(m => {
                    const playerTeam = (m.teamA.players && m.teamA.players[player.id]) ? 'A' : 'B';
                    return m.winner === playerTeam;
                }).length;
                if (wins >= 5) checkAndAddBadge('victory_protagonist');
                
                if (playerHistory.length === 1) {
                    const teamState = completedMatch[team === 'A' ? 'teamA' : 'teamB'];
                    const teamMates = Object.keys(teamState.players);
                    const maxPointsInTeam = Math.max(...teamMates.map(id => teamState.playerStats[id]?.points || 0));
                    if (stats.points > 0 && stats.points >= maxPointsInTeam) {
                        checkAndAddBadge('rookie_ace');
                    }
                }
                
                if (completedMatch.winner === team) {
                    const winnerKey = team.toLowerCase() as 'a' | 'b';
                    const loserKey = (team === 'A' ? 'b' : 'a');
                    const wasBehindBy5 = completedMatch.scoreHistory.some(score => (score as any)[winnerKey] <= (score as any)[loserKey] - 5);
                    if (wasBehindBy5) {
                        checkAndAddBadge('comeback_kid');
                    }

                    const winningTeamState = completedMatch[team === 'A' ? 'teamA' : 'teamB'];
                    const allPlayersScored = Object.keys(winningTeamState.players).every(pId => 
                        winningTeamState.playerStats[pId] && winningTeamState.playerStats[pId].points > 0
                    );
                    if (allPlayersScored) {
                        checkAndAddBadge('team_player');
                    }
                }
            }
        });

        // 2. Process Competitive Badges
        const [finalAchievements] = recalculateSpecialBadges(allHistory, newAchievements);
        
        // 3. Save
        await savePlayerAchievements(finalAchievements);
    }, [savePlayerAchievements]);


    const checkAndAwardBadges = useCallback(async (completedMatch: MatchState, allHistory: (MatchState & { date: string })[]) => {
        const newAchievements: PlayerAchievements = {};
        for (const playerId in playerAchievementsRef.current) {
            newAchievements[playerId] = {
                earnedBadgeIds: new Set(playerAchievementsRef.current[playerId].earnedBadgeIds)
            };
        }
        let newBadgesAwardedThisMatch = false;

        const allPlayersInMatch: { player: Player, stats: PlayerStats, team: 'A' | 'B' }[] = [];
        if (completedMatch.teamA.players) {
            Object.entries(completedMatch.teamA.players).forEach(([id, player]) => {
                if(completedMatch.teamA.playerStats[id]) allPlayersInMatch.push({ player, stats: completedMatch.teamA.playerStats[id], team: 'A' });
            });
        }
        if (completedMatch.teamB.players) {
            Object.entries(completedMatch.teamB.players).forEach(([id, player]) => {
                if(completedMatch.teamB.playerStats[id]) allPlayersInMatch.push({ player, stats: completedMatch.teamB.playerStats[id], team: 'B' });
            });
        }

        for (const { player, stats, team } of allPlayersInMatch) {
            if (!newAchievements[player.id]) {
                newAchievements[player.id] = { earnedBadgeIds: new Set() };
            }

            const checkAndAddBadge = (badgeId: string) => {
                if (!newAchievements[player.id].earnedBadgeIds.has(badgeId)) {
                    newAchievements[player.id].earnedBadgeIds.add(badgeId);
                    newBadgesAwardedThisMatch = true;
                }
            };

            if (stats.points > 0 && !newAchievements[player.id].earnedBadgeIds.has('first_score')) checkAndAddBadge('first_score');
            if (completedMatch[team === 'A' ? 'teamA' : 'teamB'].threeHitPlays >= 5) checkAndAddBadge('three_hit_master');
            if (stats.serviceAces >= 3) checkAndAddBadge('serve_ace_pro');
            if (stats.blockingPoints >= 3) checkAndAddBadge('iron_wall');
            if (stats.spikeSuccesses >= 5) checkAndAddBadge('power_spiker');
            if (completedMatch[team === 'A' ? 'teamA' : 'teamB'].fairPlay >= 3) checkAndAddBadge('fair_play_master');
            if (stats.serviceAces >= 1 && stats.serviceFaults === 0) checkAndAddBadge('flawless_serve');
            if (completedMatch.winner === team && completedMatch[team === 'A' ? 'teamB' : 'teamA'].score === 0) checkAndAddBadge('perfect_game');
            
            const playerHistory = allHistory.filter(m => (m.teamA.players && m.teamA.players[player.id]) || (m.teamB.players && m.teamB.players[player.id]));
            if (playerHistory.length >= 5) checkAndAddBadge('consistency_symbol');
            const wins = playerHistory.filter(m => {
                const playerTeam = (m.teamA.players && m.teamA.players[player.id]) ? 'A' : 'B';
                return m.winner === playerTeam;
            }).length;
            if (wins >= 5) checkAndAddBadge('victory_protagonist');
            
            if (playerHistory.length === 1) {
                const teamState = completedMatch[team === 'A' ? 'teamA' : 'teamB'];
                const teamMates = Object.keys(teamState.players);
                const maxPointsInTeam = Math.max(...teamMates.map(id => teamState.playerStats[id]?.points || 0));
                if (stats.points > 0 && stats.points >= maxPointsInTeam) {
                    checkAndAddBadge('rookie_ace');
                }
            }
            
            if (completedMatch.winner === team) {
                const winnerKey = team.toLowerCase() as 'a' | 'b';
                const loserKey = (team === 'A' ? 'b' : 'a');
                const wasBehindBy5 = completedMatch.scoreHistory.some(score => (score as any)[winnerKey] <= (score as any)[loserKey] - 5);
                if (wasBehindBy5) {
                    checkAndAddBadge('comeback_kid');
                }

                const winningTeamState = completedMatch[team === 'A' ? 'teamA' : 'teamB'];
                const allPlayersScored = Object.keys(winningTeamState.players).every(pId => 
                    winningTeamState.playerStats[pId] && winningTeamState.playerStats[pId].points > 0
                );
                if (allPlayersScored) {
                    checkAndAddBadge('team_player');
                }
            }
        }

        const [finalAchievements, specialBadgesChanged] = recalculateSpecialBadges(allHistory, newAchievements);
        const finalBadgeAwarded = newBadgesAwardedThisMatch || specialBadgesChanged;

        if (finalBadgeAwarded) {
            await savePlayerAchievements(finalAchievements);
            showToast("새로운 배지를 획득했거나 랭킹이 변경되었습니다! 명예의 전당을 확인하세요.", 'success');
        }
    }, [savePlayerAchievements, showToast, recalculateAllAchievements]);


    const saveTeamSets = async (newTeamSets: TeamSet[], successMessage?: string) => {
        try {
            await localforage.setItem(TEAM_SETS_KEY, newTeamSets);
            setTeamSets(newTeamSets);
            if (successMessage) {
                showToast(successMessage, 'success');
            }
            await createBackup();
        } catch (error) {
            console.error("Error saving team sets:", error);
            showToast("데이터 저장 중 오류가 발생했습니다.", 'error');
            throw error;
        }
    };

    const saveMatchHistory = async (newHistory: (MatchState & { date: string; time?: number })[], successMessage?: string) => {
        try {
            await localforage.setItem(MATCH_HISTORY_KEY, newHistory);
            setMatchHistory(newHistory);
             if (successMessage) {
                showToast(successMessage, 'success');
            }
            await createBackup();

            const lastMatch = newHistory.find(m => m.status === 'completed');
            if (lastMatch) {
                await checkAndAwardBadges(lastMatch, newHistory as (MatchState & { date: string })[]);
            }
        } catch (error) {
            console.error("Error saving match history:", error);
            showToast("기록 저장 중 오류가 발생했습니다.", 'error');
            throw error;
        }
    };

    // ... (rest of save functions: saveUserEmblems, saveTournaments, etc. remain the same)
    
    const saveUserEmblems = async (newUserEmblems: UserEmblem[]) => {
        try {
            await localforage.setItem(USER_EMBLEMS_KEY, newUserEmblems);
            setUserEmblems(newUserEmblems);
            await createBackup();
        } catch (error) {
            console.error("Error saving user emblems:", error);
            showToast("앰블럼 저장 중 오류가 발생했습니다.", 'error');
        }
    };
    
    const saveTournaments = async (newTournaments: Tournament[]) => {
        try {
            await localforage.setItem(TOURNAMENTS_KEY, newTournaments);
            setTournaments(newTournaments);
            await createBackup();
        } catch (error) {
            console.error("Error saving tournaments:", error);
            showToast("토너먼트 저장 중 오류가 발생했습니다.", 'error');
        }
    };

    const saveLeagues = async (newLeagues: League[]) => {
        try {
            await localforage.setItem(LEAGUES_KEY, newLeagues);
            setLeagues(newLeagues);
            await createBackup();
        } catch (error) {
            console.error("Error saving leagues:", error);
            showToast("리그 저장 중 오류가 발생했습니다.", 'error');
        }
    };

    const saveCoachingLog = async (playerId: string, content: string) => {
        const newLog: CoachingLog = { date: new Date().toISOString(), content };
        const updatedLogs = { ...coachingLogs };
        if (!updatedLogs[playerId]) {
            updatedLogs[playerId] = [];
        }
        updatedLogs[playerId].push(newLog);
        
        try {
            await localforage.setItem(COACHING_LOGS_KEY, updatedLogs);
            setCoachingLogs(updatedLogs);
            showToast('코칭 로그가 저장되었습니다.', 'success');
        } catch (error) {
            console.error("Error saving coaching log:", error);
            showToast("코칭 로그 저장 중 오류가 발생했습니다.", 'error');
        }
    };

    const deleteTeam = async (teamKey: string) => {
        try {
            const [setId, teamName] = teamKey.split('___');
            if (!setId || !teamName) {
                throw new Error("Invalid team key for deletion.");
            }
    
            // structuredClone 사용: 깊은 복사 최적화
            const currentTeamSets = structuredClone(teamSets);
    
            const updatedTeamSets = currentTeamSets.map((set: TeamSet) => {
                if (set.id === setId) {
                    const updatedTeams = set.teams.filter(team => team.teamName !== teamName);
                    return { ...set, teams: updatedTeams };
                }
                return set;
            }).filter((set: TeamSet) => set.teams.length > 0);
    
            await saveTeamSets(updatedTeamSets, `'${teamName}' 팀이 삭제되었습니다.`);
        } catch (error: any) {
            console.error("Error deleting team:", error);
            showToast(`팀 삭제 중 오류 발생: ${error.message}`, 'error');
        }
    };
    
    const addPlayerToTeam = async (teamKey: string, playerName: string) => {
        const [setId, teamName] = teamKey.split('___');
        if (!setId || !teamName) {
            showToast('잘못된 팀 정보입니다.', 'error');
            return;
        }
    
        // structuredClone 사용: 깊은 복사 최적화
        const newTeamSets = structuredClone(teamSets);
        const setIndex = newTeamSets.findIndex((s: TeamSet) => s.id === setId);
        if (setIndex === -1) {
            showToast('팀 세트를 찾을 수 없습니다.', 'error');
            return;
        }
        const teamIndex = newTeamSets[setIndex].teams.findIndex((t: SavedTeamInfo) => t.teamName === teamName);
        if (teamIndex === -1) {
            showToast('팀을 찾을 수 없습니다.', 'error');
            return;
        }
    
        const newPlayer: Player = {
            id: `added_${Date.now()}_${playerName.replace(/\s/g, '')}`,
            originalName: playerName,
            anonymousName: playerName,
            class: '??',
            studentNumber: '??',
            gender: '기타',
            stats: { height: 0, shuttleRun: 0, flexibility: 0, fiftyMeterDash: 0, underhand: 0, serve: 0 },
            isCaptain: false,
            totalScore: 0,
        };
    
        newTeamSets[setIndex].players[newPlayer.id] = newPlayer;
        newTeamSets[setIndex].teams[teamIndex].playerIds.push(newPlayer.id);
    
        await saveTeamSets(newTeamSets, `'${playerName}' 선수가 '${teamName}' 팀에 추가되었습니다.`);
    };
    
    const removePlayerFromTeam = async (teamKey: string, playerId: string) => {
        const [setId, teamName] = teamKey.split('___');
        if (!setId || !teamName) {
            showToast('잘못된 팀 정보입니다.', 'error');
            return;
        }
    
        // structuredClone 사용: 깊은 복사 최적화
        const newTeamSets = structuredClone(teamSets);
        const setIndex = newTeamSets.findIndex((s: TeamSet) => s.id === setId);
        if (setIndex === -1) {
            showToast('팀 세트를 찾을 수 없습니다.', 'error');
            return;
        }
        const teamIndex = newTeamSets[setIndex].teams.findIndex((t: SavedTeamInfo) => t.teamName === teamName);
        if (teamIndex === -1) {
            showToast('팀을 찾을 수 없습니다.', 'error');
            return;
        }
        
        const team = newTeamSets[setIndex].teams[teamIndex];
        if (team.captainId === playerId) {
            showToast('주장은 명단에서 삭제할 수 없습니다.', 'error');
            return;
        }
    
        const player = newTeamSets[setIndex].players[playerId];
        const playerName = player ? player.originalName : '선수';
    
        team.playerIds = team.playerIds.filter((id: string) => id !== playerId);
        
        await saveTeamSets(newTeamSets, `'${playerName}' 선수가 '${teamName}' 팀에서 삭제되었습니다.`);
    };

    /** 개인정보보호법 삭제 요구권: 해당 세트에서 학생 데이터를 영구 삭제하고 모든 팀 명단에서 제거 */
    const deletePlayerFromSet = async (setId: string, playerId: string) => {
        const newTeamSets = structuredClone(teamSets);
        const setIndex = newTeamSets.findIndex((s: TeamSet) => s.id === setId);
        if (setIndex === -1) {
            showToast('팀 세트를 찾을 수 없습니다.', 'error');
            return;
        }
        const theSet = newTeamSets[setIndex];
        const player = theSet.players[playerId];
        const playerName = player ? player.originalName : '학생';

        delete theSet.players[playerId];

        theSet.teams.forEach((team: SavedTeamInfo) => {
            team.playerIds = team.playerIds.filter((id: string) => id !== playerId);
            if (team.captainId === playerId) {
                team.captainId = team.playerIds[0] || '';
            }
        });

        await saveTeamSets(newTeamSets, `'${playerName}' 학생 데이터가 삭제되었습니다.`);
    };
    
    const bulkAddPlayersToTeam = async (teamKey: string, playerNames: string[], overwrite: boolean) => {
        const [setId, teamName] = teamKey.split('___');
        if (!setId || !teamName) {
            showToast('잘못된 팀 정보입니다.', 'error');
            return;
        }

        // structuredClone 사용: 깊은 복사 최적화
        const newTeamSets = structuredClone(teamSets);
        const setIndex = newTeamSets.findIndex((s: TeamSet) => s.id === setId);
        if (setIndex === -1) {
            showToast('팀 세트를 찾을 수 없습니다.', 'error');
            return;
        }
        const teamIndex = newTeamSets[setIndex].teams.findIndex((t: SavedTeamInfo) => t.teamName === teamName);
        if (teamIndex === -1) {
            showToast('팀을 찾을 수 없습니다.', 'error');
            return;
        }
        
        const team = newTeamSets[setIndex].teams[teamIndex];
        const newPlayerIds: string[] = [];

        playerNames.forEach((name, index) => {
            if (name.trim() === '') return;
            const newPlayer: Player = {
                id: `added_${Date.now()}_${index}_${name.replace(/\s/g, '')}`,
                originalName: name.trim(),
                anonymousName: name.trim(),
                class: '??',
                studentNumber: '??',
                gender: '기타',
                stats: { height: 0, shuttleRun: 0, flexibility: 0, fiftyMeterDash: 0, underhand: 0, serve: 0 },
                isCaptain: false,
                totalScore: 0,
            };
            newTeamSets[setIndex].players[newPlayer.id] = newPlayer;
            newPlayerIds.push(newPlayer.id);
        });

        if (overwrite) {
            const captainId = team.captainId;
            const oldPlayerIds = [...team.playerIds];
            
            oldPlayerIds.forEach((id: string) => {
                if (id !== captainId) {
                    delete newTeamSets[setIndex].players[id];
                }
            });
            
            team.playerIds = [captainId, ...newPlayerIds];
        } else {
            team.playerIds.push(...newPlayerIds);
        }
        
        await saveTeamSets(newTeamSets);
        showToast('bulk_import_success', 'success', { count: newPlayerIds.length });
    };

    const createTeamSet = async (name: string) => {
        if (!name.trim()) {
            showToast('팀 세트 이름을 입력해주세요.', 'error');
            return;
        }
        const newSet: TeamSet = {
            id: `set_${Date.now()}`,
            className: name.trim(),
            savedAt: new Date().toISOString(),
            teams: [],
            players: {},
            teamCount: 0,
        };
        await saveTeamSets([newSet, ...teamSets]);
        showToast('toast_new_set_success', 'success', { name: newSet.className });
    };

    const addTeamToSet = async (setId: string, teamName: string) => {
        if (!teamName.trim()) {
            showToast('팀 이름을 입력해주세요.', 'error');
            return;
        }

        // structuredClone 사용: 깊은 복사 최적화
        const newTeamSets = structuredClone(teamSets);
        const setIndex = newTeamSets.findIndex((s: TeamSet) => s.id === setId);
        if (setIndex === -1) {
            showToast('팀 세트를 찾을 수 없습니다.', 'error');
            return;
        }

        const set = newTeamSets[setIndex];
        const finalTeamName = teamName.trim();
        if (set.teams.some((t: SavedTeamInfo) => t.teamName === finalTeamName)) {
            showToast('이미 존재하는 팀 이름입니다.', 'error');
            return;
        }

        // 주장 없이 빈 팀 생성 (사용자가 나중에 주장을 직접 임명하도록)
        const newTeam: SavedTeamInfo = {
            teamName: finalTeamName,
            captainId: '', // 주장 없음
            playerIds: [], // 빈 팀
            color: TEAM_COLORS_PALETTE[set.teams.length % TEAM_COLORS_PALETTE.length],
        };

        set.teams.push(newTeam);
        set.teamCount = set.teams.length;

        await saveTeamSets(newTeamSets);
        showToast('toast_new_team_success', 'success', { teamName: finalTeamName, setName: set.className });
    };

    const setTeamCaptain = async (teamKey: string, playerId: string) => {
        const [setId, teamName] = teamKey.split('___');
        if (!setId || !teamName) {
            showToast('잘못된 팀 정보입니다.', 'error');
            return;
        }

        // structuredClone 사용: 깊은 복사 최적화
        const newTeamSets = structuredClone(teamSets);
        const setIndex = newTeamSets.findIndex((s: TeamSet) => s.id === setId);
        if (setIndex === -1) {
            showToast('팀 세트를 찾을 수 없습니다.', 'error');
            return;
        }

        const teamIndex = newTeamSets[setIndex].teams.findIndex((t: SavedTeamInfo) => t.teamName === teamName);
        if (teamIndex === -1) {
            showToast('팀을 찾을 수 없습니다.', 'error');
            return;
        }

        const team = newTeamSets[setIndex].teams[teamIndex];
        if (!team.playerIds.includes(playerId)) {
            showToast('해당 선수가 이 팀에 속해있지 않습니다.', 'error');
            return;
        }

        // 기존 주장의 isCaptain 플래그 제거
        if (team.captainId && newTeamSets[setIndex].players[team.captainId]) {
            newTeamSets[setIndex].players[team.captainId].isCaptain = false;
        }

        // 새 주장 설정
        team.captainId = playerId;
        if (newTeamSets[setIndex].players[playerId]) {
            newTeamSets[setIndex].players[playerId].isCaptain = true;
        }

        const playerName = newTeamSets[setIndex].players[playerId]?.originalName || '선수';
        await saveTeamSets(newTeamSets, `'${playerName}' 학생이 주장으로 임명되었습니다.`);
    };


    const loadAllData = useCallback(async () => {
        setIsLoading(true);
        try {
            // localforage에서 데이터 로드 (비동기)
            const [
                parsedTeamSets,
                parsedMatchHistory,
                parsedUserEmblems,
                parsedAchievements,
                parsedSettings,
                parsedTournaments,
                parsedLeagues,
                parsedCoachingLogs,
                backupData
            ] = await Promise.all([
                localforage.getItem(TEAM_SETS_KEY) as Promise<TeamSet[] | null>,
                localforage.getItem(MATCH_HISTORY_KEY) as Promise<(MatchState & { date: string; time?: number })[] | null>,
                localforage.getItem(USER_EMBLEMS_KEY) as Promise<UserEmblem[] | null>,
                localforage.getItem(ACHIEVEMENTS_KEY) as Promise<any>,
                localforage.getItem(SETTINGS_KEY) as Promise<AppSettings | null>,
                localforage.getItem(TOURNAMENTS_KEY) as Promise<Tournament[] | null>,
                localforage.getItem(LEAGUES_KEY) as Promise<League[] | null>,
                localforage.getItem(COACHING_LOGS_KEY) as Promise<PlayerCoachingLogs | null>,
                localforage.getItem(BACKUP_KEY) as Promise<any>
            ]);

            const teamSets = parsedTeamSets || [];
            const matchHistory = parsedMatchHistory || [];
            const userEmblems = parsedUserEmblems || [];
            const achievements = parsedAchievements || {};
            const tournaments = parsedTournaments || [];
            const leagues = parsedLeagues || [];
            const coachingLogs = parsedCoachingLogs || {};
            
            if (parsedSettings) {
                setSettings(prev => ({
                    ...prev,
                    winningScore: typeof parsedSettings.winningScore === 'number' ? parsedSettings.winningScore : 11,
                    includeBonusPointsInWinner: typeof parsedSettings.includeBonusPointsInWinner === 'boolean' ? parsedSettings.includeBonusPointsInWinner : true,
                    googleSheetUrl: typeof parsedSettings.googleSheetUrl === 'string' ? parsedSettings.googleSheetUrl : '',
                }));
            }
            
            const deserializedAchievements: PlayerAchievements = {};
            for (const playerId in achievements) {
                deserializedAchievements[playerId] = {
                    ...achievements[playerId],
                    earnedBadgeIds: new Set(achievements[playerId].earnedBadgeIds || [])
                };
            }
            setPlayerAchievements(deserializedAchievements);

            const isMainDataEmpty = (!teamSets || teamSets.length === 0) && (!matchHistory || matchHistory.length === 0);

            if (isMainDataEmpty && backupData) {
                try {
                    const teamSetsAreValid = backupData.teamSets && Array.isArray(backupData.teamSets) && backupData.teamSets.every(isValidTeamSet);
                    const historyIsValid = backupData.matchHistory && Array.isArray(backupData.matchHistory) && backupData.matchHistory.every((m: any) => m && typeof m.date === 'string' && isValidMatchState(m));
                    
                    if (teamSetsAreValid || historyIsValid) {
                         setRecoveryData(backupData);
                    }
                } catch (e) {
                    console.error("Failed to parse or validate backup data:", e);
                }
            }
            
            if (Array.isArray(teamSets) && teamSets.every(isValidTeamSet)) setTeamSets(teamSets);
            if (Array.isArray(matchHistory) && matchHistory.every(m => m && typeof m.date === 'string' && isValidMatchState(m))) setMatchHistory(matchHistory);
            if (isValidUserEmblems(userEmblems)) setUserEmblems(userEmblems);
            if (isValidTournaments(tournaments)) setTournaments(tournaments);
            if (isValidLeagues(leagues)) setLeagues(leagues);
            if (isValidCoachingLogs(coachingLogs)) setCoachingLogs(coachingLogs);
            
        } catch (error: any) {
            // showToast 대신 직접 setToast 호출하여 의존성 순환 방지
            const errorMessage = t(`데이터 로딩 중 오류 발생: ${error.message}`);
            setToast({ message: errorMessage, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    }, [t]); // showToast 의존성 제거, t만 유지

    useEffect(() => {
        loadAllData();
    }, [loadAllData]);
    
    const handleRestoreFromBackup = useCallback(async () => {
        if (!recoveryData) return;
        try {
            const { teamSets = [], matchHistory = [], userEmblems = [], tournaments = [], leagues = [], coachingLogs = {} } = recoveryData;
            await Promise.all([
                localforage.setItem(TEAM_SETS_KEY, teamSets),
                localforage.setItem(MATCH_HISTORY_KEY, matchHistory),
                localforage.setItem(USER_EMBLEMS_KEY, userEmblems),
                localforage.setItem(TOURNAMENTS_KEY, tournaments),
                localforage.setItem(LEAGUES_KEY, leagues),
                localforage.setItem(COACHING_LOGS_KEY, coachingLogs)
            ]);
            
            await loadAllData();
            
            showToast('데이터가 성공적으로 복구되었습니다.', 'success');
            setRecoveryData(null);
        } catch (error) {
            console.error("Failed to restore from backup:", error);
            showToast('데이터 복구 중 오류가 발생했습니다.', 'error');
        }
    }, [recoveryData, loadAllData, showToast]);

    const dismissRecovery = useCallback(() => {
        setRecoveryData(null);
    }, []);

    const clearInProgressMatch = useCallback(() => {
        dispatch({ type: 'RESET_STATE' });
        setMatchTime(0);
        setTimerOn(false);
    }, []);
    
    const closeSession = useCallback(() => {
        isIntentionallyClosing.current = true;
        peerRef.current?.destroy();
        connRef.current = [];
        peerRef.current = null;
        setP2p({ peerId: null, isHost: false, isConnected: false, connections: [], status: 'disconnected', error: undefined });
        setTimeout(() => { isIntentionallyClosing.current = false; }, 500);
    }, []);

    const startHostSession = useCallback((initialState?: MatchState) => {
        if (peerRef.current) {
            peerRef.current.destroy();
        }
        setP2p(prev => ({ ...prev, status: 'connecting', isHost: true, isConnected: false, peerId: null, connections: [] }));
        connRef.current = [];

        const newPeer = new (window as any).Peer(undefined, {
            config: {'iceServers': [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' }
            ]}
        });
        peerRef.current = newPeer;

        newPeer.on('open', (id: string) => {
            setP2p(prev => ({ ...prev, peerId: id, status: 'connected', isConnected: true }));
            showToast(`실시간 세션이 시작되었습니다. 참여 코드: ${id}`, 'success');
        });

        newPeer.on('connection', (conn: DataConnection) => {
            showToast(`${conn.peer}가 연결되었습니다.`, 'success');
            conn.on('open', () => {
                const stateToSync = initialState || matchState;
                if(stateToSync) {
                    conn.send({ type: 'full_state_sync', payload: stateToSync });
                }
                conn.send({ type: 'settings_sync', payload: settings });
                conn.send({ type: 'team_sets_sync', payload: teamSets });
                conn.send({ type: 'user_emblems_sync', payload: userEmblems });
                
                connRef.current.push(conn);
                setP2p(prev => ({ ...prev, connections: [...connRef.current] }));
            });
            conn.on('close', () => {
                if (!isIntentionallyClosing.current) {
                    showToast(`${conn.peer}의 연결이 끊어졌습니다.`, 'error');
                }
                connRef.current = connRef.current.filter(c => c.peer !== conn.peer);
                setP2p(prev => ({ ...prev, connections: [...connRef.current] }));
            });
        });
        newPeer.on('error', (err: any) => {
            console.error("PeerJS host error:", err);
            const message = err.type === 'peer-unavailable' ? '호스트에 연결할 수 없습니다.' : `연결 오류: ${err.type}`;
            setP2p(prev => ({ ...prev, status: 'error', error: message, isConnected: false }));
            showToast(message, 'error');
        });
        newPeer.on('disconnected', () => {
            if (!isIntentionallyClosing.current) {
                showToast('시그널링 서버와의 연결이 끊어졌습니다. 재연결을 시도합니다.', 'error');
                setP2p(prev => ({ ...prev, status: 'connecting', isConnected: false }));
            }
        });
    }, [showToast, matchState, settings, teamSets, userEmblems]);

    const joinSession = useCallback((peerId: string, onSuccess: () => void) => {
        if (peerRef.current) peerRef.current.destroy();
        
        setP2p({ peerId: null, isHost: false, isConnected: false, connections: [], status: 'connecting', error: undefined });
        
        const newPeer = new (window as any).Peer(undefined, {
             config: {'iceServers': [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' }
            ]}
        });
        peerRef.current = newPeer;

        newPeer.on('open', () => {
            const conn = newPeer.connect(peerId, { reliable: true });
            connRef.current = [conn];

            conn.on('open', () => {
                showToast(`호스트(${peerId})에 연결되었습니다.`, 'success');
                setP2p(prev => ({ ...prev, peerId: newPeer.id, isConnected: true, status: 'connected', connections: [conn] }));
                onSuccess();
            });

            conn.on('data', (data: P2PMessage) => {
                if (data.type === 'full_state_sync') {
                    dispatch({ type: 'LOAD_STATE', state: data.payload });
                } else if (data.type === 'action') {
                    dispatch(data.payload);
                } else if (data.type === 'settings_sync') {
                    setSettings(data.payload);
                } else if (data.type === 'team_sets_sync') {
                    saveTeamSets(data.payload);
                } else if (data.type === 'user_emblems_sync') {
                    saveUserEmblems(data.payload);
                }
            });

            conn.on('close', () => {
                if (!isIntentionallyClosing.current) {
                    showToast('호스트와의 연결이 끊어졌습니다.', 'error');
                    dispatch({type: 'RESET_STATE'});
                    closeSession();
                }
            });
            conn.on('error', (err: any) => {
                console.error("PeerJS connection error:", err);
                const message = `연결 오류: ${err.type}`;
                setP2p(prev => ({ ...prev, status: 'error', error: message, isConnected: false }));
                showToast(message, 'error');
                closeSession();
            });
        });

        newPeer.on('error', (err: any) => {
            console.error("PeerJS client error:", err);
            const message = err.type === 'peer-unavailable' ? '호스트에 연결할 수 없습니다. 코드를 확인하세요.' : `연결 오류: ${err.type}`;
            setP2p(prev => ({ ...prev, status: 'error', error: message, isConnected: false }));
            showToast(message, 'error');
            closeSession();
        });
    }, [showToast, closeSession]);

    // ... (rest of the file including startMatch, exportData, etc)
    const startMatch = useCallback((
        teams?: { teamA: string, teamB: string, teamAKey?: string, teamBKey?: string, teamAInfo?: SavedTeamInfo | null, teamBInfo?: SavedTeamInfo | null },
        existingState?: MatchState,
        attendingPlayers?: { teamA: Record<string, Player>, teamB: Record<string, Player> },
        tournamentInfo?: { tournamentId: string; tournamentMatchId: string },
        onCourtIds?: { teamA: Set<string>; teamB: Set<string> },
        leagueInfo?: { leagueId: string, leagueMatchId: string }
    ) => {
        let stateToLoad: MatchState | null = null;

        if (existingState) {
            stateToLoad = existingState;
        } else if (teams) {
            let teamADetails: Partial<TeamMatchState> = {};
            let teamBDetails: Partial<TeamMatchState> = {};
            let teamAPlayers: Record<string, Player> = {};
            let teamBPlayers: Record<string, Player> = {};

            if (attendingPlayers && teams.teamAInfo && teams.teamBInfo) {
                // structuredClone 사용: 깊은 복사 최적화
                teamAPlayers = structuredClone(attendingPlayers.teamA);
                teamBPlayers = structuredClone(attendingPlayers.teamB);

                Object.values(teamAPlayers).forEach((p: Player) => { p.isCaptain = false; });
                if (teams.teamAInfo.captainId && teamAPlayers[teams.teamAInfo.captainId]) {
                    teamAPlayers[teams.teamAInfo.captainId].isCaptain = true;
                }
                const { captainId: _cA, ...detailsA } = teams.teamAInfo;
                teamADetails = detailsA;

                Object.values(teamBPlayers).forEach((p: Player) => { p.isCaptain = false; });
                if (teams.teamBInfo.captainId && teamBPlayers[teams.teamBInfo.captainId]) {
                    teamBPlayers[teams.teamBInfo.captainId].isCaptain = true;
                }
                const { captainId: _cB, ...detailsB } = teams.teamBInfo;
                teamBDetails = detailsB;

            } else {
                if (teams.teamAKey) {
                    const dataA = teamSetsMap.get(teams.teamAKey);
                    if (dataA) {
                        const { teamName: _t, captainId: _c, playerIds: _p, ...details } = dataA.team;
                        teamADetails = details;
                        teamAPlayers = _p.reduce((acc, id) => {
                            if (dataA.set.players[id]) acc[id] = structuredClone(dataA.set.players[id]);
                            return acc;
                        }, {} as Record<string, Player>);
                        if (_c && teamAPlayers[_c]) {
                            teamAPlayers[_c].isCaptain = true;
                        }
                    }
                }
                if (teams.teamBKey) {
                    const dataB = teamSetsMap.get(teams.teamBKey);
                    if (dataB) {
                        const { teamName: _t, captainId: _c, playerIds: _p, ...details } = dataB.team;
                        teamBDetails = details;
                        teamBPlayers = _p.reduce((acc, id) => {
                            if (dataB.set.players[id]) acc[id] = structuredClone(dataB.set.players[id]);
                            return acc;
                        }, {} as Record<string, Player>);
                        if (_c && teamBPlayers[_c]) {
                            teamBPlayers[_c].isCaptain = true;
                        }
                    }
                }
            }

            stateToLoad = getInitialState({
                ...teams,
                teamAPlayers,
                teamBPlayers,
                teamADetails,
                teamBDetails,
            }, tournamentInfo, onCourtIds, leagueInfo);
        }

        if (stateToLoad) {
            dispatch({ type: 'LOAD_STATE', state: stateToLoad });
            if (!existingState) {
                 startHostSession(stateToLoad);
            }
        }
        
        setMatchTime(0);
        setTimerOn(!!stateToLoad?.servingTeam && !stateToLoad?.gameOver);

    }, [getInitialState, teamSetsMap, startHostSession]);
    
    const localDispatch = useCallback((action: Action) => {
        const newState = matchReducer(matchState, action);
        if (newState) {
            dispatch({ type: 'LOAD_STATE', state: newState });
            if (p2p.isHost) {
                // FIX: Send Full State Sync on UNDO to ensure clients match exactly
                if (action.type === 'UNDO') {
                    broadcast({ type: 'full_state_sync', payload: newState });
                } else {
                    broadcast({ type: 'action', payload: action });
                }
            }
        }
    }, [matchState, p2p.isHost, broadcast, matchReducer]);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | null = null;
        if (timerOn && matchState && !matchState.gameOver) {
            interval = setInterval(() => setMatchTime(prev => prev + 1), 1000);
        }
        return () => { if (interval) clearInterval(interval); };
    }, [timerOn, matchState]);

    const exportData = async () => {
        try {
            // 진행 중인 경기 상태도 포함
            const ongoingMatch = matchState && matchState.status === 'in_progress' ? {
                matchState,
                matchTime,
                timerOn
            } : null;
            
            const dataToExport = {
                teamSets, 
                matchHistory, 
                userEmblems, 
                tournaments, 
                leagues, 
                coachingLogs, 
                settings,
                ongoing_match: ongoingMatch // 진행 중인 경기 상태 포함
            };
            const dataStr = JSON.stringify(dataToExport, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `jct_volleyball_backup_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('데이터를 성공적으로 내보냈습니다.', 'success');
        } catch (error) {
            showToast('데이터 내보내기 중 오류가 발생했습니다.', 'error');
            console.error("Export failed:", error);
        }
    };
    
    const saveImportedData = async (data: { teamSets: TeamSet[], matchHistory: (MatchState & { date: string; time?: number })[], userEmblems?: UserEmblem[], tournaments?: Tournament[], leagues?: League[], coachingLogs?: PlayerCoachingLogs, settings?: AppSettings, ongoing_match?: { matchState: MatchState, matchTime: number, timerOn: boolean } }) => {
        try {
            await Promise.all([
                saveTeamSets(data.teamSets || []),
                saveMatchHistory(data.matchHistory || []),
                saveUserEmblems(data.userEmblems || []),
                saveTournaments(data.tournaments || []),
                saveLeagues(data.leagues || []),
                (async () => {
                    const logs = data.coachingLogs || {};
                    await localforage.setItem(COACHING_LOGS_KEY, logs);
                    setCoachingLogs(logs);
                })(),
                (async () => {
                    if (data.settings) {
                        await localforage.setItem(SETTINGS_KEY, data.settings);
                        setSettings(data.settings);
                    }
                })()
            ]);
            
            // 진행 중인 경기 상태 복구
            if (data.ongoing_match && data.ongoing_match.matchState) {
                dispatch({ type: 'LOAD_STATE', state: data.ongoing_match.matchState });
                setMatchTime(data.ongoing_match.matchTime || 0);
                setTimerOn(data.ongoing_match.timerOn || false);
                showToast('진행 중이던 경기 상태가 복구되었습니다.', 'success');
            }
            
            // Recalculate achievements based on imported match history to ensure consistency
            if (data.matchHistory && data.matchHistory.length > 0) {
               await recalculateAllAchievements(data.matchHistory as (MatchState & { date: string })[]);
            }
            
            showToast('데이터를 성공적으로 가져왔습니다.', 'success');
            await loadAllData();
        } catch (error) {
            console.error("Import failed:", error);
            showToast('데이터를 적용하는 중 오류가 발생했습니다.', 'error');
        }
    };

    const resetAllData = useCallback(async () => {
        try {
            await Promise.all([
                localforage.removeItem(TEAM_SETS_KEY),
                localforage.removeItem(MATCH_HISTORY_KEY),
                localforage.removeItem(USER_EMBLEMS_KEY),
                localforage.removeItem(ACHIEVEMENTS_KEY),
                localforage.removeItem(BACKUP_KEY),
                localforage.removeItem(SETTINGS_KEY),
                localforage.removeItem(TOURNAMENTS_KEY),
                localforage.removeItem(LEAGUES_KEY),
                localforage.removeItem(COACHING_LOGS_KEY),
                localforage.removeItem(LANGUAGE_KEY)
            ]);

            setTeamSets([]);
            setMatchHistory([]);
            setUserEmblems([]);
            setPlayerAchievements({});
            setTournaments([]);
            setLeagues([]);
            setCoachingLogs({});
            setSettings({ winningScore: 11, includeBonusPointsInWinner: true, googleSheetUrl: '' });
            await setLanguage('ko');
            showToast('모든 데이터가 초기화되었습니다.', 'success');
        } catch (error) {
            console.error("Failed to reset all data:", error);
            showToast('데이터 초기화 중 오류가 발생했습니다.', 'error');
        }
    }, [showToast, setLanguage]);

    const value: DataContextType = {
        teamSets,
        teamSetsMap,
        matchHistory,
        userEmblems,
        playerAchievements,
        coachingLogs,
        playerCumulativeStats,
        teamPerformanceData,
        tournaments,
        leagues,
        isLoading,
        toast,
        saveTeamSets,
        saveMatchHistory,
        saveUserEmblems,
        saveTournaments,
        saveLeagues,
        saveCoachingLog,
        deleteTeam,
        addPlayerToTeam,
        removePlayerFromTeam,
        deletePlayerFromSet,
        bulkAddPlayersToTeam,
        createTeamSet,
        addTeamToSet,
        setTeamCaptain,
        reloadData: loadAllData,
        exportData,
        saveImportedData,
        showToast,
        hideToast,
        resetAllData,
        matchState,
        matchTime,
        timerOn,
        dispatch: localDispatch,
        setTimerOn,
        clearInProgressMatch,
        startMatch,
        recoveryData,
        handleRestoreFromBackup,
        dismissRecovery,
        generateAiResponse,
        isPasswordModalOpen,
        handlePasswordSuccess,
        handlePasswordCancel,
        requestPassword,
        settings,
        saveSettings,
        p2p,
        startHostSession,
        joinSession,
        closeSession,
        language,
        setLanguage,
    };

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};