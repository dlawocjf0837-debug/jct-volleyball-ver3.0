/**
 * 잠금 화면에서 백업 JSON 파일을 로드하여 localforage에 저장.
 * DataProvider 외부에서 호출되므로 localforage를 직접 사용.
 * 보안: 로드 후에도 로그인 상태로 전환하지 않음 - 사용자는 비밀번호 입력 필요.
 */
import localforage from 'localforage';

const SETTINGS_KEY = 'jct_volleyball_settings';

function getStorageKeys(appMode: 'CLASS' | 'CLUB') {
    const p = appMode === 'CLUB' ? 'club_' : 'class_';
    return {
        TEAM_SETS_KEY: p + 'jct_volleyball_team_sets',
        MATCH_HISTORY_KEY: p + 'jct_volleyball_match_history',
        USER_EMBLEMS_KEY: p + 'jct_volleyball_user_emblems',
        ACHIEVEMENTS_KEY: p + 'jct_volleyball_achievements',
        TOURNAMENTS_KEY: p + 'jct_volleyball_tournaments',
        LEAGUES_KEY: p + 'jct_volleyball_leagues',
        COACHING_LOGS_KEY: p + 'jct_volleyball_coaching_logs',
        BACKUP_KEY: p + 'jct_volleyball_backup_autosave',
        OPPONENT_TEAMS_KEY: p + 'jct_volleyball_opponent_teams',
        LEAGUE_STANDINGS_KEY: p + 'jct_volleyball_league_standings',
        LEAGUE_STANDINGS_LIST_KEY: p + 'jct_volleyball_league_standings_list',
        PRACTICE_MATCH_HISTORY_KEY: p + 'jct_volleyball_practice_match_history',
        LEAGUE_MATCH_HISTORY_KEY: p + 'jct_volleyball_league_match_history',
    };
}

export async function loadBackupFromFile(file: File): Promise<{ ok: boolean; error?: string }> {
    try {
        const text = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(String(e.target?.result ?? ''));
            reader.onerror = () => reject(new Error('파일 읽기 실패'));
            reader.readAsText(file);
        });
        const data = JSON.parse(text);
        const teamSets = data.teamSets ?? [];
        const matchHistory = data.matchHistory ?? [];
        const userEmblems = data.userEmblems ?? [];
        const tournaments = data.tournaments ?? [];
        const leagues = data.leagues ?? [];
        const coachingLogs = data.coachingLogs ?? {};
        const settings = data.settings ?? null;
        const opponentTeams = data.opponentTeams ?? null;
        const leagueStandingsList = data.leagueStandingsList ?? null;
        const practiceMatchHistory = data.practiceMatchHistory ?? [];
        const leagueMatchHistory = data.leagueMatchHistory ?? [];

        const hasTeamSets = Array.isArray(teamSets);
        const hasMatchHistory = Array.isArray(matchHistory);
        if (!hasTeamSets && !hasMatchHistory) {
            return { ok: false, error: '유효한 백업 형식이 아닙니다.' };
        }

        for (const mode of ['CLASS', 'CLUB'] as const) {
            const keys = getStorageKeys(mode);
            await Promise.all([
                localforage.setItem(keys.TEAM_SETS_KEY, teamSets),
                localforage.setItem(keys.MATCH_HISTORY_KEY, matchHistory),
                localforage.setItem(keys.USER_EMBLEMS_KEY, userEmblems),
                localforage.setItem(keys.TOURNAMENTS_KEY, tournaments),
                localforage.setItem(keys.LEAGUES_KEY, leagues),
                localforage.setItem(keys.COACHING_LOGS_KEY, coachingLogs),
                localforage.setItem(keys.OPPONENT_TEAMS_KEY, opponentTeams ?? []),
                localforage.setItem(keys.LEAGUE_STANDINGS_LIST_KEY, leagueStandingsList ?? { list: [], selectedId: null }),
                localforage.setItem(keys.PRACTICE_MATCH_HISTORY_KEY, practiceMatchHistory),
                localforage.setItem(keys.LEAGUE_MATCH_HISTORY_KEY, leagueMatchHistory),
                localforage.setItem(keys.BACKUP_KEY, { teamSets, matchHistory, userEmblems }),
            ]);
        }
        if (settings && typeof settings === 'object') {
            await localforage.setItem(SETTINGS_KEY, settings);
        }
        return { ok: true };
    } catch (e: any) {
        return { ok: false, error: e?.message ?? '파일 로드 실패' };
    }
}
