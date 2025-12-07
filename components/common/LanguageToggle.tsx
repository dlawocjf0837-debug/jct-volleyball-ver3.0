import React from 'react';
import { useData } from '../../contexts/DataContext';

const LanguageToggle: React.FC = () => {
    const { language, setLanguage } = useData();

    return (
        <div className="flex items-center bg-slate-700 rounded-full p-1">
            <button
                onClick={() => setLanguage('ko')}
                className={`px-3 py-1 text-sm font-semibold rounded-full transition-colors ${language === 'ko' ? 'bg-sky-500 text-white' : 'text-slate-300'}`}
            >
                KOR
            </button>
            <button
                onClick={() => setLanguage('id')}
                className={`px-3 py-1 text-sm font-semibold rounded-full transition-colors ${language === 'id' ? 'bg-sky-500 text-white' : 'text-slate-300'}`}
            >
                INA
            </button>
        </div>
    );
};

export default LanguageToggle;
