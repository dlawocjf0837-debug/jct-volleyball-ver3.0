import React, { useCallback, useEffect } from 'react';

export interface HeatmapCoordinates {
    x: number;
    y: number;
}

interface HeatmapRecordModalProps {
    isOpen: boolean;
    onRecord: (coordinates: HeatmapCoordinates | null) => void;
    onClose: () => void;
}

/** 2D 탑다운 반코트 (상대 진영). 하단=네트(우리 쪽), 상단=엔드라인(상대 끝) — 방향감 극대화 */
const CourtBackground: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div className={`relative w-full h-full bg-slate-800 border-2 border-white rounded overflow-hidden border-b-[12px] border-b-slate-300 ${className}`}>
        {/* 상단: 엔드라인 (상대 코트 끝) */}
        <div className="absolute top-1 left-0 right-0 text-center text-white/50 font-bold text-xs z-10 pointer-events-none select-none">
            ⬆️ 엔드라인 (상대 코트 끝) ⬆️
        </div>
        {/* 어택 라인 (3m) */}
        <div className="absolute left-0 right-0 h-px bg-white/80 z-10" style={{ top: '33.33%' }} />
        {/* 중앙선 (세로) */}
        <div className="absolute top-0 bottom-0 w-px bg-white/80 left-1/2 -translate-x-px z-10" />
        {/* 사이드 라인 (세로) */}
        <div className="absolute top-0 bottom-0 w-px bg-white/80 left-1/3 z-10" />
        <div className="absolute top-0 bottom-0 w-px bg-white/80 right-1/3 z-10" />
        {/* 상단 실선 (엔드라인) */}
        <div className="absolute top-0 left-0 right-0 h-px bg-white/80 z-10" />
        {/* 하단: 네트 (두꺼운 border-b로 표현) + 라벨 */}
        <div className="absolute bottom-1 left-0 right-0 text-center text-white/50 font-bold text-xs z-10 pointer-events-none select-none">
            ⬇️ 네트 (우리 팀 진영) ⬇️
        </div>
    </div>
);

export const HeatmapRecordModal: React.FC<HeatmapRecordModalProps> = ({
    isOpen,
    onRecord,
    onClose,
}) => {
    const handleCourtClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            if (!isOpen) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            onRecord({ x, y });
            onClose();
        },
        [isOpen, onRecord, onClose]
    );

    const handleSkip = useCallback(() => {
        onRecord(null);
        onClose();
    }, [onRecord, onClose]);

    useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="득점 위치 기록"
            onClick={handleSkip}
        >
            <div
                className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-600 overflow-y-auto w-full max-w-sm max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
                role="presentation"
            >
                <div className="px-4 pt-4 pb-3 border-b border-slate-700 bg-slate-800/80 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-200">
                        🎯 어디에 떨어졌나요? (터치)
                    </p>
                    <button
                        type="button"
                        onClick={handleSkip}
                        className="shrink-0 px-4 py-2 bg-slate-700 hover:bg-slate-600 active:bg-slate-600 rounded-lg text-slate-200 font-medium text-sm transition-colors"
                        aria-label="건너뛰기"
                    >
                        ✕ 건너뛰기
                    </button>
                </div>
                <div className="p-4">
                    <div
                        role="button"
                        tabIndex={0}
                        onClick={handleCourtClick}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onRecord({ x: 50, y: 50 });
                                onClose();
                            }
                        }}
                        className="relative w-full aspect-[9/9] max-h-[280px] mx-auto rounded-lg cursor-crosshair overflow-hidden touch-none border-2 border-slate-600 active:bg-slate-700/50 transition-colors"
                        style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}
                    >
                        <CourtBackground />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HeatmapRecordModal;
