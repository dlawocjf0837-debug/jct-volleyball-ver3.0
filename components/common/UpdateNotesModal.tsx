import React, { useEffect } from 'react';

export interface ReleaseNoteItem {
    version: string;
    date: string;
    items: string[];
}

const DEFAULT_RELEASE_NOTES: ReleaseNoteItem[] = [
    {
        version: 'v3.6',
        date: '2026.02.23',
        items: [
            '⚖️ 더 정교해진 평가, 더 깔끔해진 수업! 선생님과 학생들의 피드백을 바탕으로, J-IVE가 실제 배구 수업 현장에 더욱 딱 맞게 최적화되었습니다.',
            '🏆 [개인별 스탯 랭킹] 메뉴 이름이 \'수행평가 랭킹\'에서 프로 스포츠 느낌의 \'개인별 스탯 랭킹\'으로 변경되었습니다.',
            '🏆 랭킹 점수 밸런스 완벽 패치: 서브 에이스·노력상 등 특정 플레이에 점수가 과도하게 쏠리는 현상을 막고, 실제 체육 수업 난이도에 맞게 산출 공식을 조정했습니다. (우수/노력 가중치 대폭 조정)',
            '✂️ [수업 모드 UI 다이어트] 세트별 보기, 연습/대회 필터, 복잡한 전략 메모 등 불필요한 기능을 숨겨 기록과 코칭에만 집중할 수 있도록 화면을 정리했습니다.',
            '🤫 수업 모드에서 라이브 채팅 기본 OFF. 수업 중 무분별한 채팅 방지용이며, 이벤트 경기 때만 선생님이 켜주세요!',
            '🛠️ 스포츠클럽(CLUB) 모드 전환 시 베타 테스트 안내 팝업이 표시됩니다. 다음 학기 정식 도입 전까지 기능 확인용으로 조심해서 다뤄주세요!',
            '🎨 팀 색상 중복 선택 시 번거로운 경고창 제거 → 선택 자유도 UP',
            '🎨 수업 모드 \'4팀제\' 필터 복구',
            '🎨 대회 전광판 모드 토글이 수업 모드에서도 정상 노출. 전광판 모드를 켜도 학생(아나운서) 화면의 응원 리액션 버튼(👏🔥🏐)은 유지됩니다.',
        ],
    },
    {
        version: 'v3.5',
        date: '2026.02.17',
        items: [
            '🏆 암호화된 대회용 전광판 및 라이브 방송국 시스템 도입',
            '📸 [초간편 접속] QR코드 확대/저장 지원 및 스캔 즉시 0.1초 만에 전광판 화면으로 자동 연결(매직 라우팅)',
            '🔒 [원격 제어] 관리자 암호로 철저히 통제되는 \'대회 전광판 모드\' 도입 (학생 폰 조작 및 BGM 원격 차단)',
            '📺 [방송국 기능] 대회 모드 전용 접속자 수(👀) 실시간 표시 및 하단 뉴스 자막(💬) 송출 기능 추가',
            '🔥 [라이브 응원] 대회 모드 전용 \'실시간 이모지(👏, 🔥, 🏐)\' 도입 (스팸/렉 방지를 위한 3초 쿨다운 적용)',
            '📱 [모바일 최적화] 스마트폰 전광판 모드 접속 시 화면(그래프, 명단) 겹침 현상 완벽 해결',
        ],
    },
    {
        version: 'v3.4',
        date: '2026.02.16',
        items: [
            '📡 4자리 PIN 기반 실시간 아나운서(전광판) 연동 시스템 도입',
            '🔗 복잡한 접속 코드 대신 직관적인 \'4자리 핀 번호\'와 \'QR 코드\' 연결 지원 (대소문자 구분 없음)',
            '⚡ WebRTC(PeerJS) 기술 적용으로 다른 와이파이/데이터 환경에서도 0.1초 만에 실시간 점수 동기화',
            '⏱️ 경기 중간에 아나운서 화면 접속 시 0:0으로 초기화되는 현상(동기화 지연) 완벽 해결',
        ],
    },
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
    useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="update-notes-title"
        >
            <div
                className="bg-slate-900 rounded-2xl border border-slate-600 shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto flex flex-col text-slate-100"
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
