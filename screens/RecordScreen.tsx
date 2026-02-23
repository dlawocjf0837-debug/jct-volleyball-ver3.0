import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { MatchState, SavedTeamInfo, TeamMatchState, PlayerStats, Player, TeamSet, EnrichedMatch, MvpResult, AppSettings, ScoreEvent, ScoreEventType } from '../types';
import { useData } from '../contexts/DataContext';
import { CrownIcon, TrophyIcon, FireIcon, SparklesIcon, MedalIcon, PhotoIcon, TargetIcon, WallIcon, ShieldIcon, BoltIcon, HandshakeIcon, LinkIcon, StopwatchIcon, VolleyballIcon } from '../components/icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
// Fix: Changed import to be a named import as PlayerHistoryModal is not a default export.
import { PlayerHistoryModal } from '../components/PlayerHistoryModal';
import TeamEmblem from '../components/TeamEmblem';
import { generateMatchResultImage } from '../utils/canvasUtils';
import { useTranslation } from '../hooks/useTranslation';

interface RecordScreenProps {
    appMode?: 'CLASS' | 'CLUB';
    onContinueGame: (state: MatchState) => void;
    preselectedMatchId?: string | null;
    onClearPreselection?: () => void;
}

// --- New Types for In-depth Analysis ---
type TimelineEvent = {
    type: ScoreEventType | 'LOG';
    team: 'A' | 'B' | null;
    description: string;
    score: string;
};

type MatchLeaders = {
    points: { player: Player; value: number }[];
    serviceAces: { player: Player; value: number }[];
    blockingPoints: { player: Player; value: number }[];
};


interface FlattenedTeam extends SavedTeamInfo {
    className: string;
    captain: string;
    players: string[];
}

const getTotalScoreWinner = (match: MatchState, settings: AppSettings): 'A' | 'B' | 'TIE' | null => {
    if (match.status !== 'completed') return null;
    
    const finalScoreA = settings.includeBonusPointsInWinner
        ? (match.teamA.score || 0) + (match.teamA.fairPlay || 0) + (match.teamA.threeHitPlays || 0)
        : (match.teamA.score || 0);
    const finalScoreB = settings.includeBonusPointsInWinner
        ? (match.teamB.score || 0) + (match.teamB.fairPlay || 0) + (match.teamB.threeHitPlays || 0)
        : (match.teamB.score || 0);

    if (finalScoreA > finalScoreB) return 'A';
    if (finalScoreB > finalScoreA) return 'B';
    return 'TIE';
}

const PlayerStatsTable: React.FC<{ 
    teamMatchState: TeamMatchState; 
    onPlayerClick: (player: Player, teamKey?: string) => void;
    teamSet: TeamSet | undefined;
    t: (key: string) => string;
}> = ({ teamMatchState, onPlayerClick, teamSet, t }) => {
    const { players: participatingPlayers, playerStats } = teamMatchState;

    const fullRoster = useMemo(() => {
        const teamInfo = teamSet?.teams.find(t => t.teamName === teamMatchState.name);
        if (!teamSet || !teamInfo) {
            // Fallback for manually created teams or old data without a proper link
            return Object.values(participatingPlayers || {});
        }
        return teamInfo.playerIds.map(id => teamSet.players[id]).filter(Boolean);
    }, [teamSet, teamMatchState.name, participatingPlayers]);

    if (fullRoster.length === 0) {
        return (
            <div className="bg-slate-900/50 p-8 rounded-2xl border border-slate-700 flex flex-col items-center justify-center text-center print-bg-white">
                <TeamEmblem emblem={teamMatchState.emblem} color={teamMatchState.color} className="w-16 h-16 mb-4 opacity-50" />
                <h4 className="font-bold text-xl text-slate-400 mb-2">{teamMatchState.name}</h4>
                <p className="text-slate-500">{t('record_no_player_stats')}</p>
            </div>
        );
    }

    const statOrder: (keyof PlayerStats)[] = ['points', 'serviceAces', 'serveIn', 'spikeSuccesses', 'blockingPoints', 'digs', 'assists', 'serviceFaults'];
    const statHeaderNames: Record<keyof PlayerStats, string> = {
        points: t('record_player_stats_header_points'),
        serviceAces: t('record_player_stats_header_serve'),
        serveIn: t('btn_serve_in'),
        spikeSuccesses: t('record_player_stats_header_spike'),
        blockingPoints: t('record_player_stats_header_blocking'),
        digs: t('stat_display_digs'),
        assists: t('stat_display_assists'),
        serviceFaults: t('record_player_stats_header_faults'),
    };
    
    return (
        <div className="flex flex-col rounded-2xl overflow-hidden border border-slate-700 shadow-xl bg-slate-900/60 backdrop-blur-md print-bg-white print-border-black">
            {/* Header Section */}
            <div className="relative p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700 overflow-hidden group">
                <div className="absolute top-0 left-0 w-1.5 h-full transition-all duration-500 group-hover:w-2" style={{ backgroundColor: teamMatchState.color }}></div>
                <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                <div className="flex items-center gap-5 relative z-10">
                    <div className="relative">
                        <div className="absolute inset-0 bg-white/10 rounded-full blur-md opacity-0 group-hover:opacity-50 transition-opacity duration-500"></div>
                        <TeamEmblem emblem={teamMatchState.emblem} color={teamMatchState.color} className="w-16 h-16 relative shadow-lg rounded-full" />
                    </div>
                    <div>
                        <h4 className="font-black text-2xl text-white tracking-tight uppercase" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>{teamMatchState.name}</h4>
                        {teamMatchState.slogan && <p className="text-sm font-medium mt-1 opacity-80" style={{ color: teamMatchState.color }}>"{teamMatchState.slogan}"</p>}
                    </div>
                </div>
            </div>

            {/* Table Section */}
            <div className="overflow-x-auto -mx-2 sm:mx-0 px-2 sm:px-0">
                <table className="w-full text-center min-w-[600px]">
                    <thead>
                        <tr className="bg-slate-950/80 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-700/50 print-text-black">
                            {/* Adjusted padding and width to reduce spacing */}
                            <th className="px-2 sm:px-3 py-2 sm:py-3 text-left whitespace-nowrap sticky left-0 z-10 bg-slate-950/90 backdrop-blur-sm shadow-[1px_0_0_0_rgba(51,65,85,0.5)]">
                                {t('record_player_stats_header_player')}
                            </th>
                            {statOrder.map(key => (
                                <th key={key} className="px-1 sm:px-2 py-2 sm:py-3 whitespace-nowrap hover:text-white transition-colors cursor-default text-xs sm:text-xs">
                                    {statHeaderNames[key]}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/30">
                        {fullRoster.map((player, idx) => {
                            const didParticipate = participatingPlayers && player.id in participatingPlayers;
                            const stats = didParticipate ? playerStats?.[player.id] : null;
                            const isEven = idx % 2 === 0;

                            return (
                             <tr 
                                key={player.id} 
                                className={`group transition-all duration-200 hover:bg-white/5 ${isEven ? 'bg-slate-800/10' : 'bg-transparent'}`}
                             >
                                <td className="px-2 sm:px-3 py-2 sm:py-3 text-left sticky left-0 z-10 bg-slate-900/90 backdrop-blur-sm group-hover:bg-slate-800/90 transition-colors shadow-[1px_0_0_0_rgba(51,65,85,0.5)]">
                                    <div className="flex items-center gap-2">
                                        {/* Hover Indicator */}
                                        <div className="w-1 h-0 group-hover:h-6 rounded-full transition-all duration-300 opacity-0 group-hover:opacity-100 absolute left-0 top-1/2 -translate-y-1/2" style={{ backgroundColor: teamMatchState.color }}></div>
                                        
                                        <button 
                                            onClick={() => onPlayerClick(player, teamMatchState.key)} 
                                            className="text-left group/btn min-h-[44px] flex items-center"
                                            aria-label={`${player.originalName} 상세 기록 보기`}
                                        >
                                            <span className="block text-sm sm:text-base lg:text-lg font-bold text-slate-200 group-hover/btn:text-white group-hover/btn:underline decoration-2 underline-offset-4 transition-all print-text-black truncate max-w-[120px] sm:max-w-[150px] lg:max-w-none">
                                                {player.originalName || '알 수 없음'}
                                            </span>
                                        </button>
                                    </div>
                                    <span className="hidden print:inline font-bold text-lg">{player.originalName || '알 수 없음'}</span>
                                </td>
                                {didParticipate && stats ? (
                                    statOrder.map(key => {
                                        const val = stats[key] || 0;
                                        const isZero = val === 0;
                                        return (
                                            <td key={key} className={`px-1 sm:px-2 py-2 sm:py-3 text-sm sm:text-base lg:text-lg font-mono ${isZero ? 'text-slate-600 font-normal' : 'text-white font-bold'} print-text-black`}>
                                                {val}
                                            </td>
                                        );
                                    })
                                ) : (
                                    <td colSpan={statOrder.length} className="px-2 py-2 sm:py-3 text-center text-xs sm:text-sm text-slate-600 font-medium italic print-text-black">
                                        {t('record_player_did_not_participate')}
                                    </td>
                                )}
                            </tr>
                        )})}
                    </tbody>
                </table>
            </div>
        </div>
    )
};


const RankingsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    rankings: { rank: number | string; teamName: string; totalPoints: number }[];
}> = ({ isOpen, onClose, rankings }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-slate-900 rounded-lg shadow-2xl p-6 w-full max-w-md text-white border border-[#00A3FF]" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-[#00A3FF]">팀 순위</h2>
                    <button onClick={onClose} className="text-2xl font-bold text-slate-500 hover:text-white">&times;</button>
                </div>
                {rankings.length > 0 ? (
                    <ul className="space-y-3">
                        {rankings.map((team, index) => (
                            <li key={index} className="flex items-center justify-between bg-slate-800 p-3 rounded-lg text-lg transition-transform hover:scale-110">
                                <span className="font-bold w-16 text-yellow-300">{team.rank}위</span>
                                <span className="flex-grow font-semibold">{team.teamName}</span>
                                <span className="font-mono text-[#00A3FF]">{team.totalPoints}점</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-slate-400 text-center py-4">계산된 순위가 없습니다. 먼저 '승점 확인'을 눌러주세요.</p>
                )}
            </div>
        </div>
    );
};

const ScoreTrendChart: React.FC<{ match: EnrichedMatch, t: (key: string) => string }> = ({ match, t }) => {
    const chartData = useMemo(() => {
        if (!match.scoreHistory) return [];
        return match.scoreHistory.map((score, index) => ({
            point: index,
            [match.teamA.name]: score.a,
            [match.teamB.name]: score.b,
        }));
    }, [match.scoreHistory, match.teamA.name, match.teamB.name]);

    return (
        <div className="bg-slate-800/50 p-4 rounded-lg h-80 print-bg-white">
             <h4 className="text-lg font-bold text-center text-slate-300 mb-2 print-text-black">{t('score_trend')}</h4>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="point" label={{ value: '진행', position: 'insideBottom', offset: -10 }} stroke="#94a3b8" tick={{ fill: '#94a3b8' }} />
                    <YAxis allowDecimals={false} stroke="#94a3b8" tick={{ fill: '#94a3b8' }}/>
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                    <Legend verticalAlign="top" />
                    <Line type="monotone" dataKey={match.teamA.name} stroke={match.teamA.color || "#38bdf8"} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey={match.teamB.name} stroke={match.teamB.color || "#f87171"} strokeWidth={2} dot={false} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

const RecordScreen: React.FC<RecordScreenProps> = ({ appMode = 'CLASS', onContinueGame, preselectedMatchId, onClearPreselection }) => {
    const { teamSets, matchHistory, practiceMatchHistory, leagueMatchHistory, matchState, matchTime, saveMatchHistory, savePracticeMatchHistory, saveLeagueMatchHistory, clearInProgressMatch, showToast, userEmblems, settings, language, leagueStandingsList, saveLeagueStandingsList, playerCumulativeStats } = useData();
    const { t } = useTranslation();
    const [selectedMatch, setSelectedMatch] = useState<EnrichedMatch | null>(null);
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [teamCountFilter, setTeamCountFilter] = useState('all');
    const [pointsData, setPointsData] = useState<Record<string, { teamA: number; teamB: number }>>({});
    const [rankings, setRankings] = useState<{ rank: number | string; teamName: string; totalPoints: number }[]>([]);
    const [matchHistoryTab, setMatchHistoryTab] = useState<'practice' | 'tournament'>('practice');
    const [selectedCompetition, setSelectedCompetition] = useState<string>('');
    const [setDetailTab, setSetDetailTab] = useState<0 | 1 | 2 | 'all'>('all');
    const [showRankingsModal, setShowRankingsModal] = useState(false);
    const [showScoreTrend, setShowScoreTrend] = useState(false);
    const [playerHistoryData, setPlayerHistoryData] = useState<{
        player: Player;
        cumulativeStats: any;
        performanceHistory: any[];
    } | null>(null);
    const [mvp, setMvp] = useState<MvpResult>(null);
    const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
    const [matchLeaders, setMatchLeaders] = useState<MatchLeaders | null>(null);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);


    // --- New Analysis Components ---
    const MvpCard: React.FC<{ mvp: MvpResult }> = ({ mvp }) => {
        if (!mvp) {
            return (
                <div className="bg-slate-800/50 p-4 rounded-lg text-center text-slate-500 h-full flex items-center justify-center print-bg-white print-text-black">
                    {t('record_mvp_no_data')}
                </div>
            );
        }

        const { player, team, stats, mvpScore, scoreBreakdown } = mvp;

        return (
            <div className="bg-gradient-to-br from-yellow-800/30 via-slate-900/50 to-slate-900/50 p-6 rounded-lg border-2 border-yellow-400/80 shadow-2xl shadow-yellow-500/10 flex flex-col items-center justify-center text-center print-bg-white">
                
                <div className="flex items-center gap-3">
                    <CrownIcon className="w-8 h-8 text-yellow-300" />
                    <h3 className="text-2xl font-bold text-yellow-300 tracking-widest print-text-black">{t('record_mvp_title')}</h3>
                </div>
                
                <p className="text-5xl font-black text-white my-4 drop-shadow-lg print-text-black">{player.originalName}</p>
                <div className="flex items-center gap-2 text-base font-semibold text-slate-300 bg-slate-700/50 px-4 py-1 rounded-full mb-6 print-bg-white">
                    <TeamEmblem emblem={team.emblem} color={team.color} className="w-5 h-5" />
                    <span className="text-white print-text-black">{team.name}</span>
                </div>

                <div className="w-full max-w-sm grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-800 p-2 rounded-lg print-bg-white">
                        <p className="text-sm font-bold text-slate-400 print-text-black">{t('record_mvp_total_points')}</p>
                        <p className="text-3xl font-black text-sky-300 print-text-black">{stats.points}</p>
                    </div>
                    <div className="bg-slate-800 p-2 rounded-lg print-bg-white">
                        <p className="text-sm font-bold text-slate-400 print-text-black">{t('record_mvp_serve_ace')}</p>
                        <p className="text-3xl font-black text-sky-300 print-text-black">{stats.serviceAces}</p>
                    </div>
                    <div className="bg-slate-800 p-2 rounded-lg print-bg-white">
                        <p className="text-sm font-bold text-slate-400 print-text-black">{t('record_mvp_spike')}</p>
                        <p className="text-3xl font-black text-sky-300 print-text-black">{stats.spikeSuccesses}</p>
                    </div>
                    <div className="bg-slate-800 p-2 rounded-lg print-bg-white">
                        <p className="text-sm font-bold text-slate-400 print-text-black">{t('record_mvp_blocking')}</p>
                        <p className="text-3xl font-black text-sky-300 print-text-black">{stats.blockingPoints}</p>
                    </div>
                    <div className="bg-slate-800 p-2 rounded-lg print-bg-white">
                        <p className="text-sm font-bold text-slate-400 print-text-black">{t('stat_display_digs')}</p>
                        <p className="text-3xl font-black text-sky-300 print-text-black">{stats.digs || 0}</p>
                    </div>
                    <div className="bg-slate-800 p-2 rounded-lg print-bg-white">
                        <p className="text-sm font-bold text-slate-400 print-text-black">{t('stat_display_assists')}</p>
                        <p className="text-3xl font-black text-sky-300 print-text-black">{stats.assists || 0}</p>
                    </div>
                </div>

                <div className="mt-6 pt-4 border-t border-yellow-400/20 w-full max-w-sm">
                    <p className="font-bold text-lg text-yellow-300 print-text-black">{t('record_mvp_score', { score: mvpScore.toFixed(1) })}</p>
                    
                    <div className="mt-6 p-5 bg-slate-800/80 rounded-xl text-sm text-slate-300 text-left space-y-2 print-bg-white print-text-black shadow-inner border border-slate-700">
                        <p className="font-bold text-sky-400 mb-3 text-lg print-text-black border-b border-slate-600 pb-2">{t('record_mvp_breakdown_title')}</p>
                        <p className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-sky-500 rounded-full"></span>{t('record_mvp_breakdown_1')}</p>
                        <p className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-sky-500 rounded-full"></span>{t('record_mvp_breakdown_2')}</p>
                        <p className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-sky-500 rounded-full"></span>{t('record_mvp_breakdown_3')}</p>
                        <p className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-sky-500 rounded-full"></span>{t('record_mvp_breakdown_4')}</p>
                        <p className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-sky-500 rounded-full"></span>{t('record_mvp_breakdown_5')}</p>
                        <p className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-sky-500 rounded-full"></span>{t('record_mvp_breakdown_6')}</p>
                    </div>
                </div>
            </div>
        );
    };

    const MatchLeadersCard: React.FC<{ leaders: MatchLeaders | null }> = ({ leaders }) => {
        if (!leaders) return null;

        const LeaderItem: React.FC<{ icon: React.ReactNode; title: string; leaders: { player: Player; value: number }[] }> = ({ icon, title, leaders }) => {
            if (leaders.length === 0) return null;
            return (
                <div className="bg-slate-800 p-4 rounded-lg flex items-start gap-4 print-bg-white">
                    <div className="flex-shrink-0 text-yellow-400 mt-1">{icon}</div>
                    <div className="flex-grow">
                        <p className="text-sm text-slate-400 print-text-black">{title}</p>
                        {leaders.map(({player, value}) => (
                            <p key={player.id} className="text-lg font-bold text-white print-text-black">{player.originalName} ({value})</p>
                        ))}
                    </div>
                </div>
            );
        };

        return (
            <div className="bg-slate-800/50 p-4 rounded-lg print-bg-white">
                <h3 className="text-xl font-bold text-slate-300 mb-4 text-center print-text-black">{t('record_leaders_title')}</h3>
                <div className="space-y-3">
                    <LeaderItem icon={<MedalIcon className="w-8 h-8"/>} title={t('record_leaders_points')} leaders={leaders.points} />
                    <LeaderItem icon={<MedalIcon className="w-8 h-8"/>} title={t('record_leaders_serve')} leaders={leaders.serviceAces} />
                    <LeaderItem icon={<MedalIcon className="w-8 h-8"/>} title={t('record_leaders_blocking')} leaders={leaders.blockingPoints} />
                </div>
            </div>
        );
    };


    const Timeline: React.FC<{ events: TimelineEvent[] }> = ({ events }) => {
        if (events.length === 0) {
            return null;
        }

        const getEventIcon = (type: ScoreEventType | 'LOG') => {
            const className = "w-5 h-5";
            switch (type) {
                case 'SCORE': return <VolleyballIcon className={`${className} text-sky-400`} />;
                case 'ACE': return <TargetIcon className={`${className} text-yellow-400`} />;
                case 'SPIKE': return <FireIcon className={`${className} text-orange-400`} />;
                case 'BLOCK': return <WallIcon className={`${className} text-blue-400`} />;
                case 'FAULT': return <span className="text-lg">⚠️</span>;
                case 'SERVE_IN': return <BoltIcon className={`${className} text-yellow-400`} />;
                case 'DIG': return <ShieldIcon className={`${className} text-green-400`} />;
                case 'ASSIST': return <HandshakeIcon className={`${className} text-sky-400`} />;
                case 'TIMEOUT': return <StopwatchIcon className={`${className} text-slate-400`} />;
                case 'GAME_END': return <TrophyIcon className={`${className} text-yellow-500`} />;
                case '3HIT': return <LinkIcon className={`${className} text-purple-400`} />;
                case 'FAIRPLAY': return <HandshakeIcon className={`${className} text-green-400`} />;
                case 'SUB': return <span className="text-lg">🔄</span>;
                default: return <div className="w-2 h-2 bg-slate-500 rounded-full" />;
            }
        };

        const getEventStyles = (type: ScoreEventType | 'LOG') => {
            switch (type) {
                case 'SCORE': return 'border-sky-500/50 bg-sky-900/10';
                case 'ACE': return 'border-yellow-500/50 bg-yellow-900/10';
                case 'SPIKE': return 'border-orange-500/50 bg-orange-900/10';
                case 'BLOCK': return 'border-blue-500/50 bg-blue-900/10';
                case 'FAULT': return 'border-red-500/50 bg-red-900/10';
                case 'GAME_END': return 'border-green-500 bg-green-900/20';
                case 'TIMEOUT': return 'border-slate-500/50 bg-slate-800/50';
                case '3HIT': return 'border-purple-500/50 bg-purple-900/10';
                case 'FAIRPLAY': return 'border-green-500/50 bg-green-900/10';
                default: return 'border-slate-700 bg-slate-800/30';
            }
        };

        return (
            <div className="bg-slate-900/50 border-2 border-slate-700 p-4 rounded-lg print-bg-white h-96 overflow-y-auto">
                <h3 className="text-xl font-bold text-slate-300 mb-4 text-center print-text-black">{t('record_timeline_title')}</h3>
                <div className="space-y-2 px-1">
                    {events.map((event, index) => (
                        <div key={index} className={`flex items-center gap-4 p-3 rounded-xl border ${getEventStyles(event.type)} transition-all hover:brightness-110 print-text-black print:border-slate-300 print:bg-white`}>
                            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-900 border border-slate-700 shadow-sm flex-shrink-0">
                                {getEventIcon(event.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-slate-200 font-bold text-base truncate print-text-black">{event.description}</p>
                                <p className="text-slate-500 text-xs font-mono mt-0.5 print-text-black">스코어 {event.score}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // 수업 모드(CLASS): matchHistory만 사용. 클럽 모드(CLUB): 연습경기 탭 = practiceMatchHistory, 대회경기 탭 = leagueMatchHistory.
    const allMatches = useMemo((): EnrichedMatch[] => {
        if (appMode === 'CLASS') {
            const list = (matchHistory ?? [])
                .map((m, originalIndex) => ({ m, originalIndex }))
                .filter(({ m }) => !!m && m.status === 'completed')
                .map(({ m, originalIndex }) => ({
                    ...m,
                    id: `history-${originalIndex}`,
                    status: 'completed' as const,
                    date: (m as MatchState & { date?: string }).date ?? new Date().toISOString(),
                })) as EnrichedMatch[];
            if (matchState?.status === 'in_progress' && !matchState.leagueId) {
                list.push({
                    ...matchState,
                    status: 'in_progress',
                    id: 'in-progress',
                    date: new Date().toISOString(),
                    time: matchTime,
                } as EnrichedMatch);
            }
            return list.sort((a, b) => new Date((b.date ?? 0) as string).getTime() - new Date((a.date ?? 0) as string).getTime());
        }

        const isPracticeTab = matchHistoryTab === 'practice';
        const source = isPracticeTab ? practiceMatchHistory : leagueMatchHistory;
        const prefix = isPracticeTab ? 'practice' : 'league';

        const list = source.map((m, i) => ({
            ...m,
            id: `${prefix}-${i}`,
            status: (m.status || 'completed') as 'completed' | 'in_progress',
        }));

        const isInProgressLeague = matchState?.leagueId != null;
        if (matchState && matchState.status === 'in_progress') {
            const showInThisTab = isPracticeTab ? !isInProgressLeague : isInProgressLeague;
            if (showInThisTab) {
                list.push({
                    ...matchState,
                    status: 'in_progress',
                    id: 'in-progress',
                    date: new Date().toISOString(),
                    time: matchTime,
                } as EnrichedMatch);
            }
        }

        return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [appMode, matchHistoryTab, matchHistory, practiceMatchHistory, leagueMatchHistory, matchState, matchTime]);

    useEffect(() => {
        if (preselectedMatchId && onClearPreselection) {
            const matchToSelect = allMatches.find(m => m.id === preselectedMatchId);
            if (matchToSelect) {
                setSelectedMatch(matchToSelect);
            }
            onClearPreselection(); // Clear it so it doesn't re-trigger
        }
    }, [preselectedMatchId, onClearPreselection, allMatches]);


    useEffect(() => {
        if (selectedMatch) {
            setShowScoreTrend(false);
            setSetDetailTab('all');
        }
    }, [selectedMatch]);

    const allTeamData = useMemo((): Record<string, FlattenedTeam> => {
        const teamData: Record<string, FlattenedTeam> = {};
        teamSets.forEach(set => {
            set.teams.forEach(team => {
                const key = `${set.id}___${team.teamName}`;
                const captain = set.players[team.captainId];
                teamData[key] = {
                    ...team,
                    className: set.className,
                    captain: captain ? captain.originalName : '주장 정보 없음',
                    players: team.playerIds.map(id => set.players[id]?.originalName || '선수 정보 없음'),
                };
            });
        });
        return teamData;
    }, [teamSets]);

    const enrichedSelectedMatch = useMemo(() => {
        if (!selectedMatch) return null;

        const matchCopy = JSON.parse(JSON.stringify(selectedMatch)) as EnrichedMatch;

        const updateTeamBranding = (teamState: TeamMatchState) => {
            const teamInfo = teamState.key ? allTeamData[teamState.key] : null;
            if (teamInfo) {
                teamState.emblem = teamInfo.emblem || teamState.emblem;
                teamState.color = teamInfo.color || teamState.color;
                teamState.slogan = teamInfo.slogan || teamState.slogan;
            }
            if (!teamState.color) teamState.color = teamState === matchCopy.teamA ? '#38bdf8' : '#f87171';
            return teamState;
        };

        matchCopy.teamA = updateTeamBranding(matchCopy.teamA);
        matchCopy.teamB = updateTeamBranding(matchCopy.teamB);

        return matchCopy;
    }, [selectedMatch, allTeamData]);

    /** 전체보기 탭: 모든 세트의 team1/team2 점수 합산 (match.sets.reduce) */
    const totalScoreFromSets = useMemo(() => {
        const match = enrichedSelectedMatch;
        if (!match?.setScores?.length) return null;
        const total = match.setScores.reduce(
            (acc, s) => ({ teamA: acc.teamA + (s.teamA ?? 0), teamB: acc.teamB + (s.teamB ?? 0) }),
            { teamA: 0, teamB: 0 }
        );
        return total;
    }, [enrichedSelectedMatch?.setScores]);

    /** 세트별 구간: scoreHistory 인덱스로 [세트0끝+1, 세트1끝+1, ...] */
    const setBoundaries = useMemo(() => {
        const match = enrichedSelectedMatch;
        if (!match?.scoreHistory?.length || !match?.setScores?.length) return [];
        const boundaries: number[] = [0];
        let idx = 0;
        for (let s = 0; s < match.setScores.length; s++) {
            const target = match.setScores[s];
            while (idx < match.scoreHistory.length) {
                const h = match.scoreHistory[idx];
                if (h.a === target.teamA && h.b === target.teamB) {
                    boundaries.push(idx + 1);
                    idx++;
                    break;
                }
                idx++;
            }
        }
        return boundaries;
    }, [enrichedSelectedMatch]);

    const currentSetEvents = useMemo(() => {
        if (!enrichedSelectedMatch?.eventHistory || setDetailTab === 'all') return enrichedSelectedMatch?.eventHistory ?? [];
        const b = setBoundaries;
        if (b.length === 0) return enrichedSelectedMatch.eventHistory;
        const i = setDetailTab as number;
        const start = b[i] ?? 0;
        const end = b[i + 1] ?? enrichedSelectedMatch.eventHistory.length;
        return enrichedSelectedMatch.eventHistory.slice(start, end);
    }, [enrichedSelectedMatch, setDetailTab, setBoundaries]);

    const displayTimelineEvents = useMemo((): TimelineEvent[] => {
        if (setDetailTab === 'all') return timelineEvents;
        const raw = currentSetEvents as Array<{ type?: string; descriptionKey?: string; score?: { a: number; b: number } }>;
        if (!raw?.length) return [];
        return raw.map((e): TimelineEvent => ({
            type: (e.type as ScoreEventType) || 'LOG',
            team: null,
            description: e.descriptionKey ?? '',
            score: e.score ? `${e.score.a}:${e.score.b}` : '-',
        })).reverse();
    }, [setDetailTab, timelineEvents, currentSetEvents]);
    

    const availableClasses = useMemo(() => {
        const classSet = new Set<string>();
        Object.values(allTeamData).forEach((team: FlattenedTeam) => {
            if (team.className) classSet.add(team.className);
        });
        return Array.from(classSet).sort((a,b) => a.localeCompare(b));
    }, [allTeamData]);
    
    const availableTeamCounts = useMemo(() => {
        const counts = new Set<number>();
        teamSets.forEach(set => {
            // If teamCount is missing, it's a legacy 4-team set.
            counts.add(set.teamCount ?? 4); 
        });
        const validCounts = Array.from(counts).filter(c => c > 0);
        const sortedCounts = validCounts.sort((a,b) => a - b);
        return sortedCounts.map(String);
    }, [teamSets]);

    const availableCompetitions = useMemo(() => 
        [...new Set((teamSets ?? []).map((s: TeamSet) => s.className))].filter(Boolean).sort(),
    [teamSets]);

    const getMatchCompetition = useCallback((match: EnrichedMatch): string | null => {
        const key = match?.teamA?.key || match?.teamB?.key;
        if (!key) return null;
        const [setId] = key.split('___');
        const ts = teamSets.find((s: TeamSet) => s.id === setId);
        return ts?.className ?? null;
    }, [teamSets]);

    const filteredMatches = useMemo(() => {
        const validMatches = allMatches.filter(match => {
            if (!match || !match.teamA || !match.teamB) {
                console.warn("Filtered out a malformed match record:", match);
                return false;
            }
            return true;
        });

        let classFiltered = selectedClass ? validMatches.filter((match: EnrichedMatch) => {
            const teamAData: FlattenedTeam | null = match.teamA.key ? allTeamData[match.teamA.key] : null;
            const teamBData: FlattenedTeam | null = match.teamB.key ? allTeamData[match.teamB.key] : null;

            const teamAClass = teamAData?.className;
            const teamBClass = teamBData?.className;
            return teamAClass === selectedClass || teamBClass === selectedClass;
        }) : validMatches;

        if (appMode === 'CLUB' && matchHistoryTab === 'tournament' && selectedCompetition) {
            classFiltered = classFiltered.filter((match: EnrichedMatch) => {
                const teamAData: FlattenedTeam | null = match.teamA.key ? allTeamData[match.teamA.key] : null;
                const teamBData: FlattenedTeam | null = match.teamB.key ? allTeamData[match.teamB.key] : null;
                const compA = teamAData?.className;
                const compB = teamBData?.className;
                return compA === selectedCompetition && compB === selectedCompetition;
            });
        }
        
        return classFiltered.filter(match => {
            if (teamCountFilter === 'all') return true;
    
            const teamAKey = match.teamA.key;
            if (!teamAKey) {
                // Referee matches have no team format, so hide them when a filter is active
                return false;
            }
    
            const [setId] = teamAKey.split('___');
            const teamSet = teamSets.find(s => s.id === setId);
    
            if (!teamSet) {
                return false;
            }
            
            // Legacy sets have no teamCount, so we default to 4.
            const matchFormat = teamSet.teamCount ?? 4;
            
            return String(matchFormat) === teamCountFilter;
        });
    }, [allMatches, selectedClass, selectedCompetition, teamCountFilter, allTeamData, teamSets, appMode, matchHistoryTab]);
    
    // ... (GameSummaryPanel)

    useEffect(() => {
        const calculateMvp = (match: EnrichedMatch): MvpResult => {
            let bestPlayer: { player: Player, team: TeamMatchState, stats: PlayerStats, mvpScore: number, scoreBreakdown: Record<string, number> } | null = null;
            const processTeam = (teamState: TeamMatchState) => {
                if (!teamState.players || !teamState.playerStats) return;
                for (const playerId of Object.keys(teamState.players)) {
                    const player = teamState.players[playerId];
                    const stats = teamState.playerStats[playerId];
                    if (player && stats) {
                        const scoreBreakdown = {
                            points: (stats.points || 0) * 1.0,
                            aces: (stats.serviceAces || 0) * 2.0,
                            blocks: (stats.blockingPoints || 0) * 1.5,
                            faults: -(stats.serviceFaults || 0) * 1.0,
                            digs: (stats.digs || 0) * 0.5,
                            assists: (stats.assists || 0) * 0.5,
                            serveIn: (stats.serveIn || 0) * 0.1,
                        };
                        const mvpScore = Object.values(scoreBreakdown).reduce((a, b) => a + b, 0);

                        if (!bestPlayer || mvpScore > bestPlayer.mvpScore) {
                            bestPlayer = { player, team: teamState, stats, mvpScore, scoreBreakdown };
                        }
                    }
                }
            };
            processTeam(match.teamA);
            processTeam(match.teamB);
            
            if (bestPlayer && bestPlayer.mvpScore <= 0) {
                return null;
            }
            return bestPlayer;
        };

        const generateTimeline = (match: EnrichedMatch): TimelineEvent[] => {
            const events: TimelineEvent[] = [];
            
            // Use the detailed eventHistory if available
            if (match.eventHistory && match.eventHistory.length > 0) {
                match.eventHistory.forEach(event => {
                    events.push({
                        type: event.type || 'LOG',
                        team: null, // Specific team not strictly needed for this log view
                        description: event.descriptionKey,
                        score: `${event.score.a}:${event.score.b}`
                    });
                });
                return events.reverse(); // Newest first
            }

            // Fallback to basic score history if no detailed events
            if (!match.scoreHistory || match.scoreHistory.length < 2) return [];

            for (let i = 1; i < match.scoreHistory.length; i++) {
                const curr = match.scoreHistory[i];
                const scoreStr = `${curr.a}:${curr.b}`;
                events.push({ type: 'LOG', team: null, description: `점수 변경`, score: scoreStr });
            }

            return events.reverse();
        };

        const calculateMatchLeaders = (match: EnrichedMatch): MatchLeaders => {
            const leaders: MatchLeaders = { points: [], serviceAces: [], blockingPoints: [] };
            let maxStats = { points: 0, serviceAces: 0, blockingPoints: 0 };
            const allPlayersInMatch: {player: Player, stats: PlayerStats}[] = [];
        
            const addPlayersFromTeam = (team: TeamMatchState) => {
                if (!team.players || !team.playerStats) return;
                Object.keys(team.players).forEach(pId => {
                    if (team.players[pId] && team.playerStats[pId]) {
                        allPlayersInMatch.push({player: team.players[pId], stats: team.playerStats[pId]});
                    }
                });
            };
        
            addPlayersFromTeam(match.teamA);
            addPlayersFromTeam(match.teamB);
        
            allPlayersInMatch.forEach(({ stats }) => {
                if (stats.points > 0 && stats.points > maxStats.points) maxStats.points = stats.points;
                if (stats.serviceAces > 0 && stats.serviceAces > maxStats.serviceAces) maxStats.serviceAces = stats.serviceAces;
                if (stats.blockingPoints > 0 && stats.blockingPoints > maxStats.blockingPoints) maxStats.blockingPoints = stats.blockingPoints;
            });
        
            allPlayersInMatch.forEach(({ player, stats }) => {
                if (stats.points > 0 && stats.points === maxStats.points) leaders.points.push({ player, value: stats.points });
                if (stats.serviceAces > 0 && stats.serviceAces === maxStats.serviceAces) leaders.serviceAces.push({ player, value: stats.serviceAces });
                if (stats.blockingPoints > 0 && stats.blockingPoints === maxStats.blockingPoints) leaders.blockingPoints.push({ player, value: stats.blockingPoints });
            });
        
            return leaders;
        };

        if (enrichedSelectedMatch && enrichedSelectedMatch.status === 'completed') {
            setMvp(calculateMvp(enrichedSelectedMatch));
            setTimelineEvents(generateTimeline(enrichedSelectedMatch));
            setMatchLeaders(calculateMatchLeaders(enrichedSelectedMatch));
        } else {
            setMvp(null);
            setTimelineEvents([]);
            setMatchLeaders(null);
        }
    }, [enrichedSelectedMatch, t]);


    /** 선수 클릭 시: 전역 playerCumulativeStats 사용 + teamSets에서 최신 선수 객체로 모달에 전달 (스탯 0 버그 방지) */
    const calculatePlayerHistory = useCallback((player: Player, teamKey?: string) => {
        if (!player) return;

        const latestPlayer: Player = (() => {
            if (teamKey) {
                const [setId] = teamKey.split('___');
                const set = teamSets.find((s) => s.id === setId);
                const found = set?.players?.[player.id];
                if (found) return { ...found };
            }
            for (const s of teamSets) {
                const p = s.players?.[player.id];
                if (p) return { ...p };
            }
            return player;
        })();

        const baseStats = {
            points: 0, serviceAces: 0, serviceFaults: 0, blockingPoints: 0, spikeSuccesses: 0, matchesPlayed: 0,
            serveIn: 0, digs: 0, assists: 0
        };
        const cumulativeStats: any = { ...baseStats, ...(playerCumulativeStats?.[player.id] ?? {}) };

        const performanceHistory: any[] = [];
        const allMatches = [
            ...matchHistory.filter(m => m.status === 'completed' && !m.leagueId && !m.tournamentId),
            ...(practiceMatchHistory || []).filter(m => m.status === 'completed'),
            ...(leagueMatchHistory || []).filter(m => m.status === 'completed'),
        ].sort((a, b) => new Date((a as { date?: string }).date ?? 0).getTime() - new Date((b as { date?: string }).date ?? 0).getTime());

        allMatches.forEach(match => {
            let playerTeam: 'teamA' | 'teamB' | null = null;
            if (match.teamA.players && Object.keys(match.teamA.players).includes(player.id)) {
                playerTeam = 'teamA';
            } else if (match.teamB.players && Object.keys(match.teamB.players).includes(player.id)) {
                playerTeam = 'teamB';
            }
            if (playerTeam) {
                const teamState = match[playerTeam];
                const opponentName = (playerTeam === 'teamA' ? match.teamB : match.teamA).name;
                const playerStatsForMatch = teamState.playerStats?.[player.id];
                if (playerStatsForMatch) {
                    performanceHistory.push({
                        match,
                        teamName: teamState.name,
                        opponent: opponentName,
                        stats: playerStatsForMatch,
                    });
                }
            }
        });

        const totalServices = (cumulativeStats.serviceAces || 0) + (cumulativeStats.serviceFaults || 0);
        cumulativeStats.serviceSuccessRate = totalServices > 0 ? ((cumulativeStats.serviceAces || 0) + (cumulativeStats.serveIn || 0)) / totalServices * 100 : 0;

        performanceHistory.reverse();
        setPlayerHistoryData({ player: latestPlayer, cumulativeStats, performanceHistory });
    }, [matchHistory, practiceMatchHistory, leagueMatchHistory, teamSets, playerCumulativeStats]);

    const findTeamSetForMatchTeam = useCallback((teamKey: string | undefined) => {
        if (!teamKey) return undefined;
        const [setId] = teamKey.split('___');
        return teamSets.find(s => s.id === setId);
    }, [teamSets]);

    const handleDelete = async (matchId: string) => {
        if (matchId === 'in-progress') {
            if (window.confirm("진행 중인 경기를 삭제하시겠습니까?")) {
                clearInProgressMatch();
                showToast("진행 중인 경기가 삭제되었습니다.");
                setSelectedMatch(null);
            }
            return;
        }

        if (matchId.startsWith('practice-')) {
            const index = parseInt(matchId.replace('practice-', ''), 10);
            if (window.confirm("정말로 이 연습 경기 기록을 삭제하시겠습니까?")) {
                const newList = practiceMatchHistory.filter((_, i) => i !== index);
                await savePracticeMatchHistory(newList, "연습 경기 기록이 삭제되었습니다.");
                setSelectedMatch(null);
            }
            return;
        }
        if (matchId.startsWith('league-')) {
            const index = parseInt(matchId.replace('league-', ''), 10);
            if (window.confirm("정말로 이 대회 경기 기록을 삭제하시겠습니까?")) {
                const deletedMatch = leagueMatchHistory[index];
                const newList = leagueMatchHistory.filter((_, i) => i !== index);
                await saveLeagueMatchHistory(newList, "대회 경기 기록이 삭제되었습니다.");
                if (deletedMatch && (deletedMatch as MatchState & { leagueId?: string }).leagueId && saveLeagueStandingsList && leagueStandingsList?.list) {
                    const leagueId = (deletedMatch as MatchState & { leagueId?: string }).leagueId;
                    const teamA = deletedMatch.teamA?.name ?? '';
                    const teamB = deletedMatch.teamB?.name ?? '';
                    const list = leagueStandingsList.list.map((d) => {
                        if (d.id !== leagueId) return d;
                        const remainingMatches = (d.matches ?? []).filter(
                            (m) => !((m.teamA === teamA && m.teamB === teamB) || (m.teamA === teamB && m.teamB === teamA))
                        );
                        return { ...d, matches: remainingMatches };
                    });
                    await saveLeagueStandingsList({ list, selectedId: leagueStandingsList.selectedId });
                }
                setSelectedMatch(null);
            }
            return;
        }
        
        if (window.confirm("정말로 이 기록을 삭제하시겠습니까?")) {
            const originalIndex = parseInt(matchId.replace('history-', ''), 10);
            const newHistory = [...matchHistory];
            newHistory.splice(originalIndex, 1);
            await saveMatchHistory(newHistory, "기록이 삭제되었습니다.");
            setSelectedMatch(null);
        }
    };

    const handleExportCSV = () => {
        if (filteredMatches.length === 0) return;

        const headers = [
            '날짜', '팀A', '점수A', '점수B', '팀B', '승리팀', 'MVP', 
            'A_서브에이스', 'A_서브범실', 'A_블로킹', 'A_스파이크', 'A_3단플레이', 'A_페어플레이',
            'B_서브에이스', 'B_서브범실', 'B_블로킹', 'B_스파이크', 'B_3단플레이', 'B_페어플레이'
        ];

        const csvRows = [headers.join(',')];

        filteredMatches.forEach(match => {
            if(match.status !== 'completed') return;
            
            let mvpName = '';
            
            const row = [
                new Date(match.date).toLocaleDateString(),
                match.teamA.name,
                match.teamA.score,
                match.teamB.score,
                match.teamB.name,
                match.winner === 'A' ? match.teamA.name : (match.winner === 'B' ? match.teamB.name : '무승부'),
                mvpName,
                match.teamA.serviceAces,
                match.teamA.serviceFaults,
                match.teamA.blockingPoints,
                match.teamA.spikeSuccesses,
                match.teamA.threeHitPlays,
                match.teamA.fairPlay,
                match.teamB.serviceAces,
                match.teamB.serviceFaults,
                match.teamB.blockingPoints,
                match.teamB.spikeSuccesses,
                match.teamB.threeHitPlays,
                match.teamB.fairPlay,
            ];
            csvRows.push(row.join(','));
        });

        const blob = new Blob([`\uFEFF${csvRows.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `match_records_${new Date().toISOString().slice(0,10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleCalculatePoints = () => {
        const points: Record<string, { teamA: number; teamB: number }> = {};
        
        filteredMatches.forEach(match => {
            if (match.status !== 'completed') return;
            
            let pointsA = 0;
            let pointsB = 0;
            
            // Standard points (Win 3, Tie 1, Loss 0)
            const winner = getTotalScoreWinner(match, settings);
            if (winner === 'A') {
                pointsA += 3;
            } else if (winner === 'B') {
                pointsB += 3;
            } else {
                pointsA += 1;
                pointsB += 1;
            }
            
            points[match.id] = { teamA: pointsA, teamB: pointsB };
        });
        
        setPointsData(points);
    };

    const handleCalculateRankings = () => {
        const teamStats: Record<string, { points: number }> = {};
        
        filteredMatches.forEach(match => {
            if (match.status !== 'completed') return;
            
            // Identify teams by name (since keys might be missing in older data or referee mode)
            const nameA = match.teamA.name;
            const nameB = match.teamB.name;
            
            if (!teamStats[nameA]) teamStats[nameA] = { points: 0 };
            if (!teamStats[nameB]) teamStats[nameB] = { points: 0 };
            
            const winner = getTotalScoreWinner(match, settings);
            if (winner === 'A') {
                teamStats[nameA].points += 3;
            } else if (winner === 'B') {
                teamStats[nameB].points += 3;
            } else {
                teamStats[nameA].points += 1;
                teamStats[nameB].points += 1;
            }
        });
        
        const sortedRankings = Object.entries(teamStats)
            .map(([teamName, stats]) => ({ teamName, totalPoints: stats.points }))
            .sort((a, b) => b.totalPoints - a.totalPoints);
            
        // Handle ties in ranking
        const finalRankings = sortedRankings.map((item, index, array) => {
            let rank: number | string = index + 1;
            // Actually, usually we want rank to be the same, but the next one skips.
            return { ...item, rank: index + 1 };
        });
        
        // Adjust for ties
        for (let i = 1; i < finalRankings.length; i++) {
            if (finalRankings[i].totalPoints === finalRankings[i-1].totalPoints) {
                finalRankings[i].rank = finalRankings[i-1].rank;
            }
        }

        setRankings(finalRankings);
        setShowRankingsModal(true);
    };

    const handleSaveAsImage = async () => {
        if (!selectedMatch) return;
        setIsGeneratingImage(true);
        try {
            const locale = language === 'ko' ? 'ko-KR' : 'id-ID';
            const dataUrl = await generateMatchResultImage(selectedMatch, userEmblems, mvp, t, locale);
            
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `match_result_${selectedMatch.teamA.name}_vs_${selectedMatch.teamB.name}.png`;
            link.click();
        } catch (error) {
            console.error("Failed to generate image:", error);
            showToast("이미지 생성에 실패했습니다.", 'error');
        } finally {
            setIsGeneratingImage(false);
        }
    };

    const chartData = useMemo(() => {
        if (enrichedSelectedMatch) { 
             return [
                { name: t('stat_display_serve_ace'), [enrichedSelectedMatch.teamA.name]: enrichedSelectedMatch.teamA.serviceAces, [enrichedSelectedMatch.teamB.name]: enrichedSelectedMatch.teamB.serviceAces },
                { name: t('stat_display_spike_success'), [enrichedSelectedMatch.teamA.name]: enrichedSelectedMatch.teamA.spikeSuccesses, [enrichedSelectedMatch.teamB.name]: enrichedSelectedMatch.teamB.spikeSuccesses },
                { name: t('stat_display_blocking'), [enrichedSelectedMatch.teamA.name]: enrichedSelectedMatch.teamA.blockingPoints, [enrichedSelectedMatch.teamB.name]: enrichedSelectedMatch.teamB.blockingPoints },
                { name: t('stat_display_serve_fault'), [enrichedSelectedMatch.teamA.name]: enrichedSelectedMatch.teamA.serviceFaults, [enrichedSelectedMatch.teamB.name]: enrichedSelectedMatch.teamB.serviceFaults },
                { name: t('stat_display_digs'), [enrichedSelectedMatch.teamA.name]: Object.values(enrichedSelectedMatch.teamA.playerStats || {}).reduce((acc, p: any) => acc + (p.digs || 0), 0), [enrichedSelectedMatch.teamB.name]: Object.values(enrichedSelectedMatch.teamB.playerStats || {}).reduce((acc, p: any) => acc + (p.digs || 0), 0) },
                { name: t('stat_display_assists'), [enrichedSelectedMatch.teamA.name]: Object.values(enrichedSelectedMatch.teamA.playerStats || {}).reduce((acc, p: any) => acc + (p.assists || 0), 0), [enrichedSelectedMatch.teamB.name]: Object.values(enrichedSelectedMatch.teamB.playerStats || {}).reduce((acc, p: any) => acc + (p.assists || 0), 0) },
             ];
        }
        return [];
    }, [enrichedSelectedMatch, t]);

    const GameSummaryPanel = () => {
        if (!enrichedSelectedMatch) return null;
        const { teamA, teamB } = enrichedSelectedMatch;
        const isClub = appMode === 'CLUB';
        const scoreA = (setDetailTab === 'all' && totalScoreFromSets) ? totalScoreFromSets.teamA : teamA.score;
        const scoreB = (setDetailTab === 'all' && totalScoreFromSets) ? totalScoreFromSets.teamB : teamB.score;
        const finalScoreA = isClub ? scoreA : (settings.includeBonusPointsInWinner ? teamA.score + teamA.fairPlay + teamA.threeHitPlays : teamA.score);
        const finalScoreB = isClub ? scoreB : (settings.includeBonusPointsInWinner ? teamB.score + teamB.fairPlay + teamB.threeHitPlays : teamB.score);
        
        let winnerMessage;
        if (finalScoreA > finalScoreB) {
            winnerMessage = `${t('record_final_winner_prefix')}: ${teamA.name}!`;
        } else if (finalScoreB > finalScoreA) {
            winnerMessage = `${t('record_final_winner_prefix')}: ${teamB.name}!`;
        } else {
            winnerMessage = t('record_final_result_tie');
        }

        const breakdownA = isClub ? `${t('record_score_part_match')} ${scoreA}` : `${t('record_score_part_match')} ${teamA.score} + ${t('record_score_part_fairplay')} ${teamA.fairPlay} + ${t('record_score_part_3hit')} ${teamA.threeHitPlays}`;
        const breakdownB = isClub ? `${t('record_score_part_match')} ${scoreB}` : `${t('record_score_part_match')} ${teamB.score} + ${t('record_score_part_fairplay')} ${teamB.fairPlay} + ${t('record_score_part_3hit')} ${teamB.threeHitPlays}`;

        return (
            <div className="bg-[#00A3FF]/10 border border-[#00A3FF] p-6 rounded-lg space-y-4 no-print">
                <div className="text-center">
                    <h3 className="text-3xl font-bold text-[#00A3FF]">{winnerMessage}</h3>
                    <div className="text-xl mt-1 flex flex-col gap-1">
                        <p>
                            <span className="font-bold">{t('record_score_breakdown_format', { teamName: teamA.name, totalScore: finalScoreA, breakdown: breakdownA })}</span>
                        </p>
                        <p>
                            <span className="font-bold">{t('record_score_breakdown_format', { teamName: teamB.name, totalScore: finalScoreB, breakdown: breakdownB })}</span>
                        </p>
                    </div>
                    {!isClub && settings.includeBonusPointsInWinner && (
                        <p className="text-sm text-slate-400 mt-1">{t('record_score_breakdown_guide')}</p>
                    )}
                </div>
            </div>
        );
    };

    return (
        <>
            <RankingsModal isOpen={showRankingsModal} onClose={() => setShowRankingsModal(false)} rankings={rankings} />
            {playerHistoryData && (
                <PlayerHistoryModal
                    player={playerHistoryData.player}
                    cumulativeStats={playerHistoryData.cumulativeStats}
                    performanceHistory={playerHistoryData.performanceHistory}
                    onClose={() => setPlayerHistoryData(null)}
                    teamSets={teamSets}
                    appMode={appMode}
                />
            )}
            <div className="max-w-7xl mx-auto bg-slate-900/50 backdrop-blur-sm border border-slate-700 p-6 rounded-lg shadow-2xl space-y-6 animate-fade-in w-full">
                {/* 연습경기 / 대회경기 탭: 클럽 모드에서만 표시 */}
                {appMode === 'CLUB' && (
                    <div className="flex gap-2 border-b border-slate-600 pb-3 no-print">
                        <button
                            type="button"
                            onClick={() => { setMatchHistoryTab('practice'); setSelectedMatch(null); }}
                            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${matchHistoryTab === 'practice' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                        >
                            🏐 연습경기
                        </button>
                        <button
                            type="button"
                            onClick={() => { setMatchHistoryTab('tournament'); setSelectedMatch(null); }}
                            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${matchHistoryTab === 'tournament' ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                        >
                            🏆 대회경기
                        </button>
                    </div>
                )}
                {/* ... Header and filter controls ... */}
                <div className="flex flex-col lg:flex-row items-center lg:justify-between mb-6 gap-4 no-print">
                    <h1 className="text-3xl lg:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 text-center lg:text-right">
                        {t('record_list_title')}
                    </h1>
                    <div className="flex gap-4 items-center self-start lg:self-auto flex-wrap">
                        {appMode === 'CLASS' && (
                            <div>
                                <label htmlFor="class-select-history" className="sr-only">{t('record_filter_class_label')}</label>
                                <select
                                    id="class-select-history"
                                    value={selectedClass}
                                    onChange={(e) => {
                                        setSelectedClass(e.target.value);
                                        setSelectedMatch(null);
                                        setPointsData({});
                                        setRankings([]);
                                    }}
                                    className="bg-slate-700 border border-slate-600 rounded-md p-2 text-white focus:outline-none focus:ring-2 focus:ring-[#00A3FF]"
                                >
                                    <option value="">{t('record_all_classes')}</option>
                                    {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        )}
                        {appMode === 'CLUB' && matchHistoryTab === 'tournament' && (
                            <div>
                                <label htmlFor="competition-select-history" className="sr-only">대회 선택</label>
                                <select
                                    id="competition-select-history"
                                    value={selectedCompetition}
                                    onChange={(e) => {
                                        setSelectedCompetition(e.target.value);
                                        setSelectedMatch(null);
                                        setPointsData({});
                                        setRankings([]);
                                    }}
                                    className="bg-slate-700 border border-slate-600 rounded-md p-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                                >
                                    <option value="">전체 대회</option>
                                    {availableCompetitions.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        )}
                        <button onClick={handleExportCSV} disabled={filteredMatches.length === 0} className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 px-4 rounded-lg transition duration-200 disabled:bg-slate-600 disabled:cursor-not-allowed">
                            {t('record_download_csv')}
                        </button>
                    </div>
                </div>

                 <div className="flex flex-wrap items-center gap-2 border-b border-t border-slate-700 pb-4 no-print">
                    <span className="text-sm font-semibold text-slate-400 mr-2">{t('record_format_filter')}</span>
                    <button onClick={() => setTeamCountFilter('all')} className={`px-3 py-1 text-sm rounded-md transition-colors ${teamCountFilter === 'all' ? 'bg-[#00A3FF] text-white font-bold' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}>{t('record_all_formats')}</button>
                    {availableTeamCounts.map(count => (
                        <button key={count} onClick={() => setTeamCountFilter(count)} className={`px-3 py-1 text-sm rounded-md transition-colors ${teamCountFilter === count ? 'bg-[#00A3FF] text-white font-bold' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}>
                            {t('record_team_format', { count })}
                        </button>
                    ))}
                </div>

                <div className="animate-fade-in">
                    <div className="max-h-60 overflow-y-auto bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-2 no-print">
                        {filteredMatches.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center py-8 px-4">
                                <h3 className="text-lg font-bold text-sky-400 mb-3">{t('record_no_matches_for_filter_title')}</h3>
                                <p className="text-slate-300 text-sm max-w-md">
                                    {t('record_no_matches_for_filter_desc')}
                                </p>
                            </div>
                        ) : (
                            filteredMatches.map((match) => {
                                const pointInfo = pointsData[match.id];
                                const teamAInfo = match.teamA.key ? allTeamData[match.teamA.key] : null;
                                const teamBInfo = match.teamB.key ? allTeamData[match.teamB.key] : null;
                                const totalScoreWinner = getTotalScoreWinner(match, settings);

                                const teamAColor = teamAInfo?.color || match.teamA.color || '#38bdf8';
                                const teamBColor = teamBInfo?.color || '#f87171';
                                const teamAEmblem = teamAInfo?.emblem || match.teamA.emblem;
                                const teamBEmblem = teamBInfo?.emblem || match.teamB.emblem;

                                const isAssessment = (match as MatchState & { isAssessment?: boolean }).isAssessment;
                                return (
                                <div
                                    key={match.id}
                                    className={`flex items-center justify-between p-3 rounded-md transition-all duration-200 ${selectedMatch?.id === match.id ? 'bg-[#00A3FF]/20 ring-2 ring-[#00A3FF]' : isAssessment ? 'bg-amber-900/30 border-2 border-amber-500/50 hover:bg-amber-900/40' : 'bg-slate-800 hover:bg-slate-700'}`}
                                >
                                    <div className="flex-grow cursor-pointer" onClick={() => setSelectedMatch(match)}>
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                            {matchHistoryTab === 'tournament' && (() => {
                                                const comp = getMatchCompetition(match);
                                                return comp ? <span className="inline-block text-xs font-medium bg-amber-600/80 text-amber-100 px-2 py-0.5 rounded">[{comp}]</span> : null;
                                            })()}
                                            {isAssessment && (
                                                <span className="inline-flex items-center gap-1 text-xs font-semibold bg-amber-500/30 text-amber-200 px-2 py-0.5 rounded border border-amber-500/50">
                                                    🎯 수행평가
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex justify-between items-center text-lg">
                                            <div className="flex items-center gap-2">
                                                <TeamEmblem emblem={teamAEmblem} color={teamAColor} className="w-10 h-10"/>
                                                <span className={`font-semibold ${totalScoreWinner === 'A' ? 'font-bold' : ''}`} style={{color: teamAColor}}>
                                                    {match.teamA.name} {pointInfo && <span className="text-yellow-400 text-sm">({t('record_points')}: {pointInfo.teamA}{t('record_point')})</span>}
                                                </span>
                                            </div>
                                            <span className="font-mono font-bold text-xl">{match.teamA.score} : {match.teamB.score}</span>
                                            <div className="flex items-center gap-2">
                                                <span className={`font-semibold text-right ${totalScoreWinner === 'B' ? 'font-bold' : ''}`} style={{color: teamBColor}}>
                                                    {match.teamB.name} {pointInfo && <span className="text-yellow-400 text-sm">({t('record_points')}: {pointInfo.teamB}{t('record_point')})</span>}
                                                </span>
                                                <TeamEmblem emblem={teamBEmblem} color={teamBColor} className="w-10 h-10"/>
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">
                                            <span className={`font-semibold ${match.status === 'in_progress' ? 'text-green-400 animate-pulse' : 'text-slate-500'}`}>
                                                {match.status === 'in_progress' ? t('record_in_progress') : t('record_completed')}
                                            </span>
                                            - {new Date(match.date).toLocaleString('ko-KR')}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                                        {match.status === 'in_progress' && (
                                            <button onClick={(e) => { e.stopPropagation(); onContinueGame(match); }} className="bg-green-600 hover:bg-green-500 text-white font-bold py-1 px-3 rounded-md text-sm transition" aria-label={`${match.teamA.name} vs ${match.teamB.name} 경기 이어하기`}>
                                                {t('record_continue_game')}
                                            </button>
                                        )}
                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(match.id); }} className="text-slate-500 hover:text-red-500 font-bold text-xl flex items-center justify-center w-6 h-6 rounded-full hover:bg-slate-700" aria-label={t('record_delete_record')}>&times;</button>
                                    </div>
                                </div>
                            )})
                        )}
                    </div>

                    <div className="flex justify-center items-center gap-4 py-4 mt-4 border-t border-slate-700 no-print">
                        <button onClick={handleCalculatePoints} className="bg-[#00A3FF] hover:bg-[#0082cc] text-white font-bold py-3 px-6 rounded-lg transition duration-200">
                            {t('record_check_points')}
                        </button>
                        <button onClick={handleCalculateRankings} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-6 rounded-lg transition duration-200">
                            {t('record_check_ranking')}
                        </button>
                    </div>
                    
                    {enrichedSelectedMatch ? (
                        <div className="space-y-6 pt-6 border-t border-slate-700 animate-fade-in printable-area">
                            {(enrichedSelectedMatch as EnrichedMatch & { isAssessment?: boolean }).isAssessment && (
                                <>
                                    <div className="rounded-xl overflow-hidden border-2 border-amber-500/60 bg-amber-600/90 no-print">
                                        <div className="px-5 py-4 flex items-center gap-3">
                                            <span className="text-2xl">🎯</span>
                                            <h2 className="text-xl font-bold text-amber-950">수행평가 매치</h2>
                                        </div>
                                    </div>
                                    {(() => {
                                        const match = enrichedSelectedMatch as EnrichedMatch & { hustlePlayers?: { id: string; name: string; team: 'A' | 'B' }[]; hustlePlayerIds?: string[] };
                                        const list = match.hustlePlayers?.length
                                            ? match.hustlePlayers
                                            : (match.hustlePlayerIds ?? []).map(pid => {
                                                const inA = match.teamA?.players?.[pid];
                                                const inB = match.teamB?.players?.[pid];
                                                const p = inA ?? inB;
                                                return { id: pid, name: p?.originalName ?? '선수', team: (inA ? 'A' : 'B') as 'A' | 'B' };
                                              });
                                        if (list.length === 0) return null;
                                        return (
                                            <div className="rounded-xl border-2 border-amber-500/40 bg-amber-900/30 p-4 no-print">
                                                <h3 className="text-sm font-bold text-amber-400 mb-2">🔥 오늘의 허슬 플레이어</h3>
                                                <p className="text-slate-200 font-medium">
                                                    {list.map((hp, i) => (
                                                        <span key={hp.id}>
                                                            {i > 0 && ', '}
                                                            <span className="text-amber-200">{hp.name}</span>
                                                            <span className="text-slate-500 text-sm ml-1">({hp.team === 'A' ? enrichedSelectedMatch.teamA.name : enrichedSelectedMatch.teamB.name})</span>
                                                        </span>
                                                    ))}
                                                </p>
                                            </div>
                                        );
                                    })()}
                                </>
                            )}
                             <div className="printable-header hidden print:flex">
                                <h1 className="printable-title">J-IVE 경기 분석 리포트</h1>
                                <div className="text-right">
                                    <p className="printable-subtitle">{enrichedSelectedMatch.teamA.name} vs {enrichedSelectedMatch.teamB.name}</p>
                                    <p className="printable-subtitle">{new Date(enrichedSelectedMatch.date).toLocaleString('ko-KR')}</p>
                                </div>
                            </div>
                            <div className="flex flex-col lg:flex-row items-center lg:justify-between mb-6 gap-4 no-print">
                                <h1 className={`text-3xl lg:text-4xl font-bold text-center lg:text-right ${(enrichedSelectedMatch as EnrichedMatch & { isAssessment?: boolean }).isAssessment ? 'text-amber-200' : 'text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400'}`}>
                                    {(enrichedSelectedMatch as EnrichedMatch & { isAssessment?: boolean }).isAssessment && '🎯 '}
                                    {t('record_detailed_analysis')}
                                </h1>
                                 <div className='flex items-center gap-2 self-start lg:self-auto'>
                                    {enrichedSelectedMatch.status === 'completed' && (
                                        <>
                                            <button 
                                                onClick={handleSaveAsImage}
                                                disabled={isGeneratingImage}
                                                className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-lg transition flex items-center gap-2 disabled:bg-slate-600"
                                            >
                                                <PhotoIcon className="w-5 h-5" />
                                                {isGeneratingImage ? t('record_generating_image') : t('record_save_as_image')}
                                            </button>
                                        </>
                                    )}
                                 </div>
                            </div>

                            {enrichedSelectedMatch.status === 'completed' && enrichedSelectedMatch.setScores && enrichedSelectedMatch.setScores.length > 0 && (
                                <div className="bg-slate-800/70 border border-slate-600 rounded-xl p-4 no-print">
                                    <h3 className="text-lg font-bold text-slate-200 mb-2 text-center">{t('record_final_result_banner')}</h3>
                                    <div className="flex flex-wrap items-center justify-center gap-3">
                                        <span className="text-2xl font-bold" style={{ color: enrichedSelectedMatch.teamA.color }}>{enrichedSelectedMatch.teamA.name}</span>
                                        <span className="text-slate-400">vs</span>
                                        <span className="text-2xl font-bold" style={{ color: enrichedSelectedMatch.teamB.color }}>{enrichedSelectedMatch.teamB.name}</span>
                                    </div>
                                    <div className="mt-2 text-center">
                                        {setDetailTab === 'all' && totalScoreFromSets && (
                                            <p className="text-xl font-mono font-bold text-[#00A3FF] mb-1">
                                                총점 {totalScoreFromSets.teamA} : {totalScoreFromSets.teamB}
                                            </p>
                                        )}
                                        <p className="text-xl font-mono text-slate-200">
                                            {enrichedSelectedMatch.setScores.map((s, i) => (
                                                <span key={i}>
                                                    {i > 0 && ' · '}
                                                    <span>{s.teamA}-{s.teamB}</span>
                                                </span>
                                            ))}
                                        </p>
                                        <p className="text-slate-400 text-sm mt-1">
                                            {(setDetailTab === 'all' && totalScoreFromSets
                                                ? totalScoreFromSets.teamA > totalScoreFromSets.teamB
                                                : enrichedSelectedMatch.teamA.score > enrichedSelectedMatch.teamB.score)
                                                ? `${t('record_final_winner_prefix')}: ${enrichedSelectedMatch.teamA.name}`
                                                : (setDetailTab === 'all' && totalScoreFromSets
                                                    ? totalScoreFromSets.teamB > totalScoreFromSets.teamA
                                                    : enrichedSelectedMatch.teamB.score > enrichedSelectedMatch.teamA.score)
                                                    ? `${t('record_final_winner_prefix')}: ${enrichedSelectedMatch.teamB.name}`
                                                    : t('record_final_result_tie')}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {appMode === 'CLUB' && enrichedSelectedMatch.status === 'completed' && enrichedSelectedMatch.setScores && enrichedSelectedMatch.setScores.length > 0 && (
                                <div className="flex flex-wrap gap-2 no-print">
                                    {enrichedSelectedMatch.setScores.map((_, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => setSetDetailTab(idx as 0 | 1 | 2)}
                                            className={`px-4 py-2 rounded-lg font-medium transition ${
                                                setDetailTab === idx ? 'bg-[#00A3FF] text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                            }`}
                                        >
                                            {idx + 1}{t('record_set_suffix')}
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => setSetDetailTab('all')}
                                        className={`px-4 py-2 rounded-lg font-medium transition ${
                                            setDetailTab === 'all' ? 'bg-[#00A3FF] text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                        }`}
                                    >
                                        {t('record_overview_tab') || '전체보기'}
                                    </button>
                                </div>
                            )}

                            {enrichedSelectedMatch.status === 'completed' && <GameSummaryPanel />}

                            {appMode === 'CLUB' && enrichedSelectedMatch.status === 'completed' && setDetailTab === 'all' && enrichedSelectedMatch.setScores?.length && (
                                <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-4 no-print">
                                    <h3 className="text-lg font-bold text-slate-200 mb-2">{t('record_overview_tab')} · 세트별 점수</h3>
                                    <p className="text-slate-300 font-mono">
                                        {enrichedSelectedMatch.setScores.map((s, i) => (
                                            <span key={i}>{i + 1}{t('record_set_suffix')} {s.teamA}:{s.teamB}{i < enrichedSelectedMatch.setScores!.length - 1 ? ' · ' : ''}</span>
                                        ))}
                                    </p>
                                    <p className="text-slate-400 text-sm mt-2">아래 팀 기록 비교 및 선수별 상세 기록에서 전체 누적 스탯을 확인할 수 있습니다.</p>
                                </div>
                            )}

                            {enrichedSelectedMatch.status === 'completed' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                                    <MvpCard mvp={mvp} />
                                    <div className="flex flex-col gap-6">
                                        <MatchLeadersCard leaders={matchLeaders} />
                                        {setDetailTab !== 'all' && enrichedSelectedMatch.setScores?.[setDetailTab as number] && (
                                            <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-3 text-center">
                                                <p className="text-slate-400 text-sm">{(setDetailTab as number) + 1}{t('record_set_suffix')} 스코어</p>
                                                <p className="text-xl font-mono font-bold text-slate-200">
                                                    {enrichedSelectedMatch.teamA.name} {enrichedSelectedMatch.setScores[setDetailTab as number].teamA} : {enrichedSelectedMatch.setScores[setDetailTab as number].teamB} {enrichedSelectedMatch.teamB.name}
                                                </p>
                                            </div>
                                        )}
                                        <Timeline events={displayTimelineEvents} />
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="bg-slate-800/50 p-4 rounded-lg print-bg-white">
                                    <h3 className="font-bold text-xl mb-3 text-center print-text-black">{t('record_main_stats_comparison')}</h3>
                                    <table className="w-full text-center">
                                        <thead><tr className="border-b-2 border-slate-600 text-slate-300 print-text-black"><th className="p-2 text-left">{t('record_stats_table_header')}</th><th className="p-2" style={{color: enrichedSelectedMatch.teamA.color}}>{enrichedSelectedMatch.teamA.name}</th><th className="p-2" style={{color: enrichedSelectedMatch.teamB.color}}>{enrichedSelectedMatch.teamB.name}</th></tr></thead>
                                        <tbody className="font-mono text-slate-200 print-text-black">
                                            <tr className="border-b border-slate-700"><td className="p-2 text-left font-sans text-slate-400 print-text-black">{t('record_final_score_label')}</td><td className="p-2 text-2xl font-bold">{setDetailTab === 'all' && totalScoreFromSets ? totalScoreFromSets.teamA : enrichedSelectedMatch.teamA.score}</td><td className="p-2 text-2xl font-bold">{setDetailTab === 'all' && totalScoreFromSets ? totalScoreFromSets.teamB : enrichedSelectedMatch.teamB.score}</td></tr>
                                            <tr className="border-b border-slate-700"><td className="p-2 text-left font-sans text-slate-400 print-text-black">{t('record_serve_ace_label')}</td><td>{enrichedSelectedMatch.teamA.serviceAces}</td><td>{enrichedSelectedMatch.teamB.serviceAces}</td></tr>
                                            <tr className="border-b border-slate-700"><td className="p-2 text-left font-sans text-slate-400 print-text-black">{t('record_serve_fault_label')}</td><td>{enrichedSelectedMatch.teamA.serviceFaults}</td><td>{enrichedSelectedMatch.teamB.serviceFaults}</td></tr>
                                            <tr className="border-b border-slate-700"><td className="p-2 text-left font-sans text-slate-400 print-text-black">{t('record_blocking_label')}</td><td>{enrichedSelectedMatch.teamA.blockingPoints}</td><td>{enrichedSelectedMatch.teamB.blockingPoints}</td></tr>
                                            <tr className="border-b border-slate-700"><td className="p-2 text-left font-sans text-slate-400 print-text-black">{t('record_spike_label')}</td><td>{enrichedSelectedMatch.teamA.spikeSuccesses}</td><td>{enrichedSelectedMatch.teamB.spikeSuccesses}</td></tr>
                                            {appMode !== 'CLUB' && (
                                                <>
                                                    <tr className="border-b border-slate-700"><td className="p-2 text-left font-sans text-slate-400 print-text-black">{t('record_3hit_label')}</td><td>{enrichedSelectedMatch.teamA.threeHitPlays}</td><td>{enrichedSelectedMatch.teamB.threeHitPlays}</td></tr>
                                                    <tr className="border-b border-slate-700"><td className="p-2 text-left font-sans text-slate-400 print-text-black">{t('record_fairplay_label')}</td><td>{enrichedSelectedMatch.teamA.fairPlay}</td><td>{enrichedSelectedMatch.teamB.fairPlay}</td></tr>
                                                </>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="bg-slate-800/50 p-4 rounded-lg min-h-[300px] print-bg-white">
                                    <div className="flex justify-between items-center mb-2 no-print">
                                        <h3 className="font-bold text-xl text-center">{t('record_team_stats_graph')}</h3>
                                        <button
                                            onClick={() => setShowScoreTrend(prev => !prev)}
                                            className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-1 px-3 rounded-lg text-sm transition duration-200"
                                        >
                                            {showScoreTrend ? t('record_close_trend') : t('record_score_trend_label')}
                                        </button>
                                     </div>
                                    {showScoreTrend ? (
                                        <div className="animate-fade-in h-[250px]">
                                            <ScoreTrendChart match={enrichedSelectedMatch} t={t} />
                                        </div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height={250}>
                                            <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                                <XAxis dataKey="name" tick={{ fill: '#94a3b8' }} interval={0} />
                                                <YAxis tick={{ fill: '#94a3b8' }} allowDecimals={false} />
                                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                                                <Legend />
                                                <Bar dataKey={enrichedSelectedMatch.teamA.name} fill={enrichedSelectedMatch.teamA.color} />
                                                <Bar dataKey={enrichedSelectedMatch.teamB.name} fill={enrichedSelectedMatch.teamB.color} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </div>
                            <div className="pt-6 border-t border-slate-700">
                                <div className="flex items-baseline gap-x-3 mb-4">
                                    <h3 className="text-2xl font-bold text-slate-300 print-text-black">{t('record_detailed_player_stats')}</h3>
                                    <p className="text-sm text-slate-400 no-print">{t('record_player_history_guide')}</p>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <PlayerStatsTable 
                                        teamMatchState={enrichedSelectedMatch.teamA} 
                                        onPlayerClick={calculatePlayerHistory} 
                                        teamSet={findTeamSetForMatchTeam(enrichedSelectedMatch.teamA.key)}
                                        t={t}
                                    />
                                    <PlayerStatsTable 
                                        teamMatchState={enrichedSelectedMatch.teamB} 
                                        onPlayerClick={calculatePlayerHistory}
                                        teamSet={findTeamSetForMatchTeam(enrichedSelectedMatch.teamB.key)}
                                        t={t}
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        filteredMatches.length > 0 && (
                            <div className="text-center p-6 bg-slate-800/50 border border-slate-700 rounded-lg animate-fade-in mt-4 no-print">
                                <h3 className="text-lg font-bold text-sky-400 mb-3">{t('record_guide_title')}</h3>
                                <p className="text-slate-300">
                                    {t('record_guide_desc1')}
                                </p>
                                <p className="text-slate-400 mt-2 text-sm">
                                    {t('record_guide_desc2')}
                                </p>
                            </div>
                        )
                    )}
                </div>
            </div>
        </>
    );
};

export default RecordScreen;