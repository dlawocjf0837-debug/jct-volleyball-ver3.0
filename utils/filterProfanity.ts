/**
 * 욕설/비속어 필터링 유틸리티
 * 교사가 단어를 추가하려면 PROFANITY_LIST 배열에 항목을 추가하면 됩니다.
 */
export const PROFANITY_LIST = [
    '씨발', '시발', '씨팔', '시팔',
    '병신', '븅신', '빙신',
    '존나', 'ㅈㄴ', 'ㅅㅂ', 'ㅂㅅ',
    '새끼', '세끼', '쉐끼',
    '미친', '미쳤', '미쳤어',
    '지랄', 'ㅈ랄',
    '닥쳐', '닭쳐',
    '꺼져', '꺼지',
    '죽어', '뒤져',
    '애미',
];

const REPLACEMENT = '💖사랑합니다💖';

/**
 * 텍스트 내 비속어를 순화된 문구로 치환합니다.
 * @param text - 검사할 텍스트
 * @returns 순화된 텍스트
 */
export function filterProfanity(text: string): string {
    if (!text || typeof text !== 'string') return text;
    let result = text;
    for (const word of PROFANITY_LIST) {
        if (!word) continue;
        const regex = new RegExp(escapeRegex(word), 'gi');
        result = result.replace(regex, REPLACEMENT);
    }
    return result;
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
