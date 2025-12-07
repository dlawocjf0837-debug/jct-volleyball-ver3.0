import React from 'react';
import { SkillDrillVideo } from '../data/skillDrills';
import { useTranslation } from '../hooks/useTranslation';
import { PlayIcon } from '../components/icons';

interface VideoPlayerModalProps {
    video: SkillDrillVideo | null;
    onClose: () => void;
}

const getYoutubeInfo = (url: string): { videoId: string | null; watchUrl: string } => {
    let videoId: string | null = null;
    let startTime: string | null = null;

    try {
        const urlObj = new URL(url);
        if (urlObj.hostname === 'youtu.be') {
            videoId = urlObj.pathname.slice(1);
        } else if (urlObj.hostname.includes('youtube.com')) {
            videoId = urlObj.searchParams.get('v');
        }
        const timeParam = urlObj.searchParams.get('t') || urlObj.searchParams.get('start');
        startTime = timeParam?.replace('s', '') || null;
    } catch (e) {
        const embedMatch = url.match(/src="https?:\/\/www\.youtube\.com\/embed\/([^"?]+)/);
        if (embedMatch && embedMatch[1]) {
            videoId = embedMatch[1];
            const startMatch = url.match(/start=(\d+)/);
            if (startMatch && startMatch[1]) {
                startTime = startMatch[1];
            }
        } else {
            console.error("Invalid YouTube URL:", url);
        }
    }

    if (!videoId) return { videoId: null, watchUrl: '#' };

    let watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    if (startTime) {
        watchUrl += `&t=${startTime}s`;
    }
    return { videoId, watchUrl };
};


const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({ video, onClose }) => {
    const { t } = useTranslation();
    if (!video) return null;

    const { videoId, watchUrl } = getYoutubeInfo(video.youtubeUrl);
    const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '';
    
    const title = t(video.titleKey);
    const description = t(video.descriptionKey);
    const transcript = t(video.transcriptKey);

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 animate-fade-in"
            onClick={onClose}
        >
            <div 
                className="bg-slate-900 rounded-lg shadow-2xl p-6 w-full max-w-2xl text-white border border-slate-700 max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-[#00A3FF]">{title}</h2>
                        <p className="text-slate-400 text-sm">{description}</p>
                    </div>
                    <button onClick={onClose} className="text-2xl font-bold text-slate-500 hover:text-white">&times;</button>
                </div>
                
                <div className="aspect-video w-full bg-black rounded-lg overflow-hidden mb-4 relative group">
                     <a href={watchUrl} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                        {videoId ? (
                            <img
                                src={thumbnailUrl}
                                alt={title}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-red-500">
                                {t('invalid_youtube_url')}
                            </div>
                        )}
                        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <PlayIcon className="w-16 h-16 text-white" />
                            <p className="text-white font-bold mt-2">{t('play_on_youtube')}</p>
                        </div>
                    </a>
                </div>

                <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                     <div className="bg-slate-800/50 p-4 rounded-lg">
                        <h3 className="text-lg font-semibold text-sky-300 mb-2">{t('video_content')}</h3>
                        <p className="text-slate-300 whitespace-pre-wrap text-sm leading-relaxed">
                            {transcript.trim()}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VideoPlayerModal;