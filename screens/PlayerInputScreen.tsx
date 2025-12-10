
import React, { useState, useCallback, useEffect } from 'react';
import { Player, Stats, STAT_KEYS } from '../types';
import { useTranslation } from '../hooks/useTranslation';
import { useData } from '../contexts/DataContext';
import { saveCustomLabels, CustomLabels } from '../utils/labelUtils';

interface PlayerInputScreenProps {
    onStart: (players: Omit<Player, 'id' | 'anonymousName' | 'isCaptain' | 'totalScore'>[], selectedClass: string) => void;
}

const defaultCsv = `번호,이름,성별,키,심폐지구력,유연성,순발력,언더핸드,서브
30101,김민지,여,165,45,15,8.5,8,7
30102,박서준,남,175,60,12,7.8,9,8
30103,이하은,여,160,40,20,8.9,7,6
30201,이서연,여,162,42,18,8.7,7,7
30202,최지우,여,168,50,14,8.2,8,8
30203,김도윤,남,178,65,10,7.5,9,9
30301,정수빈,여,170,55,16,8.1,8,8
`;

const PlayerInputScreen: React.FC<PlayerInputScreenProps> = ({ onStart }) => {
    const { t } = useTranslation();
    const { settings } = useData();
    const [csvData, setCsvData] = useState(defaultCsv);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [statusMessage, setStatusMessage] = useState(t('player_input_initial_status'));
    const [selectedClass, setSelectedClass] = useState<string>('all');
    const [sheetUrl, setSheetUrl] = useState(settings.googleSheetUrl || '');

    const [phase, setPhase] = useState<'input' | 'exclude'>('input');
    const [allPlayers, setAllPlayers] = useState<Omit<Player, 'id' | 'anonymousName' | 'isCaptain' | 'totalScore'>[]>([]);
    const [excludedPlayerNames, setExcludedPlayerNames] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (settings.googleSheetUrl) {
            setSheetUrl(settings.googleSheetUrl);
        }
    }, [settings.googleSheetUrl]);

    const handleFetchDataFromUrl = async () => {
        const urlToUse = sheetUrl.trim();
        if (!urlToUse) {
            setStatusMessage(`❌ ${t('status_invalid_sheet_url')}`);
            return;
        }

        const match = urlToUse.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (!match || !match[1]) {
            setStatusMessage(`❌ ${t('status_invalid_sheet_url')}`);
            return;
        }
        const spreadsheetId = match[1];

        setIsLoadingData(true);
        setStatusMessage(t('status_fetching_sheet_data'));

        try {
            const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
            const response = await fetch(exportUrl);
            if (!response.ok) {
                throw new Error(t('status_fetch_error', { status: response.status }));
            }
            const rawCsvText = await response.text();
            
            const cleanedCsv = rawCsvText.split('\n').map(line => 
                line.split(',').map(cell => 
                    cell.trim().replace(/^"|"$/g, '')
                ).join(',')
            ).join('\n');
            
            setCsvData(cleanedCsv);
            setStatusMessage(`✅ ${t('status_fetch_success')}`);

        } catch (error: any) {
            console.error("Error fetching sheet data:", error);
            setStatusMessage(`❌ ${t('status_error', { message: error.message })}`);
        } finally {
            setIsLoadingData(false);
        }
    };


    // 헤더 매핑: 키워드로 헤더 찾기
    const findHeaderIndex = (headers: string[], keywords: string[]): number => {
        for (let i = 0; i < headers.length; i++) {
            const headerLower = headers[i].toLowerCase();
            if (keywords.some(keyword => headerLower.includes(keyword.toLowerCase()))) {
                return i;
            }
        }
        return -1;
    };

    const handleParseAndProceed = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        
        const lines = csvData.trim().split('\n').map(line => line.trim()).filter(Boolean);
        if (lines.length < 2) {
            alert(t('alert_min_one_player'));
            return;
        }

        const headers = lines[0].split(',').map(h => h.trim());
        
        // Fuzzy Matching으로 헤더 인덱스 찾기
        const headerMapping: Record<string, number> = {
            '번호': findHeaderIndex(headers, ['번호', '학번', 'id']),
            '이름': findHeaderIndex(headers, ['이름', '성명', 'name']),
            '성별': findHeaderIndex(headers, ['성별', 'gender']),
            '키': findHeaderIndex(headers, ['키', '신장', 'height']),
            '셔틀런': findHeaderIndex(headers, ['셔틀런', '심폐', '지구력', '심폐지구력', '오래달리기', '왕복', 'shuttle']),
            '유연성': findHeaderIndex(headers, ['유연성', '좌전굴', '스트레칭', 'flexibility']),
            '50m달리기': findHeaderIndex(headers, ['50m', '달리기', '순발력', '100m', 'dash']),
            '언더핸드': findHeaderIndex(headers, ['언더', '리시브', '패스', 'underhand']),
            '서브': findHeaderIndex(headers, ['서브', '공격', '스파이크', 'serve']),
        };

        // 필수 헤더 확인 (번호, 이름, 성별)
        if (headerMapping['번호'] === -1 || headerMapping['이름'] === -1 || headerMapping['성별'] === -1) {
            alert('필수 헤더(번호, 이름, 성별)를 찾을 수 없습니다.');
            return;
        }

        // 통계 헤더는 선택 사항 - 누락되어도 오류 없이 진행
        const statHeaderKeys = ['키', '셔틀런', '유연성', '50m달리기', '언더핸드', '서브']; // 내부 키는 유지, 표시명만 변경
        
        // 순서 기반 Fallback: 키워드 매칭이 실패한 경우 순서로 강제 할당
        // 마지막에서 두 번째 컬럼 → skill1 (underhand)
        // 맨 마지막 컬럼 → skill2 (serve)
        const totalHeaders = headers.length;
        const expectedStatStartIndex = 3; // 번호(0), 이름(1), 성별(2) 다음부터 통계 데이터
        
        // 커스텀 라벨 추출 및 저장 (초기화)
        const customLabels: CustomLabels = {};
        
        // 언더핸드(skill1)가 매칭되지 않았고, 마지막에서 두 번째 컬럼이 있으면 강제 할당
        if (headerMapping['언더핸드'] === -1 && totalHeaders >= expectedStatStartIndex + STAT_KEYS.length - 1) {
            const fallbackIndex = totalHeaders - 2; // 마지막에서 두 번째
            if (fallbackIndex >= expectedStatStartIndex && fallbackIndex < totalHeaders) {
                headerMapping['언더핸드'] = fallbackIndex;
                // fallback으로 할당된 경우에도 헤더 이름을 커스텀 라벨로 저장
                if (headers[fallbackIndex]) {
                    customLabels['underhand'] = headers[fallbackIndex];
                }
            }
        }
        
        // 서브(skill2)가 매칭되지 않았고, 맨 마지막 컬럼이 있으면 강제 할당
        if (headerMapping['서브'] === -1 && totalHeaders >= expectedStatStartIndex + STAT_KEYS.length) {
            const fallbackIndex = totalHeaders - 1; // 맨 마지막
            if (fallbackIndex >= expectedStatStartIndex && fallbackIndex < totalHeaders) {
                headerMapping['서브'] = fallbackIndex;
                // fallback으로 할당된 경우에도 헤더 이름을 커스텀 라벨로 저장
                if (headers[fallbackIndex]) {
                    customLabels['serve'] = headers[fallbackIndex];
                }
            }
        }
        
        // 모든 통계 항목의 헤더 이름을 커스텀 라벨로 저장
        STAT_KEYS.forEach((key, index) => {
            const headerKey = statHeaderKeys[index];
            const headerIndex = headerMapping[headerKey];
            if (headerIndex !== -1 && headerIndex < headers.length) {
                // 실제 헤더 텍스트를 커스텀 라벨로 저장 (이미 fallback으로 저장된 경우 덮어쓰지 않음)
                if (!customLabels[key] && headers[headerIndex]) {
                    customLabels[key] = headers[headerIndex];
                }
            }
        });
        saveCustomLabels(customLabels);
        
        // 헤더에서 라벨 추출 (데이터 객체에 직접 포함하기 위해)
        const skill1Label = (headerMapping['언더핸드'] !== -1 && headers[headerMapping['언더핸드']]) 
            ? headers[headerMapping['언더핸드']] 
            : "언더핸드";
        const skill2Label = (headerMapping['서브'] !== -1 && headers[headerMapping['서브']]) 
            ? headers[headerMapping['서브']] 
            : "서브";
        
        let players: Omit<Player, 'id' | 'anonymousName' | 'isCaptain' | 'totalScore'>[] = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            if (values.length !== headers.length) {
                alert(t('alert_data_mismatch', { line: i + 1, values: values.length, headers: headers.length }));
                return;
            }
            
            const studentId = values[headerMapping['번호']];
            if (!studentId || studentId.length !== 5 || isNaN(parseInt(studentId, 10))) {
                alert(t('alert_invalid_student_id', { line: i + 1, studentId: studentId || '' }));
                return;
            }
            const studentClass = parseInt(studentId.substring(1, 3), 10).toString();
            const studentNumber = parseInt(studentId.substring(3, 5), 10).toString();

            const stats: Partial<Stats> = {};
            for (const [index, key] of STAT_KEYS.entries()) {
                const headerKey = statHeaderKeys[index];
                const headerIndex = headerMapping[headerKey];
                
                // 헤더가 없으면 0으로 설정 (선택 사항)
                if (headerIndex === -1) {
                    stats[key] = 0;
                    continue;
                }
                
                const valueStr = values[headerIndex];
                
                // 빈 데이터 처리: null, undefined, 빈칸은 0으로 설정 (점수 계산 단계에서 0점 처리)
                if (!valueStr || valueStr.trim() === '' || valueStr.toLowerCase() === 'null' || valueStr.toLowerCase() === 'undefined') {
                    stats[key] = 0; // 빈 데이터는 0으로 설정 (점수 계산에서 0점 처리)
                    continue;
                }
                
                const statValue = parseFloat(valueStr);
                if(isNaN(statValue)) {
                    alert(t('alert_stat_not_a_number', { line: i + 1, header: headerKey, value: valueStr }));
                    return;
                }
                stats[key] = statValue;
            }

            players.push({
                originalName: values[headerMapping['이름']],
                gender: values[headerMapping['성별']],
                class: studentClass,
                studentNumber: studentNumber,
                stats: stats as Stats,
                // [핵심] 라벨을 데이터에 직접 심어버림 (데이터 문신)
                customLabel1: skill1Label,
                customLabel2: skill2Label,
            });
        }
        
        setAllPlayers(players);
        setPhase('exclude');
    }, [csvData, t]);

    const handleToggleExclude = (playerName: string) => {
        setExcludedPlayerNames(prev => {
            const newSet = new Set(prev);
            if (newSet.has(playerName)) {
                newSet.delete(playerName);
            } else {
                newSet.add(playerName);
            }
            return newSet;
        });
    };

    const handleConfirmExclusionAndStart = () => {
        const participatingPlayers = allPlayers.filter(p => !excludedPlayerNames.has(p.originalName));
        
        const filteredPlayers = selectedClass === 'all'
            ? participatingPlayers
            : participatingPlayers.filter(p => p.class === selectedClass);
        
        if (filteredPlayers.length > 0) {
            onStart(filteredPlayers, selectedClass);
        } else {
            alert(t('alert_no_valid_players_in_class'));
        }
    };
    
    if (phase === 'input') {
        return (
            <div className="max-w-4xl mx-auto bg-slate-900/50 backdrop-blur-sm border border-slate-700 p-4 sm:p-6 rounded-lg shadow-2xl space-y-4 sm:space-y-6 animate-fade-in px-4">
                <div className="p-3 sm:p-4 bg-slate-800/50 rounded-lg text-center border border-slate-700 mb-4 sm:mb-6">
                    <h2 className="text-lg sm:text-xl font-bold text-sky-400 mb-2">{t('player_input_helper_title')}</h2>
                    <p className="text-sm sm:text-base text-slate-300">
                        {t('player_input_helper_desc1')}
                    </p>
                    <p className="text-slate-400 mt-2 text-xs sm:text-sm">
                        {t('player_input_helper_desc2')}
                    </p>
                </div>
                <div className="space-y-3 sm:space-y-4">
                    <h2 className="block font-bold text-sm sm:text-base text-slate-300">
                        {t('player_input_step1_title')}
                    </h2>
                    <div className="bg-slate-800 p-3 sm:p-4 rounded-lg border border-slate-700">
                         <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center bg-slate-900 p-2 rounded-md">
                            <input
                                type="text"
                                value={sheetUrl}
                                onChange={(e) => setSheetUrl(e.target.value)}
                                placeholder={t('settings_google_sheet_url_placeholder')}
                                className="flex-grow bg-slate-800 border border-slate-600 rounded-md p-2 sm:p-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00A3FF] min-h-[44px]"
                            />
                            <button
                                onClick={handleFetchDataFromUrl}
                                disabled={isLoadingData}
                                className="w-full sm:w-auto flex-shrink-0 bg-[#00A3FF] hover:bg-[#0082cc] text-white font-bold py-2 px-3 sm:px-4 rounded-lg transition duration-200 disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed min-h-[44px] text-sm sm:text-base"
                            >
                                {isLoadingData ? t('player_input_loading_button') : t('player_input_fetch_button')}
                            </button>
                        </div>
                    </div>
                     <p className="text-xs text-slate-500 mt-1">
                        {t('player_input_sheet_note')}
                     </p>
                     <p className="text-xs sm:text-sm text-slate-400 mt-2 h-5">
                        {statusMessage}
                     </p>
                </div>
                
                <form onSubmit={handleParseAndProceed}>
                     <label htmlFor="csv-input" className="block mb-2 font-bold text-sm sm:text-base text-slate-300">
                        {t('player_input_step2_title')}
                    </label>
                    <textarea
                        id="csv-input"
                        value={csvData}
                        onChange={(e) => setCsvData(e.target.value)}
                        className="w-full h-40 sm:h-48 bg-slate-900 border border-slate-700 rounded-md p-2 sm:p-3 font-mono text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#00A3FF]"
                        placeholder={t('player_input_csv_placeholder', { defaultCsv: defaultCsv })}
                        aria-label="Student data in CSV format"
                    />
                     <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 sm:gap-0 mt-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                            <label htmlFor="class-select" className="font-semibold text-sm sm:text-base text-slate-300 whitespace-nowrap">{t('player_input_class_select_label')}</label>
                            <select 
                                id="class-select"
                                value={selectedClass}
                                onChange={(e) => setSelectedClass(e.target.value)}
                                className="w-full sm:w-auto bg-slate-800 border border-slate-600 rounded-md py-2 px-3 text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-[#00A3FF] min-h-[44px]"
                            >
                                <option value="all">{t('player_input_class_all')}</option>
                                <option value="1">{t('class_format', { class: '1' })}</option>
                                <option value="2">{t('class_format', { class: '2' })}</option>
                                <option value="3">{t('class_format', { class: '3' })}</option>
                                <option value="4">{t('class_format', { class: '4' })}</option>
                                <option value="5">{t('class_format', { class: '5' })}</option>
                            </select>
                        </div>
                        <button type="submit" className="w-full sm:w-auto bg-[#00A3FF] hover:bg-[#0082cc] text-white font-bold py-3 px-6 sm:px-8 rounded-lg transition duration-200 text-base sm:text-lg min-h-[44px]">
                            {t('player_input_start_button')}
                        </button>
                    </div>
                </form>
            </div>
        );
    }
    
    return (
        <div className="max-w-4xl mx-auto bg-slate-900/50 backdrop-blur-sm border border-slate-700 p-4 sm:p-6 rounded-lg shadow-2xl space-y-4 sm:space-y-6 animate-fade-in px-4">
            <div className="p-3 sm:p-4 bg-slate-800/50 rounded-lg text-center border border-slate-700 mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-bold text-sky-400 mb-2">{t('exclude_absent_title')}</h2>
                <p className="text-sm sm:text-base text-slate-300">{t('exclude_absent_desc')}</p>
            </div>
            <div className="max-h-96 overflow-y-auto space-y-2 pr-2">
                {allPlayers.map((player) => (
                    <label key={player.originalName} className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg transition-colors cursor-pointer min-h-[44px] ${excludedPlayerNames.has(player.originalName) ? 'bg-red-900/50 hover:bg-red-800/50' : 'bg-slate-800 hover:bg-slate-700'}`}>
                        <input
                            type="checkbox"
                            checked={excludedPlayerNames.has(player.originalName)}
                            onChange={() => handleToggleExclude(player.originalName)}
                            className="h-5 w-5 bg-slate-700 border-slate-500 rounded text-red-500 focus:ring-red-500 flex-shrink-0"
                        />
                        <span className="font-semibold text-sm sm:text-base text-slate-200 flex-1">{player.originalName}</span>
                        <span className="text-xs text-slate-400 ml-auto whitespace-nowrap">{player.class}{t('player_records_class_suffix')} {player.studentNumber}{t('achievements_student_number_suffix')}</span>
                    </label>
                ))}
            </div>
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 sm:gap-0 mt-4">
                <button onClick={() => setPhase('input')} className="w-full sm:w-auto bg-slate-600 hover:bg-slate-500 text-white font-bold py-3 px-6 sm:px-8 rounded-lg transition duration-200 text-base sm:text-lg min-h-[44px]">
                    {t('back')}
                </button>
                <button onClick={handleConfirmExclusionAndStart} className="w-full sm:w-auto bg-[#00A3FF] hover:bg-[#0082cc] text-white font-bold py-3 px-6 sm:px-8 rounded-lg transition duration-200 text-base sm:text-lg min-h-[44px]">
                    {t('confirm_and_start_building')}
                </button>
            </div>
        </div>
    );
};

export default PlayerInputScreen;
