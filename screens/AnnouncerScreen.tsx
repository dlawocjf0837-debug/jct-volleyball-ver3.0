import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { Player, MatchState, TeamSet } from '../types';
import StatModal from '../components/StatModal';
import { CrownIcon, QuestionMarkCircleIcon, VolleyballIcon } from '../components/icons';
import CommentaryGuideModal from '../components/CommentaryGuideModal';
import { LiveChatOverlay } from '../components/LiveChatOverlay';
import GameLog from '../components/GameLog';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import TeamEmblem from '../components/TeamEmblem';
import { useTranslation } from '../hooks/useTranslation';

interface AnnouncerScreenProps {
    onNavigateToHistory: () => void;
    pendingJoinCode?: string | null;
    clearPendingJoinCode?: () => void;
    /** CLASS = 수업 모드(응원가 패널 표시), CLUB = 스포츠클럽 모드(응원가 오디오 숨김) */
    appMode?: 'CLASS' | 'CLUB';
}

// Helper function to convert GitHub URLs to jsDelivr CDN URLs
const convertGithubUrl = (url: string | undefined): string | undefined => {
    if (!url) return undefined;
    if (url.includes('cdn.jsdelivr.net/gh/')) return url;

    // Pattern for raw.githubusercontent.com
    const rawPattern = /https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)/;
    let match = url.match(rawPattern);
    if (match) {
        const [, user, repo, branch, path] = match;
        return `https://cdn.jsdelivr.net/gh/${user}/${repo}@${branch}/${path}`;
    }

    // Pattern for github.com/.../blob/...
    const blobPattern = /https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)/;
    match = url.match(blobPattern);
    if (match) {
        const [, user, repo, branch, path] = match;
        return `https://cdn.jsdelivr.net/gh/${user}/${repo}@${branch}/${path}`;
    }
    
    // Pattern for github.com/.../raw/...
    const rawRedirectPattern = /https:\/\/github\.com\/([^/]+)\/([^/]+)\/raw\/(.+)/;
    match = url.match(rawRedirectPattern);
    if (match) {
        const [, user, repo, fullPath] = match;
        const parts = fullPath.split('/');
        
        let branch = '';
        let path = '';

        // Handle full refs like refs/heads/main
        if (parts.length >= 3 && parts[0] === 'refs' && parts[1] === 'heads') {
            branch = parts[2];
            path = parts.slice(3).join('/');
        } else {
            branch = parts[0];
            path = parts.slice(1).join('/');
        }
        
        if (branch) {
             return `https://cdn.jsdelivr.net/gh/${user}/${repo}@${branch}/${path}`;
        }
    }

    return url;
};


const SoundPanel: React.FC<{ match: MatchState | null }> = ({ match }) => {
    const { teamSets } = useData();
    const { t } = useTranslation();
    const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
    const [playingSound, setPlayingSound] = useState<string | null>(null);
    const [showCheerSongs, setShowCheerSongs] = useState(false);
    const [selectedClassTab, setSelectedClassTab] = useState<string | null>(null);
    const [teamCountFilter, setTeamCountFilter] = useState('all');

    const availableTeamCounts = useMemo(() => {
        const counts = new Set<number>();
        teamSets.forEach(set => {
            counts.add(set.teamCount ?? 4);
        });
        const validCounts = Array.from(counts).filter(c => c > 0);
        return validCounts.sort((a, b) => a - b).map(String);
    }, [teamSets]);

    const filteredTeamSets = useMemo(() => {
        if (teamCountFilter === 'all') {
            return teamSets;
        }
        const count = parseInt(teamCountFilter, 10);
        return teamSets.filter(set => (set.teamCount ?? 4) === count);
    }, [teamSets, teamCountFilter]);

    const groupedCheerSongs = useMemo(() => {
        const groups: Record<string, { key: string; name: string; url: string, color: string }[]> = {};
        const addedUrls = new Set<string>();

        filteredTeamSets.forEach(set => {
            const className = set.className || t('cheer_song_etc_class');
            if (!groups[className]) {
                groups[className] = [];
            }

            set.teams.forEach(team => {
                if (team.cheerUrl && !addedUrls.has(team.cheerUrl)) {
                    groups[className].push({ key: `cheer_${set.id}_${team.teamName}_1`, name: t('cheer_song_team_song_format', { teamName: team.teamName, number: 1 }), url: team.cheerUrl, color: team.color || '#64748b' });
                    addedUrls.add(team.cheerUrl);
                }
                if (team.cheerUrl2 && !addedUrls.has(team.cheerUrl2)) {
                    groups[className].push({ key: `cheer_${set.id}_${team.teamName}_2`, name: `${team.teamName} ${team.cheerName2 || t('cheer_song_team_song_format_no_name', { number: 2 })}`, url: team.cheerUrl2, color: team.color || '#64748b' });
                    addedUrls.add(team.cheerUrl2);
                }
            });
        });
    
        return Object.entries(groups)
            .filter(([, songs]) => songs.length > 0)
            .sort(([classA], [classB]) => classA.localeCompare(classB));
    }, [filteredTeamSets, t]);

    const staticSounds = useMemo(() => [
        { key: 'bgm1', name: t('cheer_song_start1'), playingName: t('cheer_song_stop_music'), color: 'bg-blue-600 hover:bg-blue-500', url: "https://cdn.jsdelivr.net/gh/dlawocjf0837-debug/Volleyball-sounds@main/start.wav" },
        { key: 'bgm2', name: t('cheer_song_start2'), playingName: t('cheer_song_stop_music'), color: 'bg-blue-600 hover:bg-blue-500', url: "https://cdn.jsdelivr.net/gh/dlawocjf0837-debug/Volleyball-sounds@main/start2.mp3" },
        { key: 'timeout', name: t('cheer_song_timeout'), playingName: t('cheer_song_stop_music'), color: 'bg-green-600 hover:bg-green-500', url: "https://cdn.jsdelivr.net/gh/dlawocjf0837-debug/Volleyball-sounds@main/Timsong.mp3" },
        { key: 'cheer_effect', name: t('cheer_song_cheer'), playingName: t('cheer_song_stop_music'), color: 'bg-yellow-600 hover:bg-yellow-500', url: "https://cdn.jsdelivr.net/gh/dlawocjf0837-debug/Volleyball-sounds@main/crowd-cheering-379666.mp3" },
        { key: 'end', name: t('cheer_song_end'), playingName: t('cheer_song_stop_music'), color: 'bg-red-600 hover:bg-red-500', url: "https://cdn.jsdelivr.net/gh/dlawocjf0837-debug/Volleyball-sounds@main/end.wav" },
    ], [t]);
    
    const allSongs = useMemo(() => [...staticSounds, ...groupedCheerSongs.flatMap(([, songs]) => songs)], [groupedCheerSongs, staticSounds]);

    const handleSetTeamCountFilter = (filter: string) => {
        setTeamCountFilter(filter);
        setSelectedClassTab(null);
    };

    const handleToggleCheerSongSection = () => {
        if (showCheerSongs) {
            setSelectedClassTab(null);
            setTeamCountFilter('all');
        }
        setShowCheerSongs(!showCheerSongs);
    };

    const handleSoundToggle = useCallback((soundKey: string) => {
        Object.keys(audioRefs.current).forEach(key => {
            const audioEl = audioRefs.current[key];
            if (key !== soundKey && audioEl && !audioEl.paused) {
                audioEl.pause();
                audioEl.currentTime = 0;
            }
        });

        const audioToToggle = audioRefs.current[soundKey];
        if (!audioToToggle) return;
        
        if (playingSound === soundKey) {
            audioToToggle.pause();
            audioToToggle.currentTime = 0;
            setPlayingSound(null);
        } else {
            const isOneShot = ['cheer_effect', 'end'].includes(soundKey);
            audioToToggle.loop = !isOneShot;
            audioToToggle.play().catch(error => {
                if (error.name !== 'AbortError') {
                    console.error(`Audio play failed for ${soundKey}:`, error);
                }
            });
            setPlayingSound(soundKey);
        }
    }, [playingSound]);

    useEffect(() => {
        if (!match) {
            Object.values(audioRefs.current).forEach((audio: HTMLAudioElement | null) => {
                if (audio && !audio.paused) {
                    audio.pause();
                    audio.currentTime = 0;
                }
            });
            setPlayingSound(null);
        }
    }, [match]);

    return (
        <div className="flex flex-col items-center justify-center gap-2">
            {allSongs.map(sound => (
                <audio key={sound.key} ref={el => {audioRefs.current[sound.key] = el}} src={convertGithubUrl(sound.url)} preload="metadata"></audio>
            ))}
            <div className="flex flex-wrap items-center justify-center gap-2">
                {staticSounds.map(sound => (
                    <button 
                        key={sound.key} 
                        onClick={() => handleSoundToggle(sound.key)} 
                        className={`font-semibold py-2 px-3 rounded transition-colors text-sm text-white ${playingSound === sound.key ? 'bg-orange-500 hover:bg-orange-600' : (sound.color.startsWith('bg-') ? sound.color : '')}`}
                        style={!sound.color.startsWith('bg-') ? { backgroundColor: sound.color, opacity: playingSound === sound.key ? 1 : 0.9 } : {}}
                    >
                        {(sound as any).playingName && playingSound === sound.key ? (sound as any).playingName : sound.name}
                    </button>
                ))}
                 {groupedCheerSongs.length > 0 && (
                    <button 
                        onClick={handleToggleCheerSongSection}
                        className="font-semibold py-2 px-3 rounded text-sm text-white bg-purple-600 hover:bg-purple-500"
                    >
                        {showCheerSongs ? t('cheer_song_close') : t('cheer_song_list')}
                    </button>
                )}
            </div>
             {showCheerSongs && (
                <div className="w-full mt-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700 animate-fade-in space-y-3">
                    {availableTeamCounts.length > 1 && (
                        <div className="flex flex-wrap items-center justify-center gap-2 border-b border-slate-700 pb-3">
                            <span className="text-sm font-semibold text-slate-400 mr-2">{t('record_format_filter')}</span>
                            <button onClick={() => handleSetTeamCountFilter('all')} className={`px-3 py-1 text-sm rounded-md transition-colors ${teamCountFilter === 'all' ? 'bg-[#00A3FF] text-white font-bold' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}>{t('record_all_formats')}</button>
                            {availableTeamCounts.map(count => (
                                <button key={count} onClick={() => handleSetTeamCountFilter(count)} className={`px-3 py-1 text-sm rounded-md transition-colors ${teamCountFilter === count ? 'bg-[#00A3FF] text-white font-bold' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}>
                                    {t('record_team_format', { count })}
                                </button>
                            ))}
                        </div>
                    )}
                    
                    {groupedCheerSongs.length > 0 ? (
                        <>
                            <div className="flex flex-wrap items-center justify-center gap-2">
                                {groupedCheerSongs.map(([className]) => (
                                    <button
                                        key={className}
                                        onClick={() => setSelectedClassTab(className)}
                                        className={`font-semibold py-2 px-4 rounded text-sm text-white transition-colors ${selectedClassTab === className ? 'bg-sky-600' : 'bg-slate-700 hover:bg-slate-600'}`}
                                    >
                                        {className}
                                    </button>
                                ))}
                            </div>

                            {selectedClassTab && (
                                <div className="flex flex-wrap items-center justify-center gap-2 pt-3 border-t border-slate-700 animate-fade-in">
                                    {(groupedCheerSongs.find(([className]) => className === selectedClassTab)?.[1] || []).map(sound => (
                                        <button 
                                            key={sound.key} 
                                            onClick={() => handleSoundToggle(sound.key)} 
                                            className={`font-semibold py-2 px-3 rounded transition-colors text-sm text-white truncate ${playingSound === sound.key ? 'bg-orange-500 hover:bg-orange-600' : ''}`}
                                            style={playingSound !== sound.key ? { backgroundColor: sound.color, opacity: 0.9 } : {}}
                                        >
                                            {playingSound === sound.key ? '■ 중지' : sound.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <p className="text-center text-slate-400 py-2">표시할 응원가가 없습니다.</p>
                    )}
                </div>
            )}
        </div>
    );
};


const ScoreTrendChart: React.FC<{ match: MatchState }> = ({ match }) => {
    const { t } = useTranslation();
    const chartData = useMemo(() => {
        return match.scoreHistory.map((score, index) => ({
            point: index,
            [match.teamA.name]: score.a,
            [match.teamB.name]: score.b,
        }));
    }, [match.scoreHistory, match.teamA.name, match.teamB.name]);

    return (
        <div className="bg-slate-900/50 p-4 rounded-lg h-80 mt-8">
             <h4 className="text-lg font-bold text-center text-slate-300 mb-2">{t('score_trend')}</h4>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="point" label={{ value: '진행', position: 'insideBottom', offset: -10 }} stroke="#94a3b8" />
                    <YAxis allowDecimals={false} stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                    <Legend verticalAlign="top" />
                    <Line type="monotone" dataKey={match.teamA.name} stroke={match.teamA.color || "#38bdf8"} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey={match.teamB.name} stroke={match.teamB.color || "#f87171"} strokeWidth={2} dot={false} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

const LiveGameDisplay: React.FC<{ match: MatchState; isTournamentMode?: boolean }> = ({ match, isTournamentMode }) => {
    const { t } = useTranslation();
    const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
    const [showGuideModal, setShowGuideModal] = useState(false);
    const [showDetailedStats, setShowDetailedStats] = useState(false);

    useEffect(() => {
        if (!match.timeout) setShowDetailedStats(false);
    }, [match.timeout]);

    if (!match || typeof match !== 'object' || !match.teamA || typeof match.teamA !== 'object' || !match.teamB || typeof match.teamB !== 'object') {
        return (
            <div className="flex-grow flex items-center justify-center">
                <p className="text-red-500 text-lg">오류: 표시할 경기 데이터가 올바르지 않습니다.</p>
            </div>
        );
    }

    const TeamRoster: React.FC<{ team: typeof match.teamA }> = ({ team }) => {
        const teamColor = team.color || '#cbd5e1';
        
        const sortedPlayers = useMemo(() => {
            if (!team.players || typeof team.players !== 'object') {
                return [];
            }
            const validPlayers = Object.values(team.players).filter(
                (p): p is Player => p && typeof p === 'object' && 'id' in p && 'originalName' in p
            );
            
            return validPlayers.sort((a, b) => {
                if (a.isCaptain !== b.isCaptain) {
                    return a.isCaptain ? -1 : 1; // Captains first
                }
                return a.originalName.localeCompare(b.originalName);
            });
        }, [team.players]);


        if (sortedPlayers.length === 0) {
            return (
                <div className="bg-slate-900/50 p-4 rounded-lg border-2 h-full flex items-center justify-center text-center" style={{ borderColor: teamColor }}>
                    <p className="text-slate-400">선수 명단 정보 없음<br/>(수동 생성 팀)</p>
                </div>
            );
        }

        return (
            <div className="bg-slate-900/50 p-2 rounded-lg border-2 h-full flex flex-col" style={{ borderColor: teamColor }}>
                <div className="flex flex-col items-center text-center gap-1 mb-2 flex-shrink-0">
                    <TeamEmblem emblem={team.emblem} color={teamColor} className="w-10 h-10" />
                    <div>
                        <h3 className="text-xl font-bold text-white">{team.name}</h3>
                    </div>
                </div>
                <div className="flex-grow overflow-y-auto pr-1">
                    <ul className="space-y-2">
                        {sortedPlayers.map((player: Player) => {
                            const isCaptain = player.isCaptain;
                            const onCourt = team.onCourtPlayerIds?.includes(player.id);
                            return (
                                <li
                                    key={player.id}
                                    onClick={isTournamentMode ? undefined : () => setSelectedPlayer(player)}
                                    className={`flex items-center gap-3 bg-slate-800 p-4 rounded-lg transition-colors ${!onCourt ? 'opacity-50' : ''} ${isTournamentMode ? '' : 'cursor-pointer hover:bg-slate-700'}`}
                                >
                                    {isCaptain && <CrownIcon className="w-6 h-6 text-yellow-400 flex-shrink-0" />}
                                    <span className={`font-bold text-xl text-slate-200 truncate ${!isCaptain ? 'ml-9' : ''}`}>{player.originalName}</span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </div>
        )
    };

    return (
        <div className="flex flex-col gap-4 animate-fade-in flex-grow">
            {showGuideModal && <CommentaryGuideModal onClose={() => setShowGuideModal(false)} />}
            {selectedPlayer && <StatModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} showRealNames={true} />}

            {/* 아나운서용 전광판 스코어보드 - 상단 고정, 크고 직관적 */}
            <div className="w-full bg-slate-950 border-2 border-slate-600 rounded-xl p-4 sm:p-6 shadow-2xl">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center justify-center gap-3 min-w-0 flex-1">
                        <TeamEmblem emblem={match.teamA.emblem} color={match.teamA.color} className="w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0" />
                        <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-white truncate" style={{ color: match.teamA.color || '#38bdf8' }}>{match.teamA.name}</span>
                    </div>
                    <div className="flex items-center justify-center gap-3 sm:gap-6 px-4">
                        <span className="text-6xl sm:text-7xl lg:text-8xl xl:text-9xl font-black tabular-nums min-w-[1.2em] text-center" style={{ color: match.teamA.color || '#38bdf8' }}>{match.teamA.score}</span>
                        <span className="text-4xl sm:text-5xl font-bold text-slate-500">:</span>
                        <span className="text-6xl sm:text-7xl lg:text-8xl xl:text-9xl font-black tabular-nums min-w-[1.2em] text-center" style={{ color: match.teamB.color || '#f87171' }}>{match.teamB.score}</span>
                    </div>
                    <div className="flex items-center justify-center gap-3 min-w-0 flex-1">
                        <span className="text-xl sm:text-2xl lg:text-3xl font-bold text-white truncate" style={{ color: match.teamB.color || '#f87171' }}>{match.teamB.name}</span>
                        <TeamEmblem emblem={match.teamB.emblem} color={match.teamB.color} className="w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0" />
                    </div>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-4 mt-3 pt-3 border-t border-slate-700">
                    <span className="text-slate-400 font-semibold">세트 {match.currentSet}</span>
                    {match.servingTeam && !match.gameOver && (
                        <span className="flex items-center gap-1.5 text-sky-400 font-bold">
                            <VolleyballIcon className="w-5 h-5 animate-pulse" />
                            {(match.servingTeam === 'A' ? match.teamA : match.teamB).name} 서빙
                        </span>
                    )}
                    {match.isDeuce && !match.gameOver && <span className="text-yellow-400 font-bold">듀스</span>}
                    {match.gameOver && <span className="text-green-400 font-bold text-lg">경기 종료</span>}
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr_1fr] gap-6">
                <TeamRoster team={match.teamA} />
                <div className="bg-slate-900/50 p-4 rounded-lg flex flex-col items-center justify-start gap-4 text-center overflow-y-auto min-h-0">
                    <div className="flex items-center justify-center gap-4 my-2">
                        <span className="text-4xl font-extrabold" style={{ color: match.teamA.color || '#38bdf8' }}>{match.teamA.score}</span>
                        <span className="text-3xl font-bold text-slate-400">-</span>
                        <span className="text-4xl font-extrabold" style={{ color: match.teamB.color || '#f87171' }}>{match.teamB.score}</span>
                    </div>

                    {match.timeout && (() => {
                        const team = match.timeout.team === 'A' ? match.teamA : match.teamB;
                        const teamColor = team.color || (match.timeout.team === 'A' ? '#38bdf8' : '#f87171');
                        return (
                            <div className="mt-4 flex flex-wrap items-center justify-center gap-3 animate-fade-in">
                                <div className="bg-slate-800/80 p-3 rounded-lg border-2" style={{ borderColor: teamColor }}>
                                    <h3 className="text-lg font-bold" style={{ color: teamColor }}>{team.name} {t('timeout')}</h3>
                                    <p className="text-4xl font-mono font-extrabold text-white mt-1">{match.timeout.timeLeft}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowDetailedStats(prev => !prev)}
                                    className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold text-sm transition-colors"
                                >
                                    📊 {showDetailedStats ? '상세 기록 숨기기' : '상세 기록 보기'}
                                </button>
                                {showDetailedStats && (
                                    <div className="w-full mt-2 bg-slate-800/90 rounded-xl p-4 overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-slate-400 border-b border-slate-600">
                                                    <th className="text-left py-2"></th>
                                                    <th className="text-center py-2">{match.teamA.name}</th>
                                                    <th className="text-center py-2">{match.teamB.name}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-slate-200">
                                                <tr className="border-b border-slate-700">
                                                    <td className="py-2">{t('stat_display_spike_success')}</td>
                                                    <td className="text-center font-mono font-bold py-2">{match.teamA.spikeSuccesses}</td>
                                                    <td className="text-center font-mono font-bold py-2">{match.teamB.spikeSuccesses}</td>
                                                </tr>
                                                <tr className="border-b border-slate-700">
                                                    <td className="py-2">{t('stat_display_serve_ace')}</td>
                                                    <td className="text-center font-mono font-bold py-2">{match.teamA.serviceAces}</td>
                                                    <td className="text-center font-mono font-bold py-2">{match.teamB.serviceAces}</td>
                                                </tr>
                                                <tr className="border-b border-slate-700">
                                                    <td className="py-2">{t('stat_display_blocking')}</td>
                                                    <td className="text-center font-mono font-bold py-2">{match.teamA.blockingPoints}</td>
                                                    <td className="text-center font-mono font-bold py-2">{match.teamB.blockingPoints}</td>
                                                </tr>
                                                <tr>
                                                    <td className="py-2">{t('stat_display_serve_fault')}</td>
                                                    <td className="text-center font-mono font-bold py-2">{match.teamA.serviceFaults}</td>
                                                    <td className="text-center font-mono font-bold py-2">{match.teamB.serviceFaults}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )
                    })()}

                    {match.servingTeam && !match.gameOver && (
                        (() => {
                            const servingTeam = match.servingTeam === 'A' ? match.teamA : match.teamB;
                            return (
                                <div className="flex items-center justify-center gap-2 mb-2 text-lg" style={{ color: servingTeam.color }}>
                                    <VolleyballIcon className="w-6 h-6 animate-pulse" />
                                    <span className="font-bold">
                                        {servingTeam.name} {t('serving')}
                                    </span>
                                </div>
                            );
                        })()
                    )}
                    {match.isDeuce && !match.gameOver && <p className="text-yellow-400 font-bold text-xl animate-pulse">듀스!</p>}
                    {match.gameOver && <p className="text-green-400 font-bold text-2xl">경기 종료!</p>}

                    <div className="w-full max-w-md my-4 space-y-2 bg-slate-800/50 p-3 rounded-lg">
                        <h4 className="text-lg font-bold text-slate-300 text-center mb-2">{t('additional_score')}</h4>
                        <div className="flex justify-between items-center text-md">
                            <span className="font-bold" style={{ color: match.teamA.color || '#38bdf8' }}>{match.teamA.name}</span>
                            <div className="flex gap-4 text-slate-300">
                                <span>{t('fair_play')}: <span className="font-mono font-bold text-white">{match.teamA.fairPlay}</span></span>
                                <span>{t('three_hit_play')}: <span className="font-mono font-bold text-white">{match.teamA.threeHitPlays}</span></span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center text-md">
                            <span className="font-bold" style={{ color: match.teamB.color || '#f87171' }}>{match.teamB.name}</span>
                            <div className="flex gap-4 text-slate-300">
                                <span>{t('fair_play')}: <span className="font-mono font-bold text-white">{match.teamB.fairPlay}</span></span>
                                <span>{t('three_hit_play')}: <span className="font-mono font-bold text-white">{match.teamB.threeHitPlays}</span></span>
                            </div>
                        </div>
                    </div>
                    
                    {/* Commentary Guide Button Moved Here */}
                     <button onClick={() => setShowGuideModal(true)} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 font-semibold py-1.5 px-4 rounded-lg text-sm transition-colors mt-1 mb-2 justify-center">
                        <QuestionMarkCircleIcon className="w-4 h-4" />
                        {t('commentary_guide')}
                    </button>

                     {/* Timeline added to Announcer Screen */}
                    <div className="w-full max-w-md flex-grow min-h-0 overflow-y-auto flex flex-col">
                        <GameLog events={match.eventHistory} showUndoButton={false} />
                    </div>
                </div>
                <TeamRoster team={match.teamB} />
            </div>
            
            {match.scoreHistory && match.scoreHistory.length > 1 && (
                <div className="mt-6 pb-4">
                    <ScoreTrendChart match={match} />
                </div>
            )}
        </div>
    );
};

const TICKER_DURATION_MS = 24000; // 12초 마퀴 × 2번 지나가도록 표시
const FLOATING_EMOJI_DURATION_MS = 2500;
const EMOJI_COOLDOWN_SEC = 3;

const FloatingEmoji: React.FC<{ id: number; emoji: string; onEnd: () => void }> = ({ id, emoji, onEnd }) => {
    useEffect(() => {
        const t = setTimeout(onEnd, FLOATING_EMOJI_DURATION_MS);
        return () => clearTimeout(t);
    }, [onEnd]);
    const leftPercent = 30 + (id % 5) * 10;
    return (
        <span
            className="absolute text-5xl pointer-events-none animate-float-up"
            style={{
                left: `${leftPercent}%`,
                bottom: '6rem',
                transform: 'translateX(-50%)',
                textShadow: '0 0 20px rgba(255,255,255,0.8)',
            }}
        >
            {emoji}
        </span>
    );
};

const EFFECT_DURATION_MS = 2000;

const EffectPopup: React.FC<{ id: number; effectType: 'SPIKE' | 'BLOCK'; onEnd: () => void }> = ({ effectType, onEnd }) => {
    useEffect(() => {
        const t = setTimeout(onEnd, EFFECT_DURATION_MS);
        return () => clearTimeout(t);
    }, [onEnd]);
    const text = effectType === 'SPIKE' ? '🔥 SUPER SPIKE 🔥' : '🧱 MONSTER BLOCK 🧱';
    return (
        <div className="fixed inset-0 flex items-center justify-center z-40 pointer-events-none">
            <span className="animate-effect-popup text-4xl sm:text-5xl md:text-6xl font-black text-white text-center drop-shadow-[0_0_20px_rgba(255,255,255,0.9)]">
                {text}
            </span>
        </div>
    );
};

const AnnouncerScreen: React.FC<AnnouncerScreenProps> = ({ onNavigateToHistory, pendingJoinCode, clearPendingJoinCode, appMode = 'CLASS' }) => {
    const { matchState, p2p, joinSession, receivedTickerMessage, clearTicker, receivedReactions, removeReceivedReaction, sendReaction, receivedEffects, removeReceivedEffect, receivedChatMessages, sendChat } = useData();
    const { t } = useTranslation();
    const hasTriedJoinRef = useRef(false);
    const isTournamentMode = p2p.clientTournamentMode ?? false;
    const [emojiCooldownRemaining, setEmojiCooldownRemaining] = useState(0);
    const CHAT_COOLDOWN_SEC = 3;
    const [chatCooldownRemaining, setChatCooldownRemaining] = useState(0);

    useEffect(() => {
        if (pendingJoinCode && joinSession && clearPendingJoinCode && !hasTriedJoinRef.current) {
            hasTriedJoinRef.current = true;
            joinSession(pendingJoinCode, clearPendingJoinCode);
        }
    }, [pendingJoinCode, joinSession, clearPendingJoinCode]);

    useEffect(() => {
        if (!receivedTickerMessage) return;
        const t = setTimeout(clearTicker, TICKER_DURATION_MS);
        return () => clearTimeout(t);
    }, [receivedTickerMessage, clearTicker]);

    useEffect(() => {
        if (emojiCooldownRemaining <= 0) return;
        const interval = setInterval(() => setEmojiCooldownRemaining(prev => Math.max(0, prev - 1)), 1000);
        return () => clearInterval(interval);
    }, [emojiCooldownRemaining]);
    useEffect(() => {
        if (chatCooldownRemaining <= 0) return;
        const interval = setInterval(() => setChatCooldownRemaining(prev => Math.max(0, prev - 1)), 1000);
        return () => clearInterval(interval);
    }, [chatCooldownRemaining]);

    const handleEmojiClick = useCallback((emoji: string) => {
        if (emojiCooldownRemaining > 0 || !sendReaction) return;
        sendReaction(emoji);
        setEmojiCooldownRemaining(EMOJI_COOLDOWN_SEC);
    }, [emojiCooldownRemaining, sendReaction]);

    return (
        <div className={`w-full max-w-7xl mx-auto flex flex-col gap-6 flex-grow min-h-screen overflow-y-auto pb-10 px-4 relative ${receivedEffects.length > 0 ? 'animate-shake' : ''}`}>
            {receivedEffects.map(e => (
                <EffectPopup key={e.id} id={e.id} effectType={e.effectType} onEnd={() => removeReceivedEffect(e.id)} />
            ))}
            {receivedReactions.length > 0 && (
                <div className="fixed inset-0 pointer-events-none z-30 flex items-end justify-center pb-32">
                    {receivedReactions.map(r => (
                        <FloatingEmoji key={r.id} id={r.id} emoji={r.emoji} onEnd={() => removeReceivedReaction(r.id)} />
                    ))}
                </div>
            )}
            {isTournamentMode && (
                <div className="flex justify-end">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-400 text-sm font-bold">
                        🏆 공식 대회 모드
                    </span>
                </div>
            )}
            {appMode !== 'CLUB' && !isTournamentMode && (
                <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-700 p-4 rounded-lg shadow-2xl flex-shrink-0">
                    <h3 className="text-xl font-bold text-center text-slate-300 mb-2">{t('sound_panel')}</h3>
                    <SoundPanel match={matchState} />
                </div>
            )}

            {matchState ? (
                <LiveGameDisplay match={matchState} isTournamentMode={isTournamentMode} />
            ) : (
                <div className="flex-grow flex flex-col items-center justify-center text-center text-slate-400 min-h-[40vh]">
                    {p2p.status === 'connecting' && (
                        <p className="text-xl font-semibold text-sky-400">
                            {pendingJoinCode ? '📡 QR 코드로 자동 연결 중입니다...' : '연결 중...'}
                        </p>
                    )}
                    {p2p.isConnected && !matchState && (
                        <p className="text-lg text-slate-500">데이터 수신 대기 중...</p>
                    )}
                    {!p2p.isConnected && p2p.status !== 'connecting' && (
                        <>
                            <p className="text-2xl font-bold">{t('no_active_game')}</p>
                            <p className="mt-2">{t('host_will_display')}</p>
                        </>
                    )}
                    <button onClick={onNavigateToHistory} className="mt-6 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg">
                        {t('view_past_games')}
                    </button>
                </div>
            )}

            {isTournamentMode && receivedTickerMessage && (
                <div className="fixed bottom-20 left-0 right-0 z-20 overflow-hidden bg-slate-900/95 border-t border-amber-500/30 py-2">
                    <div className="animate-marquee whitespace-nowrap text-amber-400 font-semibold text-lg">
                        {receivedTickerMessage}
                    </div>
                </div>
            )}

            {p2p.isConnected && matchState && (p2p.chatWindowVisible !== false) && (p2p.chatEnabled !== false) && (
                <LiveChatOverlay
                    messages={receivedChatMessages}
                    isInputEnabled={p2p.chatEnabled ?? true}
                    showInputSection={true}
                    myViewerLabel={p2p.viewerLabel}
                    onSend={(text) => {
                        if (sendChat && chatCooldownRemaining <= 0) {
                            sendChat(text);
                            setChatCooldownRemaining(CHAT_COOLDOWN_SEC);
                        }
                    }}
                    sendCooldownRemaining={chatCooldownRemaining}
                    maxLength={30}
                />
            )}
            {isTournamentMode && (
                <div className="fixed bottom-4 left-0 right-0 z-20 flex flex-col items-center gap-2 px-4">
                    {emojiCooldownRemaining > 0 && (
                        <span className="text-xs text-slate-400">{emojiCooldownRemaining}초 후 가능</span>
                    )}
                    <div className="flex justify-center gap-4">
                    <button
                        type="button"
                        disabled={emojiCooldownRemaining > 0}
                        onClick={() => handleEmojiClick('👏')}
                        className="w-14 h-14 rounded-full bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-2xl flex items-center justify-center transition-colors border-2 border-slate-600"
                        title="박수"
                    >
                        👏
                    </button>
                    <button
                        type="button"
                        disabled={emojiCooldownRemaining > 0}
                        onClick={() => handleEmojiClick('🔥')}
                        className="w-14 h-14 rounded-full bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-2xl flex items-center justify-center transition-colors border-2 border-slate-600"
                        title="불꽃"
                    >
                        🔥
                    </button>
                    <button
                        type="button"
                        disabled={emojiCooldownRemaining > 0}
                        onClick={() => handleEmojiClick('🏐')}
                        className="w-14 h-14 rounded-full bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-2xl flex items-center justify-center transition-colors border-2 border-slate-600"
                        title="배구"
                    >
                        🏐
                    </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AnnouncerScreen;