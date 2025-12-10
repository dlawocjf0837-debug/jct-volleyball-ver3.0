// utils/dataService.ts

import localforage from 'localforage';

// localforage 설정
localforage.config({
    name: 'J-IVE Volleyball',
    storeName: 'jive_volleyball_store',
    description: 'J-IVE 배구 프로젝트 데이터 저장소'
});

export const STORAGE_KEYS = {
    TEAMS: 'jive_teams_v3',
    MATCH_HISTORY: 'jive_match_history_v3',
};

// 데이터 저장하기 (비동기)
export const saveData = async (key: string, data: any): Promise<void> => {
    try {
        await localforage.setItem(key, data);
    } catch (error) {
        console.error('Error saving data:', error);
        throw error;
    }
};

// 데이터 불러오기 (비동기)
export const loadData = async (key: string): Promise<any> => {
    try {
        const data = await localforage.getItem(key);
        return data;
    } catch (error) {
        console.error('Error loading data:', error);
        return null;
    }
};

// 데이터 삭제하기 (비동기)
export const removeData = async (key: string): Promise<void> => {
    try {
        await localforage.removeItem(key);
    } catch (error) {
        console.error('Error removing data:', error);
        throw error;
    }
};