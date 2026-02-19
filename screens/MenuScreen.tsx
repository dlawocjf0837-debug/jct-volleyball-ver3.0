import React, { useState, ReactNode, useMemo, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import ConfirmationModal from '../components/common/ConfirmationModal';
import { TeamSet, MatchState, TeamMatchState } from '../types';
import {
    UserGroupIcon,
    PlayIcon,
    BookmarkSquareIcon,
    IdentificationIcon,
    TrophyIcon,
    FireIcon,
    ChartBarIcon,
    UsersIcon,
    SparklesIcon,
    ArrowDownIcon,
    ArrowUpIcon,
    TrashIcon,
    Cog6ToothIcon,
    LinkIcon,
    RectangleGroupIcon,
    VideoCameraIcon,
} from '../components/icons';
import { useTranslation } from '../hooks/useTranslation';
import { isAdminPasswordCorrect } from '../utils/adminPassword';
import { LeagueStandingsDashboard } from '../components/LeagueStandingsDashboard';
import { TacticalBoardModal } from '../components/TacticalBoardModal';
import { AnalysisMemoModal } from '../components/AnalysisMemoModal';


interface MenuScreenProps {
    onStartTeamBuilder: () => void;
    onStartMatch: () => void;
    appMode?: 'CLASS' | 'CLUB';
    onStartLeagueLive?: (teamA: string, teamB: string) => void;
    onStartCompetition: () => void;
    onShowHistory: (matchId?: string) => void;
    onShowPlayerRecords: () => void;
    onShowAchievements: () => void;
    onStartSkillDrill: () => void;
    onStartTeamAnalysis: () => void;
    onStartTeamManagement: () => void;
    onStartCheerSongManagement: () => void;
    onExportData: () => void;
    onSaveImportedData: (data: { teamSets: TeamSet[], matchHistory: (MatchState & { date: string; time?: number })[], playerAchievements?: any }) => void;
    onResetAllData: () => void;
    onStartSettings: () => void;
    onStartAnnouncer: () => void;
    onStartCameraDirector: () => void;
}

const MenuCard: React.FC<{
    icon: ReactNode;
    title: string;
    description: string;
    onClick: () => void;
    disabled?: boolean;
}> = ({ icon, title, description, onClick, disabled }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className="group relative flex flex-col h-full text-left p-4 sm:p-6 bg-slate-800/30 backdrop-blur-lg border border-slate-700/50 rounded-2xl transition-all duration-300 hover:border-sky-500/80 hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50 disabled:transform-none disabled:cursor-not-allowed overflow-hidden min-h-[120px] sm:min-h-[140px]"
    >
        <div className="absolute inset-0 bg-sky-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        <div className="relative">
            <div className="mb-3 sm:mb-4 text-sky-400">
                {icon}
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-100">{title}</h3>
            <p className="mt-1 text-xs sm:text-sm text-slate-400">{description}</p>
        </div>
    </button>
);

const MenuScreen: React.FC<MenuScreenProps> = ({ 
    onStartTeamBuilder, 
    onStartMatch,
    appMode = 'CLASS',
    onStartLeagueLive,
    onStartCompetition,
    onShowHistory,
    onShowPlayerRecords,
    onShowAchievements,
    onStartSkillDrill,
    onStartTeamAnalysis,
    onStartTeamManagement,
    onStartCheerSongManagement,
    onExportData,
    onSaveImportedData,
    onResetAllData,
    onStartSettings,
    onStartAnnouncer,
    onStartCameraDirector,
}) => {
    const { showToast, matchHistory, p2p, joinSession, closeSession } = useData();
    const { t } = useTranslation();
    const [isResetModalOpen, setIsResetModalOpen] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [resetStep, setResetStep] = useState<'password' | 'finalConfirm'>('password');
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [dataToImport, setDataToImport] = useState<any>(null);
    const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
    const [joinId, setJoinId] = useState('');
    const [isJoining, setIsJoining] = useState(false);
    const [joinError, setJoinError] = useState('');
    const [showTacticalBoard, setShowTacticalBoard] = useState(false);
    const [showAnalysisMemo, setShowAnalysisMemo] = useState(false);

    useEffect(() => {
        if (isJoining) {
            if (p2p.status === 'error') {
                setJoinError(p2p.error || t('unknown_error'));
                setIsJoining(false);
            }
        }
    }, [p2p.status, p2p.error, isJoining, t]);

    const latestMatchInfo = useMemo(() => {
        const completedMatchesWithIndex = [...matchHistory]
            .map((match, index) => ({ ...match, originalIndex: index }))
            .filter(m => m.status === 'completed')
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        if (completedMatchesWithIndex.length === 0) {
            return null;
        }

        const latestMatch = completedMatchesWithIndex[0];
        const winnerName = latestMatch.winner === 'A' ? latestMatch.teamA.name : latestMatch.teamB.name;
        const matchId = `history-${latestMatch.originalIndex}`;

        let matchTypeLabel: string | null = null;
        if (latestMatch.leagueId) {
            matchTypeLabel = '[리그]';
        } else if (latestMatch.tournamentId) {
            matchTypeLabel = '[토너먼트]';
        }
        
        return {
            id: matchId,
            teamAName: latestMatch.teamA.name,
            teamBName: latestMatch.teamB.name,
            teamAScore: latestMatch.teamA.score,
            teamBScore: latestMatch.teamB.score,
            winnerName,
            matchTypeLabel,
        };
    }, [matchHistory]);

    const handleOpenResetModal = () => {
        setPasswordInput('');
        setPasswordError('');
        setResetStep('password');
        setIsResetModalOpen(true);
    };

    const handleResetConfirm = () => {
        if (resetStep === 'password') {
            if (isAdminPasswordCorrect(passwordInput)) {
                setResetStep('finalConfirm');
                setPasswordError('');
            } else {
                setPasswordError(t('password_incorrect'));
            }
        } else if (resetStep === 'finalConfirm') {
            onResetAllData();
            setIsResetModalOpen(false);
        }
    };

    const handleImportConfirm = () => {
        if (dataToImport) {
            onSaveImportedData(dataToImport);
        }
        setIsImportModalOpen(false);
        setDataToImport(null);
    };

    const handleImportDataClick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = (event) => {
            const file = (event.target as HTMLInputElement).files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const text = e.target?.result;
                        if (typeof text !== 'string') throw new Error(t('file_read_error'));
                        const importedData = JSON.parse(text);
                        
                        // Relaxed validation: Check if basic structures exist
                        const hasTeamSets = Array.isArray(importedData.teamSets);
                        const hasMatchHistory = Array.isArray(importedData.matchHistory);

                        if (hasTeamSets || hasMatchHistory) {
                            setDataToImport(importedData);
                            setIsImportModalOpen(true);
                        } else {
                            throw new Error(t('invalid_file_format'));
                        }
                    } catch (error: any) {
                        showToast(t('import_failed', { message: error.message }), 'error');
                        console.error("Import failed:", error);
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    };

    const handleJoinSession = () => {
        if (joinId.trim()) {
            setJoinError('');
            setIsJoining(true);
            joinSession(joinId.trim().toUpperCase(), () => {
                setIsJoining(false);
                setIsJoinModalOpen(false);
                onStartAnnouncer();
            });
        } else {
            showToast(t('toast_enter_join_code'), 'error');
        }
    };
    
    const isClub = appMode === 'CLUB';

    return (
        <>
            <div className={`max-w-6xl mx-auto flex flex-col items-center gap-6 sm:gap-10 animate-fade-in py-4 sm:py-10 w-full px-4 ${isClub ? 'rounded-2xl border border-amber-500/20 bg-slate-900/50' : ''}`}>
                {/* 단일 진입 버튼: 경기 시작 + 실시간 참여 */}
                <div className={`w-full max-w-4xl grid gap-4 sm:gap-4 ${isClub ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
                    <button
                        onClick={onStartMatch}
                        className={`w-full group relative flex items-center justify-center gap-3 sm:gap-3 px-4 sm:px-8 py-4 sm:py-5 overflow-hidden font-bold text-white transition-all duration-300 rounded-2xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 min-h-[44px] ${isClub ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/50 hover:shadow-amber-700/50' : 'bg-green-600 hover:bg-green-700 shadow-green-900/50 hover:shadow-green-700/50'}`}
                    >
                        <PlayIcon className="w-6 h-6 sm:w-8 sm:h-8"/>
                        <span className="relative text-base sm:text-xl lg:text-2xl">{isClub ? '🏐 연습 경기 시작' : t('menu_start_game')}</span>
                    </button>
                    <button
                        onClick={() => setIsJoinModalOpen(true)}
                        className="w-full group relative flex items-center justify-center gap-3 sm:gap-3 px-4 sm:px-8 py-4 sm:py-5 overflow-hidden font-bold text-white transition-all duration-300 bg-green-600 rounded-2xl shadow-lg shadow-green-900/50 hover:bg-green-700 hover:shadow-xl hover:shadow-green-700/50 transform hover:-translate-y-1 min-h-[44px]"
                    >
                        <LinkIcon className="w-6 h-6 sm:w-8 sm:h-8"/>
                        <span className="relative text-base sm:text-xl lg:text-2xl">{t('menu_join_session_realtime')}</span>
                    </button>
                </div>

                <div className="w-full max-w-4xl bg-slate-800/30 backdrop-blur-lg border border-slate-700/50 rounded-2xl p-4 sm:p-6">
                    <h2 className="text-lg sm:text-xl font-bold text-slate-300 mb-3 sm:mb-4">{t('menu_main_info')}</h2>
                    {latestMatchInfo ? (
                        <button
                            onClick={() => onShowHistory(latestMatchInfo.id)}
                            className="w-full text-left p-3 sm:p-4 bg-slate-800 rounded-lg transition-all duration-200 hover:bg-slate-700 hover:ring-2 ring-sky-500"
                        >
                            <p className="text-xs sm:text-sm text-sky-400 font-semibold mb-1">{t('menu_latest_match')}</p>
                            <p className="text-sm sm:text-base lg:text-lg text-slate-300 break-words flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span>
                                    {latestMatchInfo.teamAName} vs {latestMatchInfo.teamBName}
                                    <span className="font-bold text-sky-400 mx-1 sm:mx-2">
                                        ({latestMatchInfo.teamAScore}:{latestMatchInfo.teamBScore} {latestMatchInfo.winnerName} {t('menu_winner')})
                                    </span>
                                </span>
                                {latestMatchInfo.matchTypeLabel && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-600/20 text-sky-300 border border-sky-500/40">
                                        {latestMatchInfo.matchTypeLabel}
                                    </span>
                                )}
                            </p>
                        </button>
                    ) : (
                        <div className="w-full text-left p-3 sm:p-4 bg-slate-800 rounded-lg">
                            <p className="text-xs sm:text-sm text-sky-400 font-semibold mb-1">{t('menu_latest_match')}</p>
                            <p className="text-sm sm:text-base text-slate-400">{t('menu_no_matches')}</p>
                        </div>
                    )}
                </div>
                
                <div className="w-full max-w-6xl space-y-8 sm:space-y-12">
                    <div className="w-full">
                        <h2 className="text-xl sm:text-2xl font-bold text-slate-300 mb-4 sm:mb-5 px-1">{t('menu_category_prep')}</h2>
                        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
                            {!isClub && <MenuCard icon={<UserGroupIcon className="w-6 h-6 sm:w-8 sm:h-8" />} title={t('menu_team_builder_title')} description={t('menu_team_builder_desc')} onClick={onStartTeamBuilder} />}
                            {!isClub && <MenuCard icon={<RectangleGroupIcon className="w-6 h-6 sm:w-8 sm:h-8" />} title={t('competition_title')} description={t('menu_competition_desc')} onClick={onStartCompetition} />}
                            <MenuCard icon={<UsersIcon className="w-6 h-6 sm:w-8 sm:h-8" />} title={t('menu_team_management_title')} description={t('menu_team_management_desc')} onClick={onStartTeamManagement} />
                            <MenuCard icon={<span className="text-xl">📋</span>} title="전술판" description="자석과 펜으로 작전을 그리세요" onClick={() => setShowTacticalBoard(true)} />
                            {isClub && <MenuCard icon={<span className="text-xl">📊</span>} title="전력 분석 메모" description="상대 팀 전력 분석을 작성하고 공유하세요" onClick={() => setShowAnalysisMemo(true)} />}
                            <MenuCard icon={<FireIcon className="w-6 h-6 sm:w-8 sm:h-8" />} title={t('menu_skill_drill_title')} description={t('menu_skill_drill_desc')} onClick={onStartSkillDrill} />
                        </div>
                    </div>
                    <div className="w-full">
                        <h2 className="text-xl sm:text-2xl font-bold text-slate-300 mb-4 sm:mb-5 px-1">{t('menu_category_analysis')}</h2>
                        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
                            <MenuCard icon={<BookmarkSquareIcon className="w-6 h-6 sm:w-8 sm:h-8" />} title={t('menu_match_records_title')} description={t('menu_match_records_desc')} onClick={() => onShowHistory()} />
                            <MenuCard icon={<ChartBarIcon className="w-6 h-6 sm:w-8 sm:h-8" />} title={t('menu_team_analysis_title')} description={t('menu_team_analysis_desc')} onClick={onStartTeamAnalysis} />
                            <MenuCard icon={<IdentificationIcon className="w-6 h-6 sm:w-8 sm:h-8" />} title={t('menu_player_records_title')} description={t('menu_player_records_desc')} onClick={onShowPlayerRecords} />
                            {!isClub && <MenuCard icon={<TrophyIcon className="w-6 h-6 sm:w-8 sm:h-8" />} title={t('menu_achievements_title')} description={t('menu_achievements_desc')} onClick={onShowAchievements} />}
                        </div>
                    </div>
                     <div className="w-full">
                        <h2 className="text-xl sm:text-2xl font-bold text-slate-300 mb-4 sm:mb-5 px-1">{t('menu_category_app_management')}</h2>
                        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
                            {!isClub && <MenuCard icon={<SparklesIcon className="w-6 h-6 sm:w-8 sm:h-8" />} title={t('menu_cheer_song_title')} description={t('menu_cheer_song_desc')} onClick={onStartCheerSongManagement} />}
                            <MenuCard icon={<Cog6ToothIcon className="w-6 h-6 sm:w-8 sm:h-8" />} title={t('menu_settings_title')} description={t('menu_settings_desc')} onClick={onStartSettings} />
                            <MenuCard icon={<ArrowUpIcon className="w-6 h-6 sm:w-8 sm:h-8" />} title={t('menu_import_data_title')} description={t('menu_import_data_desc')} onClick={handleImportDataClick} />
                            <MenuCard icon={<ArrowDownIcon className="w-6 h-6 sm:w-8 sm:h-8" />} title={t('menu_export_data_title')} description={t('menu_export_data_desc')} onClick={onExportData} />
                        </div>
                    </div>
                </div>

                {isClub && <LeagueStandingsDashboard appMode="CLUB" onStartLeagueLive={onStartLeagueLive} />}

                <div className="w-full max-w-4xl pt-6 sm:pt-8 mt-4 border-t border-slate-700 text-center px-4">
                    <button
                        onClick={handleOpenResetModal}
                        className="inline-flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-red-800/50 text-red-300 border border-red-600/50 rounded-lg hover:bg-red-700/50 hover:text-red-200 transition-colors min-h-[44px] text-sm sm:text-base"
                    >
                        <TrashIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                        {t('menu_reset_data_title')}
                    </button>
                </div>

            </div>

            <TacticalBoardModal isOpen={showTacticalBoard} onClose={() => setShowTacticalBoard(false)} appMode={appMode} />
                <AnalysisMemoModal isOpen={showAnalysisMemo} onClose={() => setShowAnalysisMemo(false)} />

            <ConfirmationModal
                isOpen={isJoinModalOpen}
                onClose={() => {
                    if (isJoining) return;
                    setIsJoinModalOpen(false);
                    setJoinError('');
                    setIsJoining(false);
                    closeSession();
                }}
                onConfirm={handleJoinSession}
                title={t('menu_join_session_title')}
                message={isJoining ? t('menu_connecting') : t('menu_join_session_prompt')}
                confirmText={isJoining ? t('menu_connecting_button') : t('menu_join_session_button')}
                isConfirmDisabled={isJoining || !joinId.trim()}
                isCancelDisabled={isJoining}
            >
                {!isJoining && (
                    <div className="my-4">
                        <input
                            type="text"
                            value={joinId}
                            onChange={(e) => setJoinId(e.target.value)}
                            placeholder={t('menu_join_session_placeholder')}
                            className="w-full bg-slate-800 border border-slate-600 rounded-md p-3 text-center text-white text-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                            autoFocus
                        />
                        {joinError && <p className="text-red-500 text-sm mt-2 text-center">{joinError}</p>}
                    </div>
                )}
            </ConfirmationModal>

            <ConfirmationModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onConfirm={handleImportConfirm}
                title={t('import_confirm_title')}
                message={t('import_confirm_message')}
                confirmText={t('import_confirm_button')}
            />
            <ConfirmationModal
                isOpen={isResetModalOpen}
                onClose={() => setIsResetModalOpen(false)}
                onConfirm={handleResetConfirm}
                title={t('reset_confirm_title')}
                message={resetStep === 'password'
                    ? t('reset_confirm_message_password')
                    : t('reset_confirm_message_final')}
                confirmText={t('delete')}
            >
                {resetStep === 'password' && (
                    <div className="my-4">
                        <label htmlFor="password-confirm" className="block text-sm font-medium text-slate-400 mb-2">
                            {t('password')}
                        </label>
                        <input
                            id="password-confirm"
                            type="password"
                            value={passwordInput}
                            onChange={(e) => {
                                setPasswordInput(e.target.value);
                                if (passwordError) setPasswordError('');
                            }}
                            placeholder={t('password_placeholder')}
                            className="w-full bg-slate-800 border border-slate-600 rounded-md p-2 text-center text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                            autoComplete="off"
                            autoFocus
                        />
                        {passwordError && <p className="text-red-500 text-sm mt-2 text-center">{passwordError}</p>}
                    </div>
                )}
            </ConfirmationModal>
        </>
    );
};

export default MenuScreen;