import React, { useEffect } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

const TOAST_AUTO_DISMISS_MS = 2500;

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
    useEffect(() => {
        if (!message) return;
        const timer = setTimeout(() => onClose(), TOAST_AUTO_DISMISS_MS);
        return () => clearTimeout(timer);
    }, [message, onClose]);

    const bgColor = type === 'success' ? 'bg-green-600' : 'bg-red-600';

    return (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 text-white py-2 px-6 rounded-lg shadow-lg animate-fade-in z-[9999] ${bgColor}`}>
            {message}
        </div>
    );
};

export default Toast;
