import { EnrichedMatch, UserEmblem, TeamMatchState, MvpResult } from '../types';
import { iconStrings, crownIconString } from './iconStrings';

const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(err);
        img.src = src;
    });
};

const getEmblemSrc = (emblem: string | undefined, userEmblems: UserEmblem[]): string => {
    if (emblem?.startsWith('user_')) {
        return userEmblems.find(e => e.id === emblem)?.data || '';
    }
    if (emblem?.startsWith('data:image/')) {
        return emblem;
    }
    const iconKey = emblem && iconStrings[emblem] ? emblem : 'icon_volleyball';
    const svgString = iconStrings[iconKey];
    return `data:image/svg+xml;base64,${btoa(svgString)}`;
};

const drawTeamStats = (ctx: CanvasRenderingContext2D, team: TeamMatchState, x: number, y: number, color: string, t: (key: string) => string) => {
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#cbd5e1';

    const stats = [
        { label: t('image_stat_serve'), value: team.serviceAces },
        { label: t('image_stat_spike'), value: team.spikeSuccesses },
        { label: t('image_stat_blocking'), value: team.blockingPoints },
    ];
    const statYStart = y;
    const lineHeight = 28;
    const labelX = x - 120;
    const valueX = x + 120;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 140, y - 25);
    ctx.lineTo(x + 140, y - 25);
    ctx.stroke();

    stats.forEach((stat, index) => {
        const currentY = statYStart + (index * lineHeight);
        ctx.fillText(stat.label, labelX, currentY);
        
        ctx.textAlign = 'right';
        ctx.fillStyle = color;
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText(String(stat.value), valueX, currentY);
        
        // Reset alignment and style for next iteration
        ctx.textAlign = 'left';
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '20px sans-serif';
    });
};

export const generateMatchResultImage = async (match: EnrichedMatch, userEmblems: UserEmblem[], mvp: MvpResult, t: (key: string, replacements?: Record<string, string | number>) => string, locale: string): Promise<string> => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Could not create canvas context');
    }

    // --- Draw Background ---
    ctx.fillStyle = '#1A1A2E';
    ctx.fillRect(0, 0, 1200, 630);

    // Draw grid pattern
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 1200; i += 30) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 630);
        ctx.stroke();
    }
    for (let i = 0; i < 630; i += 30) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(1200, i);
        ctx.stroke();
    }

    // --- Header & Footer ---
    ctx.textAlign = 'center';
    ctx.fillStyle = '#00A3FF';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText(t('image_header_title'), 600, 60);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '18px sans-serif';
    ctx.fillText(new Date(match.date).toLocaleString(locale), 600, 95);
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '16px sans-serif';
    ctx.fillText('© 2025 JCT', 600, 610);
    
    // --- Load Images ---
    const teamA = match.teamA;
    const teamB = match.teamB;
    const winner = match.winner;

    const teamAEmblemSrc = getEmblemSrc(teamA.emblem, userEmblems);
    const teamBEmblemSrc = getEmblemSrc(teamB.emblem, userEmblems);
    const crownSrc = `data:image/svg+xml;base64,${btoa(crownIconString)}`;

    const [teamAImg, teamBImg, crownImg] = await Promise.all([
        loadImage(teamAEmblemSrc),
        loadImage(teamBEmblemSrc),
        winner ? loadImage(crownSrc) : Promise.resolve(null),
    ]);

    // --- Team A (Left) ---
    const teamAColor = teamA.color || '#3b82f6';
    ctx.drawImage(teamAImg, 240, 130, 120, 120);

    ctx.fillStyle = teamAColor;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(teamA.name, 300, 300, 380);

    ctx.fillStyle = 'white';
    ctx.font = 'bold 120px sans-serif';
    ctx.fillText(String(teamA.score), 300, 410);

    // --- Team B (Right) ---
    const teamBColor = teamB.color || '#ef4444';
    ctx.drawImage(teamBImg, 840, 130, 120, 120);

    ctx.fillStyle = teamBColor;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(teamB.name, 900, 300, 380);

    ctx.fillStyle = 'white';
    ctx.font = 'bold 120px sans-serif';
    ctx.fillText(String(teamB.score), 900, 410);
    
    // --- VS Separator ---
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 60px sans-serif';
    ctx.fillText('VS', 600, 280);

    // --- Winner & Crown ---
    if (winner === 'A' && crownImg) {
        ctx.drawImage(crownImg, 270, 90, 60, 60);
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 28px sans-serif';
        ctx.fillText(t('image_winner'), 300, 450);
    }
    
    if (winner === 'B' && crownImg) {
        ctx.drawImage(crownImg, 870, 90, 60, 60);
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 28px sans-serif';
        ctx.fillText(t('image_winner'), 900, 450);
    }
    
    // --- Detailed Stats ---
    drawTeamStats(ctx, teamA, 300, 490, teamAColor, t);
    drawTeamStats(ctx, teamB, 900, 490, teamBColor, t);

    // --- MVP ---
    if (mvp) {
        const mvpTeamKey = mvp.team.name === teamA.name ? 'A' : 'B';
        const mvpX = mvpTeamKey === 'A' ? 300 : 900;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText(t('image_mvp', { name: mvp.player.originalName }), mvpX, 580);
    }

    return canvas.toDataURL('image/png');
};