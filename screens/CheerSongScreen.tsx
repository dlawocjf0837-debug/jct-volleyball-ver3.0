import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useData } from '../contexts/DataContext';
import { PlayIcon, PauseIcon } from '../components/icons';
import { useTranslation } from '../hooks/useTranslation';

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
        if (parts.length >= 3 && parts[0] === 'refs' && parts[1] === 'heads') {
            branch = parts[2];
            path = parts.slice(3).join('/');
        } else {
            branch = parts[0];
            path = parts.slice(1).join('/');
        }
        if (branch) return `https://cdn.jsdelivr.net/gh/${user}/${repo}@${branch}/${path}`;
    }

    return url;
};


const StandaloneSoundPanel: React.FC = () => {
    const { teamSets } = useData();
    const { t } = useTranslation();
    const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
    const [playingSound, setPlayingSound] = useState<string | null>(null);
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

    const staticSounds = [
        { key: 'bgm1', name: t('cheer_song_start1'), playingName: t('cheer_song_stop_music'), color: 'bg-blue-600 hover:bg-blue-500', url: "https://cdn.jsdelivr.net/gh/dlawocjf0837-debug/Volleyball-sounds@main/start.wav" },
        { key: 'bgm2', name: t('cheer_song_start2'), playingName: t('cheer_song_stop_music'), color: 'bg-blue-600 hover:bg-blue-500', url: "https://cdn.jsdelivr.net/gh/dlawocjf0837-debug/Volleyball-sounds@main/start2.mp3" },
        { key: 'timeout', name: t('cheer_song_timeout'), playingName: t('cheer_song_stop_music'), color: 'bg-green-600 hover:bg-green-500', url: "https://cdn.jsdelivr.net/gh/dlawocjf0837-debug/Volleyball-sounds@main/Timsong.mp3" },
        { key: 'cheer_effect', name: t('cheer_song_cheer'), playingName: t('cheer_song_stop_music'), color: 'bg-yellow-600 hover:bg-yellow-500', url: "https://cdn.jsdelivr.net/gh/dlawocjf0837-debug/Volleyball-sounds@main/crowd-cheering-379666.mp3" },
        { key: 'end', name: t('cheer_song_end'), playingName: t('cheer_song_stop_music'), color: 'bg-red-600 hover:bg-red-500', url: "https://cdn.jsdelivr.net/gh/dlawocjf0837-debug/Volleyball-sounds@main/end.wav" },
    ];

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

    const allSongs = useMemo(() => [...staticSounds, ...groupedCheerSongs.flatMap(([, songs]) => songs)], [groupedCheerSongs, staticSounds]);

    const handleSoundToggle = useCallback((soundKey: string) => {
        for (const key in audioRefs.current) {
            if (Object.prototype.hasOwnProperty.call(audioRefs.current, key)) {
                const audioEl = audioRefs.current[key];
                if (key !== soundKey && audioEl && !audioEl.paused) {
                    audioEl.pause();
                    audioEl.currentTime = 0;
                }
            }
        }

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
    
    return (
        <div className="max-w-xl mx-auto bg-slate-900/50 backdrop-blur-sm border border-slate-700 p-6 rounded-lg shadow-2xl space-y-8">
             {allSongs.map(song => (
                <audio key={song.key} ref={el => {audioRefs.current[song.key] = el}} src={convertGithubUrl(song.url)} preload="metadata"></audio>
            ))}
            <div className="flex flex-col lg:flex-row items-center lg:justify-between mb-6 gap-4">
                <h1 className="text-3xl lg:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 text-center lg:text-right">
                    {t('cheer_song_title')}
                </h1>
            </div>
            <p className="text-sm text-slate-400 mt-2 text-center">
                {t('cheer_song_subtitle')}
            </p>
            
            {availableTeamCounts.length > 1 && (
                <div className="flex flex-wrap items-center justify-center gap-2 border-y border-slate-700 py-4">
                    <span className="text-sm font-semibold text-slate-400 mr-2">{t('record_format_filter')}</span>
                    <button onClick={() => setTeamCountFilter('all')} className={`px-3 py-1 text-sm rounded-md transition-colors ${teamCountFilter === 'all' ? 'bg-[#00A3FF] text-white font-bold' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}>{t('record_all_formats')}</button>
                    {availableTeamCounts.map(count => (
                        <button key={count} onClick={() => setTeamCountFilter(count)} className={`px-3 py-1 text-sm rounded-md transition-colors ${teamCountFilter === count ? 'bg-[#00A3FF] text-white font-bold' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}>
                            {t('record_team_format', { count })}
                        </button>
                    ))}
                </div>
            )}

            <div className="bg-slate-800/50 p-4 rounded-lg">
                 <h3 className="text-lg font-semibold text-sky-300 mb-3 text-center">{t('cheer_song_effects_title')}</h3>
                 <div className="flex flex-wrap items-center justify-center gap-2">
                    {staticSounds.map(sound => (
                        <button 
                            key={sound.key} 
                            onClick={() => handleSoundToggle(sound.key)} 
                            className={`font-semibold py-2 px-3 rounded transition-colors text-sm text-white ${playingSound === sound.key ? 'bg-orange-500 hover:bg-orange-600' : (sound.color || 'bg-slate-700 hover:bg-slate-600')}`}
                        >
                            {playingSound === sound.key ? (sound.playingName || t('cheer_song_stop_button')) : sound.name}
                        </button>
                    ))}
                </div>
            </div>

            {groupedCheerSongs.length > 0 ? (
                <div className="space-y-8">
                    {groupedCheerSongs.map(([className, songs]) => (
                        <div key={className}>
                             <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">{className}</h3>
                             <div className="flex flex-col space-y-3">
                                {songs.map(song => (
                                    <button
                                        key={song.key}
                                        onClick={() => handleSoundToggle(song.key)}
                                        className={`w-full flex items-center justify-between text-left p-3 rounded-lg transition-all duration-200 group ${
                                            playingSound === song.key
                                                ? 'bg-slate-700 ring-2 ring-sky-500'
                                                : 'bg-slate-800 hover:bg-slate-700'
                                        }`}
                                    >
                                        <span className="font-medium text-slate-200 group-hover:text-white truncate">
                                            {song.name}
                                        </span>
                                        {playingSound === song.key ? (
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <span className="text-xs font-medium text-sky-400 animate-pulse">{t('cheer_song_playing')}</span>
                                                <PauseIcon className="w-6 h-6 text-sky-400" />
                                            </div>
                                        ) : (
                                            <PlayIcon className="w-6 h-6 text-slate-400 transition-colors group-hover:text-white" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center p-8 bg-slate-800/50 rounded-lg">
                    <p className="text-slate-400">{t('cheer_song_none_saved')}</p>
                    <p className="text-sm text-slate-500 mt-2">{t('cheer_song_add_guide')}</p>
                </div>
            )}
        </div>
    );
};


const CheerSongScreen: React.FC = () => {
    return <StandaloneSoundPanel />;
}

export default CheerSongScreen;