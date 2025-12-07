
import React, { useState } from 'react';
import { SKILL_DRILL_DATA, SkillDrillVideo } from '../data/skillDrills';
import VideoPlayerModal from '../components/VideoPlayerModal';
import { VideoCameraIcon } from '../components/icons';
import { useTranslation } from '../hooks/useTranslation';

const getYoutubeIdFromUrl = (url: string): string | null => {
    let videoId: string | null = null;
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname === 'youtu.be') {
            videoId = urlObj.pathname.slice(1);
        } else if (urlObj.hostname.includes('youtube.com')) {
            videoId = urlObj.searchParams.get('v');
        }
    } catch (e) {
        const embedMatch = url.match(/src="https?:\/\/www\.youtube\.com\/embed\/([^"?]+)/);
        if (embedMatch && embedMatch[1]) {
            videoId = embedMatch[1];
        } else {
            console.error("Invalid YouTube URL for thumbnail:", url);
        }
    }
    return videoId;
};


const SkillDrillScreen: React.FC = () => {
    const [selectedVideo, setSelectedVideo] = useState<SkillDrillVideo | null>(null);
    const { t } = useTranslation();

    return (
        <>
            <VideoPlayerModal video={selectedVideo} onClose={() => setSelectedVideo(null)} />
            <div className="max-w-4xl mx-auto bg-slate-900/50 backdrop-blur-sm border border-slate-700 p-6 rounded-lg shadow-2xl space-y-6 animate-fade-in w-full">
                <div className="text-center">
                    <h2 className="text-3xl font-bold text-[#00A3FF]">{t('skill_drill_library_title')}</h2>
                    <p className="text-slate-400 mt-1">{t('skill_drill_library_subtitle')}</p>
                </div>

                <div className="space-y-8">
                    {SKILL_DRILL_DATA.map(category => (
                        <div key={category.nameKey}>
                            <h3 className="text-2xl font-bold text-sky-300 border-b-2 border-sky-500/30 pb-2 mb-4">{t(category.nameKey)}</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {category.videos.map(video => {
                                    const youtubeId = getYoutubeIdFromUrl(video.youtubeUrl);
                                    const title = t(video.titleKey);
                                    const description = t(video.descriptionKey);
                                    return (
                                        <div 
                                            key={video.id}
                                            onClick={() => setSelectedVideo(video)}
                                            className="bg-slate-800 rounded-lg overflow-hidden cursor-pointer group transition-transform transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-sky-500/20"
                                        >
                                            <div className="relative">
                                                <img 
                                                    src={youtubeId ? `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg` : ''} 
                                                    alt={title}
                                                    className="w-full h-auto aspect-video object-cover bg-slate-700"
                                                />
                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <VideoCameraIcon className="w-12 h-12 text-white/80" />
                                                </div>
                                            </div>
                                            <div className="p-4">
                                                <h4 className="font-bold text-slate-100 truncate">{title}</h4>
                                                <p className="text-base text-slate-400 mt-1 truncate">{description}</p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
};

export default SkillDrillScreen;
