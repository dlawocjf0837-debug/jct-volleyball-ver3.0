export interface SkillDrillVideo {
    id: string;
    titleKey: string;
    descriptionKey: string;
    youtubeUrl: string;
    transcriptKey: string;
}

export interface SkillDrillCategory {
    nameKey: string;
    videos: SkillDrillVideo[];
}

export const SKILL_DRILL_DATA: SkillDrillCategory[] = [
    {
        nameKey: 'skill_drill_category_rules',
        videos: [
            {
                id: 'rule_1',
                titleKey: 'skill_drill_rule_1_title',
                descriptionKey: 'skill_drill_rule_1_desc',
                youtubeUrl: 'https://youtu.be/lhF8sdYtTT0?si=8Yx0V5zBPjHqQkAN&t=15',
                transcriptKey: 'skill_drill_rule_1_transcript'
            },
            {
                id: 'rule_2',
                titleKey: 'skill_drill_rule_2_title',
                descriptionKey: 'skill_drill_rule_2_desc',
                youtubeUrl: 'https://youtu.be/iPT14hLV2Xw?si=_HV_mXPinPowU7pY&t=15',
                transcriptKey: 'skill_drill_rule_2_transcript'
            },
        ]
    },
    {
        nameKey: 'skill_drill_category_receive',
        videos: [
            {
                id: 'receive_1',
                titleKey: 'skill_drill_receive_1_title',
                descriptionKey: 'skill_drill_receive_1_desc',
                youtubeUrl: 'https://youtu.be/yK_Wdk1uR5M?si=N7WhjERPZw5sY34I&t=33',
                transcriptKey: 'skill_drill_receive_1_transcript'
            }
        ]
    },
    {
        nameKey: 'skill_drill_category_toss',
        videos: [
            {
                id: 'toss_1',
                titleKey: 'skill_drill_toss_1_title',
                descriptionKey: 'skill_drill_toss_1_desc',
                youtubeUrl: 'https://youtu.be/H-hnrdpvjXA?si=6BgYtQNCkM3gvAZo&t=20',
                transcriptKey: 'skill_drill_toss_1_transcript'
            }
        ]
    },
    {
        nameKey: 'skill_drill_category_underserve',
        videos: [
            {
                id: 'serve_1',
                titleKey: 'skill_drill_underserve_1_title',
                descriptionKey: 'skill_drill_underserve_1_desc',
                youtubeUrl: 'https://youtu.be/2q-JiL3i2Dk?si=iqjgQu_sCSJ_ZnPC&t=52',
                transcriptKey: 'skill_drill_underserve_1_transcript'
            }
        ]
    },
    {
        nameKey: 'skill_drill_category_overserve',
        videos: [
            {
                id: 'serve_2',
                titleKey: 'skill_drill_overserve_1_title',
                descriptionKey: 'skill_drill_overserve_1_desc',
                youtubeUrl: 'https://youtu.be/LZSXwT7RJas?si=1JiH106YVikWH84o&t=35',
                transcriptKey: 'skill_drill_overserve_1_transcript'
            }
        ]
    },
    {
        nameKey: 'skill_drill_category_spike',
        videos: [
            {
                id: 'spike_1',
                titleKey: 'skill_drill_spike_1_title',
                descriptionKey: 'skill_drill_spike_1_desc',
                youtubeUrl: 'https://youtu.be/ouOwPy32HGQ?si=8A4KBxOHI53yn3qg&t=12',
                transcriptKey: 'skill_drill_spike_1_transcript'
            }
        ]
    }
];