import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { VolleyballIcon, StopwatchIcon, QuestionMarkCircleIcon, SwitchHorizontalIcon, ShieldIcon, BoltIcon, TargetIcon, FireIcon, WallIcon, LinkIcon, HandshakeIcon } from '../components/icons';
import RulesModal from '../components/RulesModal';
import TimeoutModal from '../components/TimeoutModal';
import PlayerSelectionModal from '../components/PlayerSelectionModal';
import SubstitutionModal from '../components/SubstitutionModal';
import GameLog from '../components/GameLog';
import { Action, Player, ScoreEvent, ScoreEventType } from '../types';
import TeamEmblem from '../components/TeamEmblem';
import { useTranslation } from '../hooks/useTranslation';

interface ScoreboardProps {
    onBackToMenu: () => void;
    mode: 'record' | 'referee';
}

type PendingAction = {
    actionType: 'SERVICE_ACE' | 'SERVICE_FAULT' | 'BLOCKING_POINT' | 'SPIKE_SUCCESS' | 'SERVE_IN' | 'DIG_SUCCESS' | 'ASSIST_SUCCESS';
    team: 'A' | 'B';
};

export const ScoreboardScreen: React.FC<ScoreboardProps> = ({ onBackToMenu, mode }) => {
    const { 
        matchState, matchTime, timerOn, dispatch, setTimerOn,
        matchHistory, saveMatchHistory, showToast, p2p, clearInProgressMatch,
        settings
    } = useData();
    const { t } = useTranslation();

    const [showRulesModal, setShowRulesModal] = useState(false);
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
    const [isSubModalOpen, setIsSubModalOpen] = useState(false);
    
    // Logic for Assist selection modal chain
    const [assistModalOpen, setAssistModalOpen] = useState(false);
    const [pendingAssistTeam, setPendingAssistTeam] = useState<'A' | 'B' | null>(null);

    const playersForModal = useMemo(() => {
        if (!pendingAction || !matchState) return {};
        
        const teamState = pendingAction.team === 'A' ? matchState.teamA : matchState.teamB;
        
        if (teamState.onCourtPlayerIds && teamState.onCourtPlayerIds.length > 0) {
            return teamState.onCourtPlayerIds.reduce((acc, playerId) => {
                if (teamState.players[playerId]) {
                    acc[playerId] = teamState.players[playerId];
                }
                return acc;
            }, {} as Record<string, Player>);
        }
        
        return teamState.players || {};
    }, [pendingAction, matchState]);

    const playersForAssistModal = useMemo(() => {
        if (!pendingAssistTeam || !matchState) return {};
        
        const teamState = pendingAssistTeam === 'A' ? matchState.teamA : matchState.teamB;
        
        if (teamState.onCourtPlayerIds && teamState.onCourtPlayerIds.length > 0) {
            return teamState.onCourtPlayerIds.reduce((acc, playerId) => {
                if (teamState.players[playerId]) {
                    acc[playerId] = teamState.players[playerId];
                }
                return acc;
            }, {} as Record<string, Player>);
        }
        
        return teamState.players || {};
    }, [pendingAssistTeam, matchState]);

    useEffect(() => {
        if (matchState?.servingTeam && !timerOn && matchTime === 0 && !matchState.gameOver) {
            setTimerOn(true);
        }
    }, [matchState?.servingTeam, timerOn, matchTime, matchState?.gameOver, setTimerOn]);
    
    useEffect(() => {
        if (!matchState?.timeout) return;
        const timerId = setInterval(() => {
            if (matchState?.timeout) {
                const newTimeLeft = matchState.timeout.timeLeft - 1;
                if (newTimeLeft >= 0) {
                    dispatch({ type: 'UPDATE_TIMEOUT_TIMER', timeLeft: newTimeLeft });
                } else {
                    dispatch({ type: 'END_TIMEOUT' });
                    showToast('작전 타임이 종료되었습니다.', 'success');
                    if (!matchState.gameOver) setTimerOn(true);
                }
            }
        }, 1000);
        return () => clearInterval(timerId);
    }, [matchState?.timeout, dispatch, setTimerOn, matchState?.gameOver, showToast]);


    const formatTime = (timeInSeconds: number) => {
        const minutes = Math.floor(timeInSeconds / 60).toString().padStart(2, '0');
        const seconds = (timeInSeconds % 60).toString().padStart(2, '0');
        return `${minutes}:${seconds}`;
    };

    const handleTimeout = (team: 'A' | 'B') => {
        if (!matchState) return;
        const teamState = team === 'A' ? matchState.teamA : matchState.teamB;
        if (teamState && teamState.timeouts > 0 && !matchState.gameOver && !matchState.timeout) {
            setTimerOn(false);
            dispatch({ type: 'TAKE_TIMEOUT', team });
            showToast(`${teamState.name} 작전 타임 사용!`, 'success');
        }
    };
    
    const handleSaveFinalResult = async () => {
        if (!matchState) return;
        const finalResult = { ...matchState, status: 'completed' as const, date: new Date().toISOString(), time: matchTime };
        const newHistory = [finalResult, ...matchHistory];
        await saveMatchHistory(newHistory, '최종 경기 기록이 저장되었습니다!');
        clearInProgressMatch();
        onBackToMenu();
    };

    const handleCloseTimeout = () => {
        dispatch({ type: 'END_TIMEOUT' });
        if (matchState && !matchState.gameOver) setTimerOn(true);
    };

    const handlePlayerSelectAndDispatch = (playerId: string) => {
        if (!pendingAction) return;
        
        const actionToDispatch = {
            type: pendingAction.actionType,
            team: pendingAction.team,
            playerId,
        } as Action;
        
        dispatch(actionToDispatch);
        
        // Chain logic: If it was a SPIKE score, open Assist selection. Removed BLOCKING_POINT.
        if (pendingAction.actionType === 'SPIKE_SUCCESS') {
            setPendingAssistTeam(pendingAction.team);
            setAssistModalOpen(true);
        }
        
        setPendingAction(null);
    };

    const handleAssistSelect = (playerId: string) => {
        if (pendingAssistTeam) {
            dispatch({
                type: 'ASSIST_SUCCESS',
                team: pendingAssistTeam,
                playerId,
            });
        }
        setAssistModalOpen(false);
        setPendingAssistTeam(null);
    };

    const getActionTitle = (actionType: string) => {
        switch(actionType) {
            case 'SERVICE_ACE': return t('select_player_service_ace');
            case 'SERVICE_FAULT': return t('select_player_service_fault');
            case 'SPIKE_SUCCESS': return t('select_player_spike');
            case 'BLOCKING_POINT': return t('select_player_block');
            case 'SERVE_IN': return t('select_player_serve_in');
            case 'DIG_SUCCESS': return t('select_player_dig');
            case 'ASSIST_SUCCESS': return t('select_player_assist');
            default: return t('who_recorded');
        }
    };

    const handleUndo = () => {
        // Removed window.confirm for better UX as requested by user ("button inactive")
        dispatch({ type: 'UNDO' });
    };

    if (!matchState) {
        return (
            <div className="flex-grow flex items-center justify-center">
                <div className="text-center">
                    <p className="text-lg text-slate-400">경기 정보를 불러오는 중...</p>
                    <button onClick={onBackToMenu} className="mt-4 bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded-lg">
                        메뉴로 돌아가기
                    </button>
                </div>
            </div>
        );
    }

    const TeamColumn: React.FC<{ teamKey: 'A' | 'B' }> = ({ teamKey }) => {
        const team = teamKey === 'A' ? matchState.teamA : matchState.teamB;
        const isServing = matchState.servingTeam === teamKey;
        const color = team.color || (teamKey === 'A' ? '#38bdf8' : '#f87171');
        const servingClasses = isServing && !matchState.gameOver ? 'glowing-border' : 'border-solid border-slate-700';

        return (
            <div className={`p-4 flex flex-col items-center justify-between gap-4 bg-slate-900/50 rounded-lg border-2 transition-all duration-300 ${servingClasses} flex-grow`} style={{ borderColor: isServing && !matchState.gameOver ? color : '#334155' }}>
                <div className="flex items-center gap-3">
                    <TeamEmblem emblem={team.emblem} color={color} className="w-16 h-16"/>
                    <div className="text-center">
                        <h2 className="text-3xl font-bold truncate text-white">{team.name}</h2>
                        {team.slogan && <p className="text-xs italic mt-1" style={{ color: color }}>"{team.slogan}"</p>}
                    </div>
                </div>

                <div className="flex flex-col items-center justify-center w-full">
                    <div className="text-[20vw] md:text-[15vw] lg:text-[16rem] font-extrabold leading-none" style={{ color: color }}>{team.score}</div>
                    <div className="flex gap-6 mt-6">
                        <button onClick={() => dispatch({type: 'SCORE', team: teamKey, amount: -1})} disabled={matchState.gameOver || !!matchState.timeout} className="bg-red-600 hover:bg-red-500 text-white font-bold py-4 px-8 rounded-xl text-2xl disabled:bg-slate-600 disabled:cursor-not-allowed">-</button>
                        <button onClick={() => dispatch({type: 'SCORE', team: teamKey, amount: 1})} disabled={matchState.gameOver || !!matchState.timeout} className="bg-green-600 hover:bg-green-500 text-white font-bold py-4 px-8 rounded-xl text-2xl disabled:bg-slate-600 disabled:cursor-not-allowed">+</button>
                    </div>
                </div>
                
                <div className="h-10 flex items-center justify-center w-full gap-2">
                    { !matchState.servingTeam && !matchState.gameOver && <button onClick={() => dispatch({type: 'SET_SERVING_TEAM', team: teamKey})} className="flex items-center gap-2 bg-[#00A3FF] hover:bg-[#0082cc] py-2 px-4 rounded-lg font-semibold"><VolleyballIcon className="w-5 h-5"/> {t('start_serve')}</button> }
                    { isServing && !matchState.gameOver && (
                        <div className="flex items-center gap-2 font-bold text-lg" style={{ color: color }}><VolleyballIcon className="w-6 h-6"/> {t('serving').toUpperCase()}</div>
                    )}
                </div>

                <div className="w-full space-y-3 border-t border-slate-700 pt-4">
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setPendingAction({ actionType: 'SERVICE_ACE', team: teamKey })} disabled={!isServing || matchState.gameOver || !!matchState.timeout} className="bg-slate-700 hover:bg-slate-600 font-semibold py-3 px-4 rounded-lg text-lg disabled:opacity-50">{t('serve_ace')}</button>
                        <button onClick={() => setPendingAction({ actionType: 'SERVICE_FAULT', team: teamKey })} disabled={!isServing || matchState.gameOver || !!matchState.timeout} className="w-full bg-slate-700 hover:bg-slate-600 font-semibold py-3 px-4 rounded-lg text-lg disabled:opacity-50">{t('serve_fault')}</button>
                        
                        <button 
                            onClick={() => setPendingAction({ actionType: 'SERVE_IN', team: teamKey })} 
                            disabled={!isServing || matchState.gameOver || !!matchState.timeout}
                            className="bg-slate-700 hover:bg-slate-600 font-semibold py-3 px-4 rounded-lg text-lg disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            <BoltIcon className="w-5 h-5 text-yellow-400" />
                            {t('btn_serve_in')}
                        </button>
                        <button onClick={() => setPendingAction({ actionType: 'SPIKE_SUCCESS', team: teamKey })} disabled={matchState.gameOver || !!matchState.timeout} className="w-full bg-slate-700 hover:bg-slate-600 font-semibold py-3 px-4 rounded-lg text-lg disabled:opacity-50">{t('spike_success')}</button>
                        
                        <button onClick={() => setPendingAction({ actionType: 'BLOCKING_POINT', team: teamKey })} disabled={matchState.gameOver || !!matchState.timeout} className="w-full bg-slate-700 hover:bg-slate-600 font-semibold py-3 px-4 rounded-lg text-lg disabled:opacity-50">{t('blocking_point')}</button>
                        <button 
                            onClick={() => setPendingAction({ actionType: 'DIG_SUCCESS', team: teamKey })} 
                            disabled={matchState.gameOver || !!matchState.timeout} 
                            className="w-full bg-slate-700 hover:bg-slate-600 font-semibold py-3 px-4 rounded-lg text-lg disabled:opacity-50 flex justify-center items-center gap-2"
                        >
                            <ShieldIcon className="w-5 h-5 text-green-400" /> {t('btn_nice_defense')}
                        </button>
                    </div>
                    
                     <button onClick={() => handleTimeout(teamKey)} disabled={team.timeouts === 0 || matchState.gameOver || !!matchState.timeout} className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 font-semibold py-3 px-4 rounded-lg text-lg disabled:opacity-50 disabled:cursor-not-allowed"><StopwatchIcon className="w-6 h-6" /> {t('timeout')} ({team.timeouts})</button>
                     {settings.includeBonusPointsInWinner && (
                        <>
                            <div className="flex justify-between items-center bg-slate-800 p-3 rounded-lg">
                                <span className="font-bold text-lg">{t('fair_play')}</span>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => dispatch({type: 'ADJUST_FAIR_PLAY', team: teamKey, amount: -1})} disabled={matchState.gameOver || !!matchState.timeout} className="w-10 h-10 rounded-full bg-slate-600 text-xl disabled:opacity-50">-</button>
                                    <span className="font-mono text-xl w-10 text-center">{team.fairPlay}</span>
                                    <button onClick={() => dispatch({type: 'ADJUST_FAIR_PLAY', team: teamKey, amount: 1})} disabled={matchState.gameOver || !!matchState.timeout} className="w-10 h-10 rounded-full bg-slate-600 text-xl disabled:opacity-50">+</button>
                                </div>
                            </div>
                             <div className="flex justify-between items-center bg-slate-800 p-3 rounded-lg">
                                <span className="font-bold text-lg">{t('three_hit_play')}</span>
                                <div className="flex items-center gap-3">
                                     <span className="font-mono text-xl w-10 text-center">{team.threeHitPlays}</span>
                                    <button onClick={() => dispatch({type: 'INCREMENT_3_HIT', team: teamKey})} disabled={matchState.gameOver || !!matchState.timeout} className="w-10 h-10 rounded-full bg-slate-600 text-xl disabled:opacity-50">+</button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    };

    const GameSummaryPanel = () => {
        const { teamA, teamB } = matchState;
        const finalScoreA = settings.includeBonusPointsInWinner ? teamA.score + teamA.fairPlay + teamA.threeHitPlays : teamA.score;
        const finalScoreB = settings.includeBonusPointsInWinner ? teamB.score + teamB.fairPlay + teamB.threeHitPlays : teamB.score;
        let winnerMessage;
        if (finalScoreA > finalScoreB) {
            winnerMessage = `${t('record_final_winner_prefix')}: ${teamA.name}!`;
        } else if (finalScoreB > finalScoreA) {
            winnerMessage = `${t('record_final_winner_prefix')}: ${teamB.name}!`;
        } else {
            winnerMessage = t('record_final_result_tie');
        }

        return (
            <div className="bg-[#00A3FF]/10 border border-[#00A3FF] p-6 rounded-lg space-y-4 animate-fade-in no-print">
                <div className="text-center">
                    <h3 className="text-3xl font-bold text-[#00A3FF]">{winnerMessage}</h3>
                    <div className="text-xl mt-1 flex flex-col gap-1">
                         <p>
                            <span className="font-bold">{t('record_score_breakdown_format', { 
                                teamName: teamA.name, 
                                totalScore: finalScoreA, 
                                breakdown: `${t('record_score_part_match')} ${teamA.score} + ${t('record_score_part_fairplay')} ${teamA.fairPlay} + ${t('record_score_part_3hit')} ${teamA.threeHitPlays}` 
                            })}</span>
                        </p>
                        <p>
                            <span className="font-bold">{t('record_score_breakdown_format', { 
                                teamName: teamB.name, 
                                totalScore: finalScoreB, 
                                breakdown: `${t('record_score_part_match')} ${teamB.score} + ${t('record_score_part_fairplay')} ${teamB.fairPlay} + ${t('record_score_part_3hit')} ${teamB.threeHitPlays}` 
                            })}</span>
                        </p>
                    </div>
                    {settings.includeBonusPointsInWinner && (
                        <p className="text-sm text-slate-400 mt-1">{t('record_score_breakdown_guide')}</p>
                    )}
                </div>
                <button onClick={handleSaveFinalResult} className="w-full bg-[#00A3FF] hover:bg-[#0082cc] text-white font-bold py-3 px-6 rounded-lg text-xl transition-all duration-200 shadow-lg shadow-blue-500/30 animate-pulse">
                    {t('save_final_result')}
                </button>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full max-w-7xl mx-auto w-full">
            <div className="flex justify-between items-center mb-4 relative">
                <button onClick={onBackToMenu} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg">
                    {t('back_to_main')}
                </button>
                
                {/* Timer Display - Clickable */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    <button
                        onClick={() => setTimerOn(!timerOn)}
                        className={`text-4xl font-mono font-black tracking-widest cursor-pointer hover:scale-105 transition-transform ${timerOn ? 'text-green-400' : 'text-red-400'}`}
                    >
                        {formatTime(matchTime)}
                    </button>
                </div>

                <div className="flex items-center gap-4">
                    {matchState.status === 'in_progress' && (
                        <div className="flex items-center gap-4">
                            {/* Join Code Display */}
                            {p2p.isHost && p2p.peerId && (
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(p2p.peerId!);
                                        showToast(t('toast_code_copied'));
                                    }}
                                    className="flex flex-col items-center justify-center bg-slate-800 border-2 border-yellow-500/50 rounded-lg px-3 py-1 cursor-pointer hover:bg-slate-700 transition-all hover:scale-105"
                                    title={t('join_code_label')}
                                >
                                    <span className="text-[10px] text-slate-400 uppercase tracking-widest">{t('join_code_label')}</span>
                                    <span className="text-xl font-mono font-black text-yellow-400 tracking-wider leading-none">
                                        {p2p.peerId}
                                    </span>
                                </button>
                            )}
                        </div>
                    )}

                    {mode === 'referee' && <span className="bg-yellow-600 text-white text-xs px-2 py-1 rounded font-bold">REFEREE MODE</span>}
                    <button onClick={() => setIsSubModalOpen(true)} className="bg-slate-700 hover:bg-slate-600 p-2 rounded-lg" title={t('substitute_player')}>
                        <SwitchHorizontalIcon className="w-6 h-6 text-white" />
                    </button>
                    <button onClick={() => setShowRulesModal(true)} className="bg-slate-700 hover:bg-slate-600 p-2 rounded-lg" title="규칙 보기">
                        <QuestionMarkCircleIcon className="w-6 h-6 text-white" />
                    </button>
                </div>
            </div>

            {/* Game Timeline (Moved to middle) */}
            <div className="mb-4">
                <GameLog 
                    events={matchState.eventHistory} 
                    onUndo={handleUndo} 
                    canUndo={!!matchState.undoStack && matchState.undoStack.length > 0} 
                />
            </div>

            {/* Main Scoreboard Content */}
            <div className="flex-grow flex flex-col md:flex-row gap-4 items-stretch justify-center relative">
                <TeamColumn teamKey="A" />
                
                {/* Center / Game Over Panel */}
                {(matchState.gameOver) && (
                    <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-20 rounded-xl p-4">
                        <div className="w-full max-w-lg">
                            <GameSummaryPanel />
                        </div>
                    </div>
                )}

                <TeamColumn teamKey="B" />
            </div>

            {/* Modals */}
            {showRulesModal && <RulesModal onClose={() => setShowRulesModal(false)} />}
            {matchState.timeout && <TimeoutModal timeLeft={matchState.timeout.timeLeft} onClose={handleCloseTimeout} />}
            <PlayerSelectionModal
                isOpen={!!pendingAction}
                onClose={() => setPendingAction(null)}
                onSelect={handlePlayerSelectAndDispatch}
                players={playersForModal}
                teamName={pendingAction ? matchState[pendingAction.team === 'A' ? 'teamA' : 'teamB'].name : ''}
                teamColor={pendingAction ? (matchState[pendingAction.team === 'A' ? 'teamA' : 'teamB'].color || '#00A3FF') : '#00A3FF'}
                title={pendingAction ? getActionTitle(pendingAction.actionType) : ''}
            />
            {/* Assist Selection Modal */}
            <PlayerSelectionModal
                isOpen={assistModalOpen}
                onClose={() => setAssistModalOpen(false)}
                onSelect={handleAssistSelect}
                players={playersForAssistModal}
                teamName={pendingAssistTeam ? matchState[pendingAssistTeam === 'A' ? 'teamA' : 'teamB'].name : ''}
                teamColor={pendingAssistTeam ? (matchState[pendingAssistTeam === 'A' ? 'teamA' : 'teamB'].color || '#00A3FF') : '#00A3FF'}
                title={t('modal_select_assist')}
            />
            <SubstitutionModal
                isOpen={isSubModalOpen}
                onClose={() => setIsSubModalOpen(false)}
                teamA={matchState.teamA}
                teamB={matchState.teamB}
                dispatch={dispatch}
            />
        </div>
    );
};