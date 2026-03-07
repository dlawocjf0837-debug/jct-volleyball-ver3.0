import React, { useRef, useEffect } from 'react';

interface ChatMessage {
    id: number;
    text: string;
    sender: string;
    senderId?: string;
    senderColor?: string;
    isSystem?: boolean;
}

interface LiveChatOverlayProps {
    messages: ChatMessage[];
    isInputEnabled: boolean;
    showInputSection?: boolean;
    isHostInputAlwaysEnabled?: boolean;
    /** 모바일(md 이하)에서 하단 리액션 버튼과 겹침 방지: true면 bottom-24로 상승 */
    raiseOnMobile?: boolean;
    onSend?: (text: string) => void;
    sendCooldownRemaining?: number;
    maxLength?: number;
    onBanViewer?: (peerId: string) => void;
    isHost?: boolean;
    myViewerLabel?: { displayName: string; color: string };
    /** Host 전용: 개별 시청자 채팅 금지/해제 (토글) */
    blockedViewerIds?: Set<string>;
    onToggleBlockViewer?: (senderId: string) => void;
    /** 시청자 전용: 현재 유저가 차단되어 입력 불가 여부 */
    isBlocked?: boolean;
    /** Host 전용: 개별 메시지 삭제 (악성 메시지 즉시 제거) */
    onDeleteMessage?: (messageId: number) => void;
}

export const LiveChatOverlay: React.FC<LiveChatOverlayProps> = ({
    messages,
    isInputEnabled,
    showInputSection = true,
    isHostInputAlwaysEnabled = false,
    raiseOnMobile = false,
    onSend,
    sendCooldownRemaining = 0,
    maxLength = 30,
    onBanViewer,
    isHost = false,
    myViewerLabel,
    blockedViewerIds = new Set(),
    onToggleBlockViewer,
    isBlocked = false,
    onDeleteMessage,
}) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [inputValue, setInputValue] = React.useState('');
    const [isExpanded, setIsExpanded] = React.useState(false);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages]);

    const handleSend = () => {
        const t = inputValue.trim();
        if (!t || !onSend || sendCooldownRemaining > 0) return;
        onSend(t);
        setInputValue('');
    };

    const isChatEnabled = (isInputEnabled || isHostInputAlwaysEnabled) && !isBlocked;

    return (
        <div className={`fixed left-4 z-20 flex flex-col bg-black/70 backdrop-blur-sm rounded-xl border border-slate-600/60 overflow-hidden shadow-xl transition-all duration-300 ${raiseOnMobile ? 'bottom-4 max-md:bottom-24' : 'bottom-4'} ${isExpanded ? 'w-[min(28rem,90vw)] h-[min(600px,80vh)] max-h-[80vh]' : 'w-[min(320px,85vw)] max-h-[200px]'}`}>
            <div className="px-3 py-2 border-b border-slate-600/60 text-xs font-semibold text-slate-300 flex items-center justify-between gap-2 shrink-0">
                <span>💬 실시간 채팅</span>
                <button
                    type="button"
                    onClick={() => setIsExpanded((e) => !e)}
                    className="shrink-0 px-2 py-1 rounded bg-slate-600/80 hover:bg-slate-500 text-slate-200 text-xs"
                    title={isExpanded ? '작게 보기' : '크게 보기'}
                >
                    {isExpanded ? '🗗 작게 보기' : '🗖 크게 보기'}
                </button>
                {myViewerLabel && (
                    <span className="shrink-0 font-medium px-1.5 py-0.5 rounded" style={{ color: myViewerLabel.color }}>
                        당신: {myViewerLabel.displayName}
                    </span>
                )}
            </div>

            {/* 1. 채팅 메시지 출력 영역 */}
            <div
                ref={scrollRef}
                className={`flex-1 overflow-y-auto p-2 space-y-1 text-sm ${isExpanded ? 'min-h-[200px] max-h-[480px]' : 'min-h-[80px] max-h-[120px]'}`}
            >
                {messages.length === 0 ? (
                    <p className="text-slate-500 text-xs py-2">아직 채팅이 없습니다.</p>
                ) : (
                    messages.map((msg) => (
                        msg.isSystem || msg.sender === 'SYSTEM' ? (
                            <p key={msg.id} className="text-gray-400 text-sm text-center py-0.5">
                                {msg.text}
                            </p>
                        ) : (
                            <div key={msg.id} className="mb-2 flex flex-wrap items-start gap-1 gap-y-0.5">
                                <span
                                    className="text-xs shrink-0 font-semibold px-1.5 py-0.5 rounded"
                                    style={{
                                        color: msg.senderColor ?? '#eab308',
                                        backgroundColor: msg.senderId === 'host' ? 'rgba(234,179,8,0.25)' : undefined,
                                    }}
                                >
                                    {msg.sender}:
                                </span>
                                <span className="text-slate-200 break-words flex-1">{msg.text}</span>
                                <span className="flex items-center gap-1 shrink-0">
                                    {isHost && msg.senderId && msg.senderId !== 'host' && onToggleBlockViewer && (
                                        <button
                                            type="button"
                                            onClick={() => onToggleBlockViewer(msg.senderId!)}
                                            className={`text-xs px-1.5 py-0.5 rounded ${blockedViewerIds.has(msg.senderId) ? 'bg-green-900/60 text-green-300 hover:bg-green-800/80' : 'bg-red-900/60 text-red-300 hover:bg-red-800/80'}`}
                                            title={blockedViewerIds.has(msg.senderId) ? '채팅 금지 해제' : '해당 시청자 채팅 금지'}
                                        >
                                            {blockedViewerIds.has(msg.senderId) ? '✅ 차단 해제' : '🚫 채팅 금지'}
                                        </button>
                                    )}
                                    {isHost && onDeleteMessage && (
                                        <button
                                            type="button"
                                            onClick={() => onDeleteMessage(msg.id)}
                                            className="text-xs px-1.5 py-0.5 rounded bg-red-800/80 text-red-200 hover:bg-red-700"
                                            title="메시지 삭제"
                                        >
                                            🗑️ 삭제
                                        </button>
                                    )}
                                </span>
                            </div>
                        )
                    ))
                )}
            </div>

            {/* 2. 입력창 또는 제한 안내 영역 (조건부 렌더링 완벽 분리) */}
            {showInputSection && (
                !isBlocked ? (
                    <div className="p-2 flex flex-wrap items-center gap-2 border-t border-slate-600/60 mt-0 shrink-0 relative z-30 bg-black/80">
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value.slice(0, maxLength))}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder={isBlocked ? '채팅이 금지되었습니다.' : (isHostInputAlwaysEnabled ? `공지 (${maxLength}자)` : `메시지 (${maxLength}자)`)}
                            disabled={isBlocked || (!isHostInputAlwaysEnabled && sendCooldownRemaining > 0)}
                            maxLength={maxLength}
                            className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 text-sm focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
                        />
                        <button
                            type="button"
                            onClick={handleSend}
                            disabled={!inputValue.trim() || (!isHostInputAlwaysEnabled && sendCooldownRemaining > 0)}
                            className="px-3 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-lg text-sm shrink-0"
                        >
                            {sendCooldownRemaining > 0 && !isHostInputAlwaysEnabled ? `${sendCooldownRemaining}초` : '전송'}
                        </button>
                    </div>
                ) : (
                    <div className="mt-2 p-2 bg-slate-800/80 border-t border-slate-600/60 text-slate-400 text-xs text-center rounded">
                        {isBlocked ? '채팅이 금지되었습니다.' : '❄️ 관리자에 의해 채팅이 제한되었습니다'}
                    </div>
                )
            )}
        </div>
    );
};
