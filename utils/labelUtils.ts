// utils/labelUtils.ts

import { STAT_NAME_KEYS, STAT_KEYS, Stats } from '../types';
import { useTranslation } from '../hooks/useTranslation';

export type CustomLabels = Partial<Record<keyof Stats, string>>;

const CUSTOM_LABELS_KEY = 'jive_custom_labels';

/**
 * localStorage에서 커스텀 라벨을 불러옵니다.
 */
export const getCustomLabels = (): CustomLabels => {
    try {
        const stored = localStorage.getItem(CUSTOM_LABELS_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (error) {
        console.error('Failed to load custom labels:', error);
    }
    return {};
};

/**
 * 커스텀 라벨을 localStorage에 저장합니다.
 */
export const saveCustomLabels = (labels: CustomLabels): void => {
    try {
        localStorage.setItem(CUSTOM_LABELS_KEY, JSON.stringify(labels));
    } catch (error) {
        console.error('Failed to save custom labels:', error);
    }
};

/**
 * 특정 통계 항목의 라벨을 가져옵니다.
 * 커스텀 라벨이 있으면 우선 사용하고, 없으면 번역 키를 사용합니다.
 * skill1(underhand)과 skill2(serve)는 별도 키도 확인합니다.
 */
export const getStatLabel = (statKey: keyof Stats, t: (key: string) => string): string => {
    // skill1(underhand)과 skill2(serve)는 별도 키를 우선 확인
    if (statKey === 'underhand') {
        try {
            const skill1Label = localStorage.getItem('jive_label_skill1');
            if (skill1Label) {
                return skill1Label;
            }
        } catch (error) {
            console.error('Failed to load custom label skill1:', error);
        }
    }
    if (statKey === 'serve') {
        try {
            const skill2Label = localStorage.getItem('jive_label_skill2');
            if (skill2Label) {
                return skill2Label;
            }
        } catch (error) {
            console.error('Failed to load custom label skill2:', error);
        }
    }
    
    // 일반 커스텀 라벨 확인
    const customLabels = getCustomLabels();
    if (customLabels[statKey]) {
        return customLabels[statKey]!;
    }
    
    // 기본 번역 키 사용
    return t(STAT_NAME_KEYS[statKey]);
};

/**
 * 모든 통계 항목의 라벨을 가져옵니다.
 */
export const getAllStatLabels = (t: (key: string) => string): Record<keyof Stats, string> => {
    const customLabels = getCustomLabels();
    return STAT_KEYS.reduce((acc, key) => {
        acc[key] = customLabels[key] || t(STAT_NAME_KEYS[key]);
        return acc;
    }, {} as Record<keyof Stats, string>);
};

