import React from 'react';
import { useTranslation } from '../../hooks/useTranslation';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    children?: React.ReactNode;
    isConfirmDisabled?: boolean;
    isCancelDisabled?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm, title, message, confirmText, children, isConfirmDisabled, isCancelDisabled }) => {
    const { t } = useTranslation();
    if (!isOpen) {
        return null;
    }

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 animate-fade-in"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirmation-dialog-title"
        >
            <div 
                className="bg-slate-900 rounded-lg shadow-2xl p-6 w-full max-w-md text-white border border-slate-700"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 id="confirmation-dialog-title" className="text-2xl font-bold text-[#00A3FF] mb-4">{title}</h2>
                <p className="text-slate-300">{message}</p>
                {children}
                <div className="flex justify-end items-center gap-4 mt-6">
                    <button 
                        onClick={onClose}
                        className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-6 rounded-lg transition duration-200 disabled:bg-slate-700 disabled:cursor-not-allowed"
                        disabled={isCancelDisabled}
                    >
                        {t('cancel')}
                    </button>
                    <button 
                        onClick={onConfirm}
                        className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-6 rounded-lg transition duration-200 disabled:bg-slate-700 disabled:cursor-not-allowed"
                        disabled={isConfirmDisabled}
                    >
                        {confirmText || t('confirm')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
