import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MatchState } from '../types';
import { useData } from '../contexts/DataContext';

// Helper to format time in mm:ss
const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
};

const CameraDirectorScreen: React.FC = () => {
    const { matchState, p2p } = useData();
    const videoRef = useRef<HTMLVideoElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const [isRecording, setIsRecording] = useState(false);
    const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [timer, setTimer] = useState(0);
    const timerRef = useRef(0);
    const [highlights, setHighlights] = useState<{ timestamp: number; event: string }[]>([]);
    const prevMatchStateRef = useRef<MatchState | null>(null);
    
    useEffect(() => {
        timerRef.current = timer;
    }, [timer]);

    // 1. Setup camera
    useEffect(() => {
        const setupCamera = async () => {
            if (!navigator.mediaDevices?.getUserMedia) {
                alert("카메라 기능을 지원하지 않는 브라우저입니다.");
                return;
            }
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: true });
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.src = '';
                }
            } catch (error) {
                console.error("Error accessing camera:", error);
                alert("카메라에 접근할 수 없습니다. 권한을 확인해주세요.");
            }
        };

        setupCamera();

        return () => {
            streamRef.current?.getTracks().forEach(track => track.stop());
        };
    }, []);
    
    // 2. Detect events from context and create highlights
    useEffect(() => {
        // Store a deep copy for comparison in the next render.
        // This should always be the last line of the effect's logic.
        const updatePrevState = () => {
            prevMatchStateRef.current = matchState ? JSON.parse(JSON.stringify(matchState)) : null;
        };

        if (!isRecording || !matchState) {
            updatePrevState();
            return;
        }
    
        const prevState = prevMatchStateRef.current;
        if (!prevState) {
            updatePrevState();
            return;
        }
    
        const addHighlight = (event: string) => {
            setHighlights(prev => [...prev, { timestamp: timerRef.current, event }]);
        };
    
        // --- Scoring Event Detection ---
        const checkTeamScoreEvents = (teamKey: 'A' | 'B') => {
            const currentTeam = teamKey === 'A' ? matchState.teamA : matchState.teamB;
            const prevTeam = teamKey === 'A' ? prevState.teamA : prevState.teamB;
            const opponentTeamKey = teamKey === 'A' ? 'B' : 'A';
            const opponentTeam = opponentTeamKey === 'A' ? matchState.teamA : matchState.teamB;
            const prevOpponentTeam = opponentTeamKey === 'A' ? prevState.teamA : prevState.teamB;

            // Only proceed if this team's score has increased
            if (currentTeam.score > prevTeam.score) {
                if (currentTeam.serviceAces > prevTeam.serviceAces) {
                    addHighlight(`${currentTeam.name} 서브 에이스!`);
                } else if (currentTeam.spikeSuccesses > prevTeam.spikeSuccesses) {
                    addHighlight(`${currentTeam.name} 스파이크 성공!`);
                } else if (currentTeam.blockingPoints > prevTeam.blockingPoints) {
                    addHighlight(`${currentTeam.name} 블로킹 성공!`);
                } else if (opponentTeam.serviceFaults > prevOpponentTeam.serviceFaults) {
                    addHighlight(`${opponentTeam.name} 서브 범실, ${currentTeam.name} 득점`);
                } else {
                    addHighlight(`${currentTeam.name} 득점! (${matchState.teamA.score}:${matchState.teamB.score})`);
                }
            }
        };
        
        checkTeamScoreEvents('A');
        checkTeamScoreEvents('B');
        
        // --- Non-Scoring Event Detection ---
        if (matchState.teamA.timeouts < prevState.teamA.timeouts) {
            addHighlight(`${matchState.teamA.name} 작전타임`);
        }
        if (matchState.teamB.timeouts < prevState.teamB.timeouts) {
            addHighlight(`${matchState.teamB.name} 작전타임`);
        }
    
        if (matchState.gameOver && !prevState.gameOver) {
            const winnerName = matchState.winner === 'A' ? matchState.teamA.name : matchState.teamB.name;
            addHighlight(`경기 종료! 최종 승자: ${winnerName}`);
        }
    
        updatePrevState();
    
    }, [matchState, isRecording]);

    // Timer for recording duration: cleanup 로직 중복 제거
    useEffect(() => {
        if (!isRecording) return;
        
        const interval = setInterval(() => {
            setTimer(t => t + 1);
        }, 1000);
        
        // cleanup 함수만으로 충분 (중복 체크 불필요)
        return () => clearInterval(interval);
    }, [isRecording]);

    // 3. Recording Logic
    const startRecording = useCallback(() => {
        if (videoRef.current && streamRef.current) {
            if (videoRef.current.srcObject !== streamRef.current) {
                videoRef.current.srcObject = streamRef.current;
                videoRef.current.src = '';
            }
            
            mediaRecorderRef.current = new MediaRecorder(streamRef.current, { mimeType: 'video/webm' });

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    setRecordedChunks(prev => [...prev, event.data]);
                }
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setTimer(0);
            setHighlights([]);
            setVideoUrl(null);
            setRecordedChunks([]);
        }
    }, []);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setRecordedChunks(prevChunks => {
                if (prevChunks.length > 0) {
                    const blob = new Blob(prevChunks, { type: 'video/webm' });
                    const url = URL.createObjectURL(blob);
                    setVideoUrl(url);
                }
                return prevChunks;
            });
        }
    }, []);

    const handleDownload = () => {
        if (recordedChunks.length === 0) return;
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        document.body.appendChild(a);
        a.style.display = 'none';
        a.href = url;
        const matchName = matchState ? `${matchState.teamA.name}_vs_${matchState.teamB.name}` : 'volleyball_match';
        a.download = `${matchName}_${new Date().toISOString()}.webm`;
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    };

    const playHighlight = (timestamp: number) => {
        if (videoRef.current && videoUrl) {
            videoRef.current.srcObject = null;
            videoRef.current.src = videoUrl;
            videoRef.current.currentTime = timestamp;
            videoRef.current.play();
        }
    };
    
    const renderMatchInfo = () => {
        if (!p2p.isHost && !p2p.isConnected) {
            return <p className="text-lg font-bold text-red-500">호스트와의 연결이 끊어졌습니다.</p>;
        }
        if (!matchState) {
            return <p className="text-slate-400">진행 중인 경기가 없습니다. 다른 기기에서 경기를 시작해주세요.</p>;
        }
        return (
            <div className="text-center">
                <p className="text-2xl font-bold">{matchState.teamA.name} <span className="text-[#00A3FF]">{matchState.teamA.score}</span> vs <span className="text-[#00A3FF]">{matchState.teamB.score}</span> {matchState.teamB.name}</p>
                 {matchState.gameOver && <p className="text-yellow-400 font-bold mt-1">경기 종료</p>}
            </div>
        )
    };

    const renderTimeoutOverlay = () => {
        if (!matchState?.timeout) return null;

        const team = matchState.timeout.team === 'A' ? matchState.teamA : matchState.teamB;
        const teamColor = team.color || '#00A3FF';

        return (
            <div className="absolute top-4 right-4 bg-slate-900/80 p-3 rounded-lg border-2 animate-fade-in z-10" style={{ borderColor: teamColor }}>
                <h3 className="text-lg font-bold text-center" style={{ color: teamColor }}>{team.name} 작전 타임</h3>
                <p className="text-4xl font-mono font-extrabold text-white text-center mt-1">{matchState.timeout.timeLeft}</p>
            </div>
        );
    };
    
    return (
        <div className="w-full max-w-7xl mx-auto flex flex-col md:flex-row gap-6 flex-grow animate-fade-in">
            <div className="flex-grow md:w-2/3 bg-slate-900/50 p-4 rounded-lg flex flex-col gap-4">
                <div className="relative w-full aspect-video bg-black rounded-md overflow-hidden">
                    {renderTimeoutOverlay()}
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"></video>
                    {isRecording && <div className="absolute top-3 left-3 bg-red-600 rounded-full w-4 h-4 animate-pulse"></div>}
                </div>
                <div className="text-center">{renderMatchInfo()}</div>
                <div className="flex flex-wrap justify-center items-center gap-4">
                    {!isRecording ? (
                        <button onClick={startRecording} className="bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors">
                            녹화 시작
                        </button>
                    ) : (
                        <button onClick={stopRecording} className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors">
                            녹화 중지 ({formatTime(timer)})
                        </button>
                    )}
                    <button onClick={handleDownload} disabled={recordedChunks.length === 0 || isRecording} className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 px-6 rounded-lg disabled:bg-slate-700 disabled:cursor-not-allowed">
                        전체 영상 다운로드
                    </button>
                </div>
            </div>

            <div className="md:w-1/3 bg-slate-900/50 p-4 rounded-lg flex flex-col">
                <h2 className="text-2xl font-bold text-[#00A3FF] mb-4 text-center">하이라이트</h2>
                <div className="flex-grow overflow-y-auto space-y-2">
                    {highlights.length === 0 ? (
                        <p className="text-slate-500 text-center pt-10">녹화 중 주요 이벤트가 자동으로 기록됩니다.</p>
                    ) : (
                        highlights.map((h, index) => (
                            <div key={index} className="bg-slate-800 p-3 rounded-md flex justify-between items-center">
                                <div>
                                    <span className="font-mono text-sky-400 mr-3">{formatTime(h.timestamp)}</span>
                                    <span className="text-slate-300">{h.event}</span>
                                </div>
                                <button onClick={() => playHighlight(h.timestamp)} disabled={!videoUrl} className="bg-slate-600 hover:bg-slate-500 text-white text-xs font-bold py-1 px-3 rounded disabled:bg-slate-700 disabled:cursor-not-allowed">
                                    재생
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default CameraDirectorScreen;