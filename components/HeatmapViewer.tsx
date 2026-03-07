import React, { useMemo, useState, useEffect } from 'react';
import HeatmapSummaryModal from './HeatmapSummaryModal';

export interface HitRecord {
    x: number;
    y: number;
    statType: 'SPIKE_SUCCESS' | 'SERVICE_ACE';
    /** 툴팁용 선택 필드 */
    set?: number;
    homeScore?: number;
    awayScore?: number;
    player?: { id?: string; name: string };
}

export type HeatmapPosition = 'LEFT' | 'RIGHT';

export type HeatmapFilter = 'ALL' | 'SPIKE' | 'SERVE';
export type HeatmapResultFilter = 'ALL' | 'SCORE' | 'CONCEDE';

export interface HeatmapViewerProps {
    scoreRecords?: HitRecord[];
    concedeRecords?: HitRecord[];
    position?: HeatmapPosition;
    maxHeight?: number;
    className?: string;
    title?: string;
    /** [전체, 스파이크, 서브] 스킬 필터 버튼 노출. 기본 true */
    showSkillFilter?: boolean;
    /** [전체, 득점, 실점] 결과 필터 버튼 노출. 기본 false (히트맵 분석 대시보드에서만 true) */
    showResultFilter?: boolean;
}

export type ClusterPoint = {
    x: number;
    y: number;
    statType: 'SPIKE_SUCCESS' | 'SERVICE_ACE';
    count: number;
    sample?: HitRecord;
};

function clusterRecords(records: HitRecord[], gridSize = 5): ClusterPoint[] {
    const key = (x: number, y: number, t: string) => `${Math.round(x / gridSize) * gridSize},${Math.round(y / gridSize) * gridSize},${t}`;
    const map = new Map<string, { x: number; y: number; statType: 'SPIKE_SUCCESS' | 'SERVICE_ACE'; count: number; sample?: HitRecord }>();
    (records || []).forEach((record) => {
        const { x, y, statType } = record;
        const k = key(x, y, statType);
        const existing = map.get(k);
        if (existing) {
            existing.count += 1;
            existing.x = (existing.x * (existing.count - 1) + x) / existing.count;
            existing.y = (existing.y * (existing.count - 1) + y) / existing.count;
            if (!existing.sample && (record.set != null || record.player != null)) existing.sample = record;
        } else {
            map.set(k, { x, y, statType, count: 1, sample: record.set != null || record.player != null ? record : undefined });
        }
    });
    return Array.from(map.values());
}

function hotZoneOpacity(count: number): number {
    return Math.min(0.5 + count * 0.2, 1);
}

export const HeatmapViewer: React.FC<HeatmapViewerProps> = ({
    scoreRecords = [],
    concedeRecords = [],
    position = 'LEFT',
    maxHeight = 200,
    className = '',
    title,
    showSkillFilter = true,
    showResultFilter = false,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [filter, setFilter] = useState<HeatmapFilter>('ALL');
    const [resultFilter, setResultFilter] = useState<HeatmapResultFilter>('ALL');
    const [selectedDot, setSelectedDot] = useState<ClusterPoint & { variant: 'score' | 'concede' } | null>(null);

    useEffect(() => {
        if (isExpanded) document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, [isExpanded]);

    const isLeft = position === 'LEFT';
    const scoreLeftPct = (y: number) => (isLeft ? 50 + (y / 100) * 50 : 50 - (y / 100) * 50);
    const concedeLeftPct = (y: number) => (isLeft ? 50 - (y / 100) * 50 : 50 + (y / 100) * 50);

    const passesFilter = (statType: 'SPIKE_SUCCESS' | 'SERVICE_ACE') => {
        if (filter === 'ALL') return true;
        if (filter === 'SPIKE') return statType === 'SPIKE_SUCCESS';
        return statType === 'SERVICE_ACE';
    };

    const [isSummaryOpen, setIsSummaryOpen] = useState(false);
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

    const filteredScoreRecords = useMemo(() => {
        if (!selectedPlayerId) return scoreRecords;
        return scoreRecords.filter((r) => r.player && (r.player.id === selectedPlayerId || r.player.name === selectedPlayerId));
    }, [scoreRecords, selectedPlayerId]);
    const filteredConcedeRecords = useMemo(() => {
        if (!selectedPlayerId) return concedeRecords;
        return concedeRecords.filter((r) => r.player && (r.player.id === selectedPlayerId || r.player.name === selectedPlayerId));
    }, [concedeRecords, selectedPlayerId]);

    const scoreClustered = useMemo(() => clusterRecords(filteredScoreRecords), [filteredScoreRecords]);
    const concedeClustered = useMemo(() => clusterRecords(filteredConcedeRecords), [filteredConcedeRecords]);

    const selectedPlayerName = useMemo(() => {
        if (!selectedPlayerId) return null;
        const r = scoreRecords.find((r) => r.player && (r.player.id === selectedPlayerId || r.player.name === selectedPlayerId))
            || concedeRecords.find((r) => r.player && (r.player.id === selectedPlayerId || r.player.name === selectedPlayerId));
        return r?.player?.name ?? selectedPlayerId;
    }, [selectedPlayerId, scoreRecords, concedeRecords]);

    const dotTooltipText = (p: ClusterPoint) =>
        `[${p.sample?.set ?? '-'}세트] ${p.sample?.player?.name ?? '알 수 없음'} (${p.statType === 'SPIKE_SUCCESS' ? '스파이크' : '서브'})`;

    const filterButtons = (showSkillFilter || showResultFilter) && (
        <div className="flex flex-wrap justify-center items-center gap-4 mb-2">
            {showSkillFilter && (
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-slate-500 mr-0.5">스킬:</span>
                    <button
                        type="button"
                        onClick={() => setFilter('ALL')}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${filter === 'ALL' ? 'bg-slate-600 text-white' : 'bg-slate-700/80 text-slate-400 hover:text-slate-200'}`}
                    >
                        전체
                    </button>
                    <button
                        type="button"
                        onClick={() => setFilter('SPIKE')}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${filter === 'SPIKE' ? 'bg-green-600/80 text-white' : 'bg-slate-700/80 text-slate-400 hover:text-slate-200'}`}
                    >
                        <span className="inline-block w-2 h-2 rounded-full bg-green-400" /> 스파이크
                    </button>
                    <button
                        type="button"
                        onClick={() => setFilter('SERVE')}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${filter === 'SERVE' ? 'bg-cyan-600/80 text-white' : 'bg-slate-700/80 text-slate-400 hover:text-slate-200'}`}
                    >
                        <span className="inline-block w-2 h-2 rounded-full bg-cyan-400" /> 서브
                    </button>
                </div>
            )}
            {showResultFilter && (
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-slate-500 mr-0.5">결과:</span>
                    <button
                        type="button"
                        onClick={() => setResultFilter('ALL')}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${resultFilter === 'ALL' ? 'bg-slate-600 text-white' : 'bg-slate-700/80 text-slate-400 hover:text-slate-200'}`}
                    >
                        전체
                    </button>
                    <button
                        type="button"
                        onClick={() => setResultFilter('SCORE')}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${resultFilter === 'SCORE' ? 'bg-emerald-600/80 text-white' : 'bg-slate-700/80 text-slate-400 hover:text-slate-200'}`}
                    >
                        득점
                    </button>
                    <button
                        type="button"
                        onClick={() => setResultFilter('CONCEDE')}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${resultFilter === 'CONCEDE' ? 'bg-amber-600/80 text-white' : 'bg-slate-700/80 text-slate-400 hover:text-slate-200'}`}
                    >
                        실점
                    </button>
                </div>
            )}
        </div>
    );

    const legend = (
        <div className="flex flex-wrap justify-center gap-3 mt-2 text-xs text-slate-400">
            <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-green-400 border border-green-300 align-middle mr-1 shadow-sm" /> 스파이크 득점</span>
            <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-cyan-400 border border-cyan-300 align-middle mr-1 shadow-sm" /> 서브 득점</span>
            <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 border border-red-400 align-middle mr-1 shadow-sm" /> 스파이크 실점</span>
            <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-400 border border-yellow-300 align-middle mr-1 shadow-sm" /> 서브 실점</span>
        </div>
    );

    const renderTooltip = () => {
        if (!selectedDot) return null;
        const s = selectedDot.sample;
        const typeLabel = selectedDot.statType === 'SPIKE_SUCCESS' ? '스파이크' : '서브';
        const variantLabel = selectedDot.variant === 'score' ? '득점' : '실점';
        return (
            <div className="absolute z-[60] min-w-[160px] max-w-[220px] rounded-lg bg-slate-800 border border-slate-600 shadow-xl p-3 text-left" style={{ bottom: '100%', left: '50%', transform: 'translateX(-50%) translateY(-8px)' }}>
                <button type="button" onClick={() => setSelectedDot(null)} className="absolute top-1.5 right-2 w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-slate-600 text-lg leading-none" aria-label="닫기">✕</button>
                {s?.set != null && (s?.homeScore != null || s?.awayScore != null) && (
                    <p className="text-sm font-medium text-slate-200 mb-1 pr-6">
                        [{s.set}세트] {s.homeScore ?? '-'} : {s.awayScore ?? '-'}
                    </p>
                )}
                <p className="text-xs text-slate-300">
                    선수명: {s?.player?.name ?? '알 수 없음'} · {typeLabel} {variantLabel}
                    {selectedDot.count > 1 && ` (${selectedDot.count}회)`}
                </p>
            </div>
        );
    };

    const fullCourt = (
        <div
            className="relative w-full mx-auto rounded-lg overflow-hidden bg-slate-800 border-2 border-white"
            style={{
                aspectRatio: '2 / 1',
                maxHeight: `${maxHeight}px`,
                boxShadow: '0 6px 16px rgba(0,0,0,0.4)',
            }}
        >
            <div className={`absolute top-0 bottom-0 left-0 w-1/2 pointer-events-none ${isLeft ? 'bg-sky-500/10' : 'bg-rose-400/15'}`} aria-hidden />
            <div className={`absolute top-0 bottom-0 right-0 w-1/2 pointer-events-none ${isLeft ? 'bg-rose-400/15' : 'bg-sky-500/10'}`} aria-hidden />
            <div className="absolute left-1/2 top-0 bottom-0 w-2 -translate-x-1/2 bg-white z-10 shadow-lg" />
            <div className="absolute top-0 bottom-0 w-px bg-white/70 z-10" style={{ left: '33.33%' }} />
            <div className="absolute top-0 bottom-0 w-px bg-white/70 z-10" style={{ left: '66.67%' }} />
            <div className="absolute top-0 left-0 right-0 h-px bg-white z-10" />
            <div className="absolute bottom-0 left-0 right-0 h-px bg-white z-10" />
            <div className="absolute top-0 bottom-0 w-px bg-white left-0 z-10" />
            <div className="absolute top-0 bottom-0 w-px bg-white right-0 z-10" />
            {isLeft ? (
                <>
                    <div className="absolute inset-0 left-0 right-1/2 flex items-center justify-center pointer-events-none select-none z-10" aria-hidden>
                        <span className="text-white/20 text-lg font-bold">우리 코트</span>
                    </div>
                    <div className="absolute inset-0 left-1/2 right-0 flex items-center justify-center pointer-events-none select-none z-10" aria-hidden>
                        <span className="text-white/20 text-lg font-bold">상대 코트</span>
                    </div>
                </>
            ) : (
                <>
                    <div className="absolute inset-0 left-0 right-1/2 flex items-center justify-center pointer-events-none select-none z-10" aria-hidden>
                        <span className="text-white/20 text-lg font-bold">상대 코트</span>
                    </div>
                    <div className="absolute inset-0 left-1/2 right-0 flex items-center justify-center pointer-events-none select-none z-10" aria-hidden>
                        <span className="text-white/20 text-lg font-bold">우리 코트</span>
                    </div>
                </>
            )}
            {selectedDot && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[60]" onClick={(e) => e.stopPropagation()}>
                {renderTooltip()}
            </div>
        )}
            {resultFilter !== 'CONCEDE' && scoreClustered.filter((c) => c.statType === 'SPIKE_SUCCESS' && passesFilter(c.statType)).map((p, i) => (
                <div
                    key={`score-s-${i}`}
                    role="button"
                    tabIndex={0}
                    className="group absolute rounded-full border-2 border-green-300 cursor-pointer z-20 min-w-4 min-h-4 touch-manipulation"
                    style={{ left: `${scoreLeftPct(p.y)}%`, top: `${p.x}%`, width: `${Math.max(16, Math.min(10 + p.count * 3, 22))}px`, height: `${Math.max(16, Math.min(10 + p.count * 3, 22))}px`, transform: 'translate(-50%, -50%)', backgroundColor: '#4ade80', opacity: hotZoneOpacity(p.count), boxShadow: '0 0 8px rgba(74, 222, 128, 0.6)' }}
                    onClick={(e) => { e.stopPropagation(); setSelectedDot({ ...p, variant: 'score' }); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedDot({ ...p, variant: 'score' }); } }}
                >
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block z-50 bg-black/80 text-white text-xs p-2 rounded whitespace-nowrap pointer-events-none" role="tooltip">{dotTooltipText(p)}</span>
                </div>
            ))}
            {resultFilter !== 'CONCEDE' && scoreClustered.filter((c) => c.statType === 'SERVICE_ACE' && passesFilter(c.statType)).map((p, i) => (
                <div
                    key={`score-a-${i}`}
                    role="button"
                    tabIndex={0}
                    className="group absolute rounded-full border-2 border-cyan-300 cursor-pointer z-20 min-w-4 min-h-4 touch-manipulation"
                    style={{ left: `${scoreLeftPct(p.y)}%`, top: `${p.x}%`, width: `${Math.max(16, Math.min(10 + p.count * 3, 22))}px`, height: `${Math.max(16, Math.min(10 + p.count * 3, 22))}px`, transform: 'translate(-50%, -50%)', backgroundColor: '#22d3ee', opacity: hotZoneOpacity(p.count), boxShadow: '0 0 8px rgba(34, 211, 238, 0.6)' }}
                    onClick={(e) => { e.stopPropagation(); setSelectedDot({ ...p, variant: 'score' }); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedDot({ ...p, variant: 'score' }); } }}
                >
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block z-50 bg-black/80 text-white text-xs p-2 rounded whitespace-nowrap pointer-events-none" role="tooltip">{dotTooltipText(p)}</span>
                </div>
            ))}
            {resultFilter !== 'SCORE' && concedeClustered.filter((c) => c.statType === 'SPIKE_SUCCESS' && passesFilter(c.statType)).map((p, i) => (
                <div
                    key={`concede-s-${i}`}
                    role="button"
                    tabIndex={0}
                    className="group absolute rounded-full border-2 border-red-400 cursor-pointer z-20 min-w-4 min-h-4 touch-manipulation"
                    style={{ left: `${concedeLeftPct(p.y)}%`, top: `${p.x}%`, width: `${Math.max(16, Math.min(10 + p.count * 3, 22))}px`, height: `${Math.max(16, Math.min(10 + p.count * 3, 22))}px`, transform: 'translate(-50%, -50%)', backgroundColor: '#ef4444', opacity: hotZoneOpacity(p.count), boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)' }}
                    onClick={(e) => { e.stopPropagation(); setSelectedDot({ ...p, variant: 'concede' }); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedDot({ ...p, variant: 'concede' }); } }}
                >
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block z-50 bg-black/80 text-white text-xs p-2 rounded whitespace-nowrap pointer-events-none" role="tooltip">{dotTooltipText(p)}</span>
                </div>
            ))}
            {resultFilter !== 'SCORE' && concedeClustered.filter((c) => c.statType === 'SERVICE_ACE' && passesFilter(c.statType)).map((p, i) => (
                <div
                    key={`concede-a-${i}`}
                    role="button"
                    tabIndex={0}
                    className="group absolute rounded-full border-2 border-yellow-300 cursor-pointer z-20 min-w-4 min-h-4 touch-manipulation"
                    style={{ left: `${concedeLeftPct(p.y)}%`, top: `${p.x}%`, width: `${Math.max(16, Math.min(10 + p.count * 3, 22))}px`, height: `${Math.max(16, Math.min(10 + p.count * 3, 22))}px`, transform: 'translate(-50%, -50%)', backgroundColor: '#facc15', opacity: hotZoneOpacity(p.count), boxShadow: '0 0 8px rgba(250, 204, 21, 0.6)' }}
                    onClick={(e) => { e.stopPropagation(); setSelectedDot({ ...p, variant: 'concede' }); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedDot({ ...p, variant: 'concede' }); } }}
                >
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block z-50 bg-black/80 text-white text-xs p-2 rounded whitespace-nowrap pointer-events-none" role="tooltip">{dotTooltipText(p)}</span>
                </div>
            ))}
        </div>
    );

    return (
        <div className={`w-full ${className}`}>
            {title && <h4 className="text-sm font-semibold text-slate-300 mb-2">{title}</h4>}
            {selectedPlayerId && selectedPlayerName && (
                <div className="flex flex-wrap items-center justify-center gap-2 mb-2">
                    <span className="text-xs text-slate-400">현재 필터:</span>
                    <button
                        type="button"
                        onClick={() => setSelectedPlayerId(null)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-700 text-slate-200 hover:bg-slate-600"
                    >
                        {selectedPlayerName} <span className="text-slate-400" aria-label="초기화">✖️</span>
                    </button>
                    <span className="text-xs text-slate-500">(초기화)</span>
                </div>
            )}
            {filterButtons}
            <div className="flex flex-wrap justify-center gap-2 mb-2">
                <button
                    type="button"
                    onClick={() => setIsSummaryOpen(true)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-700/80 hover:bg-amber-600 text-white border border-amber-600/50"
                >
                    📊 데이터 요약
                </button>
            </div>
            <div className="relative">
                <div className="absolute top-2 right-2 z-30">
                    <button
                        type="button"
                        onClick={() => setIsExpanded(true)}
                        className="bg-slate-700/90 hover:bg-slate-600 text-white text-xs font-medium py-1.5 px-2.5 rounded-lg shadow border border-slate-600"
                        aria-label="크게 보기"
                    >
                        🔍 확대
                    </button>
                </div>
                {fullCourt}
            </div>
            {legend}
            <HeatmapSummaryModal
                isOpen={isSummaryOpen}
                onClose={() => setIsSummaryOpen(false)}
                scoreRecords={scoreRecords}
                concedeRecords={concedeRecords}
                onSelectPlayer={(id) => { setSelectedPlayerId(id); setIsSummaryOpen(false); }}
                selectedPlayerId={selectedPlayerId}
            />
            {isExpanded && (
                <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => { setIsExpanded(false); setSelectedDot(null); }}>
                    <div className="relative w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => { setIsExpanded(false); setSelectedDot(null); }} className="absolute -top-10 right-0 text-white hover:text-slate-300 text-2xl font-bold z-10" aria-label="닫기">✕</button>
                        <div className="relative w-full mx-auto rounded-lg overflow-hidden bg-slate-800 border-2 border-white" style={{ aspectRatio: '2 / 1', height: 'min(70vh, 60vw)', boxShadow: '0 6px 16px rgba(0,0,0,0.4)' }}>
                            <div className={`absolute top-0 bottom-0 left-0 w-1/2 pointer-events-none ${isLeft ? 'bg-sky-500/10' : 'bg-rose-400/15'}`} aria-hidden />
                            <div className={`absolute top-0 bottom-0 right-0 w-1/2 pointer-events-none ${isLeft ? 'bg-rose-400/15' : 'bg-sky-500/10'}`} aria-hidden />
                            <div className="absolute left-1/2 top-0 bottom-0 w-2 -translate-x-1/2 bg-white z-10 shadow-lg" />
                            <div className="absolute top-0 bottom-0 w-px bg-white/70 z-10" style={{ left: '33.33%' }} />
                            <div className="absolute top-0 bottom-0 w-px bg-white/70 z-10" style={{ left: '66.67%' }} />
                            <div className="absolute top-0 left-0 right-0 h-px bg-white z-10" />
                            <div className="absolute bottom-0 left-0 right-0 h-px bg-white z-10" />
                            <div className="absolute top-0 bottom-0 w-px bg-white left-0 z-10" />
                            <div className="absolute top-0 bottom-0 w-px bg-white right-0 z-10" />
                            {isLeft ? (
                                <>
                                    <div className="absolute inset-0 left-0 right-1/2 flex items-center justify-center pointer-events-none select-none z-10" aria-hidden><span className="text-white/20 text-lg font-bold">우리 코트</span></div>
                                    <div className="absolute inset-0 left-1/2 right-0 flex items-center justify-center pointer-events-none select-none z-10" aria-hidden><span className="text-white/20 text-lg font-bold">상대 코트</span></div>
                                </>
                            ) : (
                                <>
                                    <div className="absolute inset-0 left-0 right-1/2 flex items-center justify-center pointer-events-none select-none z-10" aria-hidden><span className="text-white/20 text-lg font-bold">상대 코트</span></div>
                                    <div className="absolute inset-0 left-1/2 right-0 flex items-center justify-center pointer-events-none select-none z-10" aria-hidden><span className="text-white/20 text-lg font-bold">우리 코트</span></div>
                                </>
                            )}
                            {selectedDot && (
                                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[60]" onClick={(e) => e.stopPropagation()}>
                                    {renderTooltip()}
                                </div>
                            )}
                            {resultFilter !== 'CONCEDE' && scoreClustered.filter((c) => c.statType === 'SPIKE_SUCCESS' && passesFilter(c.statType)).map((p, i) => (
                                <div key={`ex-score-s-${i}`} role="button" tabIndex={0} className="group absolute rounded-full border-2 border-green-300 cursor-pointer z-20 min-w-4 min-h-4 touch-manipulation" style={{ left: `${scoreLeftPct(p.y)}%`, top: `${p.x}%`, width: `${Math.max(20, Math.min(12 + p.count * 4, 28))}px`, height: `${Math.max(20, Math.min(12 + p.count * 4, 28))}px`, transform: 'translate(-50%, -50%)', backgroundColor: '#4ade80', opacity: hotZoneOpacity(p.count), boxShadow: '0 0 8px rgba(74, 222, 128, 0.6)' }} onClick={(e) => { e.stopPropagation(); setSelectedDot({ ...p, variant: 'score' }); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedDot({ ...p, variant: 'score' }); } }}>
                                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block z-50 bg-black/80 text-white text-xs p-2 rounded whitespace-nowrap pointer-events-none" role="tooltip">{dotTooltipText(p)}</span>
                                </div>
                            ))}
                            {resultFilter !== 'CONCEDE' && scoreClustered.filter((c) => c.statType === 'SERVICE_ACE' && passesFilter(c.statType)).map((p, i) => (
                                <div key={`ex-score-a-${i}`} role="button" tabIndex={0} className="group absolute rounded-full border-2 border-cyan-300 cursor-pointer z-20 min-w-4 min-h-4 touch-manipulation" style={{ left: `${scoreLeftPct(p.y)}%`, top: `${p.x}%`, width: `${Math.max(20, Math.min(12 + p.count * 4, 28))}px`, height: `${Math.max(20, Math.min(12 + p.count * 4, 28))}px`, transform: 'translate(-50%, -50%)', backgroundColor: '#22d3ee', opacity: hotZoneOpacity(p.count), boxShadow: '0 0 8px rgba(34, 211, 238, 0.6)' }} onClick={(e) => { e.stopPropagation(); setSelectedDot({ ...p, variant: 'score' }); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedDot({ ...p, variant: 'score' }); } }}>
                                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block z-50 bg-black/80 text-white text-xs p-2 rounded whitespace-nowrap pointer-events-none" role="tooltip">{dotTooltipText(p)}</span>
                                </div>
                            ))}
                            {resultFilter !== 'SCORE' && concedeClustered.filter((c) => c.statType === 'SPIKE_SUCCESS' && passesFilter(c.statType)).map((p, i) => (
                                <div key={`ex-concede-s-${i}`} role="button" tabIndex={0} className="group absolute rounded-full border-2 border-red-400 cursor-pointer z-20 min-w-4 min-h-4 touch-manipulation" style={{ left: `${concedeLeftPct(p.y)}%`, top: `${p.x}%`, width: `${Math.max(20, Math.min(12 + p.count * 4, 28))}px`, height: `${Math.max(20, Math.min(12 + p.count * 4, 28))}px`, transform: 'translate(-50%, -50%)', backgroundColor: '#ef4444', opacity: hotZoneOpacity(p.count), boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)' }} onClick={(e) => { e.stopPropagation(); setSelectedDot({ ...p, variant: 'concede' }); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedDot({ ...p, variant: 'concede' }); } }}>
                                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block z-50 bg-black/80 text-white text-xs p-2 rounded whitespace-nowrap pointer-events-none" role="tooltip">{dotTooltipText(p)}</span>
                                </div>
                            ))}
                            {resultFilter !== 'SCORE' && concedeClustered.filter((c) => c.statType === 'SERVICE_ACE' && passesFilter(c.statType)).map((p, i) => (
                                <div key={`ex-concede-a-${i}`} role="button" tabIndex={0} className="group absolute rounded-full border-2 border-yellow-300 cursor-pointer z-20 min-w-4 min-h-4 touch-manipulation" style={{ left: `${concedeLeftPct(p.y)}%`, top: `${p.x}%`, width: `${Math.max(20, Math.min(12 + p.count * 4, 28))}px`, height: `${Math.max(20, Math.min(12 + p.count * 4, 28))}px`, transform: 'translate(-50%, -50%)', backgroundColor: '#facc15', opacity: hotZoneOpacity(p.count), boxShadow: '0 0 8px rgba(250, 204, 21, 0.6)' }} onClick={(e) => { e.stopPropagation(); setSelectedDot({ ...p, variant: 'concede' }); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedDot({ ...p, variant: 'concede' }); } }}>
                                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block z-50 bg-black/80 text-white text-xs p-2 rounded whitespace-nowrap pointer-events-none" role="tooltip">{dotTooltipText(p)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HeatmapViewer;
