import React, { useEffect, useState } from 'react';

interface AutoSaveToastProps {
    show: boolean;
    onHide: () => void;
}

const AutoSaveToast: React.FC<AutoSaveToastProps> = ({ show, onHide }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (show) {
            setIsVisible(true);
            const timer = setTimeout(() => {
                setIsVisible(false);
                setTimeout(onHide, 300); // Wait for fade out animation
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [show, onHide]);

    if (!show && !isVisible) return null;

    return (
        <div 
            className={`fixed top-4 right-4 bg-green-600 text-white py-2 px-4 rounded-lg shadow-lg z-50 flex items-center gap-2 transition-all duration-300 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
            }`}
        >
            <span className="text-lg">✅</span>
            <span className="font-semibold text-sm">자동 저장됨</span>
        </div>
    );
};

export default AutoSaveToast;

