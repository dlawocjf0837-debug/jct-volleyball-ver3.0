import React, { useState, useCallback, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { DataProvider, useData } from './contexts/DataContext';
import Header from './components/common/Header';
import Toast from './components/common/Toast';
import MenuScreen from './screens/MenuScreen';
import PlayerInputScreen from './screens/PlayerInputScreen';
import TeamBuilderScreen from './screens/TeamBuilderScreen';
import MatchSetupScreen from './screens/MatchSetupScreen';
import { ScoreboardScreen } from './screens/ScoreboardScreen';
import RecordScreen from './screens/RecordScreen';
import RefereeScreen from './screens/RefereeScreen';
import TeamManagementScreen from './screens/TeamManagementScreen';
import TeamAnalysisScreen from './screens/TeamAnalysisScreen';
import HeatmapAnalysisScreen from './screens/HeatmapAnalysisScreen';
import AttendanceScreen from './screens/AttendanceScreen';
import AchievementsScreen from './screens/AchievementsScreen';
import SkillDrillScreen from './screens/SkillDrillScreen';
import PlayerRecordsScreen from './screens/PlayerRecordsScreen';
import CheerSongScreen from './screens/CheerSongScreen';
import SettingsScreen from './screens/SettingsScreen';
import TournamentScreen from './screens/TournamentScreen';
import LeagueScreen from './screens/LeagueScreen';
import LeagueLobbyScreen from './screens/LeagueLobbyScreen';
import AnnouncerScreen from './screens/AnnouncerScreen';
import CameraDirectorScreen from './screens/CameraDirectorScreen';
import CompetitionScreen from './screens/CompetitionScreen';
import AdminLockScreen from './screens/AdminLockScreen';
import StudentJoinScreen from './screens/StudentJoinScreen';
import RoleRecordScreen from './screens/RoleRecordScreen';
import { AssessmentRankingScreen } from './screens/AssessmentRankingScreen';
import { Player, Screen, Stats, STAT_KEYS, MatchState, SavedTeamInfo, SavedOpponentTeam, MatchRoles } from './types';
import ConfirmationModal from './components/common/ConfirmationModal';
import PasswordModal from './components/common/PasswordModal';
import { useTranslation } from './hooks/useTranslation';
import { isAdminPasswordCorrect } from './utils/adminPassword';
import LockScreen, { UNLOCKED_MODE_KEY } from './components/LockScreen';

type TournamentInfo = {
    tournamentId: string;
    tournamentMatchId: string;
};

type LeagueInfo = {
    leagueId: string;
    leagueMatchId: string;
};


/** 라우트 가드: 인증 없으면 제자리 잠금 오버레이(LockScreen)만 표시. 리다이렉트 없음. /, /join 은 Public. */
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const location = useLocation();
    const [, setVersion] = useState(0); // 잠금 해제 시 강제 리렌더용

    const handleUnlock = useCallback(() => {
        // LockScreen 내부에서 sessionStorage.setItem('unlockedMode', ...) 를 수행하므로,
        // 여기서는 단순히 렌더를 다시 트리거만 하면 됨.
        setVersion(v => v + 1);
    }, []);

    const unlockedMode =
        typeof window !== 'undefined' ? sessionStorage.getItem(UNLOCKED_MODE_KEY) : null;
    const path = location.pathname || '';

    // 1. 권한이 아예 없으면 무조건 잠금 화면
    if (!unlockedMode) {
        return <LockScreen onUnlock={handleUnlock} />;
    }

    // 2. 마스터 권한은 묻지도 따지지도 않고 프리패스
    if (unlockedMode === 'master') {
        return <>{children}</>;
    }

    // 3. 수업 권한은 /class 로 시작하는 경로만 허용
    if (unlockedMode === 'class' && path.startsWith('/class')) {
        return <>{children}</>;
    }

    // 4. 클럽 권한은 /club 로 시작하는 경로만 허용
    if (unlockedMode === 'club' && path.startsWith('/club')) {
        return <>{children}</>;
    }

    // 5. 위 조건에 하나도 맞지 않으면 다시 잠금 화면
    return <LockScreen onUnlock={handleUnlock} />;
};

const getInitialPendingJoinCodeFromUrl = (): string | null => {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const liveCode = params.get('liveCode') ?? params.get('code');
    return liveCode ? liveCode.trim().toUpperCase() : null;
};

type ViewKey = 'menu' | 'teamBuilder' | 'matchSetup' | 'attendance' | 'scoreboard' | 'history' | 'referee' | 'teamManagement' | 'teamAnalysis' | 'heatmapAnalysis' | 'achievements' | 'skillDrill' | 'playerRecords' | 'cheerSong' | 'settings' | 'tournament' | 'leagueLobby' | 'league' | 'announcer' | 'cameraDirector' | 'competition' | 'roleRecord' | 'assessmentRanking';

const VIEW_TO_SEGMENT: Record<ViewKey, string> = {
    menu: '',
    teamBuilder: 'team-builder',
    matchSetup: 'match-setup',
    attendance: 'attendance',
    scoreboard: 'scoreboard',
    history: 'history',
    referee: 'referee',
    teamManagement: 'team-management',
    teamAnalysis: 'team-analysis',
    heatmapAnalysis: 'heatmap-analysis',
    achievements: 'achievements',
    skillDrill: 'skill-drill',
    playerRecords: 'player-records',
    cheerSong: 'cheer-song',
    settings: 'settings',
    tournament: 'tournament',
    leagueLobby: 'league-lobby',
    league: 'league',
    announcer: 'announcer',
    cameraDirector: 'camera-director',
    competition: 'competition',
    roleRecord: 'role-record',
    assessmentRanking: 'assessment-ranking',
};

const SEGMENT_TO_VIEW: Record<string, ViewKey> = Object.fromEntries(
    (Object.entries(VIEW_TO_SEGMENT) as [ViewKey, string][]).map(([k, v]) => [v || 'menu', k])
) as Record<string, ViewKey>;

function getViewFromPathname(pathname: string, base: 'class' | 'club'): ViewKey {
    const prefix = `/${base}`;
    if (!pathname.startsWith(prefix)) return 'menu';
    const rest = pathname.slice(prefix.length).replace(/^\//, '') || 'menu';
    return SEGMENT_TO_VIEW[rest] ?? 'menu';
}

function getPathFromView(view: ViewKey, base: 'class' | 'club'): string {
    const seg = VIEW_TO_SEGMENT[view];
    return seg ? `/${base}/${seg}` : `/${base}`;
}

/** 루트(/) 게이트: 로그인/모드 선택 후 /class 또는 /club으로 이동 */
const Gate = () => {
    const navigate = useNavigate();
    const pendingCode = getInitialPendingJoinCodeFromUrl();

    if (pendingCode) {
        return (
            <DataProvider appMode="CLASS">
                <StudentJoinScreen
                    onBackToLock={() => navigate('/', { replace: true })}
                    appMode="CLASS"
                    pendingJoinCode={pendingCode}
                    clearPendingJoinCode={() => window.history.replaceState({}, '', window.location.pathname || '/')}
                />
            </DataProvider>
        );
    }
    return (
        <AdminLockScreen
            onUnlock={(mode) => {
                navigate(mode === 'CLASS' ? '/class' : '/club');
            }}
            onRequestStudentJoin={() => navigate('/join')}
        />
    );
};

/** 학생 참여 화면 전용 라우트 (/join) */
const StudentJoinRoute = () => {
    const navigate = useNavigate();
    const pendingCode = getInitialPendingJoinCodeFromUrl();
    return (
        <DataProvider appMode="CLASS">
            <StudentJoinScreen
                onBackToLock={() => navigate('/', { replace: true })}
                appMode="CLASS"
                pendingJoinCode={pendingCode}
                clearPendingJoinCode={() => window.history.replaceState({}, '', window.location.pathname || '/')}
            />
        </DataProvider>
    );
};

const AppContent = ({ appMode, onReturnToInitialScreen }: { appMode: 'CLASS' | 'CLUB'; onReturnToInitialScreen?: () => void }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const base = appMode === 'CLASS' ? 'class' : 'club';
    const view = getViewFromPathname(location.pathname, base);

    const setView = useCallback((v: ViewKey) => {
        navigate(getPathFromView(v, base));
    }, [navigate, base]);

    const [scoreboardMode, setScoreboardMode] = useState<'record' | 'referee'>('record');
    const [entryMode, setEntryMode] = useState<'class' | 'club'>('class');
    const { 
        toast, hideToast, isLoading, exportData, saveImportedData, startMatch, resetAllData, recoveryData, handleRestoreFromBackup, dismissRecovery,
        isPasswordModalOpen, handlePasswordSuccess, handlePasswordCancel, closeSession, p2p, requestPassword, leagueStandingsList, getTournamentSettingsForLive
    } = useData();
    const [pendingJoinCode, setPendingJoinCode] = useState<string | null>(getInitialPendingJoinCodeFromUrl);
    const [teamsForAttendance, setTeamsForAttendance] = useState<{ teamA: string, teamB: string, teamAKey?: string, teamBKey?: string, teamBFromOpponent?: SavedOpponentTeam, matchRoles?: MatchRoles, isAssessmentMode?: boolean } | null>(null);
    const [preselectedMatchId, setPreselectedMatchId] = useState<string | null>(null);
    const [tournamentInfoForMatch, setTournamentInfoForMatch] = useState<TournamentInfo | null>(null);
    const [leagueInfoForMatch, setLeagueInfoForMatch] = useState<LeagueInfo | null>(null);
    const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
    const [isNextMatchPractice, setIsNextMatchPractice] = useState(false);
    const { t } = useTranslation();

    // 전역 화면 잠금 (앱 어디서든 잠금 버튼 노출, 잠금 시 전체 오버레이)
    const [isAppLocked, setIsAppLocked] = useState(false);
    const [lockUnlockPin, setLockUnlockPin] = useState('');
    const [lockUnlockError, setLockUnlockError] = useState('');
    const handleLockUnlock = (e: React.FormEvent) => {
        e.preventDefault();
        setLockUnlockError('');
        if (isAdminPasswordCorrect(lockUnlockPin)) {
            setLockUnlockPin('');
            setIsAppLocked(false);
        } else {
            setLockUnlockError('비밀번호가 일치하지 않습니다.');
            setLockUnlockPin('');
        }
    };

    // URL에 liveCode가 있으면 애너운서 화면으로 이동
    useEffect(() => {
        const code = getInitialPendingJoinCodeFromUrl();
        if (code && (location.pathname === `/${base}` || location.pathname === `/${base}/`)) {
            setView('announcer');
        }
    }, [base, location.pathname, setView]);

    // 클럽 모드에서는 팀 빌더 화면 진입 시 메뉴로 리다이렉트
    useEffect(() => {
        if (appMode === 'CLUB' && view === 'teamBuilder') setView('menu');
    }, [appMode, view, setView]);

    // 잠금 모드일 때 body 스크롤 비활성화
    useEffect(() => {
        if (typeof document === 'undefined') return;
        if (isAppLocked) {
            const prev = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => { document.body.style.overflow = prev; };
        }
        document.body.style.overflow = '';
    }, [isAppLocked]);

    // --- State and Logic for Team Builder ---
    const [builderScreen, setBuilderScreen] = useState<Screen>(Screen.Input);
    const [players, setPlayers] = useState<Player[]>([]);
    const [currentClass, setCurrentClass] = useState<string>('all');
    
    const handleStartBuilding = useCallback((newPlayers: Omit<Player, 'id' | 'anonymousName' | 'isCaptain' | 'totalScore'>[], selectedClass: string) => {
        // 각 종목별로 유효한 데이터(0보다 큰 값)만으로 min/max 계산
        const statsRange: Record<keyof Stats, { min: number, max: number }> = STAT_KEYS.reduce((acc, key) => {
            acc[key] = { min: Infinity, max: -Infinity };
            return acc;
        }, {} as Record<keyof Stats, { min: number, max: number }>);

        // 유효한 데이터만으로 범위 계산
        newPlayers.forEach(p => {
            STAT_KEYS.forEach(key => {
                const value = p.stats[key];
                // null이 아니고 0보다 큰 값만 고려
                if (value != null && value > 0) {
                    statsRange[key].min = Math.min(statsRange[key].min, value);
                    statsRange[key].max = Math.max(statsRange[key].max, value);
                }
            });
        });

        // Min-Max Normalization: 반 1등 = 100점, 반 꼴찌 = 30점
        const playersWithScores = newPlayers.map(p => {
            let totalNormalizedScore = 0;
            let validStatCount = 0;
            const normalizedStats: Partial<Stats> = {};
            
            STAT_KEYS.forEach(key => {
                const { min, max } = statsRange[key];
                const value = p.stats[key];
                
                // 기록이 없는 경우(null 또는 0)는 0점 부여
                if (value == null || value <= 0) {
                    normalizedStats[key] = 0;
                    return;
                }

                // 유효한 데이터가 없는 경우 0점
                if (min === Infinity || max === -Infinity || min === max) {
                    normalizedStats[key] = 0;
                    return;
                }

                let normalizedValue = 0;

                if (key === 'fiftyMeterDash') {
                    // 50m 달리기는 기록이 작을수록 점수가 높아야 함 (역방향)
                    // min(최고 기록) = 100점, max(최저 기록) = 30점
                    normalizedValue = 30 + ((max - value) / (max - min)) * 70;
                    } else {
                    // 일반 종목: max(최고 기록) = 100점, min(최저 기록) = 30점
                    normalizedValue = 30 + ((value - min) / (max - min)) * 70;
                }
                
                normalizedStats[key] = Math.max(0, Math.min(normalizedValue, 100));
                totalNormalizedScore += normalizedStats[key]!;
                validStatCount++;
            });
            
            // 유효한 통계가 있는 경우에만 평균 계산
            const totalScore = validStatCount > 0 ? totalNormalizedScore / validStatCount : 0;
            return { ...p, stats: normalizedStats as Stats, totalScore };
        });

        const finalPlayers: Player[] = playersWithScores
            .sort((a, b) => b.totalScore - a.totalScore)
            .map((p, index) => ({
                ...p,
                // Use a stable ID based on class and student number to ensure data accumulation across different sessions.
                id: `${p.class}-${p.studentNumber}`,
                anonymousName: `${t('player_anonymous_prefix')} ${index + 1}`,
                isCaptain: false,
            }));
        
        setPlayers(finalPlayers);
        setCurrentClass(selectedClass);
        setBuilderScreen(Screen.Builder);
    }, [t]);

    const handleResetBuilder = useCallback(() => {
        setPlayers([]);
        setBuilderScreen(Screen.Input);
        setView('menu');
    }, []);

    const handleGoToAttendance = (teams: { teamA: string, teamB: string, teamAKey?: string, teamBKey?: string, teamBFromOpponent?: SavedOpponentTeam, isAssessmentMode?: boolean }, tournamentInfo?: TournamentInfo, leagueInfo?: LeagueInfo) => {
        setTeamsForAttendance(teams);
        setTournamentInfoForMatch(tournamentInfo || null);
        setLeagueInfoForMatch(leagueInfo || null);
        setView('attendance');
    };

    const handleStartMatchFromAttendance = async (data: { 
        attendingPlayers: { teamA: Record<string, Player>, teamB: Record<string, Player> },
        onCourtIds: { teamA: Set<string>, teamB: Set<string> },
        onCourtOrder?: { teamA: string[], teamB: string[] },
        teamAInfo: SavedTeamInfo | null,
        teamBInfo: SavedTeamInfo | null,
        matchRoles?: MatchRoles;
    }) => {
        if (!teamsForAttendance) return;
        const sessionData = {
            ...teamsForAttendance,
            teamAInfo: data.teamAInfo,
            teamBInfo: data.teamBInfo,
        };
        const isLeague = !!leagueInfoForMatch;
        const t = isLeague ? await getTournamentSettingsForLive() : { tournamentMaxSets: 3, tournamentTargetScore: 21 };
        startMatch(sessionData, undefined, data.attendingPlayers, tournamentInfoForMatch || undefined, data.onCourtIds, leagueInfoForMatch || undefined, {
            onCourtOrder: data.onCourtOrder,
            isPracticeMatch: isNextMatchPractice,
            maxSets: isLeague ? t.tournamentMaxSets : (isNextMatchPractice ? 1 : (appMode === 'CLUB' ? 3 : undefined)),
            tournamentTargetScore: isLeague ? t.tournamentTargetScore : undefined,
            isLeagueMatch: isLeague,
            leagueStandingsId: leagueInfoForMatch?.leagueId ?? undefined,
            matchRoles: data.matchRoles ?? teamsForAttendance?.matchRoles,
            isAssessment: teamsForAttendance?.isAssessmentMode,
        });
        setIsNextMatchPractice(false);
        setScoreboardMode('record');
        setView('scoreboard');
    };
    
    const handleStartRefereeMatch = (teams: { teamA: string, teamB: string, teamAKey?: string, teamBKey?: string }) => {
        startMatch(teams);
        setScoreboardMode('referee');
        setView('scoreboard');
    };
    
    const handleContinueGame = (gameState: MatchState) => {
        startMatch(undefined, gameState);
        setScoreboardMode('record');
        setView('scoreboard');
    };

    const handleStartTournamentMatch = (data: { teamAKey: string, teamBKey: string, teamAName: string, teamBName: string, tournamentId: string, tournamentMatchId: string }) => {
        handleGoToAttendance(
            { teamA: data.teamAName, teamB: data.teamBName, teamAKey: data.teamAKey, teamBKey: data.teamBKey },
            { tournamentId: data.tournamentId, tournamentMatchId: data.tournamentMatchId }
        );
    };

    const handleStartLeagueMatch = (data: { teamAKey: string, teamBKey: string, teamAName: string, teamBName: string, leagueId: string, leagueMatchId: string }) => {
        handleGoToAttendance(
            { teamA: data.teamAName, teamB: data.teamBName, teamAKey: data.teamAKey, teamBKey: data.teamBKey },
            undefined,
            { leagueId: data.leagueId, leagueMatchId: data.leagueMatchId }
        );
    };
    
    const navigateToMenu = () => {
        setTeamsForAttendance(null);
        setPreselectedMatchId(null);
        setTournamentInfoForMatch(null);
        setLeagueInfoForMatch(null);
        setSelectedLeagueId(null);
        closeSession();
        setView('menu');
    }

    const renderView = () => {
        if (isLoading && !p2p.isConnected) {
            return (
                <div className="flex-grow flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-[#00A3FF]"></div>
                        <p className="mt-4 text-lg">{t('loading_data')}</p>
                    </div>
                </div>
            );
        }

        switch (view) {
            case 'teamBuilder':
                if (appMode === 'CLUB') return null;
                if (builderScreen === Screen.Input) {
                    return <PlayerInputScreen onStart={handleStartBuilding} />;
                } else {
                    return <TeamBuilderScreen initialPlayers={players} onReset={handleResetBuilder} selectedClass={currentClass} />;
                }
            case 'matchSetup':
                return <MatchSetupScreen appMode={appMode} onStartMatch={handleGoToAttendance} />;
            case 'attendance':
                if (!teamsForAttendance) {
                    setView('matchSetup');
                    return null;
                }
                return <AttendanceScreen appMode={appMode} teamSelection={teamsForAttendance} onStartMatch={handleStartMatchFromAttendance} />;
            case 'scoreboard':
                return <ScoreboardScreen onBackToMenu={navigateToMenu} mode={scoreboardMode} entryMode={entryMode} />;
            case 'history':
                return <RecordScreen appMode={appMode} onContinueGame={handleContinueGame} preselectedMatchId={preselectedMatchId} onClearPreselection={() => setPreselectedMatchId(null)} />;
            case 'playerRecords':
                return <PlayerRecordsScreen appMode={appMode} />;
            case 'roleRecord':
                return <RoleRecordScreen onBack={() => setView('menu')} />;
            case 'assessmentRanking':
                return <AssessmentRankingScreen onBack={() => setView('menu')} />;
            case 'referee':
                 return <RefereeScreen onStartMatch={handleStartRefereeMatch} />;
            case 'teamManagement':
                return <TeamManagementScreen appMode={appMode} />;
            case 'teamAnalysis':
                return <TeamAnalysisScreen appMode={appMode} />;
            case 'heatmapAnalysis':
                return <HeatmapAnalysisScreen appMode={appMode} onBack={() => setView('menu')} />;
            case 'achievements':
                return <AchievementsScreen />;
            case 'skillDrill':
                return <SkillDrillScreen />;
            case 'cheerSong':
                return <CheerSongScreen />;
            case 'settings':
                return <SettingsScreen appMode={appMode} />;
            case 'competition':
                return (
                    <CompetitionScreen
                        onSelectTournament={() => setView('tournament')}
                        onSelectLeague={() => setView('leagueLobby')}
                    />
                );
            case 'tournament':
                return <TournamentScreen onStartMatch={handleStartTournamentMatch} onOpenMatchAnalysis={(matchId) => { setPreselectedMatchId(matchId); setView('history'); }} />;
            case 'league':
                return <LeagueScreen onStartMatch={handleStartLeagueMatch} selectedLeagueId={selectedLeagueId} onOpenMatchAnalysis={(matchId) => { setPreselectedMatchId(matchId); setView('history'); }} />;
            case 'leagueLobby':
                return (
                    <LeagueLobbyScreen
                        onCreateNewLeague={() => {
                            setSelectedLeagueId(null);
                            setView('league');
                        }}
                        onSelectLeague={(leagueId) => {
                            setSelectedLeagueId(leagueId);
                            setView('league');
                        }}
                    />
                );
            case 'announcer':
                return (
                    <AnnouncerScreen
                        onNavigateToHistory={() => setView('history')}
                        pendingJoinCode={pendingJoinCode}
                        clearPendingJoinCode={() => setPendingJoinCode(null)}
                        appMode={appMode}
                    />
                );
            case 'cameraDirector':
                return <CameraDirectorScreen />;
            case 'menu':
            default:
                return (
                    <MenuScreen
                        onStartTeamBuilder={() => {
                            setBuilderScreen(Screen.Input);
                            setPlayers([]);
                            setView('teamBuilder');
                        }}
                        onStartMatch={() => {
                            const mode = appMode === 'CLASS' ? 'class' : 'club';
                            if (appMode === 'CLUB') setIsNextMatchPractice(true);
                            setEntryMode(mode);
                            if (typeof window !== 'undefined') {
                                const params = new URLSearchParams(window.location.search);
                                params.set('mode', mode);
                                window.history.replaceState(null, '', `${window.location.pathname || '/'}?${params.toString()}`);
                            }
                            setView('matchSetup');
                        }}
                        onStartLeagueLive={(teamA, teamB, standingsId) => {
                            const sid = standingsId ?? leagueStandingsList?.selectedId ?? undefined;
                            const teamAKey = sid ? `${sid}___${teamA}` : undefined;
                            const teamBKey = sid ? `${sid}___${teamB}` : undefined;
                            setTeamsForAttendance({ teamA, teamB, teamAKey, teamBKey });
                            setLeagueInfoForMatch(sid ? { leagueId: sid, leagueMatchId: `live-${Date.now()}` } : null);
                            setIsNextMatchPractice(false);
                            setScoreboardMode('record');
                            setEntryMode('club');
                            setView('attendance');
                        }}
                        appMode={appMode}
                        onStartCompetition={() => setView('competition')}
                        onShowHistory={(matchId?: string) => {
                            if (matchId) {
                                setPreselectedMatchId(matchId);
                            }
                            setView('history');
                        }}
                        onShowPlayerRecords={() => setView('playerRecords')}
                        onShowRoleRecord={() => setView('roleRecord')}
                        onShowAssessmentRanking={() => setView('assessmentRanking')}
                        onShowAchievements={() => setView('achievements')}
                        onStartSkillDrill={() => setView('skillDrill')}
                        onStartTeamAnalysis={() => setView('teamAnalysis')}
                        onStartHeatmapAnalysis={() => setView('heatmapAnalysis')}
                        onStartTeamManagement={() => setView('teamManagement')}
                        onExportData={exportData}
                        onStartCheerSongManagement={() => setView('cheerSong')}
                        onStartSettings={() => {
                            requestPassword(() => setView('settings'));
                        }}
                        onSaveImportedData={saveImportedData}
                        onResetAllData={resetAllData}
                        onStartAnnouncer={() => setView('announcer')}
                        onStartCameraDirector={() => setView('cameraDirector')}
                    />
                );
        }
    };

    const getHeaderTitleKey = () => {
        switch (view) {
            case 'teamBuilder': return 'team_builder_title';
            case 'matchSetup': return 'match_setup_title';
            case 'attendance': return 'attendance_title';
            case 'scoreboard': return 'scoreboard_title';
            case 'history': return 'match_history_title';
            case 'playerRecords': return 'player_records_title';
            case 'roleRecord': return 'role_record_title';
            case 'achievements': return 'achievements_title';
            case 'skillDrill': return 'skill_drill_title';
            case 'referee': return 'referee_scoreboard_title';
            case 'teamManagement': return 'team_management_title';
            case 'teamAnalysis': return 'team_analysis_title';
            case 'heatmapAnalysis': return 'heatmap_analysis_title';
            case 'cheerSong': return 'cheer_song_title';
            case 'settings': return 'settings_title';
            case 'competition': return 'competition_title';
            case 'tournament': return 'tournament_title';
            case 'leagueLobby': return 'league_title';
            case 'league': return 'league_title';
            case 'announcer': return 'announcer_title';
            case 'cameraDirector': return 'camera_director_title';
            default: return 'app_title_volleyball';
        }
    }

    const showLanguageToggle = !['teamBuilder', 'matchSetup', 'scoreboard', 'referee'].includes(view);

    // Special logic for Main Menu branding
    const headerProps = view === 'menu'
        ? {
            brand: "J-ive",
            title: t('app_title_volleyball'),
            subtitle: t('app_subtitle'),
            showUpdateNotesIcon: true,
            appMode,
            showModeToggle: false
        }
        : {
            title: t(getHeaderTitleKey())
        };

    return (
        <div className={`min-h-screen font-sans p-4 sm:p-6 lg:p-8 flex flex-col ${appMode === 'CLUB' ? 'bg-gradient-to-b from-slate-950 via-amber-950/12 to-slate-950' : ''}`}>
            {/* 전역 화면 잠금 오버레이 - 잠금 해제 전까지 전체 화면 차단 */}
            {isAppLocked && (
                <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-6 no-print" role="dialog" aria-modal="true" aria-labelledby="app-lock-title">
                    <div className="flex flex-col items-center justify-center max-w-sm w-full">
                        <span className="text-6xl mb-4" aria-hidden>🔒</span>
                        <h2 id="app-lock-title" className="text-xl sm:text-2xl font-bold text-white mb-1 tracking-tight">
                            J-IVE 시스템 잠금 중
                        </h2>
                        <p className="text-slate-400 text-sm mb-6">관리자 비밀번호를 입력하여 해제하세요.</p>
                        <form onSubmit={handleLockUnlock} className="w-full space-y-4">
                            <input
                                type="password"
                                inputMode="numeric"
                                autoComplete="off"
                                placeholder="비밀번호 4자리"
                                value={lockUnlockPin}
                                onChange={(e) => setLockUnlockPin(e.target.value.replace(/\D/g, '').slice(0, 20))}
                                className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-white text-center text-lg tracking-[0.4em] placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00A3FF] focus:border-transparent"
                                aria-label="잠금 해제 비밀번호"
                                autoFocus
                            />
                            {lockUnlockError && (
                                <p className="text-red-400 text-sm text-center" role="alert">
                                    {lockUnlockError}
                                </p>
                            )}
                            <button
                                type="submit"
                                className="w-full py-3 rounded-xl bg-[#00A3FF] hover:bg-[#0090e0] text-white font-bold text-lg transition-colors"
                            >
                                해제
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <Header
                {...headerProps}
                showBackButton={view !== 'menu'}
                onBack={navigateToMenu}
                showLanguageToggle={showLanguageToggle}
                showUpdateNotesIcon={view === 'menu'}
                onLockClick={() => setIsAppLocked(true)}
            />
            <main className="flex-grow flex flex-col">
                {renderView()}
            </main>
            <footer className="border-t border-gray-200 pt-4 mt-12 flex flex-col items-center gap-4 no-print">
                <a
                    href="https://luck-bike-94e.notion.site/JCT-Ver-3-0-2e1033dce3ee80e7a175c85af33c333a"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full hover:bg-blue-500/20 hover:border-blue-500/30 transition-colors text-sm"
                >
                    📖 사용 설명서 (매뉴얼) 보기
                </a>
                <div className="text-center text-[10px] text-gray-600">
                    <p>© 2025. Jaecheol Im. All rights reserved.</p>
                    <p className="mt-1">본 프로그램은 비상업적 교육 목적으로만 사용 가능합니다.</p>
                </div>
            </footer>
            {toast.message && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
            <ConfirmationModal
                isOpen={!!recoveryData}
                onClose={dismissRecovery}
                onConfirm={handleRestoreFromBackup}
                title={t('data_recovery_title')}
                message={t('data_recovery_message')}
                confirmText={t('data_recovery_confirm')}
            />
            <PasswordModal
                isOpen={isPasswordModalOpen}
                onSuccess={handlePasswordSuccess}
                onClose={handlePasswordCancel}
            />
        </div>
    );
};


/** 모드별 레이아웃: 초기 화면으로 = 세션 해제 후 navigate('/') */
const ModeLayout = ({ appMode }: { appMode: 'CLASS' | 'CLUB' }) => {
    const navigate = useNavigate();
    const handleReturnToInitial = useCallback(() => {
        if (typeof window !== 'undefined') sessionStorage.removeItem(UNLOCKED_MODE_KEY);
        navigate('/', { replace: true });
    }, [navigate]);
    return <AppContent appMode={appMode} onReturnToInitialScreen={handleReturnToInitial} />;
};

const App = () => {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Gate />} />
                <Route path="/join" element={<StudentJoinRoute />} />
                <Route path="/class/*" element={<ProtectedRoute><DataProvider appMode="CLASS"><ModeLayout appMode="CLASS" /></DataProvider></ProtectedRoute>} />
                <Route path="/club/*" element={<ProtectedRoute><DataProvider appMode="CLUB"><ModeLayout appMode="CLUB" /></DataProvider></ProtectedRoute>} />
            </Routes>
        </BrowserRouter>
    );
};

export default App;
