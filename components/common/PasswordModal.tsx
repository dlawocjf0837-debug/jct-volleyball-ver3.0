import React, { useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';

interface PasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const PasswordModal: React.FC<PasswordModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const { t } = useTranslation();
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    if (!isOpen) {
        return null;
    }

    const handleConfirm = () => {
        if (password === '9999') {
            onSuccess();
            setPassword('');
            setError('');
        } else {
            setError(t('password_incorrect'));
            setPassword('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleConfirm();
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 animate-fade-in"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="password-dialog-title"
        >
            <div
                className="bg-slate-900 rounded-lg shadow-2xl p-6 w-full max-w-sm text-white border border-slate-700"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 id="password-dialog-title" className="text-2xl font-bold text-[#00A3FF] mb-4">{t('password_modal_title')}</h2>
                <p className="text-slate-300 mb-4">{t('password_modal_message')}</p>
                
                <input
                    type="password"
                    value={password}
                    onChange={(e) => {
                        setPassword(e.target.value);
                        if (error) setError('');
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={t('password_placeholder')}
                    className="w-full bg-slate-800 border border-slate-600 rounded-md p-3 text-center text-white text-lg focus:outline-none focus:ring-2 focus:ring-[#00A3FF]"
                    autoComplete="off"
                    autoFocus
                />
                {error && <p className="text-red-500 text-sm mt-2 text-center">{error}</p>}

                <div className="flex justify-end items-center gap-4 mt-6">
                    <button
                        onClick={onClose}
                        className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-6 rounded-lg transition duration-200"
                    >
                        {t('cancel')}
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="bg-[#00A3FF] hover:bg-[#0082cc] text-white font-bold py-2 px-6 rounded-lg transition duration-200"
                    >
                        {t('confirm')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PasswordModal;
