import React, { useState, useMemo, useCallback } from 'react';
import { MatchState, TeamMatchState, PlayerStats, Player, TeamSet, EnrichedMatch, MvpResult, AppSettings, ScoreEventType } from '../types';
import { useData } from '../contexts/DataContext';
import { CrownIcon, TrophyIcon, FireIcon, MedalIcon, TargetIcon, WallIcon, ShieldIcon, BoltIcon, HandshakeIcon, LinkIcon, StopwatchIcon, VolleyballIcon } from './icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import TeamEmblem from './TeamEmblem';
import { useTranslation } from '../hooks/useTranslation';

interface MatchDetailAnalysisProps {
    matchData: MatchState & { date?: string; time?: number };
    teamSets: TeamSet[];
    settings: AppSettings;
    t: (key: string) => string;
}

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

const MatchDetailAnalysis: React.FC<MatchDetailAnalysisProps> = ({ matchData, teamSets, settings, t }) => {
    // 데이터 검증: 필수 필드가 없으면 로딩 화면 표시
    if (!matchData || !matchData.teamA || !matchData.teamB) {
        return (
            <div className="text-center text-slate-400 py-12">
                <p>경기 데이터를 불러올 수 없습니다.</p>
            </div>
        );
    }

    if (!matchData.teamA.players || !matchData.teamB.players || 
        !matchData.teamA.playerStats || !matchData.teamB.playerStats) {
        return (
            <div className="text-center text-slate-400 py-12">
                <p>선수 데이터를 불러올 수 없습니다.</p>
            </div>
        );
    }

    // settings가 없으면 기본값 사용
    const safeSettings = settings || { winningScore: 25, includeBonusPointsInWinner: false };

    const [showScoreTrend, setShowScoreTrend] = useState(false);

    // MatchData를 EnrichedMatch 형태로 변환
    const enrichedMatch: EnrichedMatch = useMemo(() => {
        return {
            ...matchData,
            id: (matchData as { id?: string }).id || `match-${Date.now()}`,
            status: matchData.status || 'completed',
            date: matchData.date || new Date().toISOString(),
            time: matchData.time,
        };
    }, [matchData]);

    const findTeamSetForMatchTeam = useCallback((teamKey: string | undefined) => {
        if (!teamKey) return undefined;
        const [setId] = teamKey.split('___');
        return teamSets.find(s => s.id === setId);
    }, [teamSets]);

    // MVP 계산 (리그/토너먼트 전용 가중치)
    const mvp: MvpResult = useMemo(() => {
        const calculateMvp = (match: EnrichedMatch): MvpResult => {
            let bestPlayer: { player: Player, team: TeamMatchState, stats: PlayerStats, mvpScore: number, scoreBreakdown: Record<string, number> } | null = null;
            const processTeam = (teamState: TeamMatchState) => {
                if (!teamState.players || !teamState.playerStats) return;
                for (const playerId of Object.keys(teamState.players)) {
                    const player = teamState.players[playerId];
                    const stats = teamState.playerStats[playerId];
                    if (player && stats) {
                        // 리그/토너먼트 전용 커스텀 가중치
                        const scoreBreakdown = {
                            points: (stats.points || 0) * 1.0,           // 공격/스파이크 득점: +1.0
                            aces: (stats.serviceAces || 0) * 2.0,       // 서브 에이스: +2.0
                            blocks: (stats.blockingPoints || 0) * 1.5,  // 블로킹 득점: +1.5
                            faults: -(stats.serviceFaults || 0) * 1.0,  // 범실: -1.0
                            digs: (stats.digs || 0) * 0.5,              // 디그: +0.5
                            assists: (stats.assists || 0) * 0.5,        // 어시스트: +0.5
                            serveIn: (stats.serveIn || 0) * 0.1,        // 일반 서브 성공(In): +0.1
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
        return calculateMvp(enrichedMatch);
    }, [enrichedMatch]);

    // 타임라인 생성
    const timelineEvents: TimelineEvent[] = useMemo(() => {
        const events: TimelineEvent[] = [];
        
        if (enrichedMatch.eventHistory && enrichedMatch.eventHistory.length > 0) {
            enrichedMatch.eventHistory.forEach(event => {
                events.push({
                    type: event.type || 'LOG',
                    team: null,
                    description: event.descriptionKey,
                    score: `${event.score.a}:${event.score.b}`
                });
            });
            return events.reverse();
        }

        if (!enrichedMatch.scoreHistory || enrichedMatch.scoreHistory.length < 2) return [];

        for (let i = 1; i < enrichedMatch.scoreHistory.length; i++) {
            const curr = enrichedMatch.scoreHistory[i];
            const scoreStr = `${curr.a}:${curr.b}`;
            events.push({ type: 'LOG', team: null, description: `점수 변경`, score: scoreStr });
        }

        return events.reverse();
    }, [enrichedMatch]);

    // 경기 리더 계산
    const matchLeaders: MatchLeaders = useMemo(() => {
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
    
        addPlayersFromTeam(enrichedMatch.teamA);
        addPlayersFromTeam(enrichedMatch.teamB);
    
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
    }, [enrichedMatch]);

    // 차트 데이터
    const chartData = useMemo(() => {
        return [
            { name: t('stat_display_serve_ace'), [enrichedMatch.teamA.name]: enrichedMatch.teamA.serviceAces, [enrichedMatch.teamB.name]: enrichedMatch.teamB.serviceAces },
            { name: t('stat_display_spike_success'), [enrichedMatch.teamA.name]: enrichedMatch.teamA.spikeSuccesses, [enrichedMatch.teamB.name]: enrichedMatch.teamB.spikeSuccesses },
            { name: t('stat_display_blocking'), [enrichedMatch.teamA.name]: enrichedMatch.teamA.blockingPoints, [enrichedMatch.teamB.name]: enrichedMatch.teamB.blockingPoints },
            { name: t('stat_display_serve_fault'), [enrichedMatch.teamA.name]: enrichedMatch.teamA.serviceFaults, [enrichedMatch.teamB.name]: enrichedMatch.teamB.serviceFaults },
            { name: t('stat_display_digs'), [enrichedMatch.teamA.name]: Object.values(enrichedMatch.teamA.playerStats || {}).reduce((acc, p: any) => acc + (p.digs || 0), 0), [enrichedMatch.teamB.name]: Object.values(enrichedMatch.teamB.playerStats || {}).reduce((acc, p: any) => acc + (p.digs || 0), 0) },
            { name: t('stat_display_assists'), [enrichedMatch.teamA.name]: Object.values(enrichedMatch.teamA.playerStats || {}).reduce((acc, p: any) => acc + (p.assists || 0), 0), [enrichedMatch.teamB.name]: Object.values(enrichedMatch.teamB.playerStats || {}).reduce((acc, p: any) => acc + (p.assists || 0), 0) },
        ];
    }, [enrichedMatch, t]);

    // GameSummaryPanel
    const GameSummaryPanel = () => {
        const { teamA, teamB } = enrichedMatch;
        const finalScoreA = safeSettings.includeBonusPointsInWinner ? teamA.score + teamA.fairPlay + teamA.threeHitPlays : teamA.score;
        const finalScoreB = safeSettings.includeBonusPointsInWinner ? teamB.score + teamB.fairPlay + teamB.threeHitPlays : teamB.score;
        
        let winnerMessage;
        if (finalScoreA > finalScoreB) {
            winnerMessage = `${t('record_final_winner_prefix')}: ${teamA.name}!`;
        } else if (finalScoreB > finalScoreA) {
            winnerMessage = `${t('record_final_winner_prefix')}: ${teamB.name}!`;
        } else {
            winnerMessage = t('record_final_result_tie');
        }

        return (
            <div className="bg-[#00A3FF]/10 border border-[#00A3FF] p-6 rounded-lg space-y-4">
                <div className="text-center">
                    <h3 className="text-3xl font-bold text-[#00A3FF]">{winnerMessage}</h3>
                    <div className="text-xl mt-1 flex flex-col gap-1">
                        <p>
                            <span className="font-bold">{(t as (key: string, opts?: Record<string, string | number>) => string)('record_score_breakdown_format', { 
                                teamName: teamA.name, 
                                totalScore: finalScoreA, 
                                breakdown: `${(t as (k: string) => string)('record_score_part_match')} ${teamA.score} + ${(t as (k: string) => string)('record_score_part_fairplay')} ${teamA.fairPlay} + ${(t as (k: string) => string)('record_score_part_3hit')} ${teamA.threeHitPlays}` 
                            })}</span>
                        </p>
                        <p>
                            <span className="font-bold">{(t as (key: string, opts?: Record<string, string | number>) => string)('record_score_breakdown_format', { 
                                teamName: teamB.name, 
                                totalScore: finalScoreB, 
                                breakdown: `${(t as (k: string) => string)('record_score_part_match')} ${teamB.score} + ${(t as (k: string) => string)('record_score_part_fairplay')} ${teamB.fairPlay} + ${(t as (k: string) => string)('record_score_part_3hit')} ${teamB.threeHitPlays}` 
                            })}</span>
                        </p>
                    </div>
                    {safeSettings.includeBonusPointsInWinner && (
                        <p className="text-sm text-slate-400 mt-1">{t('record_score_breakdown_guide')}</p>
                    )}
                </div>
            </div>
        );
    };

    // MvpCard
    const MvpCard: React.FC<{ mvp: MvpResult }> = ({ mvp }) => {
        if (!mvp) {
            return (
                <div className="bg-slate-800/50 p-4 rounded-lg text-center text-slate-500 h-full flex items-center justify-center">
                    {t('record_mvp_no_data')}
                </div>
            );
        }

        const { player, team, stats, mvpScore, scoreBreakdown } = mvp;

        return (
            <div className="bg-gradient-to-br from-yellow-800/30 via-slate-900/50 to-slate-900/50 p-6 rounded-lg border-2 border-yellow-400/80 shadow-2xl shadow-yellow-500/10 flex flex-col items-center justify-center text-center">
                <div className="flex items-center gap-3">
                    <CrownIcon className="w-8 h-8 text-yellow-300" />
                    <h3 className="text-2xl font-bold text-yellow-300 tracking-widest">{t('record_mvp_title')}</h3>
                </div>
                
                <p className="text-5xl font-black text-white my-4 drop-shadow-lg">{player.originalName}</p>
                <div className="flex items-center gap-2 text-base font-semibold text-slate-300 bg-slate-700/50 px-4 py-1 rounded-full mb-6">
                    <TeamEmblem emblem={team.emblem} color={team.color} className="w-5 h-5" />
                    <span className="text-white">{team.name}</span>
                </div>

                <div className="w-full max-w-sm grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-800 p-2 rounded-lg">
                        <p className="text-sm font-bold text-slate-400">{t('record_mvp_total_points')}</p>
                        <p className="text-3xl font-black text-sky-300">{stats.points}</p>
                    </div>
                    <div className="bg-slate-800 p-2 rounded-lg">
                        <p className="text-sm font-bold text-slate-400">{t('record_mvp_serve_ace')}</p>
                        <p className="text-3xl font-black text-sky-300">{stats.serviceAces}</p>
                    </div>
                    <div className="bg-slate-800 p-2 rounded-lg">
                        <p className="text-sm font-bold text-slate-400">{t('record_mvp_spike')}</p>
                        <p className="text-3xl font-black text-sky-300">{stats.spikeSuccesses}</p>
                    </div>
                    <div className="bg-slate-800 p-2 rounded-lg">
                        <p className="text-sm font-bold text-slate-400">{t('record_mvp_blocking')}</p>
                        <p className="text-3xl font-black text-sky-300">{stats.blockingPoints}</p>
                    </div>
                    <div className="bg-slate-800 p-2 rounded-lg">
                        <p className="text-sm font-bold text-slate-400">{t('stat_display_digs')}</p>
                        <p className="text-3xl font-black text-sky-300">{stats.digs || 0}</p>
                    </div>
                    <div className="bg-slate-800 p-2 rounded-lg">
                        <p className="text-sm font-bold text-slate-400">{t('stat_display_assists')}</p>
                        <p className="text-3xl font-black text-sky-300">{stats.assists || 0}</p>
                    </div>
                </div>

                <div className="mt-6 pt-4 border-t border-yellow-400/20 w-full max-w-sm">
                    <p className="font-bold text-lg text-yellow-300">{(t as (key: string, opts?: Record<string, string | number>) => string)('record_mvp_score', { score: mvpScore.toFixed(1) })}</p>
                    
                    <div className="mt-6 p-5 bg-slate-800/80 rounded-xl text-sm text-slate-300 text-left space-y-2 shadow-inner border border-slate-700">
                        <p className="font-bold text-sky-400 mb-3 text-lg border-b border-slate-600 pb-2">리그/토너먼트 MVP 산정 기준</p>
                        <p className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-sky-500 rounded-full"></span>공격/스파이크 득점: +1.0점</p>
                        <p className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-sky-500 rounded-full"></span>서브 에이스: +2.0점</p>
                        <p className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-sky-500 rounded-full"></span>블로킹 득점: +1.5점</p>
                        <p className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-sky-500 rounded-full"></span>일반 서브 성공(In): +0.1점</p>
                        <p className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-sky-500 rounded-full"></span>디그/어시스트: +0.5점</p>
                        <p className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>범실: -1.0점</p>
                    </div>
                </div>
            </div>
        );
    };

    // MatchLeadersCard
    const MatchLeadersCard: React.FC<{ leaders: MatchLeaders | null }> = ({ leaders }) => {
        if (!leaders) return null;

        const LeaderItem: React.FC<{ icon: React.ReactNode; title: string; leaders: { player: Player; value: number }[] }> = ({ icon, title, leaders }) => {
            if (leaders.length === 0) return null;
            return (
                <div className="bg-slate-800 p-4 rounded-lg flex items-start gap-4">
                    <div className="flex-shrink-0 text-yellow-400 mt-1">{icon}</div>
                    <div className="flex-grow">
                        <p className="text-sm text-slate-400">{title}</p>
                        {leaders.map(({player, value}) => (
                            <p key={player.id} className="text-lg font-bold text-white">{player.originalName} ({value})</p>
                        ))}
                    </div>
                </div>
            );
        };

        return (
            <div className="bg-slate-800/50 p-4 rounded-lg">
                <h3 className="text-xl font-bold text-slate-300 mb-4 text-center">{t('record_leaders_title')}</h3>
                <div className="space-y-3">
                    <LeaderItem icon={<MedalIcon className="w-8 h-8"/>} title={t('record_leaders_points')} leaders={leaders.points} />
                    <LeaderItem icon={<MedalIcon className="w-8 h-8"/>} title={t('record_leaders_serve')} leaders={leaders.serviceAces} />
                    <LeaderItem icon={<MedalIcon className="w-8 h-8"/>} title={t('record_leaders_blocking')} leaders={leaders.blockingPoints} />
                </div>
            </div>
        );
    };

    // Timeline
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
            <div className="bg-slate-900/50 border-2 border-slate-700 p-4 rounded-lg h-96 overflow-y-auto">
                <h3 className="text-xl font-bold text-slate-300 mb-4 text-center">{t('record_timeline_title')}</h3>
                <div className="space-y-2 px-1">
                    {events.map((event, index) => (
                        <div key={index} className={`flex items-center gap-4 p-3 rounded-xl border ${getEventStyles(event.type)} transition-all hover:brightness-110`}>
                            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-900 border border-slate-700 shadow-sm flex-shrink-0">
                                {getEventIcon(event.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-slate-200 font-bold text-base truncate">{event.description}</p>
                                <p className="text-slate-500 text-xs font-mono mt-0.5">스코어 {event.score}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // PlayerStatsTable (간단 버전)
    const PlayerStatsTable: React.FC<{ 
        teamMatchState: TeamMatchState; 
        teamSet: TeamSet | undefined;
        t: (key: string) => string;
    }> = ({ teamMatchState, teamSet, t }) => {
        const { players: participatingPlayers, playerStats } = teamMatchState;

        const fullRoster = useMemo(() => {
            const teamInfo = teamSet?.teams.find(t => t.teamName === teamMatchState.name);
            if (!teamSet || !teamInfo) {
                return Object.values(participatingPlayers || {});
            }
            return teamInfo.playerIds.map(id => teamSet.players[id]).filter(Boolean);
        }, [teamSet, teamMatchState.name, participatingPlayers]);

        if (fullRoster.length === 0) {
            return (
                <div className="bg-slate-900/50 p-8 rounded-2xl border border-slate-700 flex flex-col items-center justify-center text-center">
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
            <div className="flex flex-col rounded-2xl overflow-hidden border border-slate-700 shadow-xl bg-slate-900/60 backdrop-blur-md">
                <div className="relative p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700 overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1.5 h-full transition-all duration-500 group-hover:w-2" style={{ backgroundColor: teamMatchState.color }}></div>
                    <div className="flex items-center gap-5 relative z-10">
                        <TeamEmblem emblem={teamMatchState.emblem} color={teamMatchState.color} className="w-12 h-12" />
                        <h4 className="font-bold text-xl text-white">{teamMatchState.name}</h4>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-800/80 border-b border-slate-700">
                                <th className="p-3 text-left text-slate-300 font-semibold">{t('record_player_name')}</th>
                                {statOrder.map(stat => (
                                    <th key={stat} className="p-3 text-center text-slate-300 font-semibold">{statHeaderNames[stat]}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {fullRoster.map(player => {
                                const stats = playerStats?.[player.id] || {} as PlayerStats;
                                return (
                                    <tr key={player.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                        <td className="p-3 font-semibold text-slate-200">{player.originalName}</td>
                                        {statOrder.map(stat => (
                                            <td key={stat} className="p-3 text-center text-slate-300 font-mono">{stats[stat] || 0}</td>
                                        ))}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    // ScoreTrendChart (간단 버전)
    const ScoreTrendChart: React.FC<{ match: EnrichedMatch, t: (key: string) => string }> = ({ match, t }) => {
        if (!match.scoreHistory || match.scoreHistory.length === 0) {
            return <div className="text-center text-slate-400 py-8">{t('record_no_score_history')}</div>;
        }

        const chartData = match.scoreHistory.map((score, index) => ({
            point: index + 1,
            [match.teamA.name]: score.a,
            [match.teamB.name]: score.b,
        }));

        return (
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="point" tick={{ fill: '#94a3b8' }} />
                    <YAxis tick={{ fill: '#94a3b8' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                    <Legend />
                    <Line type="monotone" dataKey={match.teamA.name} stroke={match.teamA.color || '#3b82f6'} strokeWidth={2} />
                    <Line type="monotone" dataKey={match.teamB.name} stroke={match.teamB.color || '#10b981'} strokeWidth={2} />
                </LineChart>
            </ResponsiveContainer>
        );
    };

    if (!matchData || !matchData.teamA || !matchData.teamB) {
        return <div className="text-center text-slate-400 py-8">경기 데이터가 없습니다.</div>;
    }

    // 데이터 검증
    if (!matchData.teamA.name || !matchData.teamB.name) {
        return <div className="text-center text-slate-400 py-8">경기 데이터가 불완전합니다.</div>;
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {enrichedMatch.status === 'completed' && <GameSummaryPanel />}

            {enrichedMatch.status === 'completed' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    <MvpCard mvp={mvp} />
                    <div className="flex flex-col gap-6">
                        <MatchLeadersCard leaders={matchLeaders} />
                        <Timeline events={timelineEvents} />
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-800/50 p-4 rounded-lg">
                    <h3 className="font-bold text-xl mb-3 text-center text-slate-300">{t('record_main_stats_comparison')}</h3>
                    <table className="w-full text-center">
                        <thead>
                            <tr className="border-b-2 border-slate-600 text-slate-300">
                                <th className="p-2 text-left">{t('record_stats_table_header')}</th>
                                <th className="p-2" style={{color: enrichedMatch.teamA.color}}>{enrichedMatch.teamA.name}</th>
                                <th className="p-2" style={{color: enrichedMatch.teamB.color}}>{enrichedMatch.teamB.name}</th>
                            </tr>
                        </thead>
                        <tbody className="font-mono text-slate-200">
                            <tr className="border-b border-slate-700">
                                <td className="p-2 text-left font-sans text-slate-400">{t('record_final_score_label')}</td>
                                <td className="p-2 text-2xl font-bold">{enrichedMatch.teamA.score}</td>
                                <td className="p-2 text-2xl font-bold">{enrichedMatch.teamB.score}</td>
                            </tr>
                            <tr className="border-b border-slate-700">
                                <td className="p-2 text-left font-sans text-slate-400">{t('record_serve_ace_label')}</td>
                                <td>{enrichedMatch.teamA.serviceAces}</td>
                                <td>{enrichedMatch.teamB.serviceAces}</td>
                            </tr>
                            <tr className="border-b border-slate-700">
                                <td className="p-2 text-left font-sans text-slate-400">{t('record_serve_fault_label')}</td>
                                <td>{enrichedMatch.teamA.serviceFaults}</td>
                                <td>{enrichedMatch.teamB.serviceFaults}</td>
                            </tr>
                            <tr className="border-b border-slate-700">
                                <td className="p-2 text-left font-sans text-slate-400">{t('record_blocking_label')}</td>
                                <td>{enrichedMatch.teamA.blockingPoints}</td>
                                <td>{enrichedMatch.teamB.blockingPoints}</td>
                            </tr>
                            <tr className="border-b border-slate-700">
                                <td className="p-2 text-left font-sans text-slate-400">{t('record_spike_label')}</td>
                                <td>{enrichedMatch.teamA.spikeSuccesses}</td>
                                <td>{enrichedMatch.teamB.spikeSuccesses}</td>
                            </tr>
                            <tr className="border-b border-slate-700">
                                <td className="p-2 text-left font-sans text-slate-400">{t('record_3hit_label')}</td>
                                <td>{enrichedMatch.teamA.threeHitPlays}</td>
                                <td>{enrichedMatch.teamB.threeHitPlays}</td>
                            </tr>
                            <tr className="border-b border-slate-700">
                                <td className="p-2 text-left font-sans text-slate-400">{t('record_fairplay_label')}</td>
                                <td>{enrichedMatch.teamA.fairPlay}</td>
                                <td>{enrichedMatch.teamB.fairPlay}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-lg min-h-[300px]">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-bold text-xl text-center text-slate-300">{t('record_team_stats_graph')}</h3>
                        <button
                            onClick={() => setShowScoreTrend(prev => !prev)}
                            className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-1 px-3 rounded-lg text-sm transition duration-200"
                        >
                            {showScoreTrend ? t('record_close_trend') : t('record_score_trend_label')}
                        </button>
                    </div>
                    {showScoreTrend ? (
                        <div className="animate-fade-in h-[250px]">
                            <ScoreTrendChart match={enrichedMatch} t={t} />
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="name" tick={{ fill: '#94a3b8' }} interval={0} />
                                <YAxis tick={{ fill: '#94a3b8' }} allowDecimals={false} />
                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                                <Legend />
                                <Bar dataKey={enrichedMatch.teamA.name} fill={enrichedMatch.teamA.color} />
                                <Bar dataKey={enrichedMatch.teamB.name} fill={enrichedMatch.teamB.color} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>
            <div className="pt-6 border-t border-slate-700">
                <div className="flex items-baseline gap-x-3 mb-4">
                    <h3 className="text-2xl font-bold text-slate-300">{t('record_detailed_player_stats')}</h3>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <PlayerStatsTable 
                        teamMatchState={enrichedMatch.teamA} 
                        teamSet={findTeamSetForMatchTeam(enrichedMatch.teamA.key)}
                        t={t}
                    />
                    <PlayerStatsTable 
                        teamMatchState={enrichedMatch.teamB} 
                        teamSet={findTeamSetForMatchTeam(enrichedMatch.teamB.key)}
                        t={t}
                    />
                </div>
            </div>
        </div>
    );
};

export default MatchDetailAnalysis;

