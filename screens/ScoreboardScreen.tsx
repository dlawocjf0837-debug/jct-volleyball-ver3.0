import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { useData } from '../contexts/DataContext';
import { VolleyballIcon, StopwatchIcon, QuestionMarkCircleIcon, SwitchHorizontalIcon, ShieldIcon, BoltIcon, TargetIcon, FireIcon, WallIcon, LinkIcon, HandshakeIcon, MagnifyingGlassIcon } from '../components/icons';
import RulesModal from '../components/RulesModal';
import { LiveChatOverlay } from '../components/LiveChatOverlay';
import TimeoutModal from '../components/TimeoutModal';
import { TacticalBoardModal } from '../components/TacticalBoardModal';
import PlayerSelectionModal from '../components/PlayerSelectionModal';
import SubstitutionModal from '../components/SubstitutionModal';
import GameLog from '../components/GameLog';
import { EffectPopup } from '../components/EffectPopup';
import { PlayerHistoryModal } from '../components/PlayerHistoryModal';
import { HustlePlayerModal } from '../components/HustlePlayerModal';
import AutoSaveToast from '../components/AutoSaveToast';
import { Action, MatchState, Player, ScoreEvent, ScoreEventType } from '../types';
import TeamEmblem from '../components/TeamEmblem';
import { useTranslation } from '../hooks/useTranslation';
import confetti from 'canvas-confetti';

import { isAdminPasswordCorrect } from '../utils/adminPassword';

interface ScoreboardProps {
    onBackToMenu: () => void;
    mode: 'record' | 'referee';
    /** 진입 트랙: class = 교과 수업 모드, club = 학교스포츠클럽 모드 (추후 로직 분리용) */
    entryMode?: 'class' | 'club';
}

type PendingAction = {
    actionType: 'SERVICE_ACE' | 'SERVICE_FAULT' | 'BLOCKING_POINT' | 'SPIKE_SUCCESS' | 'SERVE_IN' | 'DIG_SUCCESS' | 'ASSIST_SUCCESS';
    team: 'A' | 'B';
};

export const ScoreboardScreen: React.FC<ScoreboardProps> = ({ onBackToMenu, mode, entryMode = 'class' }) => {
    const { 
        matchState, matchTime, timerOn, dispatch, setTimerOn,
        matchHistory, saveMatchHistory, saveRoleHistoryAfterMatch, showToast, p2p, clearInProgressMatch,
        settings, setHostTournamentMode, sendTicker, sendEffect,
        isChatEnabled, setChatEnabled, isChatWindowVisible, setChatWindowVisible, receivedChatMessages, sendChat, removeChatMessage, banViewer, blockedViewerIds = new Set(), toggleBlockViewer = () => {},
        receivedEffects = [], removeReceivedEffect,
        practiceMatchHistory = [], leagueMatchHistory = [], playerCumulativeStats = {}, teamSets = []
    } = useData();
    const { t } = useTranslation();

    const [showRulesModal, setShowRulesModal] = useState(false);
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
    const [isSubModalOpen, setIsSubModalOpen] = useState(false);
    const [serveOrderModalTeam, setServeOrderModalTeam] = useState<'A' | 'B' | null>(null);
    const [selectedPlayerForRecord, setSelectedPlayerForRecord] = useState<{ player: Player; cumulativeStats: any; performanceHistory: any[] } | null>(null);
    
    // Logic for Assist selection modal chain
    const [assistModalOpen, setAssistModalOpen] = useState(false);
    const [pendingAssistTeam, setPendingAssistTeam] = useState<'A' | 'B' | null>(null);

    // 수행평가 모드: 허슬 플레이어 선정 팝업
    const [hustleModalOpen, setHustleModalOpen] = useState(false);

    // 대회 전광판 모드 (방장 전용, 비밀번호 9999로만 활성화)
    const [isTournamentMode, setIsTournamentMode] = useState(false);
    const [showTournamentPasswordModal, setShowTournamentPasswordModal] = useState(false);
    const [tournamentPasswordInput, setTournamentPasswordInput] = useState('');
    const [tickerInput, setTickerInput] = useState('');
    const [isSwapped, setIsSwapped] = useState(false);
    const courtChangeAt8DoneRef = useRef(false);
    const latestIsTournamentModeRef = useRef(false);
    useEffect(() => {
        latestIsTournamentModeRef.current = isTournamentMode;
    }, [isTournamentMode]);
    useEffect(() => {
        if (p2p.isHost && setHostTournamentMode) setHostTournamentMode(isTournamentMode);
    }, [isTournamentMode, p2p.isHost, setHostTournamentMode]);

    const maxSets = matchState?.maxSets ?? 1;
    const showSetScore = entryMode === 'club';
    const setsWonA = matchState?.teamA.setsWon ?? 0;
    const setsWonB = matchState?.teamB.setsWon ?? 0;
    const setScoreText = `[ ${isSwapped ? setsWonB : setsWonA} : ${isSwapped ? setsWonA : setsWonB} ]`;

    useEffect(() => {
        courtChangeAt8DoneRef.current = false;
    }, [matchState?.currentSet]);

    const handleServeOrderPlayerClick = useCallback((player: Player, teamKey?: string) => {
        if (!player) return;
        const baseStats = {
            points: 0, serviceAces: 0, serviceFaults: 0, blockingPoints: 0, spikeSuccesses: 0, matchesPlayed: 0,
            serveIn: 0, digs: 0, assists: 0
        };
        const cumulativeStats: any = { ...baseStats, ...(playerCumulativeStats?.[player.id] ?? {}) };
        const performanceHistory: any[] = [];
        const allMatches = [
            ...(matchHistory ?? []).filter((m: any) => m?.status === 'completed' && !m?.leagueId && !m?.tournamentId),
            ...(practiceMatchHistory ?? []).filter((m: any) => m?.status === 'completed'),
            ...(leagueMatchHistory ?? []).filter((m: any) => m?.status === 'completed'),
        ].sort((a: any, b: any) => new Date((a?.date ?? 0) as string).getTime() - new Date((b?.date ?? 0) as string).getTime());

        allMatches.forEach((match: any) => {
            let playerTeam: 'teamA' | 'teamB' | null = null;
            if (match?.teamA?.players && Object.keys(match.teamA.players).includes(player.id)) playerTeam = 'teamA';
            else if (match?.teamB?.players && Object.keys(match.teamB.players).includes(player.id)) playerTeam = 'teamB';
            if (playerTeam) {
                const teamState = match[playerTeam];
                const opponentName = playerTeam === 'teamA' ? (match?.teamB?.name ?? '') : (match?.teamA?.name ?? '');
                const playerStatsForMatch = teamState?.playerStats?.[player.id];
                if (playerStatsForMatch) {
                    performanceHistory.push({
                        match,
                        teamName: teamState.name,
                        opponent: opponentName,
                        stats: playerStatsForMatch,
                        teamSet: undefined,
                        matchType: (match as { _matchType?: string })?._matchType ?? 'regular',
                    });
                }
            }
        });

        const totalServices = (cumulativeStats.serviceAces || 0) + (cumulativeStats.serviceFaults || 0);
        cumulativeStats.serviceSuccessRate = totalServices > 0 ? ((cumulativeStats.serviceAces || 0) + (cumulativeStats.serveIn || 0)) / totalServices * 100 : 0;
        performanceHistory.reverse();
        setSelectedPlayerForRecord({ player, cumulativeStats, performanceHistory });
    }, [matchHistory, practiceMatchHistory, leagueMatchHistory, playerCumulativeStats]);

    useEffect(() => {
        const maxSetsCurrent = matchState?.maxSets ?? 1;
        const isDecidingSet = maxSetsCurrent >= 2 && matchState?.currentSet === maxSetsCurrent;
        if (entryMode !== 'club' || !matchState || matchState.gameOver || !isDecidingSet) return;
        const { teamA, teamB } = matchState;
        const total = teamA.score + teamB.score;
        if (total >= 8 && (teamA.score >= 8 || teamB.score >= 8) && !courtChangeAt8DoneRef.current) {
            courtChangeAt8DoneRef.current = true;
            showToast('🔄 코트 체인지 (결승 세트 8점)', 'success');
            setIsSwapped(prev => !prev);
        }
    }, [matchState?.teamA.score, matchState?.teamB.score, matchState?.currentSet, matchState?.maxSets, matchState?.gameOver, entryMode, showToast]);

    const handleTournamentModeToggle = (nextChecked: boolean) => {
        if (nextChecked) {
            setShowTournamentPasswordModal(true);
            setTournamentPasswordInput('');
        } else {
            setIsTournamentMode(false);
        }
    };
    const handleTournamentPasswordConfirm = () => {
        if (isAdminPasswordCorrect(tournamentPasswordInput)) {
            setIsTournamentMode(true);
            setShowTournamentPasswordModal(false);
            setTournamentPasswordInput('');
        } else {
            showToast('비밀번호가 일치하지 않습니다.', 'error');
        }
    };

    // QR 확대 모달
    const [showQRZoomModal, setShowQRZoomModal] = useState(false);
    const [qrZoomPin, setQrZoomPin] = useState<string | null>(null);
    const qrCanvasContainerRef = useRef<HTMLDivElement>(null);
    const [showTacticalBoard, setShowTacticalBoard] = useState(false);
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
    
    const handleSaveFinalResult = () => {
        if (!matchState) return;
        if (matchState.isAssessment) {
            setHustleModalOpen(true);
            return;
        }
        doSaveFinalResult([]);
    };

    const doSaveFinalResult = async (hustlePlayerIds: string[]) => {
        if (!matchState) return;
        const hustlePlayers: { id: string; name: string; team: 'A' | 'B' }[] = hustlePlayerIds.map(pid => {
            const inA = matchState.teamA?.players?.[pid];
            const inB = matchState.teamB?.players?.[pid];
            const player = inA ?? inB;
            const team: 'A' | 'B' = inA ? 'A' : 'B';
            return { id: pid, name: player?.originalName ?? '선수', team };
        });
        const base = JSON.parse(JSON.stringify(matchState)) as typeof matchState;
        const finalResult = {
            ...base,
            status: 'completed' as const,
            date: new Date().toISOString(),
            time: matchTime,
            ...(matchState.isAssessment && {
                isAssessment: true,
                hustlePlayerIds: [...hustlePlayerIds],
                hustlePlayers: hustlePlayers.map(p => ({ ...p })),
            }),
        };
        const newHistory = [finalResult, ...matchHistory];
        await saveMatchHistory(newHistory, '최종 경기 기록이 저장되었습니다!');
        const dateStr = finalResult.date ? new Date(finalResult.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
        const matchInfo = `${matchState.teamA.name} vs ${matchState.teamB.name}`;
        if (saveRoleHistoryAfterMatch) await saveRoleHistoryAfterMatch(matchInfo, dateStr);
        clearInProgressMatch();
        onBackToMenu();
    };

    const handleHustleConfirm = (selectedPlayerIds: string[]) => {
        setHustleModalOpen(false);
        doSaveFinalResult(selectedPlayerIds);
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
        const serverName = entryMode === 'club' && isServing && !matchState.gameOver
            ? (() => {
                const idx = team.currentServerIndex ?? 0;
                const pid = team.onCourtPlayerIds?.[idx];
                return pid ? team.players[pid]?.originalName : '';
            })()
            : '';

        return (
            <div className={`p-3 sm:p-4 flex flex-col items-center justify-between gap-4 sm:gap-4 bg-slate-900/50 rounded-lg border-2 transition-all duration-300 ${servingClasses} flex-grow`} style={{ borderColor: isServing && !matchState.gameOver ? color : '#334155' }}>
                {serverName && (
                    <span className="text-xs sm:text-sm font-semibold px-2.5 py-1 rounded-full border shadow-sm" style={{ backgroundColor: `${color}20`, borderColor: `${color}60`, color }}>
                        🏐 서브: {serverName}
                    </span>
                )}
                <div className="flex items-center gap-3 sm:gap-3">
                    <TeamEmblem emblem={team.emblem} color={color} className="w-12 h-12 sm:w-16 sm:h-16"/>
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-2 flex-wrap">
                            <h2 className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold truncate text-white">{team.name}</h2>
                            {entryMode === 'club' && (
                                <button
                                    type="button"
                                    onClick={() => setServeOrderModalTeam(teamKey)}
                                    className="text-xs font-medium px-2 py-1 rounded-lg border bg-slate-800/80 hover:bg-slate-700 border-slate-600 text-slate-300 hover:text-white transition-colors"
                                >
                                    📋 서브 순서
                                </button>
                            )}
                        </div>
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
                                if (entryMode === 'club' && isServing) {
                                    const idx = team.currentServerIndex ?? 0;
                                    const pid = team.onCourtPlayerIds?.[idx] ?? team.onCourtPlayerIds?.[0];
                                    if (pid) {
                                        const name = team.players[pid]?.originalName ?? '';
                                        dispatch({ type: 'SERVICE_ACE', team: teamKey, playerId: pid });
                                        showToast(`🔔 [${name}] 서브 득점 기록됨!`, 'success');
                                    } else {
                                        showToast('서버를 식별할 수 없습니다.', 'error');
                                    }
                                } else {
                                    setPendingAction({ actionType: 'SERVICE_ACE', team: teamKey });
                                }
                            }} 
                            disabled={!isServing || matchState.gameOver || !!matchState.timeout} 
                            className="bg-slate-700 hover:bg-slate-600 font-semibold py-2 sm:py-3 px-2 sm:px-4 rounded-lg text-sm sm:text-base lg:text-lg disabled:opacity-50 min-h-[44px] active:scale-95 transition-transform"
                        >
                            {t('serve_ace')}
                        </button>
                        <button 
                            onClick={() => {
                                playClickSound();
                                if (entryMode === 'club' && isServing) {
                                    const idx = team.currentServerIndex ?? 0;
                                    const pid = team.onCourtPlayerIds?.[idx] ?? team.onCourtPlayerIds?.[0];
                                    if (pid) {
                                        const name = team.players[pid]?.originalName ?? '';
                                        dispatch({ type: 'SERVICE_FAULT', team: teamKey, playerId: pid });
                                        showToast(`🔔 [${name}] 서브 범실 기록됨`, 'success');
                                    } else {
                                        showToast('서버를 식별할 수 없습니다.', 'error');
                                    }
                                } else {
                                    setPendingAction({ actionType: 'SERVICE_FAULT', team: teamKey });
                                }
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
                     {entryMode !== 'club' && settings.includeBonusPointsInWinner && (
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
        const isClub = entryMode === 'club';
        const finalScoreA = isClub ? teamA.score : (settings.includeBonusPointsInWinner ? teamA.score + teamA.fairPlay + teamA.threeHitPlays : teamA.score);
        const finalScoreB = isClub ? teamB.score : (settings.includeBonusPointsInWinner ? teamB.score + teamB.fairPlay + teamB.threeHitPlays : teamB.score);
        let winnerMessage;
        if (finalScoreA > finalScoreB) {
            winnerMessage = `${t('record_final_winner_prefix')}: ${teamA.name}!`;
        } else if (finalScoreB > finalScoreA) {
            winnerMessage = `${t('record_final_winner_prefix')}: ${teamB.name}!`;
        } else {
            winnerMessage = t('record_final_result_tie');
        }

        const breakdownA = isClub ? `${t('record_score_part_match')} ${teamA.score}` : `${t('record_score_part_match')} ${teamA.score} + ${t('record_score_part_fairplay')} ${teamA.fairPlay} + ${t('record_score_part_3hit')} ${teamA.threeHitPlays}`;
        const breakdownB = isClub ? `${t('record_score_part_match')} ${teamB.score}` : `${t('record_score_part_match')} ${teamB.score} + ${t('record_score_part_fairplay')} ${teamB.fairPlay} + ${t('record_score_part_3hit')} ${teamB.threeHitPlays}`;

        return (
            <div className="bg-[#00A3FF]/10 border border-[#00A3FF] p-4 sm:p-6 rounded-lg space-y-3 sm:space-y-4 animate-fade-in no-print">
                <div className="text-center">
                    <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#00A3FF] break-words">{winnerMessage}</h3>
                    <div className="text-sm sm:text-base lg:text-xl mt-1 flex flex-col gap-1">
                         <p>
                            <span className="font-bold break-words">{t('record_score_breakdown_format', { teamName: teamA.name, totalScore: finalScoreA, breakdown: breakdownA })}</span>
                        </p>
                        <p>
                            <span className="font-bold break-words">{t('record_score_breakdown_format', { teamName: teamB.name, totalScore: finalScoreB, breakdown: breakdownB })}</span>
                        </p>
                    </div>
                    {!isClub && settings.includeBonusPointsInWinner && (
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
        <div className={`flex flex-col h-full max-w-7xl mx-auto w-full px-4 ${receivedEffects.length > 0 ? 'animate-shake' : ''}`}>
            {removeReceivedEffect && receivedEffects.map(e => (
                <EffectPopup key={e.id} id={e.id} effectType={e.effectType} onEnd={() => removeReceivedEffect(e.id)} />
            ))}
            <div className="w-full flex justify-between items-center mb-3 sm:mb-4 gap-2">
                {/* 좌측 영역: 참여코드(PIN) + QR (데스크톱, 호스트 시) — 메인으로는 상단 Header에만 표시 */}
                <div className="flex-1 flex items-center justify-start min-w-0">
                    {matchState.status === 'in_progress' && p2p.isHost && p2p.peerId && (() => {
                        const pin = p2p.peerId.replace(/^jive-/, '');
                        const joinUrl = `${window.location.origin}${window.location.pathname || '/'}?liveCode=${encodeURIComponent(pin)}`;
                        return (
                            <div className="hidden md:flex items-center gap-2 bg-slate-800 border-2 border-yellow-500/50 rounded-lg px-3 py-2 flex-shrink-0">
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(pin);
                                        showToast(t('toast_code_copied'));
                                    }}
                                    className="flex flex-col items-center justify-center cursor-pointer hover:bg-slate-700 rounded transition-all"
                                    title={t('join_code_label')}
                                >
                                    <span className="text-[10px] text-slate-400 uppercase tracking-widest">{t('join_code_label')}</span>
                                    <span className="text-2xl font-mono font-black text-yellow-400 tracking-[0.2em] leading-none">{pin}</span>
                                </button>
                                <div className="flex-shrink-0 w-14 h-14 bg-white p-1 rounded">
                                    <QRCodeSVG value={joinUrl} size={48} level="M" />
                                </div>
                                <button
                                    onClick={() => { setQrZoomPin(pin); setShowQRZoomModal(true); }}
                                    className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
                                    title="QR 코드 확대"
                                >
                                    <MagnifyingGlassIcon className="w-5 h-5" />
                                </button>
                            </div>
                        );
                    })()}
                    {matchState.status === 'in_progress' && p2p.isHost && p2p.peerId && (() => {
                        const pin = p2p.peerId.replace(/^jive-/, '');
                        const joinUrl = `${window.location.origin}${window.location.pathname || '/'}?liveCode=${encodeURIComponent(pin)}`;
                        return (
                            <div className="md:hidden flex items-center gap-2 bg-slate-800 border-2 border-yellow-500/50 rounded-lg p-2 flex-shrink-0">
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
                                <button
                                    onClick={() => { setQrZoomPin(pin); setShowQRZoomModal(true); }}
                                    className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
                                    title="QR 코드 확대"
                                >
                                    <MagnifyingGlassIcon className="w-5 h-5" />
                                </button>
                            </div>
                        );
                    })()}
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

                {/* 우측 영역 - flex-row로 가로 정렬, 여백 확보 */}
                <div className="flex-1 flex justify-end items-center">
                    <div className="flex flex-row items-center gap-x-3 sm:gap-x-4 flex-wrap justify-end">
                    {entryMode === 'club' && (
                        <button
                            type="button"
                            onClick={() => setShowTacticalBoard(true)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-700 hover:bg-amber-600/80 border border-slate-600 hover:border-amber-500/50 text-slate-200 hover:text-white font-semibold text-sm min-h-[44px] transition-colors flex-shrink-0"
                            title="디지털 전술판"
                        >
                            <span>📋</span>
                            <span className="hidden sm:inline">전술판</span>
                        </button>
                    )}
                    {/* 🏆 대회 전광판 모드 토글 (CLASS/CLUB 공통) */}
                    {matchState.status === 'in_progress' && p2p.isHost && p2p.peerId && (
                        <>
                            <div className="hidden md:flex items-center gap-2 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 flex-shrink-0">
                                <span className="text-sm font-medium text-slate-200 whitespace-nowrap">🏆 대회 전광판 모드</span>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={isTournamentMode}
                                    onClick={() => handleTournamentModeToggle(!isTournamentMode)}
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-800 ${isTournamentMode ? 'bg-amber-500/70' : 'bg-slate-600'}`}
                                >
                                    <span className={`pointer-events-none absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${isTournamentMode ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>
                            {isTournamentMode && (
                                <span className="hidden md:inline-flex items-center px-3 py-1.5 rounded-lg bg-sky-500/20 border border-sky-500/50 text-sky-400 text-sm font-semibold flex-shrink-0">
                                    👀 {p2p.viewerCount ?? 0}명 시청 중
                                </span>
                            )}
                            <div className="md:hidden flex items-center gap-2 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 min-h-[44px] flex-shrink-0">
                                <span className="text-sm font-medium text-slate-200 whitespace-nowrap">🏆 대회 전광판</span>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={isTournamentMode}
                                    onClick={() => handleTournamentModeToggle(!isTournamentMode)}
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-800 ${isTournamentMode ? 'bg-amber-500/70' : 'bg-slate-600'}`}
                                >
                                    <span className={`pointer-events-none absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${isTournamentMode ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>
                            {isTournamentMode && (
                                <span className="md:hidden inline-flex items-center px-2 py-1 rounded-lg bg-sky-500/20 border border-sky-500/50 text-sky-400 text-xs font-semibold flex-shrink-0">
                                    👀 {p2p.viewerCount ?? 0}명
                                </span>
                            )}
                        </>
                    )}
                    {/* 실시간 채팅 제어 패널 (전광판 모드와 무관, 항상 별도 렌더링) */}
                    {matchState.status === 'in_progress' && p2p.isHost && (p2p.viewerCount ?? 0) > 0 && setChatEnabled && (
                        <div className="hidden md:flex items-center gap-4 flex-shrink-0 bg-slate-800/80 border border-slate-600 rounded-xl px-4 py-2.5">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-400 whitespace-nowrap">채팅</span>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={isChatEnabled}
                                    onClick={() => setChatEnabled(!isChatEnabled)}
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-800 ${isChatEnabled ? 'bg-green-600' : 'bg-slate-600'}`}
                                >
                                    <span className={`pointer-events-none absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${isChatEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                                <span className="text-sm font-medium text-slate-300 w-8">{isChatEnabled ? '열기' : '끄기'}</span>
                            </div>
                            {setChatWindowVisible && (
                                <div className={`flex items-center gap-2 border-l border-slate-600 pl-4 ${!isChatEnabled ? 'opacity-60' : ''}`}>
                                    <span className="text-sm text-slate-400 whitespace-nowrap">채팅창</span>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={isChatEnabled ? isChatWindowVisible : false}
                                        aria-disabled={!isChatEnabled}
                                        onClick={() => isChatEnabled && setChatWindowVisible(!isChatWindowVisible)}
                                        className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-800 ${!isChatEnabled ? 'bg-slate-600 cursor-not-allowed' : isChatWindowVisible ? 'bg-sky-600' : 'bg-slate-600'}`}
                                    >
                                        <span className={`pointer-events-none absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${isChatEnabled && isChatWindowVisible ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </button>
                                    <span className="text-sm font-medium text-slate-300 w-10">{!isChatEnabled ? '숨기기' : isChatWindowVisible ? '보이기' : '숨기기'}</span>
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => setChatEnabled(!isChatEnabled)}
                                className="flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-semibold bg-amber-600/80 text-white hover:bg-amber-600 transition-colors border-l border-slate-600 pl-4"
                            >
                                {isChatEnabled ? '채팅 끄기' : '채팅 켜기'}
                            </button>
                        </div>
                    )}
                    {matchState.status === 'in_progress' && p2p.isHost && (p2p.viewerCount ?? 0) > 0 && setChatEnabled && (
                        <div className="md:hidden flex items-center gap-3 flex-shrink-0 flex-wrap bg-slate-800/80 border border-slate-600 rounded-xl px-3 py-2 min-h-[44px]">
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs text-slate-400">채팅</span>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={isChatEnabled}
                                    onClick={() => setChatEnabled(!isChatEnabled)}
                                    className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${isChatEnabled ? 'bg-green-600' : 'bg-slate-600'}`}
                                >
                                    <span className={`pointer-events-none absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${isChatEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                                </button>
                                <span className="text-xs text-slate-300 w-6">{isChatEnabled ? '열기' : '끄기'}</span>
                            </div>
                            {setChatWindowVisible && (
                                <div className={`flex items-center gap-1.5 border-l border-slate-600 pl-3 ${!isChatEnabled ? 'opacity-60' : ''}`}>
                                    <span className="text-xs text-slate-400">창</span>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={isChatEnabled ? isChatWindowVisible : false}
                                        aria-disabled={!isChatEnabled}
                                        onClick={() => isChatEnabled && setChatWindowVisible(!isChatWindowVisible)}
                                        className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${!isChatEnabled ? 'bg-slate-600 cursor-not-allowed' : isChatWindowVisible ? 'bg-sky-600' : 'bg-slate-600'}`}
                                    >
                                        <span className={`pointer-events-none absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${isChatEnabled && isChatWindowVisible ? 'translate-x-4' : 'translate-x-0'}`} />
                                    </button>
                                    <span className="text-xs text-slate-300 w-8">{!isChatEnabled ? '숨기기' : isChatWindowVisible ? '보이기' : '숨기기'}</span>
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => setChatEnabled(!isChatEnabled)}
                                className="flex-shrink-0 px-2 py-1.5 rounded-lg text-xs font-semibold bg-amber-600/80 text-white border-l border-slate-600 pl-3"
                            >
                                {isChatEnabled ? '채팅 끄기' : '채팅 켜기'}
                            </button>
                        </div>
                    )}

                    {mode === 'referee' && (
                        <span className="bg-yellow-600 text-white text-xs px-2 py-1 rounded font-bold whitespace-nowrap">
                            REFEREE MODE
                        </span>
                    )}
                    
                    {/* 소리 켜기/끄기 토글 */}
                    <button
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className={`bg-slate-700 hover:bg-slate-600 p-2 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0 transition-colors ${
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
                        className="bg-slate-700 hover:bg-slate-600 p-2 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0" 
                        title={t('substitute_player')}
                    >
                        <SwitchHorizontalIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </button>
                    
                    <button 
                        onClick={() => setShowRulesModal(true)} 
                        className="bg-slate-700 hover:bg-slate-600 p-2 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0" 
                        title="규칙 보기"
                    >
                        <QuestionMarkCircleIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </button>
                    </div>
                </div>
            </div>

            {/* 대회 전광판 모드 시: 대회 공지 자막 송출 (CLUB 모드 전용, 채팅/응원가 UI는 그대로 유지) */}
            {entryMode === 'club' && isTournamentMode && p2p.isHost && sendTicker && (
                <div className="flex flex-wrap items-center gap-2 mb-3 p-2 bg-slate-800/80 border border-amber-500/30 rounded-lg">
                    <input
                        type="text"
                        value={tickerInput}
                        onChange={(e) => setTickerInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { sendTicker(tickerInput); setTickerInput(''); showToast('자막이 성공적으로 송출되었습니다.', 'success'); } }}
                        placeholder="대회 공지 자막 송출"
                        className="flex-1 min-w-[120px] bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <button
                        type="button"
                        onClick={() => { sendTicker(tickerInput); setTickerInput(''); showToast('자막이 성공적으로 송출되었습니다.', 'success'); }}
                        className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm"
                    >
                        전송
                    </button>
                </div>
            )}

            {/* Game Timeline (Moved to middle) */}
            <div className="mb-3 sm:mb-4">
                <GameLog 
                    events={matchState.eventHistory} 
                    onUndo={handleUndo} 
                    canUndo={!!matchState.undoStack && matchState.undoStack.length > 0} 
                />
            </div>

            {/* 스페셜 이펙트 송출 (Host 전용, CLASS/CLUB 공통) */}
            {matchState.status === 'in_progress' && p2p.isHost && sendEffect && (
                <div className="flex flex-wrap items-center justify-center gap-3 mb-3">
                    <button
                        type="button"
                        onClick={() => sendEffect('SPIKE')}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-700 hover:bg-orange-600/80 text-slate-200 hover:text-white text-sm font-semibold transition-colors min-h-[44px]"
                    >
                        🔥 스파이크 득점
                    </button>
                    <button
                        type="button"
                        onClick={() => sendEffect('BLOCK')}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-700 hover:bg-sky-600/80 text-slate-200 hover:text-white text-sm font-semibold transition-colors min-h-[44px]"
                    >
                        🧱 블로킹
                    </button>
                </div>
            )}

            {/* 세트 스코어 (클럽/BO3) - 팀 이름 사이 위쪽 중앙 */}
            {showSetScore && (
                <div className="flex justify-center mb-2 sm:mb-3">
                    <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-amber-400 tracking-widest bg-slate-800/90 px-4 py-2 rounded-xl border border-amber-500/40">
                        {setScoreText}
                    </span>
                </div>
            )}

            {/* Main Scoreboard Content */}
            <div className="flex-grow flex flex-col lg:flex-row gap-4 sm:gap-4 items-stretch justify-center relative">
                {isSwapped ? <TeamColumn teamKey="B" /> : <TeamColumn teamKey="A" />}
                
                {/* Center / Game Over Panel */}
                {(matchState.gameOver) && (
                    <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-20 rounded-xl p-3 sm:p-4">
                        <div className="w-full max-w-lg">
                            <GameSummaryPanel />
                        </div>
                    </div>
                )}

                {isSwapped ? <TeamColumn teamKey="A" /> : <TeamColumn teamKey="B" />}
            </div>

            {/* 세트 종료 모달 (다음 세트 진행 시 코트 체인지) */}
            {matchState?.setEnded && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
                    <div className="bg-slate-900 rounded-2xl border-2 border-amber-500/60 shadow-2xl w-full max-w-sm p-6 text-center" onClick={(e) => e.stopPropagation()}>
                        <p className="text-xl sm:text-2xl font-bold text-amber-400 mb-2">🚨 {matchState.currentSet}세트 종료</p>
                        <p className="text-slate-300 text-lg mb-4">
                            {matchState.teamA.name} {matchState.completedSetScore?.a ?? 0} : {matchState.completedSetScore?.b ?? 0} {matchState.teamB.name}
                        </p>
                        <button
                            onClick={() => {
                                dispatch({ type: 'START_NEXT_SET' });
                                setIsSwapped(prev => !prev);
                            }}
                            className="w-full py-4 px-6 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-lg transition-colors"
                        >
                            다음 세트 진행
                        </button>
                    </div>
                </div>
            )}

            {/* Modals */}
            {entryMode === 'club' && <TacticalBoardModal isOpen={showTacticalBoard} onClose={() => setShowTacticalBoard(false)} appMode="CLUB" initialMatchState={matchState} />}
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
            {p2p.isHost && (p2p.viewerCount ?? 0) > 0 && isChatEnabled && (
                <LiveChatOverlay
                    messages={receivedChatMessages}
                    isInputEnabled={isChatEnabled}
                    showInputSection={true}
                    isHostInputAlwaysEnabled={true}
                    onSend={(text) => sendChat?.(text)}
                    onBanViewer={banViewer}
                    isHost={true}
                    blockedViewerIds={blockedViewerIds}
                    onToggleBlockViewer={toggleBlockViewer}
                    onDeleteMessage={removeChatMessage}
                />
            )}
            <SubstitutionModal
                isOpen={isSubModalOpen}
                onClose={() => setIsSubModalOpen(false)}
                teamA={matchState.teamA}
                teamB={matchState.teamB}
                dispatch={dispatch}
                showPlayerMemo={entryMode === 'club'}
            />

            {/* 선수 상세 기록/메모 모달 (서브 로테이션에서 클릭 시) - z-[100]로 스코어보드/서브 로테이션 위에 표시 */}
            {selectedPlayerForRecord && (
                <div className="fixed inset-0 z-[100]" aria-modal="true" role="dialog">
                    <PlayerHistoryModal
                        player={selectedPlayerForRecord.player}
                        cumulativeStats={selectedPlayerForRecord.cumulativeStats}
                        performanceHistory={selectedPlayerForRecord.performanceHistory}
                        onClose={() => setSelectedPlayerForRecord(null)}
                        teamSets={teamSets}
                        appMode={entryMode === 'club' ? 'CLUB' : 'CLASS'}
                        currentMatchInfo={matchState?.teamA?.name && matchState?.teamB?.name ? `${matchState.teamA.name} vs ${matchState.teamB.name}` : undefined}
                    />
                </div>
            )}

            {/* 수행평가: 허슬 플레이어(노력상) 선정 모달 */}
            <HustlePlayerModal
                isOpen={hustleModalOpen}
                onClose={() => setHustleModalOpen(false)}
                teamAPlayers={matchState ? Object.values(matchState.teamA?.players ?? {}) : []}
                teamBPlayers={matchState ? Object.values(matchState.teamB?.players ?? {}) : []}
                teamAName={matchState?.teamA?.name ?? 'A팀'}
                teamBName={matchState?.teamB?.name ?? 'B팀'}
                onConfirm={handleHustleConfirm}
            />

            {/* 서브 순서 뷰어 모달 (CLUB 모드) - 다크 테마 e스포츠 스타일 */}
            {serveOrderModalTeam && (
                <div
                    className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="serve-order-modal-title"
                    onClick={() => setServeOrderModalTeam(null)}
                >
                    <div
                        className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-sm overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center px-5 py-4 border-b border-slate-700 bg-slate-800/50">
                            <h3 id="serve-order-modal-title" className="text-xl font-bold text-white">
                                📋 {(serveOrderModalTeam === 'A' ? matchState.teamA : matchState.teamB).name} 서브 로테이션
                            </h3>
                            <button
                                type="button"
                                onClick={() => setServeOrderModalTeam(null)}
                                className="p-2 rounded-lg hover:bg-slate-700 text-gray-400 hover:text-white transition-colors"
                                aria-label="닫기"
                            >
                                ✕
                            </button>
                        </div>
                        {(() => {
                            const t = serveOrderModalTeam === 'A' ? matchState.teamA : matchState.teamB;
                            const ids = t.onCourtPlayerIds ?? [];
                            const currentIdx = t.currentServerIndex ?? 0;
                            const isTeamA = serveOrderModalTeam === 'A';
                            const currentCardStyle = isTeamA
                                ? 'bg-gradient-to-r from-blue-950 to-blue-900 border-2 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.4)]'
                                : 'bg-gradient-to-r from-red-950 to-red-900 border-2 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]';
                            const currentBadgeStyle = isTeamA ? 'bg-blue-500/20 text-blue-300' : 'bg-red-500/20 text-red-300';
                            if (ids.length === 0) {
                                return (
                                    <div className="p-6 text-center">
                                        <p className="text-sm text-gray-500">출전 선수가 없습니다.</p>
                                    </div>
                                );
                            }
                            return (
                                <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3">
                                    {ids.map((pid, idx) => {
                                        const player = t.players[pid];
                                        const name = player?.originalName ?? '???';
                                        const number = player?.studentNumber ?? '';
                                        const isCurrent = idx === currentIdx;
                                        return (
                                            <div
                                                key={pid}
                                                role="button"
                                                tabIndex={0}
                                                onClick={(e) => { e.stopPropagation(); if (player) handleServeOrderPlayerClick(player); }}
                                                onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && player) { e.preventDefault(); handleServeOrderPlayerClick(player); } }}
                                                className={`flex items-center justify-between gap-3 p-4 rounded-lg border transition-all cursor-pointer hover:bg-slate-700/50 hover:scale-[1.02] ${
                                                    isCurrent
                                                        ? `${currentCardStyle} text-white font-extrabold`
                                                        : 'border border-slate-700/50 bg-slate-800 text-gray-200'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                                        isCurrent ? (isTeamA ? 'bg-blue-500 text-white' : 'bg-red-500 text-white') : 'bg-slate-700 text-gray-400'
                                                    }`}>
                                                        {idx + 1}
                                                    </span>
                                                    <div className="flex flex-col min-w-0">
                                                        <span className={`truncate ${isCurrent ? 'font-extrabold' : ''}`}>{name}</span>
                                                        {number && (
                                                            <span className={`text-xs ${isCurrent ? 'text-white/80' : 'text-gray-500'}`}>{number}번</span>
                                                        )}
                                                    </div>
                                                </div>
                                                {isCurrent && (
                                                    <span className={`flex-shrink-0 flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold ${currentBadgeStyle}`}>
                                                        <span className="animate-pulse">🏐</span>
                                                        <span>현재 서버</span>
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            <AutoSaveToast 
                show={showAutoSaveToast} 
                onHide={() => setShowAutoSaveToast(false)} 
            />

            {/* 대회 모드 비밀번호 모달 (클럽 모드에서는 미노출) */}
            {showTournamentPasswordModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
                    <div className="bg-slate-900 rounded-2xl border border-slate-600 shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-slate-200 mb-3">🏆 대회 전광판 모드</h3>
                        <p className="text-sm text-slate-400 mb-4">비밀번호를 입력하세요.</p>
                        <input
                            type="password"
                            value={tournamentPasswordInput}
                            onChange={(e) => setTournamentPasswordInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleTournamentPasswordConfirm()}
                            placeholder="비밀번호"
                            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 mb-4"
                            autoFocus
                        />
                        <div className="flex gap-2">
                            <button onClick={() => { setShowTournamentPasswordModal(false); setTournamentPasswordInput(''); }} className="flex-1 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-white font-medium">
                                취소
                            </button>
                            <button onClick={handleTournamentPasswordConfirm} className="flex-1 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium">
                                확인
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* QR 확대 모달 */}
            {showQRZoomModal && qrZoomPin && (
                <div
                    className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
                    onClick={() => { setShowQRZoomModal(false); setQrZoomPin(null); }}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="qr-zoom-title"
                >
                    <div
                        className="bg-slate-900 rounded-2xl border border-slate-600 shadow-2xl w-full max-w-sm flex flex-col items-center p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 id="qr-zoom-title" className="text-lg font-bold text-sky-300 mb-4">실시간 참여 QR 코드</h2>
                        <div ref={qrCanvasContainerRef} className="bg-white p-3 rounded-lg flex-shrink-0">
                            <QRCodeCanvas
                                value={`${window.location.origin}${window.location.pathname || '/'}?liveCode=${encodeURIComponent(qrZoomPin)}`}
                                size={260}
                                level="M"
                            />
                        </div>
                        <p className="text-slate-400 text-sm mt-3 font-mono">PIN: {qrZoomPin}</p>
                        <button
                            onClick={() => {
                                const canvas = qrCanvasContainerRef.current?.querySelector('canvas');
                                if (!canvas || !qrZoomPin) return;
                                const dataUrl = canvas.toDataURL('image/png');
                                const a = document.createElement('a');
                                a.href = dataUrl;
                                a.download = `J-IVE_Live_Code_${qrZoomPin}.png`;
                                a.click();
                                showToast('이미지가 저장되었습니다.', 'success');
                            }}
                            className="mt-4 w-full py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm transition-colors"
                        >
                            이미지 저장
                        </button>
                        <button
                            onClick={() => { setShowQRZoomModal(false); setQrZoomPin(null); }}
                            className="mt-2 text-slate-400 hover:text-white text-sm"
                        >
                            닫기
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};