import React, { useMemo, useEffect } from 'react';
import ReactDOM from 'react-dom';
import type { HitRecord } from './HeatmapViewer';

export interface HeatmapSummaryModalProps {
    isOpen: boolean;
    onClose: () => void;
    scoreRecords: HitRecord[];
    concedeRecords: HitRecord[];
    onSelectPlayer: (playerId: string) => void;
    selectedPlayerId: string | null;
}

type PlayerKey = string;
type PlayerAgg = { id: PlayerKey; name: string; spike: number; serve: number };

function aggregateByPlayer(records: HitRecord[]): Map<PlayerKey, PlayerAgg> {
    const map = new Map<PlayerKey, PlayerAgg>();
    records.forEach((r) => {
        const key = (r.player?.id ?? r.player?.name ?? '알 수 없음') as PlayerKey;
        const name = r.player?.name ?? key;
        if (!map.has(key)) map.set(key, { id: key, name, spike: 0, serve: 0 });
        const agg = map.get(key)!;
        if (r.statType === 'SPIKE_SUCCESS') agg.spike += 1;
        else if (r.statType === 'SERVICE_ACE') agg.serve += 1;
    });
    return map;
}

function topN(map: Map<PlayerKey, PlayerAgg>, by: 'spike' | 'serve', n: number): PlayerAgg[] {
    return Array.from(map.values())
        .sort((a, b) => (by === 'spike' ? b.spike - a.spike : b.serve - a.serve))
        .filter((p) => (by === 'spike' ? p.spike > 0 : p.serve > 0))
        .slice(0, n);
}

const HeatmapSummaryModal: React.FC<HeatmapSummaryModalProps> = ({
    isOpen,
    onClose,
    scoreRecords,
    concedeRecords,
    onSelectPlayer,
    selectedPlayerId,
}) => {
    const { ourTopSpike, ourTopServe, theirTopSpike, theirTopServe } = useMemo(() => {
        const ourMap = aggregateByPlayer(scoreRecords);
        const theirMap = aggregateByPlayer(concedeRecords);
        return {
            ourTopSpike: topN(ourMap, 'spike', 3),
            ourTopServe: topN(ourMap, 'serve', 3),
            theirTopSpike: topN(theirMap, 'spike', 3),
            theirTopServe: topN(theirMap, 'serve', 3),
        };
    }, [scoreRecords, concedeRecords]);

    useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    if (!isOpen) return null;

    const renderList = (list: PlayerAgg[], label: string, emptyMsg: string) => (
        <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-400 mb-1">{label}</p>
            {list.length === 0 ? (
                <p className="text-xs text-slate-500">{emptyMsg}</p>
            ) : (
                <ul className="space-y-0.5">
                    {list.map((p, i) => (
                        <li key={p.id}>
                            <button
                                type="button"
                                onClick={() => onSelectPlayer(p.id)}
                                className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${selectedPlayerId === p.id ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700/60'}`}
                            >
                                <span className="text-slate-500 mr-1">{i + 1}.</span>
                                {p.name}
                                <span className="ml-1 text-slate-400 text-xs">
                                    ({label.includes('스파이크') ? `${p.spike}회` : `${p.serve}회`})
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );

    const modalContent = (
        <div
            className="fixed top-0 left-0 w-screen h-screen z-[99999] flex items-center justify-center bg-black/80 m-0 p-0"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label="히트맵 데이터 요약"
        >
            <div
                className="bg-slate-800 border border-slate-600 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto flex flex-col mx-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-4 border-b border-slate-700">
                    <h3 className="text-lg font-bold text-slate-200">📊 득점/실점 요약 · 탑 플레이어</h3>
                    <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white" aria-label="닫기">✕</button>
                </div>
                <div className="p-4 overflow-y-auto space-y-6">
                    <section>
                        <h4 className="text-sm font-semibold text-emerald-400 mb-3">🔥 우리 팀 주요 득점자</h4>
                        <div className="grid grid-cols-2 gap-4">
                            {renderList(ourTopSpike, '탑 스파이커 (1~3위)', '기록 없음')}
                            {renderList(ourTopServe, '탑 서버 (1~3위)', '기록 없음')}
                        </div>
                    </section>
                    <section>
                        <h4 className="text-sm font-semibold text-amber-400 mb-3">⚠️ 상대 팀 주요 득점자 (실점 원인)</h4>
                        <div className="grid grid-cols-2 gap-4">
                            {renderList(theirTopSpike, '탑 스파이커 (1~3위)', '기록 없음')}
                            {renderList(theirTopServe, '탑 서버 (1~3위)', '기록 없음')}
                        </div>
                    </section>
                    <p className="text-xs text-slate-500">선수 이름을 클릭하면 해당 선수의 히트맵만 표시됩니다.</p>
                </div>
            </div>
        </div>
    );

    return typeof document !== 'undefined' ? ReactDOM.createPortal(modalContent, document.body) : null;
};

export default HeatmapSummaryModal;
