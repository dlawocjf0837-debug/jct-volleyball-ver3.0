import React, { useEffect } from 'react';

const EFFECT_DURATION_MS = 2000;

interface EffectPopupProps {
    id: number;
    effectType: 'SPIKE' | 'BLOCK';
    onEnd: () => void;
}

export const EffectPopup: React.FC<EffectPopupProps> = ({ effectType, onEnd }) => {
    useEffect(() => {
        const t = setTimeout(onEnd, EFFECT_DURATION_MS);
        return () => clearTimeout(t);
    }, [onEnd]);
    const text = effectType === 'SPIKE' ? '🔥 SUPER SPIKE 🔥' : '🧱 MONSTER BLOCK 🧱';
    return (
        <div className="fixed inset-0 flex items-center justify-center z-40 pointer-events-none">
            <span className="animate-effect-popup text-4xl sm:text-5xl md:text-6xl font-black text-white text-center drop-shadow-[0_0_20px_rgba(255,255,255,0.9)]">
                {text}
            </span>
        </div>
    );
};
