import React from 'react';

export interface ReleaseNoteItem {
    version: string;
    date: string;
    items: string[];
}

const DEFAULT_RELEASE_NOTES: ReleaseNoteItem[] = [
    {
        version: 'v3.3',
        date: '2026.02.16',
        items: [
            '🕸️ 단일 팀 방사형(레이더) 그래프 조회 지원 및 팀 분석 표 수비/범실 지표 추가',
            '✏️ 팀 관리 화면 내 직관적인 이름 수정(연필 아이콘) 및 엠블럼 라벨 도입',
            '💡 실제 학교 현장 선생님들의 피드백을 반영한 사용성 향상',
        ],
    },
    {
        version: 'v3.2',
        date: '2026.02.14',
        items: [
            '🔐 관리자 전용 잠금 화면 추가 (인가된 교사만 접근 가능)',
            '🗑️ 학생 명단 내 개별 데이터 영구 삭제 기능 도입 (삭제 요구권 보장)',
            '🛡️ 교육청 개인정보 보호 가이드라인 준수 및 보안성 향상',
        ],
    },
    {
        version: 'v3.1',
        date: '2025.02.14',
        items: [
            '🏆 토너먼트 모드 MVP 및 랭킹 기능 추가',
            '🐛 기타 버그 수정 및 안정성 개선',
        ],
    },
    {
        version: 'v3.0',
        date: '2025.02.01',
        items: [
            '🏐 리그 모드 상세 분석 그래프 도입',
            '📊 선수별 세부 스탯 기록 기능 추가',
        ],
    },
];

interface UpdateNotesModalProps {
    isOpen: boolean;
    onClose: () => void;
    releaseNotes?: ReleaseNoteItem[];
}

const UpdateNotesModal: React.FC<UpdateNotesModalProps> = ({
    isOpen,
    onClose,
    releaseNotes = DEFAULT_RELEASE_NOTES,
}) => {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 animate-fade-in"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="update-notes-title"
        >
            <div
                className="bg-slate-900 rounded-2xl border border-slate-600 shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col text-slate-100"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-4 border-b border-slate-700">
                    <h2 id="update-notes-title" className="text-xl font-bold text-[#00A3FF]">
                        🎁 업데이트 노트
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white text-2xl leading-none"
                        aria-label="닫기"
                    >
                        ×
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {releaseNotes.map((note, index) => (
                        <div key={note.version} className="relative pl-6 border-l-2 border-sky-500/50">
                            <div className="absolute -left-2 top-0 w-3 h-3 rounded-full bg-sky-400" />
                            <div className="mb-2">
                                <span className="font-bold text-sky-300 text-sm">
                                    [{note.version} 업데이트]
                                </span>
                                <span className="ml-2 text-xs text-slate-500">{note.date}</span>
                            </div>
                            <ul className="space-y-1.5 text-sm text-slate-200">
                                {note.items.map((item, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                        <span className="flex-shrink-0">·</span>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <div className="p-4 border-t border-slate-700">
                    <a
                        href="https://luck-bike-94e.notion.site/J-IVE-Ver-3-0-2ee033dce3ee80c7b494e7530cd24c64"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full text-center py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm transition-colors"
                    >
                        👉 자세한 사용법(매뉴얼) 보기
                    </a>
                </div>
            </div>
        </div>
    );
};

export default UpdateNotesModal;
