import React, { useState, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { MatchState, Player } from '../types';

interface AnalysisReportModalProps {
    // Fix: Update 'match' prop type to include optional 'time' property.
    match: (MatchState & { time?: number }) | null;
    onClose: () => void;
}

const AnalysisReportModal: React.FC<AnalysisReportModalProps> = ({ match, onClose }) => {
    const { generateAiResponse } = useData();
    const [isLoading, setIsLoading] = useState(true);
    const [report, setReport] = useState('');

    useEffect(() => {
        const generateReport = async () => {
            if (!match) {
                setReport('분석할 경기 데이터가 없습니다.');
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            try {
                const teamA = match.teamA;
                const teamB = match.teamB;

                const matchDataSummary = `
                - 경기 결과: ${teamA.name} ${teamA.score} vs ${teamB.name} ${teamB.score}
                - 승자: ${match.winner === 'A' ? teamA.name : teamB.name}
                - 경기 시간: ${Math.floor((match.time || 0) / 60)}분 ${(match.time || 0) % 60}초

                - ${teamA.name} 팀 스탯:
                  - 3단 플레이 성공: ${teamA.threeHitPlays}회
                  - 페어플레이 점수: ${teamA.fairPlay}점
                  - 서브 에이스: ${teamA.serviceAces}회, 서브 범실: ${teamA.serviceFaults}회
                  - 스파이크 성공: ${teamA.spikeSuccesses}회
                  - 블로킹 득점: ${teamA.blockingPoints}회

                - ${teamB.name} 팀 스탯:
                  - 3단 플레이 성공: ${teamB.threeHitPlays}회
                  - 페어플레이 점수: ${teamB.fairPlay}점
                  - 서브 에이스: ${teamB.serviceAces}회, 서브 범실: ${teamB.serviceFaults}회
                  - 스파이크 성공: ${teamB.spikeSuccesses}회
                  - 블로킹 득점: ${teamB.blockingPoints}회

                - 선수별 주요 기록 (${teamA.name}):
                  ${Object.values(teamA.players).map((p: Player) => {
                    const stats = teamA.playerStats[p.id];
                    if (!stats || stats.points === 0) return '';
                    return `  - ${p.originalName}: ${stats.points}득점 (서브 ${stats.serviceAces}, 스파이크 ${stats.spikeSuccesses}, 블로킹 ${stats.blockingPoints})`;
                  }).filter(Boolean).join('\n')}

                - 선수별 주요 기록 (${teamB.name}):
                  ${Object.values(teamB.players).map((p: Player) => {
                    const stats = teamB.playerStats[p.id];
                    if (!stats || stats.points === 0) return '';
                    return `  - ${p.originalName}: ${stats.points}득점 (서브 ${stats.serviceAces}, 스파이크 ${stats.spikeSuccesses}, 블로킹 ${stats.blockingPoints})`;
                  }).filter(Boolean).join('\n')}
                `;

                const prompt = `
당신은 통찰력 있는 유소년 배구 코치입니다. 아래 제공된 경기 데이터를 바탕으로, 선생님과 학생들이 이해하기 쉬운 상세 분석 리포트를 작성해주세요.

리포트는 다음 구조를 따라주세요:
1.  **한 줄 요약**: 경기의 핵심을 꿰뚫는 한 문장 요약.
2.  **경기 총평**: 경기 전반의 흐름과 양 팀의 경기력에 대한 종합적인 평가.
3.  **${teamA.name} 팀 분석**:
    *   **잘한 점 (Strength)**: 칭찬할 만한 플레이나 강점.
    *   **아쉬운 점 (Weakness)**: 개선이 필요한 부분.
    *   **핵심 선수**: 가장 인상적인 활약을 펼친 선수 1명과 그 이유.
4.  **${teamB.name} 팀 분석**:
    *   **잘한 점 (Strength)**: 칭찬할 만한 플레이나 강점.
    *   **아쉬운 점 (Weakness)**: 개선이 필요한 부분.
    *   **핵심 선수**: 가장 인상적인 활약을 펼친 선수 1명과 그 이유.
5.  **코칭 제언**: 양 팀이 다음 경기에서 더 성장하기 위한 구체적인 조언.

[경기 데이터]
${matchDataSummary}
`;
                const response = await generateAiResponse(prompt);
                setReport(response);
            } catch (error) {
                console.error("AI report generation failed:", error);
                setReport('리포트를 생성하는 중 오류가 발생했습니다. 다시 시도해주세요.');
            } finally {
                setIsLoading(false);
            }
        };

        generateReport();
    }, [match, generateAiResponse]);

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 animate-fade-in"
            onClick={onClose}
        >
            <div 
                className="bg-slate-900 rounded-lg shadow-2xl p-6 w-full max-w-2xl text-white border border-slate-700 max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h2 className="text-2xl font-bold text-[#00A3FF]">AI 경기 분석 리포트</h2>
                    <button onClick={onClose} className="text-2xl font-bold text-slate-500 hover:text-white">&times;</button>
                </div>
                <div className="flex-grow overflow-y-auto bg-slate-800/50 p-4 rounded-lg">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full">
                            <div className="w-12 h-12 border-4 border-dashed rounded-full animate-spin border-[#00A3FF]"></div>
                            <p className="mt-4 text-slate-300">AI가 경기를 심층 분석하고 있습니다...</p>
                        </div>
                    ) : (
                        <div className="text-slate-200 whitespace-pre-wrap leading-relaxed">{report}</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AnalysisReportModal;