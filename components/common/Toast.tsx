import React, { useEffect } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const bgColor = type === 'success' ? 'bg-green-600' : 'bg-red-600';

    return (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 text-white py-2 px-6 rounded-lg shadow-lg animate-fade-in z-50 ${bgColor}`}>
            {message}
        </div>
    );
};

export default Toast;
