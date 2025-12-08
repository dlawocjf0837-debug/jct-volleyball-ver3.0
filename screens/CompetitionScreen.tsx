
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
        <div className="max-w-4xl mx-auto flex flex-col items-center justify-center gap-6 sm:gap-10 py-6 sm:py-10 w-full animate-fade-in h-full px-4">
            <div className="flex flex-col lg:flex-row items-center lg:justify-between mb-6 gap-4 w-full">
                <h1 className="text-3xl lg:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 text-center lg:text-right">
                    {t('competition_select_mode')}
                </h1>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8 w-full max-w-2xl">
                <button
                    onClick={onSelectTournament}
                    className="group relative flex flex-col items-center justify-center p-6 sm:p-8 bg-slate-800/50 backdrop-blur-lg border-2 border-slate-700 rounded-3xl transition-all duration-300 hover:border-yellow-500/80 hover:bg-slate-800/80 hover:-translate-y-2 hover:shadow-2xl hover:shadow-yellow-500/20 aspect-square min-h-[250px] sm:min-h-[300px]"
                >
                    <TrophyIcon className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 text-yellow-400 mb-4 sm:mb-6 transition-transform group-hover:scale-110" />
                    <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">{t('tournament_title')}</h3>
                    <p className="text-sm sm:text-base text-slate-400 text-center px-2">{t('competition_tournament_desc')}</p>
                </button>

                <button
                    onClick={onSelectLeague}
                    className="group relative flex flex-col items-center justify-center p-6 sm:p-8 bg-slate-800/50 backdrop-blur-lg border-2 border-slate-700 rounded-3xl transition-all duration-300 hover:border-green-500/80 hover:bg-slate-800/80 hover:-translate-y-2 hover:shadow-2xl hover:shadow-green-500/20 aspect-square min-h-[250px] sm:min-h-[300px]"
                >
                    <CalendarIcon className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 text-green-400 mb-4 sm:mb-6 transition-transform group-hover:scale-110" />
                    <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">{t('league_title')}</h3>
                    <p className="text-sm sm:text-base text-slate-400 text-center px-2">{t('competition_league_desc')}</p>
                </button>
            </div>
        </div>
    );
};

export default CompetitionScreen;
