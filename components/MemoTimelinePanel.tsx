import React, { useMemo, useState } from 'react';
import {
    MemoEntry,
    MemoDayGroup,
    groupMemoEntriesByDay,
    formatMemoDayLabel,
    formatMemoLastModified,
    appendMemoEntry,
    removeMemoDayGroup,
    updateMemoDayGroup,
} from '../utils/memoTimeline';
import { useTranslation } from '../hooks/useTranslation';

interface Props {
    entries: MemoEntry[];
    onChange: (entries: MemoEntry[]) => void;
    onSave: (entries: MemoEntry[]) => void | Promise<void>;
    placeholder?: string;
    compact?: boolean;
    disableInnerScroll?: boolean;
}

export const MemoTimelinePanel: React.FC<Props> = ({ entries, onChange, onSave, placeholder, compact, disableInnerScroll }) => {
    const { t } = useTranslation();
    const [newContent, setNewContent] = useState('');
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
    const [editingContent, setEditingContent] = useState('');

    const dayGroups = useMemo(() => groupMemoEntriesByDay(entries), [entries]);

    const handleAdd = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const content = newContent.trim();
        if (!content) return;
        const next = appendMemoEntry(entries, content);
        onChange(next);
        setNewContent('');
        await onSave(next);
    };

    const handleDeleteGroup = async (group: MemoDayGroup, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const next = removeMemoDayGroup(entries, group);
        onChange(next);
        await onSave(next);
    };

    const startEdit = (group: MemoDayGroup, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setEditingGroupId(group.groupId);
        setEditingContent(group.content);
    };

    const handleSaveEdit = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!editingGroupId) return;
        const group = dayGroups.find((g) => g.groupId === editingGroupId);
        if (!group) return;
        const next = updateMemoDayGroup(entries, group, editingContent);
        onChange(next);
        setEditingGroupId(null);
        setEditingContent('');
        await onSave(next);
    };

    return (
        <div className={compact ? 'space-y-2' : 'space-y-3'} onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col sm:flex-row gap-2">
                <textarea
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder={placeholder ?? '메모를 입력하세요.'}
                    className={`flex-1 rounded-lg bg-slate-700 border border-slate-600 p-2 text-slate-200 text-sm resize-none placeholder:text-slate-500 ${compact ? 'min-h-[56px]' : 'min-h-[72px]'}`}
                    rows={compact ? 2 : 3}
                    onClick={(e) => e.stopPropagation()}
                />
                <button
                    type="button"
                    onClick={handleAdd}
                    disabled={!newContent.trim()}
                    className="flex-shrink-0 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm font-semibold whitespace-nowrap"
                >
                    + {t('memo_add_feedback')}
                </button>
            </div>
            <div className={`space-y-2 pr-1 ${disableInnerScroll ? '' : `overflow-y-auto ${compact ? 'max-h-[28vh]' : 'max-h-[36vh]'}`}`}>
                {dayGroups.length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-4">저장된 메모가 없습니다.</p>
                ) : (
                    dayGroups.map((group) => (
                        <div key={group.dayKey} className="bg-slate-800 rounded-lg p-3 border border-slate-700/50">
                            <div className="flex justify-between items-start gap-2 mb-2">
                                <div className="min-w-0">
                                    <span className="text-xs text-sky-400/90 font-medium block">{formatMemoDayLabel(group.dayKey)}</span>
                                    {formatMemoLastModified(group.lastModifiedAt) && (
                                        <span className="text-[10px] text-slate-500 mt-0.5 block">{formatMemoLastModified(group.lastModifiedAt)}</span>
                                    )}
                                </div>
                                <div className="flex gap-1 flex-shrink-0">
                                    {editingGroupId === group.groupId ? (
                                        <>
                                            <button type="button" onClick={handleSaveEdit} className="text-xs px-2 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white">저장</button>
                                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingGroupId(null); setEditingContent(''); }} className="text-xs px-2 py-1 rounded bg-slate-600 text-slate-300">취소</button>
                                        </>
                                    ) : (
                                        <>
                                            <button type="button" onClick={(e) => startEdit(group, e)} className="text-xs px-2 py-1 rounded bg-slate-600 hover:bg-slate-500 text-slate-300">수정</button>
                                            <button type="button" onClick={(e) => handleDeleteGroup(group, e)} className="text-xs px-2 py-1 rounded bg-red-900/50 hover:bg-red-800/50 text-red-300">삭제</button>
                                        </>
                                    )}
                                </div>
                            </div>
                            {editingGroupId === group.groupId ? (
                                <textarea value={editingContent} onChange={(e) => setEditingContent(e.target.value)} className="w-full min-h-[60px] bg-slate-900 border border-slate-600 rounded-md p-2 text-sm text-slate-200 resize-none" autoFocus onClick={(e) => e.stopPropagation()} />
                            ) : (
                                <p className="text-slate-200 text-sm whitespace-pre-wrap break-words">{group.content}</p>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
