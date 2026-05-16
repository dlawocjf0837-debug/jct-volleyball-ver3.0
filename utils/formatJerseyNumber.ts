/** 등번호가 유효한지 (미입력·플레이스홀더 제외) */
export function formatJerseyNumber(studentNumber?: string | null): string {
    if (!studentNumber) return '';
    const trimmed = String(studentNumber).trim();
    if (!trimmed || trimmed === '??') return '';
    return trimmed;
}

/** UI 표시용: "7번" 또는 빈 문자열 */
export function formatJerseyLabel(studentNumber?: string | null): string {
    const n = formatJerseyNumber(studentNumber);
    return n ? `${n}번` : '';
}
