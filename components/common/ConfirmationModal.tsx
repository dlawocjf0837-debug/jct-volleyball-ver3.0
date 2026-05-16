import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
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
    /** CLUB 등 부모 transform/overflow 영향을 피하려면 body에 Portal 렌더 */
    usePortal?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm, title, message, confirmText, children, isConfirmDisabled, isCancelDisabled, usePortal = false }) => {
    const { t } = useTranslation();
    useEffect(() => {
        if (!isOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [isOpen]);
    if (!isOpen) return null;

    const modal = (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirmation-dialog-title"
        >
            <div
                className="bg-slate-900 rounded-lg shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto text-white border border-slate-700"
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

    if (usePortal && typeof document !== 'undefined') {
        return ReactDOM.createPortal(modal, document.body);
    }
    return modal;
};

export default ConfirmationModal;
