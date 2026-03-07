import React, { useEffect } from 'react';
import { useTranslation } from '../hooks/useTranslation';

interface TimeoutModalProps {
    timeLeft: number;
    onClose: () => void;
}

const TimeoutModal: React.FC<TimeoutModalProps> = ({ timeLeft, onClose }) => {
    const { t } = useTranslation();
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
            <div className="bg-slate-900 rounded-lg shadow-2xl p-8 w-full max-w-sm max-h-[90vh] overflow-y-auto text-white border-2 border-[#00A3FF] text-center">
                <h2 className="text-3xl font-bold text-[#00A3FF] mb-4">{t('timeout_title')}</h2>
                <p className="text-8xl font-mono font-extrabold mb-6">{timeLeft}</p>
                <button 
                    onClick={onClose}
                    className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-8 rounded-lg transition duration-200 text-lg"
                >
                    {t('close')}
                </button>
            </div>
        </div>
    );
};

export default TimeoutModal;
