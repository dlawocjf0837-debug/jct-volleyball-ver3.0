

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useData } from '../contexts/DataContext';
import { SavedTeamInfo, SavedOpponentTeam } from '../types';
import TeamSelectionModal from '../components/TeamSelectionModal';
import TeamEmblem from '../components/TeamEmblem';
import { useTranslation } from '../hooks/useTranslation';

interface MatchSetupScreenProps {
    appMode?: 'CLASS' | 'CLUB';
    onStartMatch: (teams: { teamA: string, teamB: string, teamAKey?: string, teamBKey?: string, teamBFromOpponent?: SavedOpponentTeam }) => void;
}

interface FlattenedTeam extends SavedTeamInfo {
    key: string; // Unique key: "setId___teamName"
    displayName: string; // "1반 - Team Awesome"
    className: string; // "1반"
    teamCount: number;
}

export default function MatchSetupScreen({ appMode = 'CLASS', onStartMatch }: MatchSetupScreenProps) {
    const { teamSets, teamSetsMap, showToast, teamPerformanceData, opponentTeams, saveOpponentTeam } = useData();
    const { t } = useTranslation();
    const [selectedTeamAKey, setSelectedTeamAKey] = useState('');
    const [selectedTeamBKey, setSelectedTeamBKey] = useState('');
    const [selectedTeamBFromOpponent, setSelectedTeamBFromOpponent] = useState<SavedOpponentTeam | null>(null);
    const [modalState, setModalState] = useState<{ isOpen: boolean; target: 'A' | 'B' | null }>({ isOpen: false, target: null });
    const [opponentListOpen, setOpponentListOpen] = useState(false);
    const [prediction, setPrediction] = useState<{ a: number, b: number } | null>(null);
    const [showPrediction, setShowPrediction] = useState(false);

    const flattenedTeams = useMemo((): FlattenedTeam[] => {
        const teams: FlattenedTeam[] = [];
        teamSets.forEach(set => {
            set.teams.forEach(team => {
                teams.push({
                    ...team,
                    key: `${set.id}___${team.teamName}`,
                    displayName: `${set.className} - ${team.teamName}`,
                    className: set.className,
                    teamCount: set.teamCount ?? 4, // Legacy sets are 4 teams
                });
            });
        });
        return teams.sort((a, b) => a.displayName.localeCompare(b.displayName));
    }, [teamSets]);

    const teamA = useMemo(() => flattenedTeams.find(t => t.key === selectedTeamAKey), [flattenedTeams, selectedTeamAKey]);
    const teamB = useMemo(() => flattenedTeams.find(t => t.key === selectedTeamBKey), [flattenedTeams, selectedTeamBKey]);
    const teamBName = selectedTeamBFromOpponent?.name ?? teamB?.teamName ?? '';
    const hasTeamB = !!(selectedTeamBFromOpponent || teamB);

    const getPrediction = useCallback((teamAName: string, teamBName: string) => {
        const teamAStats = teamPerformanceData.find(t => t.teamName === teamAName);
        const teamBStats = teamPerformanceData.find(t => t.teamName === teamBName);
        
        const rateA = teamAStats?.winRate ?? 50;
        const rateB = teamBStats?.winRate ?? 50;

        if (rateA + rateB === 0) return { a: 50, b: 50 };

        const totalRate = rateA + rateB;
        const predictionA = (rateA / totalRate) * 100;
        const predictionB = (rateB / totalRate) * 100;

        return { a: Math.round(predictionA), b: Math.round(predictionB) };
    }, [teamPerformanceData]);

    useEffect(() => {
        if (teamA && teamBName) {
            setPrediction(getPrediction(teamA.teamName, teamBName));
        } else {
            setPrediction(null);
        }
        setShowPrediction(false);
    }, [teamA, teamBName, getPrediction]);

    const handleSelectTeam = (teamKey: string) => {
        const { target } = modalState;
        if (target === 'A') {
            if (teamKey === selectedTeamBKey) {
                showToast(t('toast_teams_must_be_different'), 'error');
                return;
            }
            setSelectedTeamAKey(teamKey);
        } else if (target === 'B') {
            if (teamKey === selectedTeamAKey) {
                showToast(t('toast_teams_must_be_different'), 'error');
                return;
            }
            setSelectedTeamBKey(teamKey);
            setSelectedTeamBFromOpponent(null);
        }
        setModalState({ isOpen: false, target: null });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!teamA || !hasTeamB) {
            showToast(t('toast_select_both_teams'), 'error');
            return;
        }
        if (selectedTeamBFromOpponent) {
            onStartMatch({
                teamA: teamA.teamName,
                teamB: selectedTeamBFromOpponent.name,
                teamAKey: teamA.key,
                teamBFromOpponent: selectedTeamBFromOpponent,
            });
        } else {
            onStartMatch({
                teamA: teamA.teamName,
                teamB: teamB!.teamName,
                teamAKey: teamA.key,
                teamBKey: teamB!.key,
            });
        }
    };

    const handleSaveCurrentBAsOpponent = () => {
        if (!teamB || !teamBKey) return;
        const data = teamSetsMap.get(teamB.key);
        if (!data) return;
        const players = data.team.playerIds
            .map(id => data.set.players[id])
            .filter(Boolean)
            .map(p => ({ number: p!.studentNumber, name: p!.originalName, memo: p!.memo }));
        saveOpponentTeam({ name: teamB.teamName, players });
    };

    const TeamDisplayCard: React.FC<{ team: FlattenedTeam, onSelect: () => void, colorClass: string }> = ({ team, onSelect, colorClass }) => (
        <div onClick={onSelect} className={`bg-slate-800/50 p-4 sm:p-6 rounded-lg border-2 ${colorClass} h-full flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-700/50 transition-colors min-h-[200px]`}>
            <TeamEmblem emblem={team.emblem} color={team.color} className="w-24 h-24 sm:w-32 sm:h-32 lg:w-40 lg:h-40 mb-3 sm:mb-4" />
            <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-white truncate w-full px-2">{team.teamName}</h3>
            <p className="text-sm sm:text-base text-slate-400">{team.className}</p>
        </div>
    );

    const PlaceholderCard: React.FC<{ text: string, onSelect: () => void, colorClass: string }> = ({ text, onSelect, colorClass }) => (
        <div onClick={onSelect} className={`bg-slate-800/50 p-4 sm:p-6 rounded-lg border-2 border-dashed ${colorClass} h-full flex items-center justify-center text-center cursor-pointer hover:bg-slate-700/50 transition-colors min-h-[200px]`}>
            <span className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-400">{text}</span>
        </div>
    );

    const OpponentTeamCard: React.FC<{ opponent: SavedOpponentTeam, onSelect: () => void, colorClass: string }> = ({ opponent, onSelect, colorClass }) => (
        <div onClick={onSelect} className={`bg-slate-800/50 p-4 sm:p-6 rounded-lg border-2 ${colorClass} h-full flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-700/50 transition-colors min-h-[200px]`}>
            <span className="text-amber-400/90 text-xs font-semibold mb-1">상대 팀</span>
            <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-white truncate w-full px-2">{opponent.name}</h3>
            <p className="text-sm text-slate-400">{opponent.players.length}명</p>
        </div>
    );

    const openBSelection = () => {
        if (appMode === 'CLUB') {
            setOpponentListOpen(false);
            setModalState({ isOpen: true, target: 'B' });
        } else {
            setModalState({ isOpen: true, target: 'B' });
        }
    };

    return (
        <>
            <TeamSelectionModal 
                isOpen={modalState.isOpen}
                onClose={() => setModalState({ isOpen: false, target: null })}
                onSelect={handleSelectTeam}
                excludeKey={modalState.target === 'A' ? selectedTeamBKey : selectedTeamAKey}
                baseTeamKey={modalState.target === 'B' ? selectedTeamAKey : undefined}
            />
            {appMode === 'CLUB' && (
                <div className={`fixed inset-0 z-40 ${opponentListOpen ? 'block' : 'hidden'}`} onClick={() => setOpponentListOpen(false)}>
                    <div className="absolute inset-0 bg-black/50" />
                    <div className="absolute right-4 top-24 bottom-24 left-4 sm:left-auto sm:right-4 sm:max-w-sm max-h-[60vh] overflow-auto bg-slate-800 border border-amber-600/40 rounded-lg shadow-xl p-3" onClick={e => e.stopPropagation()}>
                        <h4 className="text-amber-400 font-bold mb-2">상대 팀 불러오기</h4>
                        {opponentTeams.length === 0 ? (
                            <p className="text-slate-400 text-sm">저장된 상대 팀이 없습니다. 팀 B를 선택한 뒤 &quot;상대 팀으로 저장&quot;을 사용하세요.</p>
                        ) : (
                            <ul className="space-y-2">
                                {opponentTeams.map(opp => (
                                    <li key={opp.id}>
                                        <button type="button" onClick={() => { setSelectedTeamBFromOpponent(opp); setSelectedTeamBKey(''); setOpponentListOpen(false); }} className="w-full text-left p-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium">
                                            {opp.name} <span className="text-slate-400 text-sm">({opp.players.length}명)</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <button type="button" onClick={() => setOpponentListOpen(false)} className="mt-3 w-full py-2 bg-slate-600 hover:bg-slate-500 rounded-lg text-white text-sm">닫기</button>
                    </div>
                </div>
            )}
            <div className="max-w-4xl mx-auto bg-slate-900/50 backdrop-blur-sm border border-slate-700 p-4 sm:p-6 rounded-lg shadow-2xl space-y-4 sm:space-y-6 animate-fade-in px-4">
                 <div className="text-center p-3 sm:p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <h3 className="text-base sm:text-lg font-bold text-sky-400 mb-2">{t('match_setup_guide_title')}</h3>
                    <p className="text-sm sm:text-base text-slate-300">
                        {t('match_setup_guide_desc')}
                    </p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                        {teamA ? (
                            <TeamDisplayCard team={teamA} onSelect={() => setModalState({ isOpen: true, target: 'A' })} colorClass="border-sky-500" />
                        ) : (
                            <PlaceholderCard text={t('select_team_a')} onSelect={() => setModalState({ isOpen: true, target: 'A' })} colorClass="border-sky-500" />
                        )}
                        <div className="flex flex-col gap-2">
                            {teamB ? (
                                <TeamDisplayCard team={teamB} onSelect={openBSelection} colorClass="border-red-500" />
                            ) : selectedTeamBFromOpponent ? (
                                <OpponentTeamCard opponent={selectedTeamBFromOpponent} onSelect={openBSelection} colorClass="border-red-500" />
                            ) : (
                                <PlaceholderCard text={t('select_team_b')} onSelect={openBSelection} colorClass="border-red-500" />
                            )}
                            {appMode === 'CLUB' && (
                                <div className="flex flex-wrap gap-2">
                                    <button type="button" onClick={() => setOpponentListOpen(true)} className="text-sm py-1.5 px-3 rounded-lg bg-amber-900/50 text-amber-300 border border-amber-600/50 hover:bg-amber-800/50">
                                        상대 팀 불러오기
                                    </button>
                                    {teamB && (
                                        <button type="button" onClick={handleSaveCurrentBAsOpponent} className="text-sm py-1.5 px-3 rounded-lg bg-slate-600 text-slate-200 border border-slate-500 hover:bg-slate-500">
                                            현재 팀 B를 상대 팀으로 저장
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {teamA && hasTeamB && (
                        <div className="text-center p-3 sm:p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                            {!showPrediction ? (
                                <button
                                    type="button"
                                    onClick={() => setShowPrediction(true)}
                                    className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 sm:py-2 px-4 sm:px-6 rounded-lg transition min-h-[44px] text-sm sm:text-base"
                                >
                                    {t('show_ai_prediction')}
                                </button>
                            ) : prediction && (
                                <div className="animate-fade-in text-center">
                                    <h3 className="text-base sm:text-lg font-bold text-sky-400 mb-2">{t('ai_prediction_title')}</h3>
                                    <p className="text-base sm:text-lg lg:text-xl text-slate-300 break-words">
                                        <span style={{ color: teamA?.color || '#38bdf8' }}>{teamA?.teamName}</span>
                                        <span className="font-bold text-xl sm:text-2xl mx-1 sm:mx-2">{prediction.a}%</span>
                                        <span className="text-slate-400">vs</span>
                                        <span className="font-bold text-xl sm:text-2xl mx-1 sm:mx-2">{prediction.b}%</span>
                                        <span style={{ color: teamB?.color || '#f87171' }}>{teamBName}</span>
                                    </p>
                                    <p className="text-xs text-slate-500 mt-2">{t('ai_prediction_note')}</p>
                                    <button
                                        type="button"
                                        onClick={() => setShowPrediction(false)}
                                        className="mt-3 bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded-lg text-sm transition min-h-[44px]"
                                    >
                                        {t('close')}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    
                    <div className="flex justify-end items-center pt-3 sm:pt-4">
                        <button type="submit" className="w-full sm:w-auto bg-[#00A3FF] hover:bg-[#0082cc] text-white font-bold py-3 px-6 sm:px-8 rounded-lg transition duration-200 text-base sm:text-lg disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]" disabled={!teamA || !hasTeamB}>
                            {t('go_to_attendance_selection')}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}