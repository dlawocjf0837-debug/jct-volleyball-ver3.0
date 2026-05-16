const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'components', 'MemoTimelinePanel.tsx');

const S = {
  placeholder: '\uBA54\uBAA8\uB97C \uC785\uB825\uD558\uC138\uC694.',
  empty: '\uC800\uC7A5\uB41C \uBA54\uBAA8\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.',
  save: '\uC800\uC7A5',
  cancel: '\uCDE8\uC18C',
  edit: '\uC218\uC815',
  del: '\uC0AD\uC81C',
};

const content = `import React, { useMemo, useState } from 'react';
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
        <motion.div className={compact ? 'space-y-2' : 'space-y-3'} onClick={(e) => e.stopPropagation()}>
            <motion.div className="flex flex-col sm:flex-row gap-2">
                <textarea
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder={placeholder ?? '${S.placeholder}'}
                    className={\`flex-1 rounded-lg bg-slate-700 border border-slate-600 p-2 text-slate-200 text-sm resize-none placeholder:text-slate-500 \${compact ? 'min-h-[56px]' : 'min-h-[72px]'}\`}
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
            </motion.div>
            <motion.div className={\`space-y-2 pr-1 \${disableInnerScroll ? '' : \`overflow-y-auto \${compact ? 'max-h-[28vh]' : 'max-h-[36vh]'}\`}\`}>
                {dayGroups.length === 0 ? (
                    <p className="text-slate-500 text-sm text-center py-4">${S.empty}</p>
                ) : (
                    dayGroups.map((group) => (
                        <motion.div key={group.dayKey} className="bg-slate-800 rounded-lg p-3 border border-slate-700/50">
                            <motion.div className="flex justify-between items-start gap-2 mb-2">
                                <motion.div className="min-w-0">
                                    <span className="text-xs text-sky-400/90 font-medium block">{formatMemoDayLabel(group.dayKey)}</span>
                                    {formatMemoLastModified(group.lastModifiedAt) && (
                                        <span className="text-[10px] text-slate-500 mt-0.5 block">{formatMemoLastModified(group.lastModifiedAt)}</span>
                                    )}
                                </motion.div>
                                <motion.div className="flex gap-1 flex-shrink-0">
                                    {editingGroupId === group.groupId ? (
                                        <>
                                            <button type="button" onClick={handleSaveEdit} className="text-xs px-2 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white">${S.save}</button>
                                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingGroupId(null); setEditingContent(''); }} className="text-xs px-2 py-1 rounded bg-slate-600 text-slate-300">${S.cancel}</button>
                                        </>
                                    ) : (
                                        <>
                                            <button type="button" onClick={(e) => startEdit(group, e)} className="text-xs px-2 py-1 rounded bg-slate-600 hover:bg-slate-500 text-slate-300">${S.edit}</button>
                                            <button type="button" onClick={(e) => handleDeleteGroup(group, e)} className="text-xs px-2 py-1 rounded bg-red-900/50 hover:bg-red-800/50 text-red-300">${S.del}</button>
                                        </>
                                    )}
                                </motion.div>
                            </motion.div>
                            {editingGroupId === group.groupId ? (
                                <textarea value={editingContent} onChange={(e) => setEditingContent(e.target.value)} className="w-full min-h-[60px] bg-slate-900 border border-slate-600 rounded-md p-2 text-sm text-slate-200 resize-none" autoFocus onClick={(e) => e.stopPropagation()} />
                            ) : (
                                <p className="text-slate-200 text-sm whitespace-pre-wrap break-words">{group.content}</p>
                            )}
                        </motion.div>
                    ))
                )}
            </motion.div>
        </motion.div>
    );
};
`;

fs.writeFileSync(filePath, content.replace(/motion\.div/g, 'div'), 'utf8');
console.log('written', filePath);
