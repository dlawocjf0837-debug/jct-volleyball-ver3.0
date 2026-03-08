import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import localforage from 'localforage';
import type { TeamSet, SavedOpponentTeam, SavedTeamInfo, MatchState } from '../types';

const SAVED_TACTICS_KEY = 'jive_saved_tactics_list';
const TACTICAL_MEMOS_KEY = 'jive_tactical_memos';
const COURT_COLORS = { red: '#dc2626', blue: '#2563eb', black: '#1e293b', yellow: '#facc15' } as const;
type PenColor = keyof typeof COURT_COLORS | 'eraser';

interface Point { x: number; y: number; }
interface Stroke { color: string; points: Point[]; }
interface Token { id: string; label: string; team: 'red' | 'blue' | 'ball'; x: number; y: number; name?: string; memo?: string; }
/** 명단 적용 시 사용하는 선수 단위 데이터 */
interface PlayerSlot { id: string; name: string; backNumber?: string; memo?: string; }
interface SavedTactics {
    tokens: Token[];
    strokes: Stroke[];
    ruleMode: 6 | 9;
    eraseStrokes?: Point[][];
    selectedTeamRed?: { name: string; setId?: string; memo?: string };
    selectedTeamBlue?: { name: string; setId?: string; memo?: string };
}

interface Props { isOpen: boolean; onClose: () => void; appMode?: 'CLASS' | 'CLUB'; /** 스코어보드 내부에서 열릴 때 현재 경기 명단 자동 세팅용 */ initialMatchState?: MatchState | null; }

const ASPECT = 2;
/** 자석 크기: 가독성 향상을 위해 64px(w-16) */
const TOKEN_SIZE = 64;
const INITIAL_BENCH = 2;

/** 후보 추가 시 절대 중복되지 않는 고유 id 생성 */
function uniqueBenchId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/** 팀 이름 부분 제거 후 '1번' 또는 학생 이름만 반환 (자석 라벨용) */
function stripTeamNameFromLabel(raw: string, teamName?: string): string {
    let s = (raw ?? '').trim();
    if (teamName) s = s.replace(new RegExp(`^${teamName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`), '');
    s = s.replace(/^.+팀\s*/, '').trim();
    return s || '?';
}

/** 부모 코트 기준 절대 좌표(%). Red: x 20~40%, Blue: x 60~80%. 벤치: y 85~90%, x 30~70% 중앙부. */
/** 6인제: Red 진영 2열 3행 (앞3/뒤3), x 20~40% */
const POS_6 = [
    { x: 25, y: 20 }, { x: 30, y: 20 }, { x: 35, y: 20 },   // 앞열
    { x: 25, y: 55 }, { x: 30, y: 55 }, { x: 35, y: 55 },   // 뒤열
];
const POS_6_OPP = [
    { x: 65, y: 20 }, { x: 70, y: 20 }, { x: 75, y: 20 },
    { x: 65, y: 55 }, { x: 70, y: 55 }, { x: 75, y: 55 },
];
/** 9인제: Red 진영 3열 3행, x 20~40% */
const POS_9 = [
    { x: 25, y: 16 }, { x: 30, y: 16 }, { x: 35, y: 16 },   // 앞열
    { x: 25, y: 42 }, { x: 30, y: 42 }, { x: 35, y: 42 },   // 중간열
    { x: 25, y: 68 }, { x: 30, y: 68 }, { x: 35, y: 68 },   // 뒤열
];
const POS_9_OPP = [
    { x: 65, y: 16 }, { x: 70, y: 16 }, { x: 75, y: 16 },
    { x: 65, y: 42 }, { x: 70, y: 42 }, { x: 75, y: 42 },
    { x: 65, y: 68 }, { x: 70, y: 68 }, { x: 75, y: 68 },
];
const LABELS_6 = ['S', 'A', 'A', 'A', 'L', 'L'];
const LABELS_9 = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** 벤치: y 88% 고정(안전지대, 창 크기 변화 시 잘림/겹침 방지). Red: 20+5*i, Blue: 80-5*i */
const BENCH_Y = 88;

function benchPos(n: number, side: 'left' | 'right'): { x: number; y: number }[] {
    const arr: { x: number; y: number }[] = [];
    for (let i = 0; i < n; i++) {
        const x = side === 'left' ? 20 + i * 5 : 80 - i * 5;
        arr.push({ x: Math.max(2, Math.min(98, x)), y: BENCH_Y });
    }
    return arr;
}

function buildTokens(ruleMode: 6 | 9, benchRed: number, benchBlue: number): Token[] {
    const t: Token[] = [];
    const rPos = ruleMode === 6 ? POS_6 : POS_9;
    const bPos = ruleMode === 6 ? POS_6_OPP : POS_9_OPP;
    const rLab = ruleMode === 6 ? LABELS_6 : LABELS_9;
    const bLab = ruleMode === 6 ? LABELS_6 : LABELS_9;
    rPos.forEach((p, i) => t.push({ id: `r${i + 1}`, label: rLab[i] ?? '', team: 'red', x: p.x, y: p.y }));
    bPos.forEach((p, i) => t.push({ id: `b${i + 1}`, label: bLab[i] ?? '', team: 'blue', x: p.x, y: p.y }));
    benchPos(benchRed, 'left').forEach((p, i) => t.push({ id: `r_bench_${i}`, label: `${(ruleMode === 6 ? 7 : 10) + i}`, team: 'red', x: p.x, y: p.y }));
    benchPos(benchBlue, 'right').forEach((p, i) => t.push({ id: `b_bench_${i}`, label: `${(ruleMode === 6 ? 7 : 10) + i}`, team: 'blue', x: p.x, y: p.y }));
    t.push({ id: 'ball', label: '', team: 'ball', x: 50, y: 90 });
    return t;
}

export const TacticalBoardModal: React.FC<Props> = ({ isOpen, onClose, appMode = 'CLASS', initialMatchState }) => {
    const { settings, teamSets, opponentTeams, leagueStandingsList, saveTeamSets, showToast } = useData();
    const coordRef = useRef<HTMLDivElement>(null);
    const courtRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
    const [penColor, setPenColor] = useState<PenColor>('red');
    const [ruleMode, setRuleMode] = useState<6 | 9>(6);
    const [benchRed, setBenchRed] = useState(INITIAL_BENCH);
    const [benchBlue, setBenchBlue] = useState(INITIAL_BENCH);
    const [tokens, setTokens] = useState<Token[]>(() => buildTokens(6, INITIAL_BENCH, INITIAL_BENCH));
    const [editId, setEditId] = useState<string | null>(null);
    const [editVal, setEditVal] = useState('');
    const [editMemoVisible, setEditMemoVisible] = useState(false);
    const [editMemo, setEditMemo] = useState('');
    const [loadOpen, setLoadOpen] = useState(false);
    const [rosterOpen, setRosterOpen] = useState(false);
    const [catRed, setCatRed] = useState('');
    const [catBlue, setCatBlue] = useState('');
    const [saveOpen, setSaveOpen] = useState(false);
    const [saveName, setSaveName] = useState('');
    const [savedMap, setSavedMap] = useState<Record<string, SavedTactics>>({});
    const [selectedTeamRed, setSelectedTeamRed] = useState<{ name: string; setId?: string; memo?: string } | null>(null);
    const [selectedTeamBlue, setSelectedTeamBlue] = useState<{ name: string; setId?: string; memo?: string } | null>(null);
    const [pendingRedTeamName, setPendingRedTeamName] = useState('');
    const [pendingBlueTeamName, setPendingBlueTeamName] = useState('');
    const [undoStack, setUndoStack] = useState<Array<{ type: 's'; d: Stroke } | { type: 't'; d: Token[] }>>([]);
    const dragRef = useRef<string | null>(null);
    const isDrawingRef = useRef(false);
    const offsetRef = useRef({ dx: 0, dy: 0 });
    const prevRef = useRef<Token[]>([]);
    const lastClickRef = useRef<{ id: string; t: number } | null>(null);

    const rule = appMode === 'CLUB' && [6, 9].includes(Number(settings?.volleyballRuleSystem)) ? (settings!.volleyballRuleSystem as 6 | 9) : 9;
    const leagueItems = leagueStandingsList?.list ?? [];
    const clubTeams = appMode === 'CLUB' ? (teamSets ?? []) : [];
    const cats = useMemo(() => {
        if (appMode === 'CLASS') return [...new Set(teamSets.map((s) => s.className))].sort();
        const comps = [...new Set(clubTeams.map((t: TeamSet & { competition?: string; groupName?: string }) => t.competition || t.groupName || t.className))].filter(Boolean);
        return [...comps.sort(), ...leagueItems.map((d) => d.tournamentName).filter((n) => !comps.includes(n)), ...(opponentTeams.length ? ['상대팀'] : [])];
    }, [appMode, teamSets, leagueItems, opponentTeams, clubTeams]);

    const getPt = useCallback((clientX: number, clientY: number) => {
        const el = coordRef.current;
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: ((clientX - r.left) / r.width) * 100, y: ((clientY - r.top) / r.height) * 100 };
    }, []);

    const getCanvasPt = useCallback((e: React.PointerEvent | PointerEvent) => {
        const c = canvasRef.current;
        if (!c) return null;
        const r = c.getBoundingClientRect();
        const cx = 'clientX' in e ? e.clientX : (e as TouchEvent).touches?.[0]?.clientX ?? 0;
        const cy = 'clientY' in e ? e.clientY : (e as TouchEvent).touches?.[0]?.clientY ?? 0;
        return { x: ((cx - r.left) / r.width) * c.width, y: ((cy - r.top) / r.height) * c.height };
    }, []);

    const [eraseStrokes, setEraseStrokes] = useState<Point[][]>([]);

    const redraw = useCallback(() => {
        const c = canvasRef.current;
        if (!c) return;
        const ctx = c.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, c.width, c.height);
        const drawStrokes = penColor === 'eraser' ? strokes : [...strokes, ...(currentStroke.length > 0 ? [{ color: COURT_COLORS[penColor as keyof typeof COURT_COLORS], points: currentStroke }] : [])];
        drawStrokes.forEach((s) => {
            if (s.points.length < 2) return;
            ctx.strokeStyle = s.color;
            ctx.lineWidth = Math.max(2, c.width / 150);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalCompositeOperation = 'source-over';
            ctx.beginPath();
            ctx.moveTo(s.points[0].x, s.points[0].y);
            s.points.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
            ctx.stroke();
        });
        [...eraseStrokes, ...(penColor === 'eraser' && currentStroke.length > 0 ? [currentStroke] : [])].forEach((pts) => {
            if (pts.length < 2) return;
            ctx.strokeStyle = '#FF9248';
            ctx.lineWidth = Math.max(12, c.width / 80);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalCompositeOperation = 'destination-out';
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            pts.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
            ctx.stroke();
            ctx.globalCompositeOperation = 'source-over';
        });
    }, [strokes, currentStroke, penColor, eraseStrokes]);

    useEffect(() => { redraw(); }, [redraw]);

    useEffect(() => {
        if (!isOpen || !courtRef.current || !canvasRef.current) return;
        const el = courtRef.current;
        const c = canvasRef.current;
        const resize = () => {
            const r = el.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            const w = Math.floor(r.width * dpr);
            const h = Math.floor(r.height * dpr);
            if (c.width !== w || c.height !== h) {
                c.width = w;
                c.height = h;
                c.style.width = `${r.width}px`;
                c.style.height = `${r.height}px`;
                redraw();
            }
        };
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(el);
        return () => ro.disconnect();
    }, [isOpen, redraw]);

    useEffect(() => {
        if (isOpen) {
            const prev = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => { document.body.style.overflow = prev; };
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            setRuleMode(rule);
            setBenchRed(INITIAL_BENCH);
            setBenchBlue(INITIAL_BENCH);
            setTokens(buildTokens(rule, INITIAL_BENCH, INITIAL_BENCH));
            setStrokes([]);
            setEraseStrokes([]);
            setCurrentStroke([]);
            setUndoStack([]);
            setEditId(null);
            setEditMemoVisible(false);
            setLoadOpen(false);
            setRosterOpen(false);
            setCatRed('');
            setCatBlue('');
            setSelectedTeamRed(null);
            setSelectedTeamBlue(null);
            dragRef.current = null;
        }
    }, [isOpen, rule, appMode]);

    const applyMode = useCallback((m: 6 | 9) => { setRuleMode(m); setTokens(buildTokens(m, benchRed, benchBlue)); }, [benchRed, benchBlue]);
    const resetTokens = useCallback(() => { setTokens(buildTokens(ruleMode, benchRed, benchBlue)); setStrokes([]); setEraseStrokes([]); setCurrentStroke([]); setUndoStack([]); }, [ruleMode, benchRed, benchBlue]);

    const courtCount = ruleMode === 6 ? 6 : 9;
    const redBenchCount = tokens.filter((t) => t.team === 'red').length - courtCount;
    const blueBenchCount = tokens.filter((t) => t.team === 'blue').length - courtCount;
    const redBenchFull = redBenchCount >= 6;
    const blueBenchFull = blueBenchCount >= 6;

    const addBench = useCallback((side: 'red' | 'blue') => {
        setTokens((prev) => {
            const court = ruleMode === 6 ? 6 : 9;
            const ball = prev.find((t) => t.id === 'ball');
            const rest = prev.filter((t) => t.id !== 'ball');
            const isRed = side === 'red';
            const benchTokens = rest.filter((t) => t.team === side && t.y >= 80);
            const benchCount = benchTokens.length;
            if (benchCount >= 6) return prev;
            const newX = isRed ? 20 + (benchCount * 5) : 80 - (benchCount * 5);
            const newY = BENCH_Y;
            const newToken: Token = {
                id: uniqueBenchId(isRed ? 'r_bench' : 'b_bench'),
                label: '후보',
                team: side,
                x: newX,
                y: newY,
            };
            if (ball) return [...rest, newToken, ball];
            return [...rest, newToken];
        });
        if (side === 'red') setBenchRed((b) => Math.min(6, b + 1));
        else setBenchBlue((b) => Math.min(6, b + 1));
    }, [ruleMode]);

    const finishStroke = useCallback(() => {
        setCurrentStroke((p) => {
            if (p.length > 0) {
                if (penColor === 'eraser') {
                    setEraseStrokes((e) => [...e, p]);
                } else {
                    const s = { color: COURT_COLORS[penColor as keyof typeof COURT_COLORS], points: p };
                    setStrokes((x) => [...x, s]);
                    setUndoStack((h) => [...h.slice(-49), { type: 's', d: s }]);
                }
            }
            return [];
        });
    }, [penColor]);

    const handleCanvasDown = (e: React.PointerEvent) => { if (dragRef.current || editId) return; e.preventDefault(); const pt = getCanvasPt(e); if (!pt) return; isDrawingRef.current = true; if (penColor === 'eraser') setCurrentStroke([pt]); else setCurrentStroke([pt]); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); };
    const handleCanvasMove = (e: React.PointerEvent) => { if (!isDrawingRef.current) return; const pt = getCanvasPt(e); if (pt) setCurrentStroke((p) => [...p, pt]); };
    const handleCanvasUp = (e: React.PointerEvent) => { (e.target as HTMLElement).releasePointerCapture?.(e.pointerId); isDrawingRef.current = false; finishStroke(); };
    const handleCanvasLeave = () => { if (isDrawingRef.current) { isDrawingRef.current = false; finishStroke(); } };

    const handleTokenDown = (e: React.PointerEvent, id: string) => { e.preventDefault(); e.stopPropagation(); if (editId) return; const pt = getPt(e.clientX, e.clientY); if (!pt) return; const t = tokens.find((x) => x.id === id); if (!t) return; prevRef.current = tokens.map((x) => ({ ...x })); dragRef.current = id; offsetRef.current = { dx: t.x - pt.x, dy: t.y - pt.y }; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); };
    const handleTokenMove = (e: React.PointerEvent, id: string) => { if (dragRef.current !== id) return; const pt = getPt(e.clientX, e.clientY); if (pt) setTokens((prev) => prev.map((t) => t.id === id ? { ...t, x: Math.max(0, Math.min(100, pt.x + offsetRef.current.dx)), y: Math.max(0, Math.min(100, pt.y + offsetRef.current.dy)) } : t)); };
    const handleTokenUp = (e: React.PointerEvent, id: string) => {
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
        if (dragRef.current === id) {
            const prev = prevRef.current;
            const curr = tokens.find((t) => t.id === id);
            const p = prev.find((t) => t.id === id);
            if (prev.length && p && curr && (p.x !== curr.x || p.y !== curr.y)) setUndoStack((h) => [...h.slice(-49), { type: 't', d: prev }]);
            const now = Date.now();
            const last = lastClickRef.current;
            if (last?.id === id && now - last.t < 400) {
                const tok = tokens.find((x) => x.id === id);
                if (tok && tok.team !== 'ball') {
                    setEditId(id);
                    setEditVal(tok.label);
                    const side = tok.team;
                    const sel = side === 'red' ? selectedTeamRed : selectedTeamBlue;
                    setEditMemo(tok.memo ?? sel?.memo ?? '');
                    setEditMemoVisible(false);
                }
                lastClickRef.current = null;
            } else lastClickRef.current = { id, t: now };
        }
        dragRef.current = null;
    };


    const saveMemoForTeam = useCallback(async (side: 'red' | 'blue', memo: string, sel: { name: string; setId?: string } | null) => {
        if (!sel?.name) return;
        if (appMode === 'CLASS' && sel.setId) {
            const newTeamSets = teamSets.map((set) => {
                if (set.id !== sel.setId) return set;
                return { ...set, teams: set.teams.map((t) => (t.teamName === sel.name ? { ...t, memo: memo || undefined } : t)) };
            });
            await saveTeamSets(newTeamSets);
        } else {
            const map = (await localforage.getItem(TACTICAL_MEMOS_KEY) as Record<string, string> | null) ?? {};
            const key = `${side}_${sel.name}`;
            if (memo) map[key] = memo; else delete map[key];
            await localforage.setItem(TACTICAL_MEMOS_KEY, map);
        }
    }, [appMode, teamSets, saveTeamSets]);

    const handleEditOk = async () => {
        if (!editId) return;
        const tok = tokens.find((t) => t.id === editId);
        const side = tok?.team === 'red' ? 'red' : 'blue';
        const sel = side === 'red' ? selectedTeamRed : selectedTeamBlue;
        const v = editVal.trim().slice(0, 6) || '?';
        setTokens((prev) => prev.map((t) => (t.id === editId ? { ...t, label: v } : t)));
        const memo = editMemo.trim();
        if (side === 'red') setSelectedTeamRed((p) => (p ? { ...p, memo: memo || undefined } : null));
        else setSelectedTeamBlue((p) => (p ? { ...p, memo: memo || undefined } : null));
        await saveMemoForTeam(side, memo, sel);
        showToast?.('메모가 성공적으로 저장되었습니다.', 'success');
        setEditId(null);
        setEditVal('');
        setEditMemo('');
        setEditMemoVisible(false);
    };

    const handleUndo = () => { if (undoStack.length === 0) return; const last = undoStack[undoStack.length - 1]; if (last.type === 's') { setStrokes((s) => s.slice(0, -1)); setCurrentStroke([]); } else setTokens(last.d); setUndoStack((h) => h.slice(0, -1)); };

    const getTeamsForCat = (cat: string): { set?: TeamSet; team: SavedTeamInfo; isOpp?: SavedOpponentTeam }[] => {
        const out: { set?: TeamSet; team: SavedTeamInfo; isOpp?: SavedOpponentTeam }[] = [];
        if (appMode === 'CLASS') {
            teamSets.filter((s) => s.className === cat).forEach((set) => set.teams.forEach((team) => out.push({ set, team })));
            return out;
        }
        if (cat === '상대팀') {
            opponentTeams.forEach((opp) => out.push({ team: { teamName: opp.name, captainId: '', playerIds: [] } as SavedTeamInfo, isOpp: opp }));
            return out;
        }
        const matchingSets = (teamSets ?? []).filter((s) => s.className === cat);
        if (matchingSets.length > 0) {
            matchingSets.forEach((set) => set.teams.forEach((team) => out.push({ set, team })));
            return out;
        }
        const ld = leagueItems.find((d) => d.tournamentName === cat);
        if (ld) ld.teams.forEach((tn) => {
            const opp = opponentTeams.find((o) => o.name === tn);
            out.push(opp ? { team: { teamName: tn, captainId: '', playerIds: [] } as SavedTeamInfo, isOpp: opp } : { team: { teamName: tn, captainId: '', playerIds: [] } as SavedTeamInfo });
        });
        return out;
    };

    /** 명단 적용: 해당 진영 기존 자석 전부 제거 후, 선수 배열로 코트(6/9인)+벤치 자석 새로 생성하여 상태 갱신 */
    const applyTeamToSide = useCallback((side: 'red' | 'blue', players: PlayerSlot[], teamName: string, setId?: string, memo?: string) => {
        const courtCount = ruleMode === 6 ? 6 : 9;
        const courtPos = side === 'red' ? (ruleMode === 6 ? POS_6 : POS_9) : (ruleMode === 6 ? POS_6_OPP : POS_9_OPP);
        const benchCount = Math.max(0, players.length - courtCount);
        const benchPositions = benchPos(benchCount, side === 'red' ? 'left' : 'right');

        const newTokens: Token[] = players.map((p, i) => {
            const isCourt = i < courtCount;
            const { x, y } = isCourt ? courtPos[i]! : benchPositions[i - courtCount]!;
            const rawLabel = (p.name ?? (p.backNumber ? `${p.backNumber}번` : '')).trim();
            const label = stripTeamNameFromLabel(rawLabel, teamName) || (p.backNumber ? `${p.backNumber}번` : '?');
            return {
                id: `${side}_${p.id}_${i}`,
                label,
                team: side,
                x,
                y,
                name: p.name,
                memo: p.memo,
            };
        });

        setTokens((prev) => {
            const otherAndBall = prev.filter((t) => t.team !== side && t.team !== 'ball');
            const ball = prev.find((t) => t.id === 'ball') ?? { id: 'ball', label: '', team: 'ball' as const, x: 50, y: 90 };
            return [...otherAndBall, ...newTokens, ball];
        });
        if (side === 'red') {
            setBenchRed(Math.min(6, Math.max(0, benchCount)));
            setSelectedTeamRed({ name: teamName, setId, memo });
        } else {
            setBenchBlue(Math.min(6, Math.max(0, benchCount)));
            setSelectedTeamBlue({ name: teamName, setId, memo });
        }
    }, [ruleMode]);

    /** 명단 아이템에서 선수 목록·팀 메타만 반환 (setTokens 호출 없음). 적용은 applyRosterAndClose에서 한 번에 수행 */
    const getTeamDataForItem = async (item: { set?: TeamSet; team: SavedTeamInfo; isOpp?: SavedOpponentTeam }, side: 'red' | 'blue'): Promise<{ playerSlots: PlayerSlot[]; teamName: string; setId?: string; memo?: string } | null> => {
        if (!item?.team) return null;
        if (item.set && item.team) {
            const set = item.set;
            const team = item.team;
            const playerSlots: PlayerSlot[] = (team.playerIds ?? [])
                .map((pid) => set.players?.[pid])
                .filter(Boolean)
                .map((p: { id?: string; originalName?: string; studentNumber?: string; memo?: string }, i: number) => ({
                    id: p.id ?? `p${i}`,
                    name: p.originalName ?? '?',
                    backNumber: p.studentNumber ? String(p.studentNumber).trim() : undefined,
                    memo: p.memo,
                }));
            return { playerSlots, teamName: team.teamName, setId: set.id, memo: team.memo };
        }
        if (item.isOpp) {
            const opp = item.isOpp;
            const playerSlots: PlayerSlot[] = (opp.players ?? []).map((p, i) => ({
                id: `opp_${opp.id}_${i}`,
                name: p.name ?? '?',
                backNumber: p.number ? String(p.number).trim() : undefined,
                memo: p.memo,
            }));
            const map = (await localforage.getItem(TACTICAL_MEMOS_KEY) as Record<string, string> | null) ?? {};
            const memo = map[`${side}_${opp.name}`];
            return { playerSlots, teamName: opp.name, memo };
        }
        const teamName = item.team.teamName;
        const opp = opponentTeams.find((o) => o.name === teamName);
        if (opp) return getTeamDataForItem({ team: { teamName: opp.name, captainId: '', playerIds: [] } as SavedTeamInfo, isOpp: opp }, side);
        const map = (await localforage.getItem(TACTICAL_MEMOS_KEY) as Record<string, string> | null) ?? {};
        const memo = map[`${side}_${teamName}`];
        const fromSet = teamSets.flatMap((s) => s.teams.filter((t) => t.teamName === teamName).map((t) => ({ set: s, team: t })))[0];
        if (fromSet) return getTeamDataForItem({ set: fromSet.set, team: fromSet.team }, side);
        return { playerSlots: [{ id: 'league', name: teamName, backNumber: '' }], teamName, memo };
    };

    const loadTeamSet = async (set: TeamSet, team: SavedTeamInfo, side: 'red' | 'blue') => {
        const data = await getTeamDataForItem({ set, team }, side);
        if (data) applyTeamToSide(side, data.playerSlots, data.teamName, data.setId, data.memo);
    };

    const loadOpponent = async (opp: SavedOpponentTeam, side: 'red' | 'blue') => {
        const data = await getTeamDataForItem({ team: { teamName: opp.name, captainId: '', playerIds: [] } as SavedTeamInfo, isOpp: opp }, side);
        if (data) applyTeamToSide(side, data.playerSlots, data.teamName, data.setId, data.memo);
    };

    const loadLeagueTeam = async (teamName: string, side: 'red' | 'blue') => {
        const opp = opponentTeams.find((o) => o.name === teamName);
        if (opp) await loadOpponent(opp, side);
        else {
            const data = await getTeamDataForItem({ team: { teamName, captainId: '', playerIds: [] } as SavedTeamInfo }, side);
            if (data) applyTeamToSide(side, data.playerSlots, data.teamName, data.setId, data.memo);
        }
    };

    const handleTeamSelect = async (item: { set?: TeamSet; team: SavedTeamInfo; isOpp?: SavedOpponentTeam }, side: 'red' | 'blue') => {
        if (item.set && item.team) await loadTeamSet(item.set, item.team, side);
        else if (item.isOpp) await loadOpponent(item.isOpp, side);
        else await loadLeagueTeam(item.team.teamName, side);
    };

    const teamsRed = getTeamsForCat((catRed || cats[0]) ?? '');
    const teamsBlue = getTeamsForCat((catBlue || cats[0]) ?? '');

    useEffect(() => {
        if (rosterOpen) {
            setPendingRedTeamName(selectedTeamRed?.name ?? '');
            setPendingBlueTeamName(selectedTeamBlue?.name ?? '');
        }
    }, [rosterOpen, selectedTeamRed?.name, selectedTeamBlue?.name]);

    /** 스코어보드 내부에서 열릴 때: 현재 경기 양 팀 명단을 코트/벤치에 즉시 자동 세팅 */
    useEffect(() => {
        if (!isOpen || !initialMatchState?.teamA?.players || !initialMatchState?.teamB?.players) return;
        const toSlots = (team: { players: Record<string, { id?: string; originalName?: string; studentNumber?: string; memo?: string }>; onCourtPlayerIds?: string[]; benchPlayerIds?: string[] }): PlayerSlot[] => {
            const onCourt = team.onCourtPlayerIds ?? [];
            const bench = team.benchPlayerIds ?? [];
            const order = [...onCourt, ...bench];
            return order.map((pid) => {
                const p = team.players[pid];
                return p ? { id: p.id ?? pid, name: (p.originalName ?? '?').trim() || '?', backNumber: p.studentNumber ? String(p.studentNumber).trim() : undefined, memo: p.memo } : { id: pid, name: '?', backNumber: undefined };
            });
        };
        const redSlots = toSlots(initialMatchState.teamA);
        const blueSlots = toSlots(initialMatchState.teamB);
        if (redSlots.length === 0 && blueSlots.length === 0) return;
        const courtCount = ruleMode === 6 ? 6 : 9;
        const playersToTokens = (players: PlayerSlot[], side: 'red' | 'blue', teamName: string): Token[] => {
            const safe = players ?? [];
            const courtPos = side === 'red' ? (ruleMode === 6 ? POS_6 : POS_9) : (ruleMode === 6 ? POS_6_OPP : POS_9_OPP);
            return safe.map((p, i) => {
                const isCourt = i < courtCount;
                const benchIndex = i - courtCount;
                const x = isCourt ? (courtPos[i]?.x ?? 50) : (side === 'red' ? 20 + (benchIndex * 5) : 80 - (benchIndex * 5));
                const y = isCourt ? (courtPos[i]?.y ?? 50) : BENCH_Y;
                const rawLabel = (p.name ?? (p.backNumber ? `${p.backNumber}번` : '')).trim();
                const label = stripTeamNameFromLabel(rawLabel, teamName) || (p.backNumber ? `${p.backNumber}번` : '?');
                return { id: `${side}_${p.id}_${i}`, label, team: side, x, y, name: p.name, memo: p.memo };
            });
        };
        const newRed = playersToTokens(redSlots, 'red', initialMatchState.teamA.name);
        const newBlue = playersToTokens(blueSlots, 'blue', initialMatchState.teamB.name);
        const ball = { id: 'ball', label: '', team: 'ball' as const, x: 50, y: 90 };
        setTokens([...newRed, ...newBlue, ball]);
        if (redSlots.length > 0) setBenchRed(Math.min(6, Math.max(0, redSlots.length - courtCount)));
        if (blueSlots.length > 0) setBenchBlue(Math.min(6, Math.max(0, blueSlots.length - courtCount)));
        setSelectedTeamRed(redSlots.length > 0 ? { name: initialMatchState.teamA.name } : null);
        setSelectedTeamBlue(blueSlots.length > 0 ? { name: initialMatchState.teamB.name } : null);
    }, [isOpen, !!initialMatchState, ruleMode]);

    const applyRosterAndClose = async (e?: React.FormEvent) => {
        e?.preventDefault?.();
        const redTeam = pendingRedTeamName ? teamsRed.find((t) => t.team.teamName === pendingRedTeamName) : null;
        const blueTeam = pendingBlueTeamName ? teamsBlue.find((t) => t.team.teamName === pendingBlueTeamName) : null;
        const selectedTeam = { red: pendingRedTeamName ?? null, blue: pendingBlueTeamName ?? null };
        console.log('명단 적용 시도 - 선택된 팀:', selectedTeam);

        const courtCount = ruleMode === 6 ? 6 : 9;
        const redData = redTeam ? await getTeamDataForItem(redTeam, 'red') : null;
        const blueData = blueTeam ? await getTeamDataForItem(blueTeam, 'blue') : null;

        const playersToTokens = (players: PlayerSlot[], side: 'red' | 'blue', teamName: string): Token[] => {
            const safe = players ?? [];
            const courtPos = side === 'red' ? (ruleMode === 6 ? POS_6 : POS_9) : (ruleMode === 6 ? POS_6_OPP : POS_9_OPP);
            return safe.map((p, i) => {
                const isCourt = i < courtCount;
                const benchIndex = i - courtCount;
                const x = isCourt ? (courtPos[i]?.x ?? 50) : (side === 'red' ? 20 + (benchIndex * 5) : 80 - (benchIndex * 5));
                const y = isCourt ? (courtPos[i]?.y ?? 50) : BENCH_Y;
                const rawLabel = (p.name ?? (p.backNumber ? `${p.backNumber}번` : '')).trim();
                const label = stripTeamNameFromLabel(rawLabel, teamName) || (p.backNumber ? `${p.backNumber}번` : '?');
                return {
                    id: `${side}_${p.id}_${i}`,
                    label,
                    team: side,
                    x,
                    y,
                    name: p.name,
                    memo: p.memo,
                };
            });
        };

        const newRedTokens = redData ? playersToTokens(redData.playerSlots, 'red', redData.teamName) : [];
        const newBlueTokens = blueData ? playersToTokens(blueData.playerSlots, 'blue', blueData.teamName) : [];
        const newTokens = { red: newRedTokens, blue: newBlueTokens };
        console.log('생성된 새 자석들:', newTokens);

        setTokens((prev) => {
            const otherRed = redData ? [] : prev.filter((t) => t.team === 'red');
            const otherBlue = blueData ? [] : prev.filter((t) => t.team === 'blue');
            const redPart = redData ? newRedTokens : otherRed;
            const bluePart = blueData ? newBlueTokens : otherBlue;
            const ball = prev.find((t) => t.id === 'ball') ?? { id: 'ball', label: '', team: 'ball' as const, x: 50, y: 90 };
            return [...redPart, ...bluePart, ball];
        });

        if (redData) {
            const benchCount = Math.max(0, (redData.playerSlots?.length ?? 0) - courtCount);
            setBenchRed(Math.min(6, Math.max(0, benchCount)));
            setSelectedTeamRed({ name: redData.teamName, setId: redData.setId, memo: redData.memo });
        }
        if (blueData) {
            const benchCount = Math.max(0, (blueData.playerSlots?.length ?? 0) - courtCount);
            setBenchBlue(Math.min(6, Math.max(0, benchCount)));
            setSelectedTeamBlue({ name: blueData.teamName, setId: blueData.setId, memo: blueData.memo });
        }
        setRosterOpen(false);
    };

    const openSave = () => { setSaveName(''); setSaveOpen(true); };
    const doSave = async () => {
        const name = saveName.trim().slice(0, 30);
        if (!name) return;
        try {
            const map = (await localforage.getItem(SAVED_TACTICS_KEY) as Record<string, SavedTactics> | null) ?? {};
            map[name] = { tokens, strokes, ruleMode, eraseStrokes, selectedTeamRed: selectedTeamRed ?? undefined, selectedTeamBlue: selectedTeamBlue ?? undefined };
            await localforage.setItem(SAVED_TACTICS_KEY, map);
            setSaveOpen(false);
            setSaveName('');
            showToast?.('전술이 저장되었습니다.', 'success');
        } catch {
            showToast?.('저장에 실패했습니다.', 'error');
        }
    };

    const openLoad = async () => {
        try {
            const map = (await localforage.getItem(SAVED_TACTICS_KEY) as Record<string, SavedTactics> | null) ?? {};
            setSavedMap(map);
            setLoadOpen(true);
        } catch {
            showToast?.('불러오기에 실패했습니다.', 'error');
        }
    };
    const doLoad = (name: string) => {
        const d = savedMap[name];
        if (!d?.tokens) return;
        setTokens(d.tokens);
        setStrokes(d.strokes ?? []);
        setEraseStrokes(d.eraseStrokes ?? []);
        setRuleMode(d.ruleMode ?? 6);
        setCurrentStroke([]);
        if (d.selectedTeamRed) setSelectedTeamRed(d.selectedTeamRed);
        if (d.selectedTeamBlue) setSelectedTeamBlue(d.selectedTeamBlue);
        setLoadOpen(false);
        showToast?.('전술을 불러왔습니다.', 'success');
    };

    const clearStrokes = () => { setStrokes([]); setEraseStrokes([]); setCurrentStroke([]); setUndoStack([]); };

    const PEN_COLORS: { key: PenColor | 'eraser'; label: string }[] = [
        { key: 'red', label: '빨강' },
        { key: 'blue', label: '파랑' },
        { key: 'black', label: '검정' },
        { key: 'yellow', label: '노랑' },
        { key: 'eraser', label: '지우개' },
    ];

    useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);
    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-md flex flex-col p-4" role="dialog" aria-modal="true" aria-label="전술판">
            <div className="flex-1 flex flex-col min-h-0 h-full w-full">
                {/* 1. 상단 + 2. 중단: 코트·벤치를 하나의 좌표계(coordRef)로 묶고, 토큰은 그 위 오버레이 */}
                <div ref={coordRef} className="flex-1 flex flex-col min-h-0 w-full relative">
                    {/* 아레나: 파란 마루 + 오렌지 코트 */}
                    <div className="flex-1 flex items-center justify-center overflow-hidden p-4 bg-cyan-700 min-h-0">
                        <div ref={courtRef} className="relative w-full max-w-5xl aspect-[2/1] bg-[#FF9248] border-4 border-white shadow-2xl overflow-hidden">
                            <div className="absolute left-1/2 top-0 h-full w-1 bg-white -translate-x-1/2" aria-hidden />
                            <div className="absolute left-[33.33%] top-0 h-full w-0 border-l-4 border-dashed border-white" aria-hidden />
                            <div className="absolute right-[33.33%] top-0 h-full w-0 border-r-4 border-dashed border-white" aria-hidden />
                            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full touch-none cursor-crosshair" style={{ touchAction: 'none' }} onPointerDown={handleCanvasDown} onPointerMove={handleCanvasMove} onPointerUp={handleCanvasUp} onPointerLeave={handleCanvasLeave} />
                        </div>
                    </div>

                    {/* 벤치 영역: 버튼 양극단 배치(자석과 겹침 방지), 자석은 아래 토큰 레이어에서 % 좌표로 렌더 */}
                    <div className="w-full max-w-5xl mx-auto flex-shrink-0 bg-slate-900/90 rounded-xl mt-2 px-6 py-3 relative z-20 min-h-[3rem]">
                        <button type="button" onClick={() => addBench('red')} disabled={redBenchFull} className="absolute left-0 top-1/2 -translate-y-1/2 z-[70] ml-2 px-3 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-white text-xs font-medium shadow-md shrink-0 disabled:opacity-50 disabled:cursor-not-allowed">+ 우리팀 후보 추가</button>
                        <button type="button" onClick={() => addBench('blue')} disabled={blueBenchFull} className="absolute right-0 top-1/2 -translate-y-1/2 z-[70] mr-2 px-3 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-white text-xs font-medium shadow-md shrink-0 disabled:opacity-50 disabled:cursor-not-allowed">+ 상대팀 후보 추가</button>
                    </div>

                    {/* 토큰 레이어: 코트+벤치+볼 전부 position:absolute, left/top % 좌표로 배치. 위치 기반 다이내믹 사이즈 적용 */}
                    <div className="absolute inset-0 z-[60] pointer-events-none">
                        {tokens.map((tok) => {
                            const isBench = tok.y >= 80;
                            const sizeClass = isBench ? 'w-[44px] h-[44px]' : 'w-16 h-16';
                            const textClass = isBench ? 'text-[11px]' : 'text-base';
                            return (
                                <div key={tok.id} className={`absolute z-[60] touch-none cursor-grab active:cursor-grabbing pointer-events-auto select-none flex items-center justify-center text-white rounded-full shadow-lg border-2 border-white/80 transition-all duration-200 ease-in-out ${sizeClass}`} style={{ position: 'absolute', left: `${tok.x}%`, top: `${tok.y}%`, transform: 'translate(-50%, -50%)', backgroundColor: tok.team === 'red' ? '#dc2626' : tok.team === 'blue' ? '#2563eb' : 'transparent' }} onPointerDown={(e) => handleTokenDown(e, tok.id)} onPointerMove={(e) => handleTokenMove(e, tok.id)} onPointerUp={(e) => handleTokenUp(e, tok.id)}>
                                    {tok.team === 'ball' ? <span className={isBench ? 'text-lg' : 'text-2xl'}>🏐</span> : <span className={`font-bold leading-tight text-center tracking-tighter break-keep w-full px-1 flex items-center justify-center ${textClass}`} style={{ wordBreak: 'keep-all' }}>{tok.label}</span>}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 3. 하단: 컨트롤 바 (수정 금지) */}
                <div className="h-auto flex-shrink-0 w-full max-w-6xl mx-auto mt-4 flex flex-col sm:flex-row items-center justify-center gap-3 py-3 px-2 bg-slate-800/95 rounded-xl">
                        {/* 그룹 1: 인원/세팅 */}
                        <div className="flex flex-col items-center gap-1">
                            <div className="flex gap-2">
                                <button type="button" onClick={() => applyMode(6)} className={`px-4 py-2 rounded-lg text-sm font-bold shadow-md ${ruleMode === 6 ? 'bg-amber-500 text-slate-900' : 'bg-slate-600 text-slate-300 hover:bg-slate-500'}`}>6인제</button>
                                <button type="button" onClick={() => applyMode(9)} className={`px-4 py-2 rounded-lg text-sm font-bold shadow-md ${ruleMode === 9 ? 'bg-amber-500 text-slate-900' : 'bg-slate-600 text-slate-300 hover:bg-slate-500'}`}>9인제</button>
                            </div>
                            <button type="button" onClick={resetTokens} className="w-full px-4 py-1.5 rounded-lg bg-slate-600 hover:bg-sky-600/80 text-white text-xs font-semibold shadow-md">🔄 기본 세팅</button>
                        </div>
                        <span className="w-px h-10 bg-slate-500 hidden sm:block self-stretch" />
                        {/* 그룹 2: 펜/되돌리기/전체지우기 */}
                        <div className="flex flex-col items-center gap-1">
                            <div className="flex gap-1.5">
                                {PEN_COLORS.map(({ key, label }) => (
                                    <button key={key} type="button" onClick={() => setPenColor(key as PenColor)} title={label} className={`w-8 h-8 rounded-full border-2 shadow-md flex-shrink-0 ${penColor === key ? 'border-white ring-2 ring-sky-400' : 'border-slate-500 hover:border-slate-400'}`} style={key === 'eraser' ? { backgroundColor: '#94a3b8' } : { backgroundColor: COURT_COLORS[key as PenColor] }}>
                                        {key === 'eraser' && <span className="text-white text-xs">🧽</span>}
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-2 w-full">
                                <button type="button" onClick={handleUndo} disabled={undoStack.length === 0} className="flex-1 px-3 py-1.5 rounded-lg bg-slate-600 hover:bg-slate-500 text-slate-200 text-xs font-medium shadow-md disabled:opacity-40">⏪ 되돌리기</button>
                                <button type="button" onClick={clearStrokes} className="flex-1 px-3 py-1.5 rounded-lg bg-slate-600 hover:bg-red-600/80 text-slate-200 text-xs font-medium shadow-md">🧽 전체 지우기</button>
                            </div>
                        </div>
                        <span className="w-px h-10 bg-slate-500 hidden sm:block self-stretch" />
                        {/* 그룹 3: 명단/저장/불러오기/닫기 */}
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            <button type="button" onClick={() => { if (!catRed && cats[0]) setCatRed(cats[0]); if (!catBlue && cats[0]) setCatBlue(cats[0]); setRosterOpen(true); }} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-md">📂 명단 불러오기</button>
                            <button type="button" onClick={openSave} className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-md">💾 전술 저장</button>
                            <button type="button" onClick={openLoad} className="px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold shadow-md">📂 전술 불러오기</button>
                            <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-bold shadow-md">❌ 닫기</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* 자석 이름/메모 수정 모달 */}
            {editId != null && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-slate-800 rounded-xl p-4 border border-slate-600 w-full max-w-xs shadow-2xl">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-slate-200 font-semibold">이름/등번호</p>
                            <button
                                type="button"
                                onClick={() => setEditMemoVisible((prev) => !prev)}
                                className="hover:opacity-80 transition-opacity relative">
                                <span className="text-lg">📝</span>
                                {editMemo && !editMemoVisible && (
                                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-slate-800" />
                                )}
                            </button>
                        </div>
                        <input type="text" value={editVal} onChange={(e) => setEditVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleEditOk()} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white mb-3" maxLength={6} autoFocus />
                        {editMemoVisible && (
                            <textarea value={editMemo} onChange={(e) => setEditMemo(e.target.value)} placeholder="메모 입력..." className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm mb-3 min-h-[80px] resize-none" rows={3} />
                        )}
                        <div className="flex gap-2">
                            <button type="button" onClick={() => { setEditId(null); setEditVal(''); setEditMemo(''); setEditMemoVisible(false); }} className="flex-1 py-2 rounded-lg bg-slate-600 text-white font-medium">취소</button>
                            <button type="button" onClick={handleEditOk} className="flex-1 py-2 rounded-lg bg-amber-600 text-slate-900 font-bold">확인</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 전술 저장 모달 */}
            {saveOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4" onClick={() => setSaveOpen(false)}>
                    <div className="bg-slate-800 rounded-xl p-4 border border-slate-600 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <p className="text-slate-200 font-semibold mb-2">저장할 전술 이름</p>
                        <input type="text" value={saveName} onChange={(e) => setSaveName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doSave()} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white mb-3" maxLength={30} autoFocus />
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setSaveOpen(false)} className="flex-1 py-2 rounded-lg bg-slate-600 text-white">취소</button>
                            <button type="button" onClick={doSave} className="flex-1 py-2 rounded-lg bg-sky-600 text-white font-semibold">저장</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 전술 불러오기 모달 */}
            {loadOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4" onClick={() => setLoadOpen(false)}>
                    <div className="bg-slate-800 rounded-xl border border-slate-600 w-full max-w-sm max-h-[70vh] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="p-3 border-b border-slate-600 font-semibold text-slate-200">저장된 전술</div>
                        <div className="overflow-y-auto max-h-[50vh] p-2">
                            {Object.keys(savedMap).length === 0 ? <p className="text-slate-500 text-sm py-4 text-center">저장된 전술이 없습니다.</p> : Object.keys(savedMap).map((name, idx) => <button key={`saved-${idx}-${name}`} type="button" onClick={() => doLoad(name)} className="w-full text-left px-4 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm mb-1">{name}</button>)}
                        </div>
                        <div className="p-2 border-t border-slate-600"><button type="button" onClick={() => setLoadOpen(false)} className="w-full py-2 rounded-lg bg-slate-600 text-white text-sm">닫기</button></div>
                    </div>
                </div>
            )}

            {/* 명단 불러오기 모달: 어두운 불투명 배경, 적용하기 시에만 코트에 반영 */}
            {rosterOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/95 p-4" onClick={() => setRosterOpen(false)}>
                    <div className="bg-slate-800 rounded-xl border border-slate-600 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-600 font-semibold text-slate-200 text-center text-xl">📂 명단 불러오기</div>
                        <div className="flex-1 flex min-h-0">
                            <div className="flex-1 flex flex-col border-r border-slate-600 min-w-0 p-4 bg-red-950/30 border-b-4 border-red-500/50">
                                <div className="font-bold text-red-200 text-lg mb-4">🔴 우리 팀 명단 세팅</div>
                                <label className="text-slate-300 text-base mb-1">반/대회 선택</label>
                                <select value={catRed || (cats[0] ?? '')} onChange={(e) => setCatRed(e.target.value)} className="w-full p-4 text-xl rounded-lg bg-slate-700 border border-slate-600 text-white mb-4 focus:ring-2 focus:ring-red-500">
                                    {appMode === 'CLUB'
                                        ? [...new Set(clubTeams.map((t: TeamSet & { competition?: string; groupName?: string }) => t.competition || t.groupName || t.className))].filter(Boolean).map((comp) => (
                                            <option key={comp} value={comp}>{comp}</option>
                                        ))
                                        : cats.map((cn, cIdx) => (
                                            <option key={`cat-red-${cIdx}-${cn}`} value={cn}>{cn}</option>
                                        ))}
                                </select>
                                <label className="text-slate-300 text-base mb-1">팀 선택</label>
                                <select
                                    value={pendingRedTeamName ?? ''}
                                    onChange={(e) => setPendingRedTeamName(e.target.value)}
                                    className="w-full p-4 text-xl rounded-lg bg-slate-700 border border-slate-600 text-white focus:ring-2 focus:ring-red-500"
                                >
                                    <option value="">팀을 선택하세요</option>
                                    {teamsRed.map((item, i) => (
                                        <option key={`r-${item.set?.id ?? 'x'}-${item.team.teamName}-${i}`} value={item.team.teamName}>{item.team.teamName}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex-1 flex flex-col min-w-0 p-4 bg-blue-950/30 border-b-4 border-blue-500/50">
                                <div className="font-bold text-blue-200 text-lg mb-4">🔵 상대 팀 명단 세팅</div>
                                <label className="text-slate-300 text-base mb-1">반/대회 선택</label>
                                <select value={catBlue || (cats[0] ?? '')} onChange={(e) => setCatBlue(e.target.value)} className="w-full p-4 text-xl rounded-lg bg-slate-700 border border-slate-600 text-white mb-4 focus:ring-2 focus:ring-blue-500">
                                    {appMode === 'CLUB'
                                        ? [...new Set(clubTeams.map((t: TeamSet & { competition?: string; groupName?: string }) => t.competition || t.groupName || t.className))].filter(Boolean).map((comp) => (
                                            <option key={comp} value={comp}>{comp}</option>
                                        ))
                                        : cats.map((cn, cIdx) => (
                                            <option key={`cat-blue-${cIdx}-${cn}`} value={cn}>{cn}</option>
                                        ))}
                                </select>
                                <label className="text-slate-300 text-base mb-1">팀 선택</label>
                                <select
                                    value={pendingBlueTeamName ?? ''}
                                    onChange={(e) => setPendingBlueTeamName(e.target.value)}
                                    className="w-full p-4 text-xl rounded-lg bg-slate-700 border border-slate-600 text-white focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">팀을 선택하세요</option>
                                    {teamsBlue.map((item, i) => (
                                        <option key={`b-${item.set?.id ?? 'x'}-${item.team.teamName}-${i}`} value={item.team.teamName}>{item.team.teamName}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <form className="p-4 border-t border-slate-600 flex gap-3" onSubmit={(e) => { e.preventDefault(); applyRosterAndClose(e); }}>
                            <button type="button" onClick={() => setRosterOpen(false)} className="flex-1 py-3 rounded-lg bg-slate-600 hover:bg-slate-500 text-white text-lg font-medium">닫기</button>
                            <button type="submit" className="flex-1 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-lg font-bold shadow-lg">적용하기</button>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};
