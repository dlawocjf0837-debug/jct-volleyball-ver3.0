
import React, { useState, useCallback, useEffect } from 'react';
import { Player, Stats, STAT_KEYS } from '../types';
import { useTranslation } from '../hooks/useTranslation';
import { useData } from '../contexts/DataContext';

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


    const handleParseAndProceed = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        
        const lines = csvData.trim().split('\n').map(line => line.trim()).filter(Boolean);
        if (lines.length < 2) {
            alert(t('alert_min_one_player'));
            return;
        }

        const headers = lines[0].split(',').map(h => h.trim());
        const expectedHeaders = ['번호', '이름', '성별', '키', '셔틀런', '유연성', '50m달리기', '언더핸드', '서브'];
        
        if(JSON.stringify(headers) !== JSON.stringify(expectedHeaders)){
            alert(t('alert_header_mismatch', { headers: expectedHeaders.join(',') }));
            return;
        }
        
        let players: Omit<Player, 'id' | 'anonymousName' | 'isCaptain' | 'totalScore'>[] = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            if (values.length !== headers.length) {
                alert(t('alert_data_mismatch', { line: i + 1, values: values.length, headers: headers.length }));
                return;
            }

            if (values.some(v => v === '')) {
                alert(t('alert_empty_data', { line: i + 1 }));
                return;
            }
            
            const studentId = values[0];
            if (studentId.length !== 5 || isNaN(parseInt(studentId, 10))) {
                alert(t('alert_invalid_student_id', { line: i + 1, studentId }));
                return;
            }
            const studentClass = parseInt(studentId.substring(1, 3), 10).toString();
            const studentNumber = parseInt(studentId.substring(3, 5), 10).toString();

            const stats: Partial<Stats> = {};
            const statHeaders = headers.slice(3);
            for (const [index, key] of STAT_KEYS.entries()) {
                const statValue = parseFloat(values[index + 3]);
                if(isNaN(statValue)) {
                    alert(t('alert_stat_not_a_number', { line: i + 1, header: statHeaders[index], value: values[index + 3] }));
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
            <div className="max-w-4xl mx-auto bg-slate-900/50 backdrop-blur-sm border border-slate-700 p-6 rounded-lg shadow-2xl space-y-6 animate-fade-in">
                <div className="p-4 bg-slate-800/50 rounded-lg text-center border border-slate-700 mb-6">
                    <h2 className="text-xl font-bold text-sky-400 mb-2">{t('player_input_helper_title')}</h2>
                    <p className="text-slate-300">
                        {t('player_input_helper_desc1')}
                    </p>
                    <p className="text-slate-400 mt-2 text-sm">
                        {t('player_input_helper_desc2')}
                    </p>
                </div>
                <div className="space-y-4">
                    <h2 className="block font-bold text-slate-300">
                        {t('player_input_step1_title')}
                    </h2>
                    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                         <div className="flex flex-col sm:flex-row gap-2 items-center bg-slate-900 p-2 rounded-md">
                            <input
                                type="text"
                                value={sheetUrl}
                                onChange={(e) => setSheetUrl(e.target.value)}
                                placeholder={t('settings_google_sheet_url_placeholder')}
                                className="flex-grow bg-slate-800 border border-slate-600 rounded-md p-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00A3FF]"
                            />
                            <button
                                onClick={handleFetchDataFromUrl}
                                disabled={isLoadingData}
                                className="w-full sm:w-auto flex-shrink-0 bg-[#00A3FF] hover:bg-[#0082cc] text-white font-bold py-2 px-4 rounded-lg transition duration-200 disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed"
                            >
                                {isLoadingData ? t('player_input_loading_button') : t('player_input_fetch_button')}
                            </button>
                        </div>
                    </div>
                     <p className="text-xs text-slate-500 mt-1">
                        {t('player_input_sheet_note')}
                     </p>
                     <p className="text-sm text-slate-400 mt-2 h-5">
                        {statusMessage}
                     </p>
                </div>
                
                <form onSubmit={handleParseAndProceed}>
                     <label htmlFor="csv-input" className="block mb-2 font-bold text-slate-300">
                        {t('player_input_step2_title')}
                    </label>
                    <textarea
                        id="csv-input"
                        value={csvData}
                        onChange={(e) => setCsvData(e.target.value)}
                        className="w-full h-48 bg-slate-900 border border-slate-700 rounded-md p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#00A3FF]"
                        placeholder={t('player_input_csv_placeholder', { defaultCsv: defaultCsv })}
                        aria-label="Student data in CSV format"
                    />
                     <div className="flex justify-between items-center mt-4">
                        <div>
                            <label htmlFor="class-select" className="mr-2 font-semibold text-slate-300">{t('player_input_class_select_label')}</label>
                            <select 
                                id="class-select"
                                value={selectedClass}
                                onChange={(e) => setSelectedClass(e.target.value)}
                                className="bg-slate-800 border border-slate-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-[#00A3FF]"
                            >
                                <option value="all">{t('player_input_class_all')}</option>
                                <option value="1">{t('class_format', { class: '1' })}</option>
                                <option value="2">{t('class_format', { class: '2' })}</option>
                                <option value="3">{t('class_format', { class: '3' })}</option>
                                <option value="4">{t('class_format', { class: '4' })}</option>
                                <option value="5">{t('class_format', { class: '5' })}</option>
                            </select>
                        </div>
                        <button type="submit" className="bg-[#00A3FF] hover:bg-[#0082cc] text-white font-bold py-3 px-8 rounded-lg transition duration-200 text-lg">
                            {t('player_input_start_button')}
                        </button>
                    </div>
                </form>
            </div>
        );
    }
    
    return (
        <div className="max-w-4xl mx-auto bg-slate-900/50 backdrop-blur-sm border border-slate-700 p-6 rounded-lg shadow-2xl space-y-6 animate-fade-in">
            <div className="p-4 bg-slate-800/50 rounded-lg text-center border border-slate-700 mb-6">
                <h2 className="text-xl font-bold text-sky-400 mb-2">{t('exclude_absent_title')}</h2>
                <p className="text-slate-300">{t('exclude_absent_desc')}</p>
            </div>
            <div className="max-h-96 overflow-y-auto space-y-2 pr-2">
                {allPlayers.map((player) => (
                    <label key={player.originalName} className={`flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer ${excludedPlayerNames.has(player.originalName) ? 'bg-red-900/50 hover:bg-red-800/50' : 'bg-slate-800 hover:bg-slate-700'}`}>
                        <input
                            type="checkbox"
                            checked={excludedPlayerNames.has(player.originalName)}
                            onChange={() => handleToggleExclude(player.originalName)}
                            className="h-5 w-5 bg-slate-700 border-slate-500 rounded text-red-500 focus:ring-red-500"
                        />
                        <span className="font-semibold text-slate-200">{player.originalName}</span>
                        <span className="text-xs text-slate-400 ml-auto">{player.class}{t('player_records_class_suffix')} {player.studentNumber}{t('achievements_student_number_suffix')}</span>
                    </label>
                ))}
            </div>
            <div className="flex justify-between items-center mt-4">
                <button onClick={() => setPhase('input')} className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-3 px-8 rounded-lg transition duration-200 text-lg">
                    {t('back')}
                </button>
                <button onClick={handleConfirmExclusionAndStart} className="bg-[#00A3FF] hover:bg-[#0082cc] text-white font-bold py-3 px-8 rounded-lg transition duration-200 text-lg">
                    {t('confirm_and_start_building')}
                </button>
            </div>
        </div>
    );
};

export default PlayerInputScreen;
