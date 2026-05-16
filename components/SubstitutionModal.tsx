import React, { useState, useMemo, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { TeamMatchState, Player, Action } from '../types';
import { useTranslation } from '../hooks/useTranslation';

interface SubstitutionModalProps {
    isOpen: boolean;
    onClose: () => void;
    teamA: TeamMatchState;
    teamB: TeamMatchState;
    dispatch: React.Dispatch<Action>;
    showPlayerMemo?: boolean;
    isClubMode?: boolean;
    onOpenPlayerAnalysisMemo?: (player: Player, team: 'A' | 'B') => void;
}

type PendingSubstitution = { id: string; playerOut: string; playerIn: string; outName: string; inName: string };

const SubstitutionModal: React.FC<SubstitutionModalProps> = ({
    isOpen,
    onClose,
    teamA,
    teamB,
    dispatch,
    showPlayerMemo = false,
    isClubMode = false,
    onOpenPlayerAnalysisMemo,
}) => {
    const { t } = useTranslation();
    const [selectedTeam, setSelectedTeam] = useState<'A' | 'B'>('A');
    const [playerOut, setPlayerOut] = useState<string | null>(null);
    const [playerIn, setPlayerIn] = useState<string | null>(null);
    const [pendingOutId, setPendingOutId] = useState<string | null>(null);
    const [pendingInId, setPendingInId] = useState<string | null>(null);
    const [pendingSubstitutions, setPendingSubstitutions] = useState<PendingSubstitution[]>([]);
    const team = selectedTeam === 'A' ? teamA : teamB;

    const onCourtPlayers = useMemo(
        () => team.onCourtPlayerIds.map(id => team.players[id]).filter(Boolean),
        [team]
    );

    const benchPlayers = useMemo(
        () => team.benchPlayerIds.map(id => team.players[id]).filter(Boolean),
        [team]
    );

    const pendingOutIds = useMemo(() => new Set(pendingSubstitutions.map(p => p.playerOut)), [pendingSubstitutions]);
    const pendingInIds = useMemo(() => new Set(pendingSubstitutions.map(p => p.playerIn)), [pendingSubstitutions]);

    const addPairToPending = () => {
        if (!pendingOutId || !pendingInId || pendingOutId === pendingInId) return;
        if (pendingOutIds.has(pendingOutId) || pendingInIds.has(pendingInId)) return;
        const outP = team.players[pendingOutId];
        const inP = team.players[pendingInId];
        if (!outP || !inP) return;
        setPendingSubstitutions(prev => [
            ...prev,
            {
                id: `${pendingOutId}-${pendingInId}-${Date.now()}`,
                playerOut: pendingOutId,
                playerIn: pendingInId,
                outName: outP.originalName,
                inName: inP.originalName,
            },
        ]);
        setPendingOutId(null);
        setPendingInId(null);
    };

    const removePendingSubstitution = (id: string) => {
        setPendingSubstitutions(prev => prev.filter(p => p.id !== id));
    };

    const handleExecuteSubstitutions = () => {
        if (!isClubMode || pendingSubstitutions.length === 0) return;
        dispatch({
            type: 'SUBSTITUTE_PLAYERS',
            team: selectedTeam,
            substitutions: pendingSubstitutions.map(p => ({ playerOut: p.playerOut, playerIn: p.playerIn })),
        });
        handleClose();
    };

    const handleSubstitute = () => {
        if (playerIn && playerOut) {
            dispatch({ type: 'SUBSTITUTE_PLAYER', team: selectedTeam, playerIn, playerOut });
            handleClose();
        }
    };

    const handleClose = () => {
        setPlayerIn(null);
        setPlayerOut(null);
        setPendingOutId(null);
        setPendingInId(null);
        setPendingSubstitutions([]);
        onClose();
    };

    useEffect(() => {
        if (!isOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [isOpen]);

    useEffect(() => {
        if (!isClubMode) return;
        setPendingOutId(null);
        setPendingInId(null);
        setPendingSubstitutions([]);
    }, [selectedTeam, isClubMode]);

    if (!isOpen) return null;

    const modal = (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 font-sans" onClick={handleClose}>
            <div className={`bg-slate-900 rounded-lg shadow-2xl p-6 w-full ${isClubMode ? 'max-w-5xl' : 'max-w-2xl'} max-h-[90vh] overflow-y-auto text-white border border-slate-700 flex flex-col`} onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-[#00A3FF]">{t('substitute_player')}</h2>
                    <button type="button" onClick={handleClose} className="text-2xl font-bold text-slate-500 hover:text-white">&times;</button>
                </div>

                <div className="flex justify-center gap-4 mb-4 border-b border-slate-700">
                    <button type="button" onClick={() => setSelectedTeam('A')} className={`py-2 px-4 text-lg font-semibold border-b-2 ${selectedTeam === 'A' ? 'border-sky-500 text-sky-400' : 'border-transparent text-slate-400'}`}>{teamA.name}</button>
                    <button type="button" onClick={() => setSelectedTeam('B')} className={`py-2 px-4 text-lg font-semibold border-b-2 ${selectedTeam === 'B' ? 'border-red-500 text-red-400' : 'border-transparent text-slate-400'}`}>{teamB.name}</button>
                </div>

                {isClubMode ? (
                    <>
                        <p className="text-slate-400 text-sm mb-3 text-center">
                            코트(Out) 1명과 벤치(In) 1명을 선택한 뒤 <span className="text-sky-400 font-semibold">페어 추가</span>를 누르세요. 목록이 완성되면 일괄 교체 적용합니다.
                        </p>
                        <div className="flex flex-col lg:flex-row gap-4 min-h-0 flex-1">
                            <div className="flex-1 grid grid-cols-2 gap-3 min-h-[14rem] max-h-[40vh] overflow-y-auto">
                                <div>
                                    <h3 className="text-sm font-semibold text-center mb-2 text-red-300">{t('on_court_players')} (Out)</h3>
                                    <div className="space-y-1.5 bg-slate-800 p-2 rounded-lg">
                                        {onCourtPlayers.map(p => {
                                            const inPending = pendingOutIds.has(p.id);
                                            const isPick = pendingOutId === p.id;
                                            return (
                                                <div key={p.id} className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        disabled={inPending}
                                                        onClick={() => setPendingOutId(isPick ? null : p.id)}
                                                        className={`flex-1 text-left p-2.5 rounded-md text-sm disabled:opacity-40 ${
                                                            isPick ? 'bg-red-600 text-white ring-2 ring-red-400' : inPending ? 'bg-slate-800 text-slate-500' : 'bg-slate-700 hover:bg-slate-600'
                                                        } ${p.isLibero ? 'border border-pink-500/50' : ''}`}
                                                    >
                                                        {p.originalName}{p.isLibero ? ' [L]' : ''}
                                                    </button>
                                                    {showPlayerMemo && (
                                                        <button type="button" onClick={e => { e.stopPropagation(); onOpenPlayerAnalysisMemo?.(p, selectedTeam); }} className="p-1 rounded hover:bg-slate-600 text-amber-400/90 shrink-0" aria-label="전력 분석 메모">📝</button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-center mb-2 text-green-300">{t('bench_players')} (In)</h3>
                                    <div className="space-y-1.5 bg-slate-800 p-2 rounded-lg">
                                        {benchPlayers.map(p => {
                                            const inPending = pendingInIds.has(p.id);
                                            const isPick = pendingInId === p.id;
                                            return (
                                                <div key={p.id} className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        disabled={inPending}
                                                        onClick={() => setPendingInId(isPick ? null : p.id)}
                                                        className={`flex-1 text-left p-2.5 rounded-md text-sm disabled:opacity-40 ${
                                                            isPick ? 'bg-green-600 text-white ring-2 ring-green-400' : inPending ? 'bg-slate-800 text-slate-500' : 'bg-slate-700 hover:bg-slate-600'
                                                        } ${p.isLibero ? 'border border-pink-500/50' : ''}`}
                                                    >
                                                        {p.originalName}{p.isLibero ? ' [L]' : ''}
                                                    </button>
                                                    {showPlayerMemo && (
                                                        <button type="button" onClick={e => { e.stopPropagation(); onOpenPlayerAnalysisMemo?.(p, selectedTeam); }} className="p-1 rounded hover:bg-slate-600 text-amber-400/90 shrink-0" aria-label="전력 분석 메모">📝</button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div className="w-full lg:w-72 flex-shrink-0 flex flex-col border border-slate-600 rounded-lg bg-slate-800/80 p-3 min-h-[14rem]">
                                <h3 className="text-sm font-bold text-sky-300 mb-2">교체 대기 명단</h3>
                                <div className="flex-1 overflow-y-auto space-y-2 min-h-[8rem]">
                                    {pendingSubstitutions.length === 0 ? (
                                        <p className="text-slate-500 text-xs text-center py-6">추가된 교체 페어가 없습니다.</p>
                                    ) : (
                                        pendingSubstitutions.map(item => (
                                            <div key={item.id} className="flex items-center gap-2 bg-slate-900/80 rounded-md px-2 py-2 text-sm border border-slate-600">
                                                <span className="flex-1 min-w-0">
                                                    <span className="text-red-300">{item.outName}</span>
                                                    <span className="text-slate-500 mx-1">➡️</span>
                                                    <span className="text-green-300">{item.inName}</span>
                                                </span>
                                                <button type="button" onClick={() => removePendingSubstitution(item.id)} className="text-slate-400 hover:text-red-400 shrink-0 px-1" aria-label="삭제">&times;</button>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={addPairToPending}
                                    disabled={!pendingOutId || !pendingInId}
                                    className="mt-2 w-full py-2 rounded-lg bg-sky-700 hover:bg-sky-600 disabled:bg-slate-700 disabled:cursor-not-allowed text-sm font-semibold"
                                >
                                    페어 추가
                                </button>
                            </div>
                        </div>
                        <div className="mt-4 flex justify-end gap-3">
                            <button type="button" onClick={handleClose} className="bg-slate-600 hover:bg-slate-500 font-bold py-2 px-6 rounded-lg">{t('cancel')}</button>
                            <button
                                type="button"
                                onClick={handleExecuteSubstitutions}
                                disabled={pendingSubstitutions.length === 0}
                                className="bg-green-600 hover:bg-green-500 font-bold py-2 px-6 rounded-lg disabled:bg-slate-700 disabled:cursor-not-allowed"
                            >
                                교체 실행 ({pendingSubstitutions.length}건)
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="grid grid-cols-2 gap-4 min-h-[20rem] max-h-[50vh] overflow-y-auto">
                            <div>
                                <h3 className="text-lg font-semibold text-center mb-2">{t('on_court_players')} ({t('player_to_remove')})</h3>
                                <div className="space-y-2 bg-slate-800 p-2 rounded-lg">
                                    {onCourtPlayers.map(p => (
                                        <div key={p.id} className="flex items-center gap-2">
                                            <button type="button" onClick={() => setPlayerOut(p.id)} className={`flex-1 text-left p-3 rounded-md ${playerOut === p.id ? 'bg-red-600 text-white' : 'bg-slate-700 hover:bg-slate-600'}`}>{p.originalName}</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-center mb-2">{t('bench_players')} ({t('player_to_add')})</h3>
                                <div className="space-y-2 bg-slate-800 p-2 rounded-lg">
                                    {benchPlayers.map(p => (
                                        <div key={p.id} className="flex items-center gap-2">
                                            <button type="button" onClick={() => setPlayerIn(p.id)} className={`flex-1 text-left p-3 rounded-md ${playerIn === p.id ? 'bg-green-600 text-white' : 'bg-slate-700 hover:bg-slate-600'}`}>{p.originalName}</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-4">
                            <button type="button" onClick={handleClose} className="bg-slate-600 hover:bg-slate-500 font-bold py-2 px-6 rounded-lg">{t('cancel')}</button>
                            <button type="button" onClick={handleSubstitute} disabled={!playerIn || !playerOut} className="bg-green-600 hover:bg-green-500 font-bold py-2 px-6 rounded-lg disabled:bg-slate-700 disabled:cursor-not-allowed">{t('substitute')}</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );

    return typeof document !== 'undefined' ? ReactDOM.createPortal(modal, document.body) : null;
};

export default SubstitutionModal;
