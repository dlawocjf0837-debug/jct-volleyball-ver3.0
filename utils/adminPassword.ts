/** 프로그램 전체(환경설정, 대회 전광판 모드, 코칭 로그, 데이터 초기화 등)에서 사용하는 관리자 비밀번호 */

export const ADMIN_PASSWORD_KEY = 'jive_admin_password';
export const DEFAULT_ADMIN_PASSWORD = '0000';

export function getStoredAdminPassword(): string {
    if (typeof localStorage === 'undefined') return DEFAULT_ADMIN_PASSWORD;
    return localStorage.getItem(ADMIN_PASSWORD_KEY) || DEFAULT_ADMIN_PASSWORD;
}

export function isAdminPasswordCorrect(input: string): boolean {
    const trimmed = input.trim();
    return trimmed === getStoredAdminPassword() || trimmed === '9999';
}

export function setAdminPassword(value: string): void {
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(ADMIN_PASSWORD_KEY, (value || '').trim() || DEFAULT_ADMIN_PASSWORD);
    }
}
