import React from 'react';
import { useData } from '../contexts/DataContext';
import { League } from '../types';
import { useTranslation } from '../hooks/useTranslation';

interface LeagueLobbyScreenProps {
    onCreateNewLeague: () => void;
    onSelectLeague: (leagueId: string) => void;
}

const LeagueLobbyScreen: React.FC<LeagueLobbyScreenProps> = ({ onCreateNewLeague, onSelectLeague }) => {
    const { leagues } = useData();
    const { t } = useTranslation();

    const hasLeagues = leagues && leagues.length > 0;

    const handleSelectLeague = (league: League) => {
        onSelectLeague(league.id);
    };

    return (
        <div className="max-w-5xl mx-auto flex flex-col gap-6 sm:gap-8 py-6 sm:py-10 h-full px-4 animate-fade-in">
            <div className="flex flex-col lg:flex-row items-center lg:justify-between gap-4">
                <h1 className="text-3xl lg:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 text-center lg:text-left">
                    {t('league_title')}
                </h1>
                <button
                    onClick={onCreateNewLeague}
                    className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 px-4 rounded-full min-h-[44px] w-full lg:w-auto shadow-lg shadow-sky-500/30 transition-colors"
                >
                    {t('league_create_new_button')}
                </button>
            </div>

            <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-semibold text-slate-100 mb-3">
                    {t('league_select_or_create_prompt')}
                </h2>
                {hasLeagues ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 max-h-[480px] overflow-y-auto pr-1">
                        {leagues
                            .slice()
                            .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
                            .map((league) => (
                                <button
                                    key={league.id}
                                    onClick={() => handleSelectLeague(league)}
                                    className="group flex flex-col items-start justify-between w-full h-full p-4 sm:p-5 rounded-xl bg-slate-800/70 border border-slate-700 hover:border-sky-500 hover:bg-slate-800 shadow-sm hover:shadow-lg hover:shadow-sky-500/20 transition-all text-left"
                                >
                                    <div>
                                        <p className="text-sm text-slate-400 mb-1">
                                            {t('league_report_title')}
                                        </p>
                                        <h3 className="text-lg font-bold text-white group-hover:text-sky-300 line-clamp-2">
                                            {league.name}
                                        </h3>
                                    </div>
                                    <div className="mt-3 flex items-center justify-between w-full text-xs text-slate-400">
                                        <span>
                                            {t('league_matches_per_day_placeholder')}:{' '}
                                            <span className="font-semibold text-sky-400">
                                                {league.schedule?.length ?? 0}
                                            </span>
                                        </span>
                                        {league.createdAt && (
                                            <span>
                                                {new Date(league.createdAt).toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                        <p className="text-slate-300 text-sm sm:text-base">
                            {t('league_select_or_create_prompt')}
                        </p>
                        <button
                            onClick={onCreateNewLeague}
                            className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 px-4 rounded-full min-h-[44px] shadow-lg shadow-sky-500/30 transition-colors"
                        >
                            {t('league_create_new_button')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LeagueLobbyScreen;


