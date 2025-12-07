import React, { useRef, useEffect } from 'react';
import { ScoreEvent, ScoreEventType } from '../types';
import { TargetIcon, FireIcon, WallIcon, BoltIcon, ShieldIcon, HandshakeIcon, StopwatchIcon, LinkIcon, UndoIcon, VolleyballIcon, TrophyIcon } from './icons';

interface GameLogProps {
    events: ScoreEvent[];
    onUndo?: () => void;
    canUndo?: boolean;
    showUndoButton?: boolean;
}

const GameLog: React.FC<GameLogProps> = ({ events, onUndo, canUndo, showUndoButton = true }) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [events]);

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
            default: return <span className="w-2 h-2 bg-slate-500 rounded-full inline-block" />;
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
        <div className="w-full bg-slate-900/50 rounded-lg border-2 border-slate-700 p-2 h-64 overflow-y-auto flex flex-col" ref={scrollRef}>
            <div className="flex justify-between items-center mb-2 px-2 sticky top-0 bg-slate-900/95 py-2 z-10 border-b border-slate-700/50">
                <h3 className="text-slate-300 text-base font-bold">경기 타임라인</h3>
                {showUndoButton && onUndo && (
                    <button 
                        onClick={onUndo} 
                        disabled={!canUndo}
                        className="flex items-center gap-1.5 bg-yellow-600 hover:bg-yellow-500 text-white text-xs font-bold py-1.5 px-3 rounded-lg disabled:bg-slate-700 disabled:cursor-not-allowed transition-all shadow-md active:scale-95"
                        title="마지막 동작 취소"
                    >
                        <UndoIcon className="w-3.5 h-3.5" />
                        되돌리기
                    </button>
                )}
            </div>
            <div className="space-y-2 px-1 pb-2">
                {events.map((event, index) => {
                    const eventType = event.type || 'LOG';
                    return (
                        <div key={index} className={`flex items-center gap-3 p-3 rounded-xl border ${getEventStyles(eventType)} transition-all hover:brightness-110 animate-fade-in`}>
                            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-900 border border-slate-700 shadow-sm flex-shrink-0">
                                {getEventIcon(eventType)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-slate-200 font-bold text-sm sm:text-base truncate">{event.descriptionKey}</p>
                                <p className="text-slate-500 text-xs font-mono mt-0.5">스코어 {event.score.a}:{event.score.b}</p>
                            </div>
                        </div>
                    );
                })}
                {events.length === 0 && <p className="text-slate-500 text-center py-8 text-sm">아직 기록된 이벤트가 없습니다.<br/>경기를 시작하면 이곳에 기록됩니다.</p>}
            </div>
        </div>
    );
};

export default GameLog;