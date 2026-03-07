import React, { useEffect } from 'react';
import { Player } from '../types';

export interface MvpDetailData {
    player: Player;
    teamName: string;
    totalPoints: number;
    sumPoints?: number;
    sumServiceAces?: number;
    sumBlockingPoints?: number;
    sumDigs?: number;
    sumAssists?: number;
    sumServeIn?: number;
    sumServiceFaults?: number;
}

interface MvpDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    mvpData?: MvpDetailData | null;
}

const MvpDetailModal: React.FC<MvpDetailModalProps> = ({ isOpen, onClose, mvpData }) => {
    useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);
    if (!isOpen || !mvpData?.player) return null;

    const { player, teamName, totalPoints, sumPoints = 0, sumServiceAces = 0, sumBlockingPoints = 0, sumDigs = 0, sumAssists = 0, sumServeIn = 0, sumServiceFaults = 0 } = mvpData;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
            <div className="bg-slate-900 rounded-2xl border border-sky-500/40 shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 text-slate-100" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-500">
                        🏆 MVP 상세
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white text-2xl leading-none"
                        aria-label="닫기"
                    >
                        ×
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
                        <p className="font-semibold text-lg text-white">{player?.originalName || '이름 없음'}</p>
                        <p className="text-sm text-slate-400">{teamName || ''}</p>
                        <p className="mt-2 text-2xl font-bold text-sky-300 font-mono">{totalPoints?.toFixed(1) ?? '0.0'}점</p>
                        <p className="text-xs text-slate-500 mt-1">리그/토너먼트 가중치 합산</p>
                    </div>

                    <div className="border-t border-slate-700 pt-3">
                        <p className="text-xs font-semibold text-slate-400 mb-2">부문별 기록 (순수 횟수)</p>
                        <ul className="space-y-1.5 text-sm">
                            <li className="flex justify-between"><span className="text-slate-300">공격/스파이크 득점</span><span className="font-mono text-sky-300">{sumPoints}점</span></li>
                            <li className="flex justify-between"><span className="text-slate-300">서브 에이스</span><span className="font-mono text-sky-300">{sumServiceAces}개</span></li>
                            <li className="flex justify-between"><span className="text-slate-300">블로킹 득점</span><span className="font-mono text-sky-300">{sumBlockingPoints}개</span></li>
                            <li className="flex justify-between"><span className="text-slate-300">디그</span><span className="font-mono text-sky-300">{sumDigs}개</span></li>
                            <li className="flex justify-between"><span className="text-slate-300">어시스트</span><span className="font-mono text-sky-300">{sumAssists}개</span></li>
                            <li className="flex justify-between"><span className="text-slate-300">서브 성공(In)</span><span className="font-mono text-sky-300">{sumServeIn}개</span></li>
                            <li className="flex justify-between"><span className="text-slate-300">범실</span><span className="font-mono text-red-400/90">{sumServiceFaults}개</span></li>
                        </ul>
                    </div>
                </div>

                <div className="mt-4 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-white font-semibold text-sm"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MvpDetailModal;
