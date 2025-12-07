

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useData } from '../contexts/DataContext';
import { SavedTeamInfo } from '../types';
import TeamSelectionModal from '../components/TeamSelectionModal';
import TeamEmblem from '../components/TeamEmblem';
import { useTranslation } from '../hooks/useTranslation';

interface MatchSetupScreenProps {
    onStartMatch: (teams: { teamA: string, teamB: string, teamAKey?: string, teamBKey?: string }) => void;
}

interface FlattenedTeam extends SavedTeamInfo {
    key: string; // Unique key: "setId___teamName"
    displayName: string; // "1반 - Team Awesome"
    className: string; // "1반"
    teamCount: number;
}

export default function MatchSetupScreen({ onStartMatch }: MatchSetupScreenProps) {
    const { teamSets, showToast, teamPerformanceData } = useData();
    const { t } = useTranslation();
    const [selectedTeamAKey, setSelectedTeamAKey] = useState('');
    const [selectedTeamBKey, setSelectedTeamBKey] = useState('');
    const [modalState, setModalState] = useState<{ isOpen: boolean; target: 'A' | 'B' | null }>({ isOpen: false, target: null });
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
        if (teamA && teamB) {
            setPrediction(getPrediction(teamA.teamName, teamB.teamName));
        } else {
            setPrediction(null);
        }
        setShowPrediction(false);
    }, [teamA, teamB, getPrediction]);

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
        }
        setModalState({ isOpen: false, target: null });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!teamA || !teamB) {
            showToast(t('toast_select_both_teams'), 'error');
            return;
        }
        onStartMatch({ 
            teamA: teamA.teamName, 
            teamB: teamB.teamName, 
            teamAKey: teamA.key, 
            teamBKey: teamB.key
        });
    };

    const TeamDisplayCard: React.FC<{ team: FlattenedTeam, onSelect: () => void, colorClass: string }> = ({ team, onSelect, colorClass }) => (
        <div onClick={onSelect} className={`bg-slate-800/50 p-6 rounded-lg border-2 ${colorClass} h-full flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-700/50 transition-colors`}>
            <TeamEmblem emblem={team.emblem} color={team.color} className="w-40 h-40 mb-4" />
            <h3 className="text-2xl font-bold text-white truncate">{team.teamName}</h3>
            <p className="text-slate-400">{team.className}</p>
        </div>
    );

    const PlaceholderCard: React.FC<{ text: string, onSelect: () => void, colorClass: string }> = ({ text, onSelect, colorClass }) => (
        <div onClick={onSelect} className={`bg-slate-800/50 p-6 rounded-lg border-2 border-dashed ${colorClass} h-full flex items-center justify-center text-center cursor-pointer hover:bg-slate-700/50 transition-colors min-h-[200px]`}>
            <span className="text-2xl font-bold text-slate-400">{text}</span>
        </div>
    );

    return (
        <>
            <TeamSelectionModal 
                isOpen={modalState.isOpen}
                onClose={() => setModalState({ isOpen: false, target: null })}
                onSelect={handleSelectTeam}
                excludeKey={modalState.target === 'A' ? selectedTeamBKey : selectedTeamAKey}
                baseTeamKey={modalState.target === 'B' ? selectedTeamAKey : undefined}
            />
            <div className="max-w-4xl mx-auto bg-slate-900/50 backdrop-blur-sm border border-slate-700 p-6 rounded-lg shadow-2xl space-y-6 animate-fade-in">
                 <div className="text-center p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                    <h3 className="text-lg font-bold text-sky-400 mb-2">{t('match_setup_guide_title')}</h3>
                    <p className="text-slate-300">
                        {t('match_setup_guide_desc')}
                    </p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {teamA ? (
                            <TeamDisplayCard team={teamA} onSelect={() => setModalState({ isOpen: true, target: 'A' })} colorClass="border-sky-500" />
                        ) : (
                            <PlaceholderCard text={t('select_team_a')} onSelect={() => setModalState({ isOpen: true, target: 'A' })} colorClass="border-sky-500" />
                        )}
                        {teamB ? (
                            <TeamDisplayCard team={teamB} onSelect={() => setModalState({ isOpen: true, target: 'B' })} colorClass="border-red-500" />
                        ) : (
                            <PlaceholderCard text={t('select_team_b')} onSelect={() => setModalState({ isOpen: true, target: 'B' })} colorClass="border-red-500" />
                        )}
                    </div>

                    {teamA && teamB && (
                        <div className="text-center p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                            {!showPrediction ? (
                                <button
                                    type="button"
                                    onClick={() => setShowPrediction(true)}
                                    className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 px-6 rounded-lg transition"
                                >
                                    {t('show_ai_prediction')}
                                </button>
                            ) : prediction && (
                                <div className="animate-fade-in text-center">
                                    <h3 className="text-lg font-bold text-sky-400 mb-2">{t('ai_prediction_title')}</h3>
                                    <p className="text-xl text-slate-300">
                                        <span style={{ color: teamA?.color || '#38bdf8' }}>{teamA?.teamName}</span>
                                        <span className="font-bold text-2xl mx-2">{prediction.a}%</span>
                                        <span className="text-slate-400">vs</span>
                                        <span className="font-bold text-2xl mx-2">{prediction.b}%</span>
                                        <span style={{ color: teamB?.color || '#f87171' }}>{teamB?.teamName}</span>
                                    </p>
                                    <p className="text-xs text-slate-500 mt-2">{t('ai_prediction_note')}</p>
                                    <button
                                        type="button"
                                        onClick={() => setShowPrediction(false)}
                                        className="mt-3 bg-slate-600 hover:bg-slate-500 text-white font-bold py-1 px-4 rounded-lg text-sm transition"
                                    >
                                        {t('close')}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    
                    <div className="flex justify-end items-center pt-4">
                        <button type="submit" className="bg-[#00A3FF] hover:bg-[#0082cc] text-white font-bold py-3 px-8 rounded-lg transition duration-200 text-lg" disabled={!teamA || !teamB}>
                            {t('go_to_attendance_selection')}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}