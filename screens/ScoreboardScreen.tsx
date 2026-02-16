import React, { useState, useEffect, useMemo, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useData } from '../contexts/DataContext';
import { VolleyballIcon, StopwatchIcon, QuestionMarkCircleIcon, SwitchHorizontalIcon, ShieldIcon, BoltIcon, TargetIcon, FireIcon, WallIcon, LinkIcon, HandshakeIcon } from '../components/icons';
import RulesModal from '../components/RulesModal';
import TimeoutModal from '../components/TimeoutModal';
import PlayerSelectionModal from '../components/PlayerSelectionModal';
import SubstitutionModal from '../components/SubstitutionModal';
import GameLog from '../components/GameLog';
import AutoSaveToast from '../components/AutoSaveToast';
import { Action, Player, ScoreEvent, ScoreEventType } from '../types';
import TeamEmblem from '../components/TeamEmblem';
import { useTranslation } from '../hooks/useTranslation';
import confetti from 'canvas-confetti';

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

    // UX 디테일: 소리 및 자동 저장 알림
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [showAutoSaveToast, setShowAutoSaveToast] = useState(false);
    const clickSoundRef = useRef<HTMLAudioElement | null>(null);
    const confettiFiredRef = useRef(false);

    // 클릭 사운드 초기화
    useEffect(() => {
        try {
            clickSoundRef.current = new Audio('/sounds/click.mp3');
            clickSoundRef.current.volume = 0.3; // 볼륨 조절
            clickSoundRef.current.preload = 'auto';
            // 에러 핸들링 (파일이 없어도 앱이 작동하도록)
            clickSoundRef.current.addEventListener('error', () => {
                console.warn('Click sound file not found. Sound effects will be disabled.');
                clickSoundRef.current = null;
            });
        } catch (error) {
            console.warn('Failed to initialize click sound:', error);
            clickSoundRef.current = null;
        }
    }, []);

    // 클릭 사운드 재생 함수
    const playClickSound = () => {
        if (soundEnabled && clickSoundRef.current) {
            clickSoundRef.current.currentTime = 0;
            clickSoundRef.current.play().catch(() => {
                // 사운드 재생 실패 시 무시 (사용자 상호작용 필요 등)
            });
        }
    };

    // 승리 폭죽 효과 및 휘슬 소리
    useEffect(() => {
        if (matchState?.gameOver && !confettiFiredRef.current) {
            confettiFiredRef.current = true;
            
            // 휘슬 소리 재생
            if (soundEnabled) {
                try {
                    const whistle = new Audio('/sounds/whistle.mp3');
                    whistle.volume = 0.5;
                    whistle.play().catch((e) => {
                        console.log("Whistle audio play error:", e);
                    });
                } catch (error) {
                    console.log("Failed to play whistle sound:", error);
                }
            }
            
            // 화려한 폭죽 효과
            const duration = 3000;
            const animationEnd = Date.now() + duration;
            const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

            function randomInRange(min: number, max: number) {
                return Math.random() * (max - min) + min;
            }

            const interval: ReturnType<typeof setInterval> = setInterval(function() {
                const timeLeft = animationEnd - Date.now();

                if (timeLeft <= 0) {
                    clearInterval(interval);
                    return;
                }

                const particleCount = 50 * (timeLeft / duration);
                
                confetti({
                    ...defaults,
                    particleCount,
                    origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
                });
                confetti({
                    ...defaults,
                    particleCount,
                    origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
                });
            }, 250);
            
            // Cleanup: 컴포넌트 언마운트 시 interval 정리
            return () => {
                clearInterval(interval);
            };
        } else if (!matchState?.gameOver) {
            confettiFiredRef.current = false;
        }
    }, [matchState?.gameOver, soundEnabled]);

    // 자동 저장 알림 (점수 변경 또는 선수 교체 시)
    const prevStateRef = useRef<{ 
        scoreA: number; 
        scoreB: number; 
        onCourtA: string[]; 
        onCourtB: string[];
    } | null>(null);
    
    useEffect(() => {
        if (matchState && prevStateRef.current) {
            const currentState = {
                scoreA: matchState.teamA.score,
                scoreB: matchState.teamB.score,
                onCourtA: matchState.teamA.onCourtPlayerIds || [],
                onCourtB: matchState.teamB.onCourtPlayerIds || []
            };
            
            // 점수 변경 또는 선수 교체 감지 (JSON.stringify 대신 배열 비교로 최적화)
            const scoreChanged = 
                currentState.scoreA !== prevStateRef.current.scoreA ||
                currentState.scoreB !== prevStateRef.current.scoreB;
            
            // 배열 비교 최적화: 길이와 요소 직접 비교
            const arraysEqual = (a: string[], b: string[]) => {
                if (a.length !== b.length) return false;
                return a.every((val, idx) => val === b[idx]);
            };
            
            const substitutionOccurred = 
                !arraysEqual(currentState.onCourtA, prevStateRef.current.onCourtA) ||
                !arraysEqual(currentState.onCourtB, prevStateRef.current.onCourtB);
            
            if (scoreChanged || substitutionOccurred) {
                setShowAutoSaveToast(true);
            }
        }
        
        if (matchState) {
            prevStateRef.current = {
                scoreA: matchState.teamA.score,
                scoreB: matchState.teamB.score,
                onCourtA: matchState.teamA.onCourtPlayerIds || [],
                onCourtB: matchState.teamB.onCourtPlayerIds || []
            };
        }
    }, [
        matchState?.teamA.score, 
        matchState?.teamB.score,
        matchState?.teamA.onCourtPlayerIds,
        matchState?.teamB.onCourtPlayerIds
    ]);

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
    
    // Timeout 타이머: timeout 객체가 변경될 때만 재생성되도록 최적화
    useEffect(() => {
        if (!matchState?.timeout) return;
        
        // timeout.timeLeft를 의존성에서 제거하여 불필요한 재생성 방지
        const timerId = setInterval(() => {
            // 최신 matchState를 직접 참조하지 않고, dispatch를 통해 상태 업데이트
            dispatch({ type: 'UPDATE_TIMEOUT_TIMER', timeLeft: matchState.timeout.timeLeft - 1 });
        }, 1000);
        
        return () => clearInterval(timerId);
    }, [matchState?.timeout ? matchState.timeout.timeLeft : null, dispatch]); // timeout 객체 자체가 변경될 때만 재생성
    
    // timeout 종료 체크는 별도 effect로 분리
    useEffect(() => {
        if (matchState?.timeout && matchState.timeout.timeLeft <= 0) {
            dispatch({ type: 'END_TIMEOUT' });
            showToast('작전 타임이 종료되었습니다.', 'success');
            if (!matchState.gameOver) setTimerOn(true);
        }
    }, [matchState?.timeout?.timeLeft, matchState?.gameOver, dispatch, setTimerOn, showToast]);


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
            <div className={`p-3 sm:p-4 flex flex-col items-center justify-between gap-4 sm:gap-4 bg-slate-900/50 rounded-lg border-2 transition-all duration-300 ${servingClasses} flex-grow`} style={{ borderColor: isServing && !matchState.gameOver ? color : '#334155' }}>
                <div className="flex items-center gap-3 sm:gap-3">
                    <TeamEmblem emblem={team.emblem} color={color} className="w-12 h-12 sm:w-16 sm:h-16"/>
                    <div className="text-center">
                        <h2 className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold truncate text-white">{team.name}</h2>
                        {team.slogan && <p className="text-xs italic mt-1" style={{ color: color }}>"{team.slogan}"</p>}
                    </div>
                </div>

                <div className="flex flex-col items-center justify-center w-full">
                    <div className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-extrabold leading-none" style={{ color: color }}>{team.score}</div>
                    <div className="flex gap-4 sm:gap-6 mt-4 sm:mt-6 w-full max-w-xs">
                        <button 
                            onClick={() => {
                                playClickSound();
                                dispatch({type: 'SCORE', team: teamKey, amount: -1});
                            }} 
                            disabled={matchState.gameOver || !!matchState.timeout} 
                            className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 sm:py-4 px-4 sm:px-8 rounded-xl text-xl sm:text-2xl disabled:bg-slate-600 disabled:cursor-not-allowed min-h-[44px] active:scale-95 transition-transform"
                        >
                            -
                        </button>
                        <button 
                            onClick={() => {
                                playClickSound();
                                dispatch({type: 'SCORE', team: teamKey, amount: 1});
                            }} 
                            disabled={matchState.gameOver || !!matchState.timeout} 
                            className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 sm:py-4 px-4 sm:px-8 rounded-xl text-xl sm:text-2xl disabled:bg-slate-600 disabled:cursor-not-allowed min-h-[44px] active:scale-95 transition-transform"
                        >
                            +
                        </button>
                    </div>
                </div>
                
                <div className="h-10 flex items-center justify-center w-full gap-2">
                    { !matchState.servingTeam && !matchState.gameOver && <button onClick={() => dispatch({type: 'SET_SERVING_TEAM', team: teamKey})} className="flex items-center gap-2 bg-[#00A3FF] hover:bg-[#0082cc] py-2 px-3 sm:px-4 rounded-lg font-semibold text-sm sm:text-base min-h-[44px]"><VolleyballIcon className="w-4 h-4 sm:w-5 sm:h-5"/> {t('start_serve')}</button> }
                    { isServing && !matchState.gameOver && (
                        <div className="flex items-center gap-2 font-bold text-base sm:text-lg" style={{ color: color }}><VolleyballIcon className="w-5 h-5 sm:w-6 sm:h-6"/> {t('serving').toUpperCase()}</div>
                    )}
                </div>

                <div className="w-full space-y-3 sm:space-y-3 border-t border-slate-700 pt-4 sm:pt-4">
                    <div className="grid grid-cols-2 gap-3 sm:gap-3">
                        <button 
                            onClick={() => {
                                playClickSound();
                                setPendingAction({ actionType: 'SERVICE_ACE', team: teamKey });
                            }} 
                            disabled={!isServing || matchState.gameOver || !!matchState.timeout} 
                            className="bg-slate-700 hover:bg-slate-600 font-semibold py-2 sm:py-3 px-2 sm:px-4 rounded-lg text-sm sm:text-base lg:text-lg disabled:opacity-50 min-h-[44px] active:scale-95 transition-transform"
                        >
                            {t('serve_ace')}
                        </button>
                        <button 
                            onClick={() => {
                                playClickSound();
                                setPendingAction({ actionType: 'SERVICE_FAULT', team: teamKey });
                            }} 
                            disabled={!isServing || matchState.gameOver || !!matchState.timeout} 
                            className="w-full bg-slate-700 hover:bg-slate-600 font-semibold py-2 sm:py-3 px-2 sm:px-4 rounded-lg text-sm sm:text-base lg:text-lg disabled:opacity-50 min-h-[44px] active:scale-95 transition-transform"
                        >
                            {t('serve_fault')}
                        </button>
                        
                        <button 
                            onClick={() => {
                                playClickSound();
                                setPendingAction({ actionType: 'SERVE_IN', team: teamKey });
                            }} 
                            disabled={!isServing || matchState.gameOver || !!matchState.timeout}
                            className="bg-slate-700 hover:bg-slate-600 font-semibold py-2 sm:py-3 px-2 sm:px-4 rounded-lg text-sm sm:text-base lg:text-lg disabled:opacity-50 flex items-center justify-center gap-1 sm:gap-2 min-h-[44px] active:scale-95 transition-transform"
                        >
                            <BoltIcon className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
                            <span className="hidden sm:inline">{t('btn_serve_in')}</span>
                            <span className="sm:hidden text-xs">서브</span>
                        </button>
                        <button 
                            onClick={() => {
                                playClickSound();
                                setPendingAction({ actionType: 'SPIKE_SUCCESS', team: teamKey });
                            }} 
                            disabled={matchState.gameOver || !!matchState.timeout} 
                            className="w-full bg-slate-700 hover:bg-slate-600 font-semibold py-2 sm:py-3 px-2 sm:px-4 rounded-lg text-sm sm:text-base lg:text-lg disabled:opacity-50 min-h-[44px] active:scale-95 transition-transform"
                        >
                            {t('spike_success')}
                        </button>
                        
                        <button 
                            onClick={() => {
                                playClickSound();
                                setPendingAction({ actionType: 'BLOCKING_POINT', team: teamKey });
                            }} 
                            disabled={matchState.gameOver || !!matchState.timeout} 
                            className="w-full bg-slate-700 hover:bg-slate-600 font-semibold py-2 sm:py-3 px-2 sm:px-4 rounded-lg text-sm sm:text-base lg:text-lg disabled:opacity-50 min-h-[44px] active:scale-95 transition-transform"
                        >
                            {t('blocking_point')}
                        </button>
                        <button 
                            onClick={() => {
                                playClickSound();
                                setPendingAction({ actionType: 'DIG_SUCCESS', team: teamKey });
                            }} 
                            disabled={matchState.gameOver || !!matchState.timeout} 
                            className="w-full bg-slate-700 hover:bg-slate-600 font-semibold py-2 sm:py-3 px-2 sm:px-4 rounded-lg text-sm sm:text-base lg:text-lg disabled:opacity-50 flex justify-center items-center gap-1 sm:gap-2 min-h-[44px] active:scale-95 transition-transform"
                        >
                            <ShieldIcon className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" /> 
                            <span className="hidden sm:inline">{t('btn_nice_defense')}</span>
                            <span className="sm:hidden text-xs">디그</span>
                        </button>
                    </div>
                    
                     <button onClick={() => handleTimeout(teamKey)} disabled={team.timeouts === 0 || matchState.gameOver || !!matchState.timeout} className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 font-semibold py-2 sm:py-3 px-3 sm:px-4 rounded-lg text-sm sm:text-base lg:text-lg disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"><StopwatchIcon className="w-5 h-5 sm:w-6 sm:h-6" /> {t('timeout')} ({team.timeouts})</button>
                     {settings.includeBonusPointsInWinner && (
                        <>
                            <div className="flex justify-between items-center bg-slate-800 p-2 sm:p-3 rounded-lg">
                                <span className="font-bold text-sm sm:text-base lg:text-lg">{t('fair_play')}</span>
                                <div className="flex items-center gap-2 sm:gap-3">
                                    <button onClick={() => dispatch({type: 'ADJUST_FAIR_PLAY', team: teamKey, amount: -1})} disabled={matchState.gameOver || !!matchState.timeout} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-600 text-lg sm:text-xl disabled:opacity-50 min-h-[44px] min-w-[44px]">-</button>
                                    <span className="font-mono text-lg sm:text-xl w-8 sm:w-10 text-center">{team.fairPlay}</span>
                                    <button onClick={() => dispatch({type: 'ADJUST_FAIR_PLAY', team: teamKey, amount: 1})} disabled={matchState.gameOver || !!matchState.timeout} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-600 text-lg sm:text-xl disabled:opacity-50 min-h-[44px] min-w-[44px]">+</button>
                                </div>
                            </div>
                             <div className="flex justify-between items-center bg-slate-800 p-2 sm:p-3 rounded-lg">
                                <span className="font-bold text-sm sm:text-base lg:text-lg">{t('three_hit_play')}</span>
                                <div className="flex items-center gap-2 sm:gap-3">
                                     <span className="font-mono text-lg sm:text-xl w-8 sm:w-10 text-center">{team.threeHitPlays}</span>
                                    <button onClick={() => dispatch({type: 'INCREMENT_3_HIT', team: teamKey})} disabled={matchState.gameOver || !!matchState.timeout} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-600 text-lg sm:text-xl disabled:opacity-50 min-h-[44px] min-w-[44px]">+</button>
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
            <div className="bg-[#00A3FF]/10 border border-[#00A3FF] p-4 sm:p-6 rounded-lg space-y-3 sm:space-y-4 animate-fade-in no-print">
                <div className="text-center">
                    <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#00A3FF] break-words">{winnerMessage}</h3>
                    <div className="text-sm sm:text-base lg:text-xl mt-1 flex flex-col gap-1">
                         <p>
                            <span className="font-bold break-words">{t('record_score_breakdown_format', { 
                                teamName: teamA.name, 
                                totalScore: finalScoreA, 
                                breakdown: `${t('record_score_part_match')} ${teamA.score} + ${t('record_score_part_fairplay')} ${teamA.fairPlay} + ${t('record_score_part_3hit')} ${teamA.threeHitPlays}` 
                            })}</span>
                        </p>
                        <p>
                            <span className="font-bold break-words">{t('record_score_breakdown_format', { 
                                teamName: teamB.name, 
                                totalScore: finalScoreB, 
                                breakdown: `${t('record_score_part_match')} ${teamB.score} + ${t('record_score_part_fairplay')} ${teamB.fairPlay} + ${t('record_score_part_3hit')} ${teamB.threeHitPlays}` 
                            })}</span>
                        </p>
                    </div>
                    {settings.includeBonusPointsInWinner && (
                        <p className="text-xs sm:text-sm text-slate-400 mt-1">{t('record_score_breakdown_guide')}</p>
                    )}
                </div>
                <button onClick={handleSaveFinalResult} className="w-full bg-[#00A3FF] hover:bg-[#0082cc] text-white font-bold py-3 px-4 sm:px-6 rounded-lg text-base sm:text-lg lg:text-xl transition-all duration-200 shadow-lg shadow-blue-500/30 animate-pulse min-h-[44px]">
                    {t('save_final_result')}
                </button>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full max-w-7xl mx-auto w-full px-4">
            <div className="w-full flex justify-between items-center mb-3 sm:mb-4 gap-2">
                {/* 좌측 영역 */}
                <div className="flex-1">
                    <button onClick={onBackToMenu} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-3 sm:px-4 rounded-lg text-sm sm:text-base min-h-[44px]">
                        {t('back_to_main')}
                    </button>
                </div>

                {/* 중앙 영역 - 타이머 */}
                <div className="flex-1 flex justify-center">
                    <button
                        onClick={() => setTimerOn(!timerOn)}
                        className={`text-2xl sm:text-3xl lg:text-4xl font-mono font-black tracking-widest cursor-pointer hover:scale-105 transition-transform ${timerOn ? 'text-green-400' : 'text-red-400'}`}
                    >
                        {formatTime(matchTime)}
                    </button>
                </div>

                {/* 우측 영역 */}
                <div className="flex-1 flex justify-end items-center gap-2 sm:gap-4">
                    {matchState.status === 'in_progress' && p2p.isHost && p2p.peerId && (() => {
                        const pin = p2p.peerId.replace(/^jive-/, '');
                        const joinUrl = `${window.location.origin}${window.location.pathname || '/'}?code=${encodeURIComponent(pin)}`;
                        return (
                            <>
                                {/* 참여 코드(PIN) + QR - 데스크톱 */}
                                <div className="hidden md:flex items-center gap-2 bg-slate-800 border-2 border-yellow-500/50 rounded-lg px-3 py-2">
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(pin);
                                            showToast(t('toast_code_copied'));
                                        }}
                                        className="flex flex-col items-center justify-center cursor-pointer hover:bg-slate-700 rounded transition-all"
                                        title={t('join_code_label')}
                                    >
                                        <span className="text-[10px] text-slate-400 uppercase tracking-widest">{t('join_code_label')}</span>
                                        <span className="text-2xl font-mono font-black text-yellow-400 tracking-[0.2em] leading-none">
                                            {pin}
                                        </span>
                                    </button>
                                    <div className="flex-shrink-0 w-14 h-14 bg-white p-1 rounded">
                                        <QRCodeSVG value={joinUrl} size={48} level="M" />
                                    </div>
                                </div>
                                {/* 모바일: PIN + QR */}
                                <div className="md:hidden flex items-center gap-2 bg-slate-800 border-2 border-yellow-500/50 rounded-lg p-2">
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(pin);
                                            showToast(t('toast_code_copied'));
                                        }}
                                        className="flex flex-col items-center justify-center min-h-[44px] min-w-[44px]"
                                        title={`${t('join_code_label')}: ${pin}`}
                                    >
                                        <span className="text-[10px] text-slate-400">PIN</span>
                                        <span className="text-yellow-400 font-mono text-lg font-black tracking-wider">{pin}</span>
                                    </button>
                                    <div className="w-10 h-10 bg-white p-0.5 rounded flex-shrink-0">
                                        <QRCodeSVG value={joinUrl} size={36} level="M" />
                                    </div>
                                </div>
                            </>
                        );
                    })()}

                    {mode === 'referee' && (
                        <span className="bg-yellow-600 text-white text-xs px-2 py-1 rounded font-bold whitespace-nowrap">
                            REFEREE MODE
                        </span>
                    )}
                    
                    {/* 소리 켜기/끄기 토글 */}
                    <button
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className={`bg-slate-700 hover:bg-slate-600 p-2 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors ${
                            soundEnabled 
                                ? 'text-yellow-400' 
                                : 'text-slate-500'
                        }`}
                        title={soundEnabled ? '소리 끄기' : '소리 켜기'}
                    >
                        <span className="text-xl">{soundEnabled ? '🔊' : '🔇'}</span>
                    </button>
                    
                    <button 
                        onClick={() => setIsSubModalOpen(true)} 
                        className="bg-slate-700 hover:bg-slate-600 p-2 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center" 
                        title={t('substitute_player')}
                    >
                        <SwitchHorizontalIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </button>
                    
                    <button 
                        onClick={() => setShowRulesModal(true)} 
                        className="bg-slate-700 hover:bg-slate-600 p-2 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center" 
                        title="규칙 보기"
                    >
                        <QuestionMarkCircleIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </button>
                </div>
            </div>

            {/* Game Timeline (Moved to middle) */}
            <div className="mb-3 sm:mb-4">
                <GameLog 
                    events={matchState.eventHistory} 
                    onUndo={handleUndo} 
                    canUndo={!!matchState.undoStack && matchState.undoStack.length > 0} 
                />
            </div>

            {/* Main Scoreboard Content */}
            <div className="flex-grow flex flex-col lg:flex-row gap-4 sm:gap-4 items-stretch justify-center relative">
                <TeamColumn teamKey="A" />
                
                {/* Center / Game Over Panel */}
                {(matchState.gameOver) && (
                    <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-20 rounded-xl p-3 sm:p-4">
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
                variant="grid"
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
                variant="grid"
            />
            <SubstitutionModal
                isOpen={isSubModalOpen}
                onClose={() => setIsSubModalOpen(false)}
                teamA={matchState.teamA}
                teamB={matchState.teamB}
                dispatch={dispatch}
            />
            <AutoSaveToast 
                show={showAutoSaveToast} 
                onHide={() => setShowAutoSaveToast(false)} 
            />
        </div>
    );
};