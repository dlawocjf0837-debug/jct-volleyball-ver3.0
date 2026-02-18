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
    /** Client: 채팅 허용 여부. Host: 무시하고 isHostInputAlwaysEnabled로 입력 항상 표시 */
    isInputEnabled: boolean;
    /** Host는 메시지만 표시할 때 false. Host가 입력창 보이면 true */
    showInputSection?: boolean;
    /** true면 Host 입력창은 통제와 무관하게 항상 활성화 (공지용) */
    isHostInputAlwaysEnabled?: boolean;
    onSend?: (text: string) => void;
    sendCooldownRemaining?: number;
    maxLength?: number;
    /** Host 전용: 해당 peerId 시청자 차단 */
    onBanViewer?: (peerId: string) => void;
    isHost?: boolean;
    /** 클라이언트 전용: 방장이 부여한 내 닉네임 (헤더에 "당신: 익명 N" 표시) */
    myViewerLabel?: { displayName: string; color: string };
}

export const LiveChatOverlay: React.FC<LiveChatOverlayProps> = ({
    messages,
    isInputEnabled,
    showInputSection = true,
    isHostInputAlwaysEnabled = false,
    onSend,
    sendCooldownRemaining = 0,
    maxLength = 30,
    onBanViewer,
    isHost = false,
    myViewerLabel,
}) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [inputValue, setInputValue] = React.useState('');

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages]);

    const handleSend = () => {
        const t = inputValue.trim();
        if (!t || !onSend || sendCooldownRemaining > 0) return;
        onSend(t);
        setInputValue('');
    };

    const isChatEnabled = isInputEnabled || isHostInputAlwaysEnabled;

    return (
        <div className="fixed left-4 bottom-4 z-20 w-[min(320px,85vw)] max-h-[200px] flex flex-col bg-black/70 backdrop-blur-sm rounded-xl border border-slate-600/60 overflow-hidden shadow-xl">
            <div className="px-3 py-2 border-b border-slate-600/60 text-xs font-semibold text-slate-300 flex items-center justify-between gap-2">
                <span>💬 실시간 채팅</span>
                {myViewerLabel && (
                    <span className="shrink-0 font-medium px-1.5 py-0.5 rounded" style={{ color: myViewerLabel.color }}>
                        당신: {myViewerLabel.displayName}
                    </span>
                )}
            </div>

            {/* 1. 채팅 메시지 출력 영역 */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto min-h-[80px] max-h-[120px] p-2 space-y-1 text-sm"
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
                                {isHost && msg.senderId && msg.senderId !== 'host' && onBanViewer && (
                                    <button
                                        type="button"
                                        onClick={() => onBanViewer(msg.senderId!)}
                                        className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-red-900/60 text-red-300 hover:bg-red-800/80"
                                        title="해당 시청자 채팅 차단"
                                    >
                                        🚫 채팅 금지
                                    </button>
                                )}
                            </div>
                        )
                    ))
                )}
            </div>

            {/* 2. 입력창 또는 제한 안내 영역 (조건부 렌더링 완벽 분리) */}
            {showInputSection && (
                isChatEnabled ? (
                    <div className="p-2 flex items-center gap-2 border-t border-slate-600/60 mt-0">
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value.slice(0, maxLength))}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder={isHostInputAlwaysEnabled ? `공지 (${maxLength}자)` : `메시지 (${maxLength}자)`}
                            disabled={!isHostInputAlwaysEnabled && sendCooldownRemaining > 0}
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
                        ❄️ 관리자에 의해 채팅이 제한되었습니다
                    </div>
                )
            )}
        </div>
    );
};
