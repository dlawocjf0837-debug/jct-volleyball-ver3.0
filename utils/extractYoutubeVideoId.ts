/** YouTube URL 또는 ID 문자열에서 11자리 Video ID 추출 */
export function extractYoutubeVideoId(input: string): string {
    const raw = (input ?? '').trim();
    if (!raw) return '';

    const patterns: RegExp[] = [
        /(?:youtube\.com\/watch\?(?:.*&)?v=|youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/i,
        /youtu\.be\/([a-zA-Z0-9_-]{11})/i,
        /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/i,
        /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/i,
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/i,
        /^([a-zA-Z0-9_-]{11})$/i,
    ];

    for (const re of patterns) {
        const m = raw.match(re);
        if (m?.[1]) return m[1];
    }

    return '';
}

export function buildYoutubeEmbedUrl(videoId: string): string {
    const id = extractYoutubeVideoId(videoId);
    if (!id) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const params = new URLSearchParams({
        autoplay: '1',
        mute: '1',
        controls: '0',
        modestbranding: '1',
        rel: '0',
        playsinline: '1',
        loop: '1',
        playlist: id,
        enablejsapi: '1',
    });
    if (origin) params.set('origin', origin);
    return `https://www.youtube.com/embed/${id}?${params.toString()}`;
}
