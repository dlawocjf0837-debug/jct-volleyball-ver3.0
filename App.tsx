
import React, { useState, useCallback, useEffect } from 'react';
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
import AttendanceScreen from './screens/AttendanceScreen';
import AchievementsScreen from './screens/AchievementsScreen';
import SkillDrillScreen from './screens/SkillDrillScreen';
import PlayerRecordsScreen from './screens/PlayerRecordsScreen';
import CheerSongScreen from './screens/CheerSongScreen';
import SettingsScreen from './screens/SettingsScreen';
import TournamentScreen from './screens/TournamentScreen';
import LeagueScreen from './screens/LeagueScreen';
import AnnouncerScreen from './screens/AnnouncerScreen';
import CameraDirectorScreen from './screens/CameraDirectorScreen';
import CompetitionScreen from './screens/CompetitionScreen';
import { Player, Screen, Stats, STAT_KEYS, MatchState, SavedTeamInfo } from './types';
import ConfirmationModal from './components/common/ConfirmationModal';
import PasswordModal from './components/common/PasswordModal';
import { useTranslation } from './hooks/useTranslation';

type TournamentInfo = {
    tournamentId: string;
    tournamentMatchId: string;
};

type LeagueInfo = {
    leagueId: string;
    leagueMatchId: string;
};


const AppContent = () => {
    const [view, setView] = useState<'menu' | 'teamBuilder' | 'matchSetup' | 'attendance' | 'scoreboard' | 'history' | 'referee' | 'teamManagement' | 'teamAnalysis' | 'achievements' | 'skillDrill' | 'playerRecords' | 'cheerSong' | 'settings' | 'tournament' | 'league' | 'announcer' | 'cameraDirector' | 'competition'>('menu');
    const [scoreboardMode, setScoreboardMode] = useState<'record' | 'referee'>('record');
    const { 
        toast, hideToast, isLoading, exportData, saveImportedData, startMatch, resetAllData, recoveryData, handleRestoreFromBackup, dismissRecovery,
        isPasswordModalOpen, handlePasswordSuccess, handlePasswordCancel, closeSession, p2p, requestPassword
    } = useData();
    const [teamsForAttendance, setTeamsForAttendance] = useState<{ teamA: string, teamB: string, teamAKey?: string, teamBKey?: string } | null>(null);
    const [preselectedMatchId, setPreselectedMatchId] = useState<string | null>(null);
    const [tournamentInfoForMatch, setTournamentInfoForMatch] = useState<TournamentInfo | null>(null);
    const [leagueInfoForMatch, setLeagueInfoForMatch] = useState<LeagueInfo | null>(null);
    const { t } = useTranslation();


    // --- State and Logic for Team Builder ---
    const [builderScreen, setBuilderScreen] = useState<Screen>(Screen.Input);
    const [players, setPlayers] = useState<Player[]>([]);
    const [currentClass, setCurrentClass] = useState<string>('all');
    
    const handleStartBuilding = useCallback((newPlayers: Omit<Player, 'id' | 'anonymousName' | 'isCaptain' | 'totalScore'>[], selectedClass: string) => {
        const statsRange: Record<keyof Stats, { min: number, max: number }> = STAT_KEYS.reduce((acc, key) => {
            acc[key] = { min: Infinity, max: -Infinity };
            return acc;
        }, {} as Record<keyof Stats, { min: number, max: number }>);

        newPlayers.forEach(p => {
            STAT_KEYS.forEach(key => {
                statsRange[key].min = Math.min(statsRange[key].min, p.stats[key]);
                statsRange[key].max = Math.max(statsRange[key].max, p.stats[key]);
            });
        });

        const playersWithScores = newPlayers.map(p => {
            let totalNormalizedScore = 0;
            const normalizedStats: Partial<Stats> = {};
            STAT_KEYS.forEach(key => {
                const { min, max } = statsRange[key];
                const value = p.stats[key];
                let normalizedValue = 0;

                if (key === 'fiftyMeterDash') {
                    if (value > 0) {
                        normalizedValue = (min / value) * 100;
                    } else {
                        normalizedValue = 0;
                    }
                } else {
                    if (max > 0) {
                        normalizedValue = (value / max) * 100;
                    } else {
                        normalizedValue = 0;
                    }
                }
                
                normalizedStats[key] = Math.max(0, Math.min(normalizedValue, 100));
                totalNormalizedScore += normalizedStats[key]!;
            });
            const totalScore = totalNormalizedScore / STAT_KEYS.length;
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

    const handleGoToAttendance = (teams: { teamA: string, teamB: string, teamAKey?: string, teamBKey?: string }, tournamentInfo?: TournamentInfo, leagueInfo?: LeagueInfo) => {
        setTeamsForAttendance(teams);
        setTournamentInfoForMatch(tournamentInfo || null);
        setLeagueInfoForMatch(leagueInfo || null);
        setView('attendance');
    };

    const handleStartMatchFromAttendance = (data: { 
        attendingPlayers: { teamA: Record<string, Player>, teamB: Record<string, Player> },
        onCourtIds: { teamA: Set<string>, teamB: Set<string> },
        teamAInfo: SavedTeamInfo | null,
        teamBInfo: SavedTeamInfo | null,
    }) => {
        if (!teamsForAttendance) return;
        const sessionData = {
            ...teamsForAttendance,
            teamAInfo: data.teamAInfo,
            teamBInfo: data.teamBInfo,
        };
        startMatch(sessionData, undefined, data.attendingPlayers, tournamentInfoForMatch || undefined, data.onCourtIds, leagueInfoForMatch || undefined);
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
                if (builderScreen === Screen.Input) {
                    return <PlayerInputScreen onStart={handleStartBuilding} />;
                } else {
                    return <TeamBuilderScreen initialPlayers={players} onReset={handleResetBuilder} selectedClass={currentClass} />;
                }
            case 'matchSetup':
                return <MatchSetupScreen onStartMatch={handleGoToAttendance} />;
            case 'attendance':
                if (!teamsForAttendance) {
                    setView('matchSetup');
                    return null;
                }
                return <AttendanceScreen teamSelection={teamsForAttendance} onStartMatch={handleStartMatchFromAttendance} />;
            case 'scoreboard':
                return <ScoreboardScreen onBackToMenu={navigateToMenu} mode={scoreboardMode} />;
            case 'history':
                return <RecordScreen onContinueGame={handleContinueGame} preselectedMatchId={preselectedMatchId} onClearPreselection={() => setPreselectedMatchId(null)} />;
            case 'playerRecords':
                return <PlayerRecordsScreen />;
            case 'referee':
                 return <RefereeScreen onStartMatch={handleStartRefereeMatch} />;
            case 'teamManagement':
                return <TeamManagementScreen />;
            case 'teamAnalysis':
                return <TeamAnalysisScreen />;
            case 'achievements':
                return <AchievementsScreen />;
            case 'skillDrill':
                return <SkillDrillScreen />;
            case 'cheerSong':
                return <CheerSongScreen />;
            case 'settings':
                return <SettingsScreen />;
            case 'competition':
                return <CompetitionScreen onSelectTournament={() => setView('tournament')} onSelectLeague={() => setView('league')} />;
            case 'tournament':
                return <TournamentScreen onStartMatch={handleStartTournamentMatch} />;
            case 'league':
                return <LeagueScreen onStartMatch={handleStartLeagueMatch} />;
            case 'announcer':
                return <AnnouncerScreen onNavigateToHistory={() => setView('history')} />;
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
                        onStartMatch={() => setView('matchSetup')}
                        onStartCompetition={() => setView('competition')}
                        onShowHistory={(matchId?: string) => {
                            if (matchId) {
                                setPreselectedMatchId(matchId);
                            }
                            setView('history');
                        }}
                        onShowPlayerRecords={() => setView('playerRecords')}
                        onShowAchievements={() => setView('achievements')}
                        onStartSkillDrill={() => setView('skillDrill')}
                        onStartTeamAnalysis={() => setView('teamAnalysis')}
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
            case 'achievements': return 'achievements_title';
            case 'skillDrill': return 'skill_drill_title';
            case 'referee': return 'referee_scoreboard_title';
            case 'teamManagement': return 'team_management_title';
            case 'teamAnalysis': return 'team_analysis_title';
            case 'cheerSong': return 'cheer_song_title';
            case 'settings': return 'settings_title';
            case 'competition': return 'competition_title';
            case 'tournament': return 'tournament_title';
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
            subtitle: t('app_subtitle')
        }
        : {
            title: t(getHeaderTitleKey())
        };

    return (
        <div className="min-h-screen font-sans p-4 sm:p-6 lg:p-8 flex flex-col">
            <Header
                {...headerProps}
                showBackButton={view !== 'menu'}
                onBack={navigateToMenu}
                showLanguageToggle={showLanguageToggle}
            />
            <main className="flex-grow flex flex-col">
                {renderView()}
            </main>
            <footer className="text-center mt-12 text-xs text-slate-500 no-print">
                <p>&copy; 2025 <span className="font-semibold text-[#00A3FF]">JCT Labs</span>. All Rights Reserved. | Ver 3.0</p>
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


const App = () => {
    return (
        <DataProvider>
            <AppContent />
        </DataProvider>
    );
};

export default App;
