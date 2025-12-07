import React from 'react';
import { useTranslation } from '../hooks/useTranslation';

interface CommentaryGuideModalProps {
    onClose: () => void;
}

const commentaryKeys = [
    {
        titleKey: 'commentary_attack_success_title',
        phraseKeys: ['commentary_attack_success_1', 'commentary_attack_success_2', 'commentary_attack_success_3']
    },
    {
        titleKey: 'commentary_serve_ace_title',
        phraseKeys: ['commentary_serve_ace_1', 'commentary_serve_ace_2', 'commentary_serve_ace_3']
    },
    {
        titleKey: 'commentary_block_success_title',
        phraseKeys: ['commentary_block_success_1', 'commentary_block_success_2']
    },
    {
        titleKey: 'commentary_defense_success_title',
        phraseKeys: ['commentary_defense_success_1', 'commentary_defense_success_2']
    },
    {
        titleKey: 'commentary_fault_title',
        phraseKeys: ['commentary_fault_1', 'commentary_fault_2']
    },
    {
        titleKey: 'commentary_timeout_title',
        phraseKeys: ['commentary_timeout_1', 'commentary_timeout_2']
    },
];

const CommentaryGuideModal: React.FC<CommentaryGuideModalProps> = ({ onClose }) => {
    const { t } = useTranslation();
    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[9999] p-4 animate-fade-in"
            onClick={onClose}
        >
            <div 
                className="bg-slate-900 rounded-lg shadow-2xl p-6 w-full max-w-2xl text-white border border-slate-700 max-h-[85vh] overflow-y-auto relative flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4 sticky top-0 bg-slate-900 py-2 border-b border-slate-800 z-50">
                    <h2 className="text-xl font-bold text-[#00A3FF]">{t('commentary_guide_title')}</h2>
                    <button onClick={onClose} className="text-2xl font-bold text-slate-500 hover:text-white">&times;</button>
                </div>
                <div className="space-y-3">
                    {commentaryKeys.map((category, index) => (
                        <div key={index} className="bg-slate-800/50 p-3 rounded-lg">
                            <h3 className="font-bold text-base text-sky-300 mb-1">{t(category.titleKey)}</h3>
                            <ul className="list-disc list-inside space-y-1 text-slate-300 text-sm leading-relaxed">
                                {category.phraseKeys.map((phraseKey, pIndex) => (
                                    <li key={pIndex}>{t(phraseKey)}</li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CommentaryGuideModal;