

// Fix: Import useEffect from React to resolve 'Cannot find name' error.
import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { SavedTeamInfo } from '../types';
import TeamEmblem from './TeamEmblem';
import { useTranslation } from '../hooks/useTranslation';

interface TeamSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (teamKey: string) => void;
    excludeKey: string;
    baseTeamKey?: string;
}

interface FlattenedTeam extends SavedTeamInfo {
    key: string; 
    displayName: string;
    className: string;
    teamCount: number;
    savedAt: string;
}

const TeamSelectionModal: React.FC<TeamSelectionModalProps> = ({ isOpen, onClose, onSelect, excludeKey, baseTeamKey }) => {
    const { teamSets } = useData();
    const { t } = useTranslation();
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [selectedFormat, setSelectedFormat] = useState('all');

    const flattenedTeams = useMemo((): FlattenedTeam[] => {
        const teams: FlattenedTeam[] = [];
        teamSets.forEach(set => {
            set.teams.forEach(team => {
                teams.push({
                    ...team,
                    key: `${set.id}___${team.teamName}`,
                    displayName: `${set.className} - ${team.teamName}`,
                    className: set.className,
                    teamCount: set.teamCount ?? 4,
                    savedAt: set.savedAt,
                });
            });
        });
        return teams.sort((a, b) => a.displayName.localeCompare(b.displayName));
    }, [teamSets]);

    const baseTeam = useMemo(() => {
        if (!baseTeamKey) return null;
        return flattenedTeams.find(t => t.key === baseTeamKey);
    }, [baseTeamKey, flattenedTeams]);
    
    useEffect(() => {
        if (baseTeam) {
            setSelectedClass(baseTeam.className);
            setSelectedFormat(String(baseTeam.teamCount));
        } else {
            setSelectedClass('');
            setSelectedFormat('all');
        }
    }, [baseTeam, isOpen]);

    const availableClasses = useMemo(() => {
        const classNames = new Set(flattenedTeams.map(t => t.className).filter(Boolean));
        const allText = t('class_all');
        return Array.from(classNames).sort((a: string, b: string) => {
            if (a === allText) return -1;
            if (b === allText) return 1;
            return a.localeCompare(b);
        });
    }, [flattenedTeams, t]);


    const availableFormats = useMemo(() => {
        if (!selectedClass) return [];
        const formats = new Set<string>();
        flattenedTeams.forEach(team => {
            if (team.className === selectedClass) {
                formats.add(String(team.teamCount));
            }
        });
        const sortedFormats = Array.from(formats).sort((a, b) => parseInt(a) - parseInt(b));
        return ['all', ...sortedFormats];
    }, [selectedClass, flattenedTeams]);
    
    const filteredTeams = useMemo(() => {
        if (!selectedClass) {
            return [];
        }
        
        let finalTeams = flattenedTeams.filter(t => t.className === selectedClass);
        
        if (selectedFormat !== 'all') {
            finalTeams = finalTeams.filter(t => String(t.teamCount) === selectedFormat);
        }
    
        return finalTeams;
    }, [flattenedTeams, selectedClass, selectedFormat]);

    const handleClassSelect = (className: string) => {
        setSelectedClass(className);
        setSelectedFormat('all');
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex flex-col p-4 sm:p-6 lg:p-8 animate-fade-in"
            onClick={onClose}
        >
            <div className="w-full max-w-6xl mx-auto flex flex-col h-full" onClick={e => e.stopPropagation()}>
                <div className="flex-shrink-0 flex justify-between items-center mb-6">
                    <h2 className="text-3xl font-bold text-sky-400">{t('team_selection')}</h2>
                    <button onClick={onClose} className="text-4xl font-light text-slate-400 hover:text-white">&times;</button>
                </div>
                
                <>
                    <div className="flex-shrink-0 bg-slate-800/50 p-4 rounded-lg mb-4">
                        <h3 className="text-lg font-semibold text-slate-300 mb-3">{t('step1_select_class')}</h3>
                        <div className="flex flex-wrap gap-3">
                            {availableClasses.map(c => (
                                <button
                                    key={c}
                                    onClick={() => handleClassSelect(c)}
                                    className={`px-6 py-3 text-xl rounded-md transition-colors font-semibold ${selectedClass === c ? 'bg-sky-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
                                >
                                    {c}
                                </button>
                            ))}
                        </div>
                    </div>

                    {selectedClass && availableFormats.length > 1 && (
                        <div className="flex-shrink-0 bg-slate-800/50 p-4 rounded-lg mb-6 animate-fade-in">
                            <h3 className="text-lg font-semibold text-slate-300 mb-3">{t('step2_select_format')}</h3>
                            <div className="flex flex-wrap gap-3">
                                {availableFormats.map(format => (
                                    <button
                                        key={format}
                                        onClick={() => setSelectedFormat(format)}
                                        className={`px-4 py-2 text-lg rounded-md transition-colors font-semibold ${selectedFormat === format ? 'bg-sky-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}
                                    >
                                        {format === 'all' ? t('all') : t('team_format_n', { n: format })}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </>
                
                <div className="flex-grow overflow-y-auto pr-2 -mr-2">
                    {selectedClass ? (
                        filteredTeams.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-fade-in">
                                {filteredTeams.map(team => {
                                    const isExcluded = team.key === excludeKey;
                                    const dateString = team.memo || new Date(team.savedAt).toLocaleDateString();
                                    return (
                                        <button
                                            key={team.key}
                                            onClick={() => onSelect(team.key)}
                                            disabled={isExcluded}
                                            className={`bg-slate-800 p-4 rounded-lg text-center flex flex-col items-center justify-center h-80 transition-all duration-200 ${isExcluded ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-700 hover:ring-2 ring-sky-500'}`}
                                        >
                                            <TeamEmblem emblem={team.emblem} color={team.color} className="w-40 h-40 mb-3" />
                                            <h4 className="text-2xl font-bold text-white truncate w-full">{team.teamName}</h4>
                                            <p className="text-base text-slate-300 mt-1 font-semibold">{team.className}</p>
                                            <p className="text-sm text-slate-500 mt-1">{dateString}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-500 text-lg">
                                {t('no_teams_for_filter')}
                            </div>
                        )
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-500 text-lg">
                            {t('please_select_class_first')}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TeamSelectionModal;