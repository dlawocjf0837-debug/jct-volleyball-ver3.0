

import React from 'react';
import { Badge, Player } from '../types';
import { useTranslation } from '../hooks/useTranslation';

interface BadgeRankingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: {
        badge: Badge;
        rankings: { player: Player; value: number; rank: number | string }[];
    } | null;
}

const BadgeRankingsModal: React.FC<BadgeRankingsModalProps> = ({ isOpen, onClose, data }) => {
    const { t } = useTranslation();
    if (!isOpen || !data) return null;

    const { badge, rankings } = data;
    
    // For competitive badges, we usually care about top 3, but include all ties for 3rd place
    const topRankValue = rankings.length > 2 ? rankings[2].rank : 3;
    // FIX: Ensure topRankValue is treated as a number during comparison to avoid type errors.
    const topRankings = rankings.filter(r => typeof r.rank === 'number' && r.rank <= Number(topRankValue));

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4 animate-fade-in"
            onClick={onClose}
        >
            <div 
                className="bg-slate-900 rounded-lg shadow-2xl p-6 w-full max-w-md text-white border border-yellow-400"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-4 mb-4">
                    <badge.icon className="w-12 h-12 text-yellow-400 flex-shrink-0" />
                    <div>
{/* FIX: Use 'nameKey' and 'descriptionKey' from the badge object with the translation hook 't'. */}
                        <h2 className="text-2xl font-bold text-yellow-300">{t(badge.nameKey)} 랭킹</h2>
                        <p className="text-sm text-slate-400">{t(badge.descriptionKey)}</p>
                    </div>
                </div>
                {topRankings.length > 0 ? (
                    <div className="max-h-80 overflow-y-auto bg-slate-800/50 p-2 rounded-lg">
                        <ul className="divide-y divide-slate-700">
                            {topRankings.map(({ player, value, rank }) => (
                                <li key={player.id} className="p-3 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <span className="font-bold text-xl w-8 text-center">{rank}위</span>
                                        <div>
                                            <span className="font-semibold text-lg text-slate-200">{player.originalName}</span>
                                            <span className="text-xs text-slate-500 ml-2">({player.class}반 {player.studentNumber}번)</span>
                                        </div>
                                    </div>
                                    <span className="font-mono text-2xl text-sky-400 font-bold">{value}회</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <p className="text-center text-slate-500 py-4">랭킹 데이터가 없습니다.</p>
                )}
                <div className="text-center mt-6">
                    <button onClick={onClose} className="bg-slate-600 hover:bg-slate-500 font-bold py-2 px-6 rounded-lg">닫기</button>
                </div>
            </div>
        </div>
    );
};

export default BadgeRankingsModal;