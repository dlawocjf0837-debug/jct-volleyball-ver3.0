import React, { useRef, useState, useEffect, useCallback } from 'react';

const COURT_COLORS = {
    red: '#dc2626',      // 공격 루트
    blue: '#2563eb',      // 수비 위치
    black: '#1e293b',
    yellow: '#facc15',    // 형광 노란
} as const;

type PenColor = keyof typeof COURT_COLORS;

interface Point {
    x: number;
    y: number;
}

interface Stroke {
    color: string;
    points: Point[];
}

interface TacticalBoardModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/** 배구 코트 비율 18m x 9m = 2:1 */
const COURT_ASPECT = 2;

export const TacticalBoardModal: React.FC<TacticalBoardModalProps> = ({ isOpen, onClose }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
    const [penColor, setPenColor] = useState<PenColor>('red');
    const isDrawingRef = useRef(false);

    const getCanvasPoint = useCallback((e: React.PointerEvent | PointerEvent): Point | null => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const clientX = 'clientX' in e ? e.clientX : (e as TouchEvent).touches?.[0]?.clientX ?? 0;
        const clientY = 'clientY' in e ? e.clientY : (e as TouchEvent).touches?.[0]?.clientY ?? 0;
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY,
        };
    }, []);

    const redraw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const allStrokes = [...strokes];
        if (currentStroke.length > 0) {
            allStrokes.push({ color: COURT_COLORS[penColor], points: currentStroke });
        }
        allStrokes.forEach((stroke) => {
            if (stroke.points.length < 2) return;
            ctx.strokeStyle = stroke.color;
            ctx.lineWidth = Math.max(2, canvas.width / 200);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
            for (let i = 1; i < stroke.points.length; i++) {
                ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
            }
            ctx.stroke();
        });
    }, [strokes, currentStroke, penColor]);

    useEffect(() => {
        redraw();
    }, [redraw]);

    useEffect(() => {
        if (!isOpen) return;
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;

        const resize = () => {
            const rect = container.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            const w = Math.floor(rect.width * dpr);
            const h = Math.floor(rect.height * dpr);
            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w;
                canvas.height = h;
                canvas.style.width = `${rect.width}px`;
                canvas.style.height = `${rect.height}px`;
                redraw();
            }
        };
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(container);
        return () => ro.disconnect();
    }, [isOpen, redraw]);

    const handlePointerDown = (e: React.PointerEvent) => {
        e.preventDefault();
        const pt = getCanvasPoint(e);
        if (!pt) return;
        isDrawingRef.current = true;
        setCurrentStroke([pt]);
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDrawingRef.current) return;
        const pt = getCanvasPoint(e);
        if (!pt) return;
        setCurrentStroke((prev) => [...prev, pt]);
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!isDrawingRef.current) return;
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
        isDrawingRef.current = false;
        setCurrentStroke((prev) => {
            if (prev.length > 0) {
                setStrokes((s) => [...s, { color: COURT_COLORS[penColor], points: prev }]);
            }
            return [];
        });
    };

    const handlePointerLeave = () => {
        if (isDrawingRef.current) {
            setCurrentStroke((prev) => {
                if (prev.length > 0) {
                    setStrokes((s) => [...s, { color: COURT_COLORS[penColor], points: prev }]);
                }
                return [];
            });
        }
        isDrawingRef.current = false;
    };

    const handleUndo = () => {
        setStrokes((s) => s.slice(0, -1));
        setCurrentStroke([]);
    };

    const handleClear = () => {
        setStrokes([]);
        setCurrentStroke([]);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black/80 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="전술판">
            <div className="flex-1 flex flex-col items-center justify-center p-4 min-h-0">
                <div className="w-full max-w-4xl flex-1 flex flex-col min-h-0 rounded-xl overflow-hidden border-2 border-amber-500/40 shadow-2xl">
                    {/* 코트 영역: 배구 코트 비율 2:1, 배경 디자인 */}
                    <div
                        ref={containerRef}
                        className="flex-1 min-h-[200px] relative overflow-hidden"
                        style={{
                            aspectRatio: `${COURT_ASPECT} / 1`,
                            maxHeight: 'calc(100vh - 180px)',
                            backgroundColor: '#c2410c',
                            backgroundImage: `
                                linear-gradient(90deg, transparent 0%, transparent calc(50% - 3px), #fff 50%, transparent calc(50% + 3px), transparent 100%),
                                linear-gradient(0deg, transparent 0%, transparent calc(16.66% - 2px), rgba(255,255,255,0.9) 16.66%, transparent calc(16.66% + 2px), transparent calc(83.33% - 2px), rgba(255,255,255,0.9) 83.33%, transparent calc(83.33% + 2px), transparent 100%),
                                linear-gradient(180deg, rgba(255,255,255,0.12) 0%, transparent 50%, rgba(0,0,0,0.08) 100%)
                            `,
                            backgroundSize: '100% 100%, 100% 100%, 100% 100%',
                            boxShadow: 'inset 0 0 0 4px rgba(255,255,255,0.4)',
                        }}
                    >
                        <canvas
                            ref={canvasRef}
                            className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
                            style={{ touchAction: 'none' }}
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            onPointerCancel={handlePointerUp}
                            onPointerLeave={handlePointerLeave}
                        />
                    </div>

                    {/* 도구 팔레트 */}
                    <div className="flex flex-wrap items-center justify-center gap-3 py-3 px-4 bg-slate-900/95 border-t border-slate-600">
                        <span className="text-slate-400 text-sm font-semibold mr-1">펜 색상</span>
                        {(Object.keys(COURT_COLORS) as PenColor[]).map((c) => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => setPenColor(c)}
                                className={`w-9 h-9 rounded-full border-2 transition-all ${penColor === c ? 'border-white scale-110 ring-2 ring-sky-400' : 'border-slate-600 hover:border-slate-500'}`}
                                style={{ backgroundColor: COURT_COLORS[c] }}
                                title={c === 'red' ? '공격 루트' : c === 'blue' ? '수비 위치' : c}
                            />
                        ))}
                        <div className="w-px h-8 bg-slate-600" />
                        <button
                            type="button"
                            onClick={handleUndo}
                            disabled={strokes.length === 0}
                            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 font-semibold text-sm min-h-[44px]"
                        >
                            ⏪ 되돌리기
                        </button>
                        <button
                            type="button"
                            onClick={handleClear}
                            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-red-600/80 text-slate-200 font-semibold text-sm min-h-[44px]"
                        >
                            🧹 전체 지우기
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-900 font-bold text-sm min-h-[44px]"
                        >
                            ❌ 닫기
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
