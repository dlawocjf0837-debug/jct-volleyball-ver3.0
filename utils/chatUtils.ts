/**
 * peerId(또는 세션 ID)를 해싱하여 채팅 닉네임용 고유 Hex 색상 반환
 */
export function hashToColor(peerId: string): string {
    let hash = 0;
    for (let i = 0; i < peerId.length; i++) {
        const char = peerId.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    const h = Math.abs(hash) % 360;
    const s = 65 + (Math.abs(hash >> 8) % 25);
    const l = 55 + (Math.abs(hash >> 16) % 25);
    return hslToHex(h, s, l);
}

function hslToHex(h: number, s: number, l: number): string {
    s /= 100;
    l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

export const ADMIN_CHAT_COLOR = '#eab308';
export const ADMIN_CHAT_LABEL = '👑 관리자';
