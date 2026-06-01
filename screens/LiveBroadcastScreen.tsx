import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../contexts/DataContext';
import { VolleyballIcon } from '../components/icons';
import { buildYoutubeEmbedUrl } from '../utils/extractYoutubeVideoId';

const EMOJI_POOL = ['👏', '🔥', '🏐'] as const;
const TOAST_DURATION_MS = 3500;

function formatTickerFromEventDescription(desc: string): string {
    const s = (desc ?? '').trim().replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ');
    return s
        .replace('의 환상적인 서브 에이스!', ' 서브 에이스!')
        .replace(', 강력한 스파이크 성공!', ' 스파이크 득점!')
        .replace('의 완벽한 블로킹 득점!', ' 블로킹 득점!')
        .replace(', 다이렉트 공격 득점!', ' 다이렉트 득점!');
}

const LiveBroadcastScreen: React.FC = () => {
    const {
        matchState,
        broadcastVideoId,
        p2p,
        receivedChatMessages,
        isChatEnabled,
        isChatWindowVisible,
        sendChat,
        receivedReactions,
        removeReceivedReaction,
        sendReaction,
    } = useData();

    const embedUrl = useMemo(() => buildYoutubeEmbedUrl(broadcastVideoId), [broadcastVideoId]);

    const [showUi, setShowUi] = useState(true);
    const [chatMinimized, setChatMinimized] = useState(false);
    const [chatInput, setChatInput] = useState('');
    const [chatCooldown, setChatCooldown] = useState(0);
    const [toastText, setToastText] = useState<string | null>(null);
    const lastEventLenRef = useRef(0);

    useEffect(() => {
        if (chatCooldown <= 0) return;
        const id = setInterval(() => setChatCooldown((v) => Math.max(0, v - 1)), 1000);
        return () => clearInterval(id);
    }, [chatCooldown]);

    useEffect(() => {
        if (!matchState?.eventHistory) return;
        const len = matchState.eventHistory.length;
        if (len <= lastEventLenRef.current) return;
        const last = matchState.eventHistory[len - 1];
        if (!last) return;

        const scoringTypes = ['ACE', 'SPIKE', 'BLOCK', 'DIRECT', 'SCORE', 'MANUAL_SCORE'];
        if (scoringTypes.includes(last.type)) {
            setToastText(formatTickerFromEventDescription(String(last.descriptionKey ?? last.type)));
            const timer = setTimeout(() => setToastText(null), TOAST_DURATION_MS);
            lastEventLenRef.current = len;
            return () => clearTimeout(timer);
        }
        lastEventLenRef.current = len;
    }, [matchState?.eventHistory]);

    const teamA = matchState?.teamA;
    const teamB = matchState?.teamB;
    const chatAllowed = !!(p2p.isConnected && isChatEnabled && isChatWindowVisible);

    const sendChatMessage = () => {
        const text = chatInput.trim();
        if (!text || chatCooldown > 0 || !chatAllowed) return;
        sendChat?.(text);
        setChatInput('');
        setChatCooldown(3);
    };

    return (
        <div className="fixed inset-0 overflow-hidden bg-black">
            {/* Layer 0: YouTube 배경 (가장 뒤) */}
            <div className="absolute inset-0 z-0">
                {embedUrl ? (
                    <iframe
                        title="Live Broadcast Video"
                        src={embedUrl}
                        className="absolute inset-0 w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-black p-6">
                        <div className="text-center pointer-events-none">
                            <p className="text-slate-300 font-semibold mb-2">🎥 라이브 영상 대기 중</p>
                            <p className="text-slate-500 text-sm">기록원이 YouTube URL 또는 영상 ID를 입력하면 표시됩니다.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Layer 1+: 오버레이 UI (영상 위) — 컨테이너는 클릭 통과, 버튼만 상호작용 */}
            <div className="absolute inset-0 z-10 pointer-events-none">
                {/* UI 토글 */}
                <button
                    type="button"
                    onClick={() => setShowUi((v) => !v)}
                    className="fixed right-4 top-4 z-[9999] pointer-events-auto bg-black/50 hover:bg-black/70 border border-slate-600/60 text-slate-200 rounded-lg px-3 py-2 text-sm font-semibold shadow-lg"
                    title="중계 UI 숨기기/표시"
                >
                    {showUi ? '🙈 UI 숨기기' : '👁 UI 표시'}
                </button>

                {showUi && matchState && (
                    <div className="fixed top-0 left-0 right-0 z-[100] pointer-events-none">
                        <div className="bg-black/50 backdrop-blur-md border-b border-white/10 pointer-events-auto">
                            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-slate-100 truncate">{teamA?.name ?? 'A팀'}</p>
                                    <p className="text-xs text-slate-300/90 mt-0.5">
                                        세트 {matchState.currentSet ?? 1}
                                        {matchState.servingTeam && (
                                            <span className="ml-2 inline-flex items-center gap-1 text-sky-300">
                                                <VolleyballIcon className="w-3.5 h-3.5" />
                                                {(matchState.servingTeam === 'A' ? teamA?.name : teamB?.name) ?? ''} 서빙
                                            </span>
                                        )}
                                    </p>
                                </div>
                                <div className="flex items-center justify-center gap-3 sm:gap-4 shrink-0">
                                    <span className="text-4xl sm:text-6xl font-extrabold tabular-nums drop-shadow-lg" style={{ color: teamA?.color || '#38bdf8' }}>
                                        {teamA?.score ?? 0}
                                    </span>
                                    <span className="text-2xl sm:text-4xl font-black text-white/80">:</span>
                                    <span className="text-4xl sm:text-6xl font-extrabold tabular-nums drop-shadow-lg" style={{ color: teamB?.color || '#f87171' }}>
                                        {teamB?.score ?? 0}
                                    </span>
                                </div>
                                <div className="min-w-0 flex-1 text-right">
                                    <p className="text-sm font-semibold text-slate-100 truncate">{teamB?.name ?? 'B팀'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {toastText && (
                    <div className="fixed bottom-24 left-1/2 z-[200] -translate-x-1/2 pointer-events-none">
                        <div className="bg-black/60 backdrop-blur-md border border-white/15 text-white rounded-2xl px-5 py-3 shadow-2xl">
                            <p className="font-bold text-base sm:text-lg text-center whitespace-nowrap">{toastText}</p>
                        </div>
                    </div>
                )}

                {/* 채팅: 최소화 시 '채팅 열기' FAB — 최상위 z-index + pointer-events-auto */}
                {showUi && chatAllowed && chatMinimized && (
                    <button
                        type="button"
                        onClick={() => setChatMinimized(false)}
                        className="fixed right-4 bottom-4 z-[9999] pointer-events-auto flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-500/70 shadow-2xl text-slate-100 font-semibold text-sm"
                        title="채팅 열기"
                    >
                        💬 채팅 열기
                    </button>
                )}

                {showUi && chatAllowed && !chatMinimized && (
                    <div className="fixed right-4 bottom-4 z-[9998] pointer-events-auto flex flex-col w-[min(320px,90vw)] max-h-[min(70vh,520px)] bg-black/50 backdrop-blur-md rounded-xl border border-slate-500/50 shadow-2xl overflow-hidden">
                        <div className="px-3 py-2 border-b border-slate-600/60 flex items-center justify-between gap-2 shrink-0">
                            <span className="text-xs font-semibold text-slate-200">💬 실시간 채팅</span>
                            <button
                                type="button"
                                onClick={() => setChatMinimized(true)}
                                className="px-2 py-1 rounded bg-slate-700/90 hover:bg-slate-600 text-slate-200 text-xs pointer-events-auto"
                            >
                                🔽 최소화
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-[100px] max-h-[280px]">
                            {receivedChatMessages.length === 0 ? (
                                <p className="text-slate-400 text-xs text-center py-2">아직 채팅이 없습니다.</p>
                            ) : (
                                receivedChatMessages.map((msg) =>
                                    msg.isSystem || msg.sender === 'SYSTEM' ? (
                                        <p key={msg.id} className="text-gray-400 text-xs text-center py-0.5">{msg.text}</p>
                                    ) : (
                                        <div key={msg.id} className="flex flex-wrap gap-1 text-xs">
                                            <span className="font-semibold shrink-0" style={{ color: msg.senderColor ?? '#eab308' }}>
                                                {msg.sender}:
                                            </span>
                                            <span className="text-slate-100 break-words">{msg.text}</span>
                                        </div>
                                    ),
                                )
                            )}
                        </div>
                        <div className="p-2 border-t border-slate-600/60 bg-black/40 shrink-0">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value.slice(0, 30))}
                                    onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                                    placeholder="메시지 입력..."
                                    disabled={chatCooldown > 0}
                                    className="flex-1 bg-slate-800/80 border border-slate-600 rounded-lg px-3 py-2 text-white text-xs placeholder-slate-500 focus:ring-2 focus:ring-amber-500 pointer-events-auto"
                                />
                                <button
                                    type="button"
                                    onClick={sendChatMessage}
                                    disabled={chatCooldown > 0 || !chatInput.trim()}
                                    className="px-3 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 text-white text-xs font-medium rounded-lg pointer-events-auto"
                                >
                                    {chatCooldown > 0 ? `${chatCooldown}초` : '전송'}
                                </button>
                            </div>
                            <div className="flex justify-center gap-2 mt-2 pointer-events-auto">
                                {EMOJI_POOL.map((emoji) => (
                                    <button
                                        key={emoji}
                                        type="button"
                                        onClick={() => sendReaction?.(emoji)}
                                        className="w-9 h-9 rounded-full bg-slate-800/90 hover:bg-slate-700 text-lg border border-slate-600 pointer-events-auto"
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {receivedReactions.length > 0 && (
                    <div className="absolute inset-0 z-[50] flex items-end justify-center pb-28 pointer-events-none">
                        {receivedReactions.map((r) => (
                            <span
                                key={r.id}
                                className="text-5xl animate-float-up pointer-events-none"
                                style={{ textShadow: '0 0 20px rgba(255,255,255,0.8)' }}
                                onAnimationEnd={() => removeReceivedReaction(r.id)}
                            >
                                {r.emoji}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LiveBroadcastScreen;
