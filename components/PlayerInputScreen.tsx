import React, { useState, useCallback } from 'react';
import { Player, Stats, STAT_KEYS } from '../types';

interface PlayerInputScreenProps {
    onStart: (players: Omit<Player, 'id' | 'anonymousName' | 'isCaptain' | 'totalScore'>[], selectedClass: string) => void;
}

const defaultCsv = `번호,이름,성별,키,셔틀런,유연성,50m달리기,언더핸드,서브
30101,김민지,여,165,45,15,8.5,8,7
30102,박서준,남,175,60,12,7.8,9,8
30103,이하은,여,160,40,20,8.9,7,6
30201,이서연,여,162,42,18,8.7,7,7
30202,최지우,여,168,50,14,8.2,8,8
30203,김도윤,남,178,65,10,7.5,9,9
30301,정수빈,여,170,55,16,8.1,8,8
`;

const FIXED_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1Da0Cx6JyS5olJgcj6AOdVowN9rUB3tz19v9GCo2paS0/edit?usp=sharing';

const PlayerInputScreen: React.FC<PlayerInputScreenProps> = ({ onStart }) => {
    const [csvData, setCsvData] = useState(defaultCsv);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [statusMessage, setStatusMessage] = useState('위 버튼을 눌러 고정된 주소에서 데이터를 불러오세요.');
    const [selectedClass, setSelectedClass] = useState<string>('all');


    const handleFetchDataFromUrl = async () => {
        const match = FIXED_SHEET_URL.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (!match || !match[1]) {
            setStatusMessage('❌ 고정된 구글 시트 URL 형식이 올바르지 않습니다.');
            return;
        }
        const spreadsheetId = match[1];

        setIsLoadingData(true);
        setStatusMessage(`시트 데이터를 불러오는 중...`);

        try {
            const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
            const response = await fetch(exportUrl);
            if (!response.ok) {
                throw new Error(`데이터를 가져올 수 없습니다 (HTTP ${response.status}). 시트가 '링크가 있는 모든 사용자에게 공개'로 설정되었는지 확인하세요.`);
            }
            const rawCsvText = await response.text();
            
            const cleanedCsv = rawCsvText.split('\n').map(line => 
                line.split(',').map(cell => 
                    cell.trim().replace(/^"|"$/g, '')
                ).join(',')
            ).join('\n');
            
            setCsvData(cleanedCsv);
            setStatusMessage(`✅ 시트 데이터를 성공적으로 불러왔습니다. (첫 번째 시트)`);

        } catch (error: any) {
            console.error("Error fetching sheet data:", error);
            setStatusMessage(`❌ 오류: ${error.message}`);
        } finally {
            setIsLoadingData(false);
        }
    };


    const handleParseAndStart = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        
        const lines = csvData.trim().split('\n').map(line => line.trim()).filter(Boolean);
        if (lines.length < 2) {
            alert('헤더를 포함하여 최소 한 명 이상의 학생 데이터가 필요합니다.');
            return;
        }

        const headers = lines[0].split(',').map(h => h.trim());
        const expectedHeaders = ['번호', '이름', '성별', '키', '셔틀런', '유연성', '50m달리기', '언더핸드', '서브'];
        
        if(JSON.stringify(headers) !== JSON.stringify(expectedHeaders)){
            alert(`헤더가 일치하지 않습니다. 다음 순서로 입력해주세요: ${expectedHeaders.join(',')}`);
            return;
        }
        
        let players: Omit<Player, 'id' | 'anonymousName' | 'isCaptain' | 'totalScore'>[] = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            if (values.length !== headers.length) {
                alert(`데이터 오류: ${i + 1}번째 줄의 데이터 개수가 헤더와 일치하지 않습니다. (${values.length}/${headers.length})`);
                return;
            }

            if (values.some(v => v === '')) {
                alert(`데이터 오류: ${i + 1}번째 줄에 빈 데이터가 있습니다. 모든 칸을 채워주세요.`);
                return;
            }
            
            const studentId = values[0];
            if (studentId.length !== 5 || isNaN(parseInt(studentId, 10))) {
                alert(`데이터 오류: ${i + 1}번째 줄의 '번호'(${studentId}) 형식이 올바르지 않습니다. '30101'과 같은 5자리 숫자 형식이어야 합니다.`);
                return;
            }
            const studentClass = parseInt(studentId.substring(1, 3), 10).toString();
            const studentNumber = parseInt(studentId.substring(3, 5), 10).toString();

            const stats: Partial<Stats> = {};
            const statHeaders = headers.slice(3);
            for (const [index, key] of STAT_KEYS.entries()) {
                const statValue = parseFloat(values[index + 3]);
                if(isNaN(statValue)) {
                    alert(`데이터 오류: ${i + 1}번째 줄, '${statHeaders[index]}' 값이 숫자가 아닙니다. (입력값: "${values[index + 3]}")`);
                    return;
                }
                stats[key] = statValue;
            }

            players.push({
                originalName: values[1],
                gender: values[2],
                class: studentClass,
                studentNumber: studentNumber,
                stats: stats as Stats,
            });
        }
        
        const filteredPlayers = selectedClass === 'all'
            ? players
            : players.filter(p => p.class === selectedClass);

        if (filteredPlayers.length > 0) {
            onStart(filteredPlayers, selectedClass);
        } else {
            alert('선택한 반에 유효한 학생 데이터가 없습니다. CSV 데이터를 확인하거나 다른 반을 선택해주세요.');
        }

    }, [csvData, onStart, selectedClass]);


    return (
        <div className="max-w-4xl mx-auto bg-slate-900/50 backdrop-blur-sm border border-slate-700 p-6 rounded-lg shadow-2xl space-y-6">
            <div className="p-4 bg-slate-800/50 rounded-lg text-center border border-slate-700 mb-6">
                <h2 className="text-xl font-bold text-sky-400 mb-2">팀 구성 도우미</h2>
                <p className="text-slate-300">
                    학생들의 데이터를 기반으로 AI가 능력치를 분석하여 공정하고 균형 잡힌 배구팀을 구성할 수 있도록 돕습니다.
                </p>
                <p className="text-slate-400 mt-2 text-sm">
                    아래 단계에 따라 데이터를 입력하고 팀 빌딩을 시작하세요.
                </p>
            </div>
            <div className="space-y-4">
                <h2 className="block font-bold text-slate-300">
                    1. 구글 시트 데이터 불러오기
                </h2>
                <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                     <div className="flex flex-col sm:flex-row gap-2 items-center bg-slate-900 p-2 rounded-md">
                        <span className="text-sm text-slate-300 truncate font-mono flex-grow text-center sm:text-left">
                            {FIXED_SHEET_URL}
                        </span>
                        <button
                            onClick={handleFetchDataFromUrl}
                            disabled={isLoadingData}
                            className="w-full sm:w-auto flex-shrink-0 bg-[#00A3FF] hover:bg-[#0082cc] text-white font-bold py-2 px-4 rounded-lg transition duration-200 disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed"
                        >
                            {isLoadingData ? '불러오는 중...' : '데이터 불러오기'}
                        </button>
                    </div>
                </div>
                 <p className="text-xs text-slate-500 mt-1">
                    * 시트는 '링크가 있는 모든 사용자에게 공개'로 설정되어 있어야 합니다. 첫 번째 시트의 데이터를 가져옵니다.
                 </p>
                 <p className="text-sm text-slate-400 mt-2 h-5">
                    {statusMessage}
                 </p>
            </div>
            
            <form onSubmit={handleParseAndStart}>
                 <label htmlFor="csv-input" className="block mb-2 font-bold text-slate-300">
                    2. 데이터 확인 및 팀 구성 시작
                </label>
                <textarea
                    id="csv-input"
                    value={csvData}
                    onChange={(e) => setCsvData(e.target.value)}
                    className="w-full h-48 bg-slate-900 border border-slate-700 rounded-md p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#00A3FF]"
                    placeholder={`구글 시트에서 불러오거나, 아래 형식으로 직접 붙여넣으세요:\n${defaultCsv}`}
                    aria-label="Student data in CSV format"
                />
                 <div className="flex justify-between items-center mt-4">
                    <div>
                        <label htmlFor="class-select" className="mr-2 font-semibold text-slate-300">반 선택:</label>
                        <select 
                            id="class-select"
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                            className="bg-slate-800 border border-slate-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-[#00A3FF]"
                        >
                            <option value="all">전체</option>
                            <option value="1">1반</option>
                            <option value="2">2반</option>
                            <option value="3">3반</option>
                            <option value="4">4반</option>
                            <option value="5">5반</option>
                        </select>
                    </div>
                    <button type="submit" className="bg-[#00A3FF] hover:bg-[#0082cc] text-white font-bold py-3 px-8 rounded-lg transition duration-200 text-lg">
                        팀 구성 시작
                    </button>
                </div>
            </form>
        </div>
    );
};

export default PlayerInputScreen;