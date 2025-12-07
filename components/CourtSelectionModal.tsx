import React from 'react';

interface CourtSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectLocation: (location?: { x: number; y: number }) => void;
    teamName: string;
    teamColor: string;
}

const CourtSelectionModal: React.FC<CourtSelectionModalProps> = ({ isOpen, onClose, onSelectLocation, teamName, teamColor }) => {
    if (!isOpen) return null;

    const handleCourtClick = (e: React.MouseEvent<SVGSVGElement>) => {
        const svg = e.currentTarget;
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;

        const { x, y } = pt.matrixTransform(svg.getScreenCTM()?.inverse());
        
        // Normalize coordinates to a 100x100 grid (for one side of the court)
        const normalizedX = Math.max(0, Math.min(100, x));
        const normalizedY = Math.max(0, Math.min(100, y));

        onSelectLocation({ x: normalizedX, y: normalizedY });
    };

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 animate-fade-in"
            onClick={onClose}
        >
            <div 
                className="bg-slate-900 rounded-lg shadow-2xl p-6 w-full max-w-sm text-white border border-slate-700 flex flex-col items-center"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="text-center mb-4">
                    <h2 className="text-2xl font-bold text-[#00A3FF]">득점 위치 선택</h2>
                    <p className="text-lg" style={{ color: teamColor }}>{teamName}의 득점 위치를 코트에서 선택하세요.</p>
                </div>

                <div className="w-full max-w-[200px] aspect-[1/2] cursor-pointer">
                    <svg viewBox="0 0 100 200" onClick={handleCourtClick} className="w-full h-full">
                        <rect x="0" y="0" width="100" height="200" fill="#0f172a" stroke="#475569" strokeWidth="1" />
                        <line x1="0" y1="100" x2="100" y2="100" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2,2" />
                        <text x="50" y="50" textAnchor="middle" fill="#475569" fontSize="12">상대 코트</text>
                        <text x="50" y="150" textAnchor="middle" fill="#475569" fontSize="12">우리 코트</text>
                    </svg>
                </div>
                
                <p className="text-xs text-slate-500 mt-2">상대 코트 쪽에 득점 위치를 클릭하세요.</p>

                <div className="mt-4 pt-4 border-t border-slate-700 w-full flex flex-col items-center gap-3">
                    <button 
                        onClick={() => onSelectLocation(undefined)} 
                        className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-6 rounded-lg w-full"
                    >
                        범실 / 위치 없음
                    </button>
                     <button 
                        onClick={onClose}
                        className="text-slate-400 hover:text-white py-1 px-4"
                    >
                        취소
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CourtSelectionModal;