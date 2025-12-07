import React from 'react';
import { Player } from '../types';
import { CrownIcon, ChartBarIcon } from './icons';

interface PlayerCardProps {
    player: Player;
    onClick: (player: Player) => void;
    onViewStats: (player: Player) => void;
    isDraggable: boolean;
    showRealNames: boolean;
    onToggleComparison: (playerId: string) => void;
    isComparisonSelected: boolean;
    isCaptainSelectable?: boolean;
    isCaptainSelected?: boolean;
    onDoubleClick?: (player: Player) => void;
}

const PlayerCard: React.FC<PlayerCardProps> = ({ 
    player, 
    onClick, 
    onViewStats,
    isDraggable, 
    showRealNames, 
    onToggleComparison, 
    isComparisonSelected,
    isCaptainSelectable,
    isCaptainSelected,
    onDoubleClick,
}) => {
    
    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        if (!isDraggable) {
            e.preventDefault();
            return;
        }
        e.dataTransfer.setData('playerId', player.id);
        e.currentTarget.style.opacity = '0.4';
    };

    const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
        e.currentTarget.style.opacity = '1';
    };

    const handleComparisonToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation();
        onToggleComparison(player.id);
    };
    
    const baseClasses = 'flex items-center justify-between p-3 rounded-lg shadow-md transition-all duration-150 ease-in-out border-l-4';
    
    let stateClasses = '';
    let cursorClass = '';
    
    const baseBgClass = 'bg-slate-800';

    if (player.isCaptain) {
        stateClasses = `border-yellow-400 ${baseBgClass.replace('800', '700')}`;
        cursorClass = 'cursor-pointer';
    } else if (isDraggable) {
        stateClasses = `border-[#00A3FF] ${baseBgClass}`;
        cursorClass = 'cursor-grab active:cursor-grabbing';
    } else if (isCaptainSelectable) {
        stateClasses = isCaptainSelected 
            ? 'border-[#00A3FF] bg-[#00A3FF]/10 ring-2 ring-[#00A3FF] shadow-lg shadow-[#00A3FF]/20'
            : `border-slate-600 ${baseBgClass} hover:bg-slate-700`;
        cursorClass = 'cursor-pointer';
    } else {
        stateClasses = `border-slate-600 ${baseBgClass} hover:bg-slate-700`;
        cursorClass = 'cursor-pointer';
    }

    if (onDoubleClick) {
        cursorClass = 'cursor-pointer';
    }

    const genderIcon = player.gender.includes('남') ? '♂' : player.gender.includes('여') ? '♀' : null;
    const genderColor = player.gender.includes('남') ? 'text-blue-400' : player.gender.includes('여') ? 'text-pink-400' : 'text-slate-400';

    return (
        <div
            onClick={() => onClick(player)}
            onDoubleClick={() => onDoubleClick?.(player)}
            draggable={isDraggable}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            className={`${baseClasses} ${stateClasses} ${cursorClass}`}
        >
            <div className="flex-grow min-w-0">
                <div className="flex items-center gap-2">
                    {player.isCaptain && <CrownIcon className="w-5 h-5 text-yellow-400 flex-shrink-0" />}
                    <span className="font-bold text-lg truncate text-slate-200">
                        {(showRealNames || (player.isCaptain && !isCaptainSelectable)) ? player.originalName : player.anonymousName}
                    </span>
                    {genderIcon && <span className={`font-bold text-lg ${genderColor}`}>{genderIcon}</span>}
                    <span className="text-xs font-mono bg-slate-700 text-[#99dfff] px-2 py-0.5 rounded-full">{player.totalScore.toFixed(1)}</span>
                </div>
                {showRealNames && (
                    <p className="text-xs text-slate-400 mt-1 truncate pl-1">
                        {player.class}반 {player.studentNumber}번 {player.originalName} ({player.gender})
                    </p>
                )}
            </div>
            <div className="flex items-center pl-2 flex-shrink-0">
                 <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        onViewStats(player);
                    }}
                    className="p-1 rounded-full hover:bg-slate-600"
                    title={`${player.anonymousName} 능력치 보기`}
                >
                    <ChartBarIcon className="w-5 h-5 text-slate-400" />
                </button>
                 <div className="ml-2" title="비교 선택">
                     <input
                        type="checkbox"
                        checked={isComparisonSelected}
                        onChange={handleComparisonToggle}
                        onClick={e => e.stopPropagation()}
                        className="h-5 w-5 bg-slate-700 border-slate-500 rounded text-[#00A3FF] focus:ring-[#00A3FF] cursor-pointer"
                        aria-label={`Compare ${player.anonymousName}`}
                    />
                </div>
            </div>
        </div>
    );
};

export default PlayerCard;