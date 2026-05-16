export type MemoEntry = { id: string; createdAt: string; content: string; matchInfo?: string };

export type MemoDayGroup = {
    dayKey: string;
    groupId: string;
    content: string;
    lastModifiedAt: string;
    entryIds: string[];
};

export function genMemoId(): string {
    return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `memo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** YYYY-MM-DD (날짜 단위 그룹 키) */
export function getMemoDayKey(input?: string | Date): string {
    if (input instanceof Date) {
        const y = input.getFullYear();
        const m = String(input.getMonth() + 1).padStart(2, '0');
        const d = String(input.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    if (input && typeof input === 'string') {
        if (input === '이전 기록') return input;
        const iso = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
        const dotted = input.match(/^(\d{4})\.(\d{2})\.(\d{2})/);
        if (dotted) return `${dotted[1]}-${dotted[2]}-${dotted[3]}`;
        const dottedTime = input.match(/^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})/);
        if (dottedTime) return `${dottedTime[1]}-${dottedTime[2]}-${dottedTime[3]}`;
        const parsed = new Date(input);
        if (!Number.isNaN(parsed.getTime())) return getMemoDayKey(parsed);
    }
    return getMemoDayKey(new Date());
}

export function formatMemoDateTime(d: Date): string {
    return d.toISOString();
}

export function parseMemoTimestamp(createdAt: string): number {
    if (!createdAt || createdAt === '이전 기록') return 0;
    const d = new Date(createdAt);
    if (!Number.isNaN(d.getTime())) return d.getTime();
    const dottedTime = createdAt.match(/^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})/);
    if (dottedTime) {
        return new Date(Number(dottedTime[1]), Number(dottedTime[2]) - 1, Number(dottedTime[3]), Number(dottedTime[4]), Number(dottedTime[5])).getTime();
    }
    const day = getMemoDayKey(createdAt);
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) return new Date(`${day}T00:00:00`).getTime();
    return 0;
}

export function parseMemoEntries(raw: string | undefined): MemoEntry[] {
    if (raw == null || raw === '') return [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed
                .filter((e: unknown) => e && typeof e === 'object' && 'content' in (e as object))
                .map((e: { id?: string; createdAt?: string; content?: string; matchInfo?: string; date?: string }) => ({
                    id: String(e?.id ?? genMemoId()),
                    createdAt: String(e?.createdAt ?? e?.date ?? formatMemoDateTime(new Date())),
                    content: String(e?.content ?? ''),
                    matchInfo: e?.matchInfo ? String(e.matchInfo) : undefined,
                }));
        }
    } catch (_) { /* legacy plain text */ }
    if (String(raw).trim()) {
        return [{ id: 'legacy', createdAt: '이전 기록', content: String(raw) }];
    }
    return [];
}

export function serializeMemoEntries(entries: MemoEntry[]): string {
    if (entries.length === 0) return '';
    return JSON.stringify(entries);
}

/** 날짜(YYYY-MM-DD)별로 그룹화 — 같은 날 여러 메모는 하나의 블록으로 병합 */
export function groupMemoEntriesByDay(entries: MemoEntry[]): MemoDayGroup[] {
    const byDay = new Map<string, MemoDayGroup>();
    for (const e of entries) {
        const day = getMemoDayKey(e.createdAt);
        const ts = parseMemoTimestamp(e.createdAt);
        const piece = e.content.trim();
        if (!piece) continue;
        const existing = byDay.get(day);
        if (!existing) {
            byDay.set(day, {
                dayKey: day,
                groupId: e.id,
                content: piece,
                lastModifiedAt: e.createdAt,
                entryIds: [e.id],
            });
        } else {
            existing.content = existing.content.trim()
                ? `${existing.content.trim()}\n${piece}`
                : piece;
            existing.entryIds.push(e.id);
            if (ts >= parseMemoTimestamp(existing.lastModifiedAt)) {
                existing.lastModifiedAt = e.createdAt;
            }
        }
    }
    return [...byDay.values()].sort(
        (a, b) => parseMemoTimestamp(b.lastModifiedAt) - parseMemoTimestamp(a.lastModifiedAt)
    );
}

export function formatMemoDayLabel(dayKey: string): string {
    if (dayKey === '이전 기록') return dayKey;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
        const [y, m, d] = dayKey.split('-');
        return `${y}.${m}.${d}`;
    }
    return dayKey;
}

export function formatMemoLastModified(createdAt: string): string {
    if (!createdAt || createdAt === '이전 기록') return '';
    const d = new Date(createdAt);
    if (!Number.isNaN(d.getTime()) && (createdAt.includes('T') || createdAt.includes(':'))) {
        const h = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `최종 수정 ${h}:${min}`;
    }
    const dottedTime = createdAt.match(/^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})/);
    if (dottedTime) return `최종 수정 ${dottedTime[4]}:${dottedTime[5]}`;
    return '';
}

/** 새 피드백 추가 (타임스탬프 보존 — 렌더 시 날짜별 병합) */
export function appendMemoEntry(entries: MemoEntry[], content: string): MemoEntry[] {
    const trimmed = content.trim();
    if (!trimmed) return entries;
    const entry: MemoEntry = { id: genMemoId(), createdAt: formatMemoDateTime(new Date()), content: trimmed };
    return [entry, ...entries];
}

export function removeMemoDayGroup(entries: MemoEntry[], group: MemoDayGroup): MemoEntry[] {
    const ids = new Set(group.entryIds);
    return entries.filter((e) => !ids.has(e.id));
}

export function updateMemoDayGroup(entries: MemoEntry[], group: MemoDayGroup, newContent: string): MemoEntry[] {
    const trimmed = newContent.trim();
    const without = removeMemoDayGroup(entries, group);
    if (!trimmed) return without;
    const entry: MemoEntry = {
        id: genMemoId(),
        createdAt: formatMemoDateTime(new Date()),
        content: trimmed,
    };
    return [entry, ...without];
}
