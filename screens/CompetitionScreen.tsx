
import React from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { TrophyIcon, CalendarIcon } from '../components/icons';

interface CompetitionScreenProps {
    onSelectTournament: () => void;
    onSelectLeague: () => void;
}

const CompetitionScreen: React.FC<CompetitionScreenProps> = ({ onSelectTournament, onSelectLeague }) => {
    const { t } = useTranslation();

    return (
        <div className="max-w-4xl mx-auto flex flex-col items-center justify-center gap-10 py-10 w-full animate-fade-in h-full">
            <h2 className="text-3xl font-bold text-[#00A3FF] mb-6">{t('competition_select_mode')}</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
                <button
                    onClick={onSelectTournament}
                    className="group relative flex flex-col items-center justify-center p-8 bg-slate-800/50 backdrop-blur-lg border-2 border-slate-700 rounded-3xl transition-all duration-300 hover:border-yellow-500/80 hover:bg-slate-800/80 hover:-translate-y-2 hover:shadow-2xl hover:shadow-yellow-500/20 aspect-square"
                >
                    <TrophyIcon className="w-24 h-24 text-yellow-400 mb-6 transition-transform group-hover:scale-110" />
                    <h3 className="text-2xl font-bold text-white mb-2">{t('tournament_title')}</h3>
                    <p className="text-slate-400 text-center">{t('competition_tournament_desc')}</p>
                </button>

                <button
                    onClick={onSelectLeague}
                    className="group relative flex flex-col items-center justify-center p-8 bg-slate-800/50 backdrop-blur-lg border-2 border-slate-700 rounded-3xl transition-all duration-300 hover:border-green-500/80 hover:bg-slate-800/80 hover:-translate-y-2 hover:shadow-2xl hover:shadow-green-500/20 aspect-square"
                >
                    <CalendarIcon className="w-24 h-24 text-green-400 mb-6 transition-transform group-hover:scale-110" />
                    <h3 className="text-2xl font-bold text-white mb-2">{t('league_title')}</h3>
                    <p className="text-slate-400 text-center">{t('competition_league_desc')}</p>
                </button>
            </div>
        </div>
    );
};

export default CompetitionScreen;
