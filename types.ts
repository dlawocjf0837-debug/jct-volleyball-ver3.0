import React from 'react';

export interface Stats {
    height: number;
    shuttleRun: number;
    flexibility: number;
    fiftyMeterDash: number;
    underhand: number;
    serve: number;
}

export const STAT_KEYS: (keyof Stats)[] = ['height', 'shuttleRun', 'flexibility', 'fiftyMeterDash', 'underhand', 'serve'];

export const STAT_NAME_KEYS: Record<keyof Stats, string> = {
    height: 'stat_height',
    shuttleRun: 'stat_shuttleRun',
    flexibility: 'stat_flexibility',
    fiftyMeterDash: 'stat_fiftyMeterDash',
    underhand: 'stat_underhand',
    serve: 'stat_serve',
};


export interface Player {
    id: string;
    originalName: string;
    anonymousName: string;
    class: string;
    studentNumber: string;
    gender: string;
    stats: Stats;
    isCaptain: boolean;
    totalScore: number;
    customLabel1?: string; // 언더핸드 대체 라벨
    customLabel2?: string; // 서브 대체 라벨
    /** 전력 분석/특이사항 메모 (클럽 모드 상대 선수 등) */
    memo?: string;
    /** 수업 모드: 경기 역할 수행 이력 (아나운서, 주심, 선심 등) */
    roleHistory?: Array<{ role: string; date: string; matchInfo: string }>;
}

/** 수업 모드: 경기 역할 배정 데이터 (MatchSetup → Scoreboard 전달) - 모든 역할 최대 4명 배열 */
export type MatchRoles = {
    announcers: Player[];
    referees: Player[];
    lineJudges: Player[];
    cameraDirectors: Player[];
    recorders: Player[];
};

export enum Screen {
    Input = 'INPUT',
    Builder = 'BUILDER',
}

export type TeamId = string;

export interface Team {
    id: TeamId;
    name: string;
    captainId: string;
    playerIds: string[];
    color: string;
    emblem?: string;
}

/** 클럽 모드: 저장된 상대 팀 (이름 + 선수 목록, 원클릭 불러오기용) */
export interface SavedOpponentTeam {
    id: string;
    name: string;
    players: { number: string; name: string; memo?: string }[];
    savedAt: string;
}

/** 1세트 점수 (3판 2선승제 등) */
export interface SetScore {
    teamA: number;
    teamB: number;
}

/** 클럽 모드: 조별 리그 순위표용 경기 결과 (3판 2선승제 세트 스코어 배열) */
export interface LeagueStandingsMatch {
    teamA: string;
    teamB: string;
    /** 최대 3세트 점수. [세트1, 세트2, 세트3]. 2:0 또는 2:1로 승패 판단 */
    setScores: SetScore[];
}

/** 세트 스코어 배열에서 승/패 세트 수 계산 */
export function getSetsWonFromMatch(m: LeagueStandingsMatch): { setsA: number; setsB: number } {
    let setsA = 0;
    let setsB = 0;
    (m.setScores || []).forEach(s => {
        if (s.teamA > s.teamB) setsA += 1;
        else if (s.teamB > s.teamA) setsB += 1;
    });
    return { setsA, setsB };
}

/** 클럽 모드: 조별 리그 순위표 데이터 (대회 1개) */
export interface LeagueStandingsData {
    id: string;
    tournamentName: string;
    teams: string[];
    matches: LeagueStandingsMatch[];
    /** 진출 시나리오 계산 기준 팀 (우리 학교) */
    ourSchool?: string;
}

/** 클럽 모드: 대회 목록 저장 (다중 대회 관리) */
export interface LeagueStandingsDataList {
    list: LeagueStandingsData[];
    selectedId: string | null;
}

export interface SavedTeamInfo {
    teamName: string;
    captainId: string;

    playerIds: string[];
    cheerUrl?: string;
    cheerUrl2?: string;
    cheerName2?: string;
    emblem?: string;
    color?: string;
    slogan?: string;
    memo?: string;
}
export interface TeamSet {
    id: string;
    className: string;
    savedAt: string;
    teams: SavedTeamInfo[];
    players: Record<string, Player>;
    teamCount?: number;
}

export type UserEmblem = {
    id: string;
    data: string;
}

export interface PlayerStats {
    points: number;
    serviceAces: number;
    serviceFaults: number;
    blockingPoints: number;
    spikeSuccesses: number;
    // New stats
    serveIn: number;
    digs: number;
    assists: number;
}

export interface TeamMatchState {
    name: string;
    key?: string;
    cheerUrl?: string;
    cheerUrl2?: string;
    cheerName2?: string;
    emblem?: string;
    color?: string;
    slogan?: string;
    score: number;
    setsWon: number;
    timeouts: number;
    fairPlay: number;
    threeHitPlays: number;
    serviceAces: number;
    serviceFaults: number;
    blockingPoints: number;
    spikeSuccesses: number;
    players: Record<string, Player>;
    playerStats: Record<string, PlayerStats>;
    onCourtPlayerIds: string[];
    benchPlayerIds: string[];
    /** 0~5: onCourtPlayerIds 내 서버 위치 (배구 로테이션) */
    currentServerIndex?: number;
}

export type ScoreEventType = 'ACE' | 'FAULT' | 'BLOCK' | 'SPIKE' | 'SCORE' | 'TIMEOUT' | 'GAME_END' | 'SUB' | 'FAIRPLAY' | '3HIT' | 'SERVE_IN' | 'DIG' | 'ASSIST' | 'UNKNOWN';

export interface ScoreEvent {
    score: { a: number; b: number };
    descriptionKey: string;
    replacements?: Record<string, string | number>;
    time?: number;
    substitution?: {
        team: 'A' | 'B';
        playerIn: string;
        playerOut: string;
    };
    type: ScoreEventType;
}

export interface MatchState {
    teamA: TeamMatchState;
    teamB: TeamMatchState;
    servingTeam: 'A' | 'B' | null;
    currentSet: number;
    /** 3판 2선승제면 3. 기본 1(단판) */
    maxSets?: number;
    isDeuce: boolean;
    gameOver: boolean;
    winner: 'A' | 'B' | null;
    scoreHistory: { a: number, b: number }[];
    /** 3판 2선승제 등에서 세트별 최종 스코어 (세트 종료 시마다 추가) */
    setScores?: SetScore[];
    eventHistory: ScoreEvent[];
    scoreLocations: any[];
    status?: 'in_progress' | 'completed';
    timeout: { team: 'A' | 'B', timeLeft: number } | null;
    tournamentId?: string;
    tournamentMatchId?: string;
    leagueId?: string;
    leagueMatchId?: string;
    /** 연습경기(practice) / 대회·조별리그(tournament) 구분 */
    matchType?: 'practice' | 'tournament';
    time?: number;
    undoStack?: MatchState[]; // For Undo functionality
    /** 세트 종료 후 [다음 세트 진행] 대기 중일 때 true (코트 체인지 후 다음 세트 시작용) */
    setEnded?: boolean;
    /** 세트 종료 시점의 서브 팀 (다음 세트 첫 서브 = 상대 팀) */
    lastServingTeamAtSetEnd?: 'A' | 'B';
    /** 방금 끝난 세트 스코어 (setEnded일 때만 사용) */
    completedSetScore?: { a: number; b: number };
    /** 대회 모드일 때 1~n-1세트 목표 점수 (21 또는 25). 결승 세트는 항상 15점 */
    tournamentTargetScore?: number;
    /** 수업 모드 수행평가 기록 여부 */
    isAssessment?: boolean;
    /** 수행평가 종료 시 선정된 허슬 플레이어(노력상) ID 목록 */
    hustlePlayerIds?: string[];
    /** 상세 보기용: 허슬 플레이어 id, name, team 배열 */
    hustlePlayers?: { id: string; name: string; team: 'A' | 'B' }[];
}

export type Action =
    | { type: 'LOAD_STATE'; state: MatchState }
    | { type: 'RESET_STATE' }
    | { type: 'UNDO' } // New Undo Action
    | { type: 'SCORE'; team: 'A' | 'B'; amount: number }
    | { type: 'SERVICE_ACE'; team: 'A' | 'B'; playerId: string }
    | { type: 'SERVICE_FAULT'; team: 'A' | 'B'; playerId: string }
    | { type: 'BLOCKING_POINT'; team: 'A' | 'B'; playerId: string }
    | { type: 'SPIKE_SUCCESS'; team: 'A' | 'B'; playerId: string }
    | { type: 'SERVE_IN'; team: 'A' | 'B'; playerId: string } // New
    | { type: 'DIG_SUCCESS'; team: 'A' | 'B'; playerId: string } // New
    | { type: 'ASSIST_SUCCESS'; team: 'A' | 'B'; playerId: string } // New
    | { type: 'TAKE_TIMEOUT'; team: 'A' | 'B' }
    | { type: 'UPDATE_TIMEOUT_TIMER'; timeLeft: number }
    | { type: 'END_TIMEOUT' }
    | { type: 'ADJUST_FAIR_PLAY'; team: 'A' | 'B'; amount: number }
    | { type: 'INCREMENT_3_HIT'; team: 'A' | 'B' }
    | { type: 'SET_SERVING_TEAM'; team: 'A' | 'B' }
    | { type: 'SUBSTITUTE_PLAYER'; team: 'A' | 'B'; playerIn: string; playerOut: string }
    | { type: 'UPDATE_PLAYER_MEMO'; team: 'A' | 'B'; playerId: string; memo: string }
    | { type: 'START_NEXT_SET' }; // 세트 종료 모달에서 [다음 세트 진행] 클릭 시


export interface Badge {
    id: string;
    nameKey: string;
    descriptionKey: string;
    icon: React.FC<{ className?: string }>;
    isCompetitive?: boolean;
}

export interface PlayerAchievements {
    [playerId: string]: {
        earnedBadgeIds: Set<string>;
    };
}

export type PlayerCumulativeStats = {
    serviceAces: number;
    serviceFaults: number;
    spikeSuccesses: number;
    blockingPoints: number;
    matchesPlayed: number;
    wins: number;
    points: number;
    badgeCount: number;
    plusMinus: number;
    serveIn: number;
    digs: number;
    assists: number;
    /** 허슬 뱃지(노력상) 획득 횟수 */
    hustleBadges?: number;
};

export interface ToastState {
    message: string;
    type: 'success' | 'error';
}

export interface AppSettings {
    winningScore: number;
    includeBonusPointsInWinner: boolean;
    googleSheetUrl?: string;
    /** 스포츠클럽 대회 세트당 목표 점수 (21 또는 25, 기본 21) */
    tournamentTargetScore?: number;
    /** 스포츠클럽 대회 경기 세트 수 (3 = 3판2선승, 5 = 5판3선승, 기본 3) */
    tournamentMaxSets?: number;
    /** 배구 경기 인원 룰: 6 = 6인제(로테이션/서브), 9 = 9인제(서브 순서만), 기본 6 */
    volleyballRuleSystem?: 6 | 9;
}
export type MvpResult = {
    player: Player;
    team: TeamMatchState;
    stats: PlayerStats;
    mvpScore: number;
    scoreBreakdown: Record<string, number>;
} | null;

export interface Tournament {
    id: string;
    name: string;
    teamKeys: string[];
    createdAt: string;
    rounds: TournamentMatch[][];
}
export interface TournamentMatch {
    id: string;
    teamA: { key: string | null; name: string | null, score?: number };
    teamB: { key: string | null; name: string | null, score?: number };
    winnerKey: string | null;
    nextMatchId: string | null;
    round: number;
}

export interface League {
    id: string;
    name: string;
    createdAt: string;
    teamKeys: string[];
    schedule: LeagueMatch[];
}

export interface LeagueMatch {
    id: string;
    teamAKey: string;
    teamBKey: string;
    teamAName: string;
    teamBName: string;
    matchId: string | null; // To link with a MatchState in matchHistory
    day?: number;
}


export type CoachingLog = {
    date: string;
    content: string;
};

export type PlayerCoachingLogs = {
    [playerId: string]: CoachingLog[];
};

export type TeamStats = {
    teamName: string;
    className: string;
    teamCount: number;
    emblem?: string;
    slogan?: string;
    color?: string;
    gamesPlayed: number;
    wins: number;
    losses: number;
    ties: number;
    winRate: number;
    points: number;
    pointsFor: number;
    pointsAgainst: number;
    pointDifference: number;
    
    // Detailed stats
    avgPointsFor: number;
    avgPointsAgainst: number;
    serviceAces: number;
    serviceFaults: number;
    blockingPoints: number;
    spikeSuccesses: number;
    threeHitPlays: number;
    fairPlay: number;
    
    // New stats
    serveIn?: number;
    avgServeSuccess?: number;
};


export type EnrichedMatch = MatchState & {
  id: string;
  status: 'in_progress' | 'completed';
  date: string;
  time?: number;
};

// PeerJS related types
export interface PeerJSOption {
  key?: string;
  host?: string;
  port?: number;
  path?: string;
  secure?: boolean;
  config?: any;
  debug?: number;
}

export interface DataConnection {
  on(event: 'data', callback: (data: any) => void): void;
  on(event: 'open', callback: () => void): void;
  on(event: 'close', callback: () => void): void;
  on(event: 'error', callback: (err: any) => void): void;
  send(data: any): void;
  close(): void;
  peer: string;
}

export interface P2PState {
    peerId: string | null;
    isHost: boolean;
    isConnected: boolean;
    connections: DataConnection[];
    status: 'disconnected' | 'connecting' | 'connected' | 'error';
    error?: string;
    /** 클라이언트 전용: 방장이 켠 대회 모드 여부 */
    clientTournamentMode?: boolean;
    /** 시청자 수 (호스트: 실시간 계산, 클라이언트: 수신값) */
    viewerCount?: number;
    /** 작전 타임 뷰어 오버레이 상태 */
    timeoutViewer?: { active: boolean; timeLeft: number };
    /** 클라이언트 전용: 방장의 채팅 허용 여부 (false면 채팅 입력 불가) */
    chatEnabled?: boolean;
    /** 클라이언트 전용: 방장이 부여한 익명 닉네임/색상 */
    viewerLabel?: { displayName: string; color: string };
    /** 클라이언트 전용: 채팅창 표시 여부 (false면 LiveChatOverlay 미렌더) */
    chatWindowVisible?: boolean;
    /** 클라이언트 전용: 호스트가 차단한 시청자 ID 목록 (해당 시청자 채팅 입력 불가) */
    blockedViewerIds?: string[];
}

export type P2PMessage = {
    type: 'full_state_sync';
    payload: MatchState | { matchData: MatchState; isTournamentMode: boolean };
} | {
    type: 'tournament_mode_sync';
    payload: boolean;
} | {
    type: 'ticker_sync';
    payload: string;
} | {
    type: 'REACTION';
    payload: { emoji: string };
} | {
    type: 'reaction_broadcast';
    payload: { emoji: string };
} | {
    type: 'viewer_count_sync';
    payload: number;
} | {
    type: 'timeout_viewer_sync';
    payload: { active: boolean; timeLeft?: number };
} | {
    type: 'effect_broadcast';
    payload: { effectType: 'SPIKE' | 'BLOCK' };
} | {
    type: 'action';
    payload: Action;
} | {
    type: 'settings_sync';
    payload: AppSettings;
} | {
    type: 'team_sets_sync';
    payload: TeamSet[];
} | {
    type: 'user_emblems_sync';
    payload: UserEmblem[];
} | {
    type: 'CHAT';
    payload: { text: string; senderId: string };
} | {
    type: 'chat_broadcast';
    payload: { text: string; senderId?: string; senderLabel: string; senderColor: string; isSystem?: boolean };
} | {
    type: 'chat_enabled_sync';
    payload: boolean;
} | {
    type: 'viewer_info';
    payload: { displayName: string; color: string };
} | {
    type: 'chat_visibility_sync';
    payload: boolean;
} | {
    type: 'chat_blocked_sync';
    payload: string[];
} | {
    type: 'chat_delete_message';
    payload: number;
};

export type Language = 'ko' | 'id';

export interface DataContextType {
    teamSets: TeamSet[];
    teamSetsMap: Map<string, { set: TeamSet, team: SavedTeamInfo }>;
    matchHistory: (MatchState & { date: string, time?: number })[];
    userEmblems: UserEmblem[];
    playerAchievements: PlayerAchievements;
    coachingLogs: PlayerCoachingLogs;
    opponentTeams: SavedOpponentTeam[];
    leagueStandings: LeagueStandingsData | null;
    leagueStandingsList: LeagueStandingsDataList;
    saveLeagueStandings: (data: LeagueStandingsData | null) => Promise<void>;
    saveLeagueStandingsList: (data: LeagueStandingsDataList) => Promise<void>;
    leagueMatchHistory: (MatchState & { date: string; time?: number })[];
    saveOpponentTeam: (team: Omit<SavedOpponentTeam, 'id' | 'savedAt'>) => Promise<void>;
    updateOpponentTeam: (id: string, team: Partial<SavedOpponentTeam>) => Promise<void>;
    deleteOpponentTeam: (id: string) => Promise<void>;
    playerCumulativeStats: Record<string, Partial<PlayerCumulativeStats>>;
    teamPerformanceData: TeamStats[];
    tournaments: Tournament[];
    leagues: League[];
    isLoading: boolean;
    toast: ToastState;
    saveTeamSets: (newTeamSets: TeamSet[], successMessage?: string) => Promise<void>;
    saveMatchHistory: (newHistory: (MatchState & { date: string, time?: number })[], successMessage?: string) => Promise<void>;
    saveRoleHistoryAfterMatch: (matchInfo: string, date: string) => Promise<void>;
    savePracticeMatchHistory: (newList: (MatchState & { date: string; time?: number })[], successMessage?: string) => Promise<void>;
    saveLeagueMatchHistory: (newList: (MatchState & { date: string; time?: number })[], successMessage?: string) => Promise<void>;
    saveUserEmblems: (newUserEmblems: UserEmblem[]) => Promise<void>;
    saveTournaments: (newTournaments: Tournament[]) => Promise<void>;
    saveLeagues: (newLeagues: League[]) => Promise<void>;
    saveCoachingLog: (playerId: string, content: string) => Promise<void>;
    deleteTeam: (teamKey: string) => Promise<void>;
    addPlayerToTeam: (teamKey: string, playerName: string) => Promise<void>;
    removePlayerFromTeam: (teamKey: string, playerId: string) => Promise<void>;
    deletePlayerFromSet: (setId: string, playerId: string) => Promise<void>;
    bulkAddPlayersToTeam: (teamKey: string, playerNames: string[], overwrite: boolean) => Promise<void>;
    createTeamSet: (name: string) => Promise<void>;
    addTeamToSet: (setId: string, teamName: string, options?: { createDefaultPlayers?: boolean }) => Promise<void>;
    copyTeamFromOtherSet: (targetSetId: string, sourceTeamKey: string) => Promise<void>;
    setTeamCaptain: (teamKey: string, playerId: string) => Promise<void>;
    updatePlayerMemoInTeamSet: (setId: string, playerId: string, memo: string) => Promise<void>;
    reloadData: () => void;
    exportData: () => void;
    saveImportedData: (data: any) => void;
    showToast: (message: string, type?: 'success' | 'error', replacements?: Record<string, string | number>) => void;
    hideToast: () => void;
    resetAllData: () => void;
    matchState: MatchState | null;
    matchTime: number;
    timerOn: boolean;
    dispatch: React.Dispatch<Action>;
    // FIX: Changed React.SetState to React.SetStateAction
    setTimerOn: React.Dispatch<React.SetStateAction<boolean>>;
    clearInProgressMatch: () => void;
    startMatch: (
        teams?: { teamA: string; teamB: string; teamAKey?: string; teamBKey?: string; teamAInfo?: SavedTeamInfo | null; teamBInfo?: SavedTeamInfo | null },
        existingState?: MatchState,
        attendingPlayers?: { teamA: Record<string, Player>; teamB: Record<string, Player> },
        tournamentInfo?: { tournamentId: string; tournamentMatchId: string },
        onCourtIds?: { teamA: Set<string>; teamB: Set<string> },
        leagueInfo?: { leagueId: string, leagueMatchId: string },
        options?: { isPracticeMatch?: boolean; maxSets?: number; tournamentTargetScore?: number; isLeagueMatch?: boolean; leagueStandingsId?: string | null; onCourtOrder?: { teamA: string[]; teamB: string[] }; matchRoles?: MatchRoles }
    ) => void;
    recoveryData: any | null;
    handleRestoreFromBackup: () => void;
    dismissRecovery: () => void;
    generateAiResponse: (prompt: string) => Promise<string>;
    isPasswordModalOpen: boolean;
    handlePasswordSuccess: () => void;
    handlePasswordCancel: () => void;
    requestPassword: (onSuccess: () => void) => void;
    settings: AppSettings;
    saveSettings: (newSettings: AppSettings) => Promise<void>;
    /** 리그 라이브 전광판 시작 시 저장소에서 대회 룰(tournamentTargetScore, tournamentMaxSets)을 읽어옵니다. 키 없으면 21, 3 폴백 */
    getTournamentSettingsForLive: () => Promise<{ tournamentTargetScore: number; tournamentMaxSets: number }>;
    p2p: P2PState;
    setHostTournamentMode?: (value: boolean) => void;
    sendTicker?: (message: string) => void;
    sendReaction?: (emoji: string) => void;
    sendTimeoutViewer?: (active: boolean, timeLeft?: number) => void;
    sendEffect?: (effectType: 'SPIKE' | 'BLOCK') => void;
    isChatEnabled: boolean;
    setChatEnabled?: (value: boolean) => void;
    isChatWindowVisible: boolean;
    setChatWindowVisible?: (value: boolean) => void;
    receivedChatMessages: { id: number; text: string; sender: string; senderId?: string; senderColor?: string; isSystem?: boolean }[];
    sendChat?: (text: string) => void;
    removeChatMessage?: (messageId: number) => void;
    banViewer?: (peerId: string) => void;
    blockedViewerIds?: Set<string>;
    toggleBlockViewer?: (senderId: string) => void;
    receivedTickerMessage: string | null;
    clearTicker: () => void;
    receivedReactions: { id: number; emoji: string }[];
    addReceivedReaction: (emoji: string) => void;
    removeReceivedReaction: (id: number) => void;
    receivedEffects: { id: number; effectType: 'SPIKE' | 'BLOCK' }[];
    addReceivedEffect: (effectType: 'SPIKE' | 'BLOCK') => void;
    removeReceivedEffect: (id: number) => void;
    startHostSession: (initialState?: MatchState) => void;
    joinSession: (peerId: string, onSuccess: () => void) => void;
    closeSession: () => void;
    language: Language;
    setLanguage: (lang: Language) => void;
}