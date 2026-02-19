import React, { useState, useEffect } from 'react';

interface PlayerMemoModalProps {
    isOpen: boolean;
    onClose: () => void;
    playerName: string;
    initialMemo: string;
    onSave: (memo: string) => void;
}

export const PlayerMemoModal: React.FC<PlayerMemoModalProps> = ({
    isOpen,
    onClose,
    playerName,
    initialMemo,
    onSave,
}) => {
    const [memo, setMemo] = useState(initialMemo);

    useEffect(() => {
        if (isOpen) setMemo(initialMemo);
    }, [isOpen, initialMemo]);

    const handleSave = async () => {
        const result = onSave(memo);
        if (result && typeof (result as Promise<unknown>)?.then === 'function') await (result as Promise<unknown>);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4" onClick={onClose}>
            <div className="bg-slate-900 rounded-lg shadow-2xl p-5 w-full max-w-md border border-slate-700" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-sky-400 mb-1">전력 분석 메모</h3>
                <p className="text-slate-400 text-sm mb-3">{playerName}</p>
                <textarea
                    value={memo}
                    onChange={e => setMemo(e.target.value)}
                    placeholder="예: 공격 에이스, 서브 리시브 약함"
                    className="w-full h-28 bg-slate-800 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:border-transparent resize-none"
                />
                <div className="flex justify-end gap-2 mt-4">
                    <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-white font-medium">
                        취소
                    </button>
                    <button type="button" onClick={handleSave} className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium">
                        저장
                    </button>
                </div>
            </div>
        </div>
    );
};
