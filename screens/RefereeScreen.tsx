
import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { CrownIcon, QuestionMarkCircleIcon } from '../components/icons';
import RulesModal from '../components/RulesModal';
import TeamEmblem from '../components/TeamEmblem';
import { SavedTeamInfo } from '../types';
import { useTranslation } from '../hooks/useTranslation';

interface FlattenedTeam extends SavedTeamInfo {
    players: string[];
    captain: string;
    key: string;
    displayName: string;
    className: string;
}

interface RefereeScreenProps {
    onStartMatch: (teams: { teamA: string, teamB: string, teamAKey?: string, teamBKey?: string }) => void;
}

const RefereeScreen: React.FC<RefereeScreenProps> = ({ onStartMatch }) => {
    const { teamSets, reloadData, clearInProgressMatch } = useData();
    const { t } = useTranslation();
    const [selectedTeamAKey, setSelectedTeamAKey] = useState<string>('');
    const [selectedTeamBKey, setSelectedTeamBKey] = useState<string>('');
    const [showRulesModal, setShowRulesModal] = useState(false);
    const [selectedClass, setSelectedClass] = useState<string>('');

    useEffect(() => {
        reloadData();
    }, [reloadData]);
    
    const flattenedTeams = useMemo((): FlattenedTeam[] => {
        const teams: FlattenedTeam[] = [];
        teamSets.forEach(set => {
            set.teams.forEach(team => {
                const captain = set.players[team.captainId];
                teams.push({
                    ...team,
                    captain: captain ? captain.originalName : '주장 정보 없음',
                    players: team.playerIds.map(id => set.players[id]?.originalName || '선수 정보 없음'),
                    key: `${set.id}___${team.teamName}`,
                    displayName: `${set.className} - ${team.teamName}`,
                    className: set.className,
                });
            });
        });
        return teams.sort((a,b) => a.displayName.localeCompare(b.displayName));
    }, [teamSets]);

    const availableClasses = useMemo(() => {
        const classNames = new Set(flattenedTeams.map(t => t.className).filter(Boolean));
        // Fix: Add explicit types to sort callback parameters to prevent them from being inferred as `unknown`.
        return Array.from(classNames).sort((a: string, b: string) => {
            if (a === t('class_all')) return -1;
            if (b === t('class_all')) return 1;
            return a.localeCompare(b);
        });
    }, [flattenedTeams, t]);
    
    const filteredTeams = useMemo(() => {
        if (!selectedClass) return [];
        return flattenedTeams.filter(t => t.className === selectedClass);
    }, [flattenedTeams, selectedClass]);

    const selectedTeamA = useMemo(() => {
        if (!selectedTeamAKey) return null;
        return flattenedTeams.find(t => t.key === selectedTeamAKey) || null;
    }, [selectedTeamAKey, flattenedTeams]);
    
    const selectedTeamB = useMemo(() => {
        if (!selectedTeamBKey) return null;
        return flattenedTeams.find(t => t.key === selectedTeamBKey) || null;
    }, [selectedTeamBKey, flattenedTeams]);
    
    const handleClassChange = (className: string) => {
        setSelectedClass(className);
        setSelectedTeamAKey('');
        setSelectedTeamBKey('');
    };

    const handleStartMatchClick = () => {
        if (!selectedTeamA || !selectedTeamB) return;
        clearInProgressMatch();
        onStartMatch({
            teamA: selectedTeamA.teamName,
            teamB: selectedTeamB.teamName,
            teamAKey: selectedTeamA.key,
            teamBKey: selectedTeamB.key,
        });
    };

    const TeamRoster: React.FC<{ team: FlattenedTeam | null, teamLabel: string, color: string }> = ({ team, teamLabel, color }) => {
        if (!team) {
            return (
                <div className="bg-slate-900/50 p-6 rounded-lg border border-slate-700 text-center h-full flex items-center justify-center min-h-[200px]">
                    <p className="text-slate-400">{t('referee_select_team_prompt', { label: teamLabel })}</p>
                </div>
            );
        }
        const teamColor = team.color || color;
        return (
             <div className="bg-slate-900/50 p-6 rounded-lg border-2 border-solid animate-fade-in" style={{ borderColor: teamColor }}>
                <div className="flex flex-col items-center text-center gap-2 mb-4">
                    <TeamEmblem emblem={team.emblem} color={teamColor} className="w-12 h-12"/>
                    <div>
                        <h3 className="text-2xl font-bold text-white">{team.displayName}</h3>
                        {team.slogan && <p className="text-sm italic" style={{ color: teamColor }}>"{team.slogan}"</p>}
                    </div>
                </div>
                <div className="bg-slate-800 p-4 rounded-md space-y-3">
                    <h4 className="font-bold text-lg text-slate-300">{t('referee_roster_title')}</h4>
                    <div className="flex items-center gap-2 text-yellow-400 font-semibold text-lg">
                        <CrownIcon className="w-6 h-6" />
                        {t('referee_captain_label')}: {team.captain}
                    </div>
                    <ul className="text-slate-300 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 pt-2 border-t border-slate-700">
                        {team.players.filter(p => p !== team.captain).map(player => (
                            <li key={player} className="truncate">{player}</li>
                        ))}
                    </ul>
                </div>
            </div>
        );
    };

    return (
        <div className="w-full max-w-5xl mx-auto flex flex-col gap-6 flex-grow animate-fade-in">
            {showRulesModal && <RulesModal onClose={() => setShowRulesModal(false)} />}
            
            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-700 p-6 rounded-lg shadow-2xl space-y-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-slate-300">{t('referee_select_team_title')}</h2>
                    <div className="flex items-center gap-2">
                        <button onClick={reloadData} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-3 rounded-lg transition duration-200 text-xl" aria-label="새로고침">
                            ⟳
                        </button>
                        <button 
                            onClick={() => setShowRulesModal(true)} 
                            className="p-2 text-slate-400 hover:text-white transition-colors"
                            aria-label="규칙 보기"
                        >
                            <QuestionMarkCircleIcon className="w-8 h-8" />
                        </button>
                    </div>
                </div>

                <div className="space-y-2">
                    <label htmlFor="class-select-referee" className="block text-sm font-bold text-slate-300">{t('referee_select_class_label')}</label>
                    <select
                        id="class-select-referee"
                        value={selectedClass}
                        onChange={(e) => handleClassChange(e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                        <option value="">{t('referee_select_class_placeholder')}</option>
                        {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                
                {selectedClass ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
                        <div>
                            <label htmlFor="teamA-select" className="block text-sm font-medium text-slate-300 mb-1">{t('referee_select_team_a_label')}</label>
                            <select
                                id="teamA-select"
                                value={selectedTeamAKey}
                                onChange={(e) => setSelectedTeamAKey(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-600 rounded-md p-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                                aria-label="A팀 선택"
                            >
                                <option value="">{t('referee_select_team_a_placeholder')}</option>
                                {filteredTeams.map(team => (
                                    <option key={team.key} value={team.key} disabled={team.key === selectedTeamBKey}>
                                        {team.teamName}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="teamB-select" className="block text-sm font-medium text-slate-300 mb-1">{t('referee_select_team_b_label')}</label>
                            <select
                                id="teamB-select"
                                value={selectedTeamBKey}
                                onChange={(e) => setSelectedTeamBKey(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-600 rounded-md p-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                                aria-label="B팀 선택"
                            >
                                <option value="">{t('referee_select_team_b_placeholder')}</option>
                                {filteredTeams.map(team => (
                                    <option key={team.key} value={team.key} disabled={team.key === selectedTeamAKey}>
                                        {team.teamName}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                 ) : (
                    <div className="text-center p-6 bg-slate-800/50 border border-slate-700 rounded-lg animate-fade-in">
                        <h3 className="text-lg font-bold text-sky-400 mb-3">{t('referee_guide_title')}</h3>
                        <p className="text-slate-300">
                            {t('referee_guide_desc1')}
                        </p>
                        <p className="text-slate-400 mt-2 text-sm">
                           {t('referee_guide_desc2')}
                        </p>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-grow">
                <TeamRoster team={selectedTeamA} teamLabel={t('referee_team_a_label')} color="#38bdf8" />
                <TeamRoster team={selectedTeamB} teamLabel={t('referee_team_b_label')} color="#f87171" />
            </div>

            <div className="flex justify-center items-center gap-4 pt-4">
                <button
                    onClick={handleStartMatchClick}
                    disabled={!selectedTeamAKey || !selectedTeamBKey}
                    className="bg-[#00A3FF] hover:bg-[#0082cc] text-white font-bold py-3 px-8 rounded-lg transition duration-200 text-lg disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed"
                >
                    {t('start_match_button')}
                </button>
            </div>
        </div>
    );
};

export default RefereeScreen;
