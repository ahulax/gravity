import { GAME_CONSTANTS, THEME_COLORS } from './constants';
import { GameState } from './types';
import { getWaveConfig } from './waveManager';

export function renderGame(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    width: number,
    height: number
) {
    // 1. Clear & Background
    ctx.fillStyle = THEME_COLORS.BG;
    ctx.fillRect(0, 0, width, height);

    // Screen Flash
    if (state.screenFlash > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${state.screenFlash})`;
        ctx.fillRect(0, 0, width, height);
    }

    // Screen Shake
    if (state.shakeTimer > 0) {
        const dx = (Math.random() - 0.5) * 10;
        const dy = (Math.random() - 0.5) * 10;
        ctx.save();
        ctx.translate(dx, dy);
    }

    const { hole, blackholeRadius } = state;

    // 2. Draw Black Hole with DYNAMIC radius
    const coreRadius = blackholeRadius * 0.6;
    const ringRadius = blackholeRadius;
    const glowRadius = blackholeRadius * 1.8;

    const progress = (blackholeRadius - GAME_CONSTANTS.MIN_RADIUS) /
        (GAME_CONSTANTS.VICTORY_RADIUS - GAME_CONSTANTS.MIN_RADIUS);
    const hue = 180 - progress * 60;
    const progressColor = `hsl(${hue}, 80%, 60%)`;

    // Outer Glow
    const gradient = ctx.createRadialGradient(
        hole.pos.x, hole.pos.y, coreRadius,
        hole.pos.x, hole.pos.y, glowRadius
    );
    gradient.addColorStop(0, progressColor);
    gradient.addColorStop(0.4, `hsla(${hue}, 80%, 40%, 0.5)`);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.globalAlpha = 0.4 + progress * 0.3;
    ctx.beginPath();
    ctx.arc(hole.pos.x, hole.pos.y, glowRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // Swirling effect
    const time = performance.now() / 1000;
    ctx.save();
    ctx.translate(hole.pos.x, hole.pos.y);
    ctx.rotate(time * 0.5);

    ctx.strokeStyle = `hsla(${hue}, 70%, 50%, 0.3)`;
    ctx.lineWidth = 2;
    for (let arm = 0; arm < 4; arm++) {
        ctx.beginPath();
        for (let r = coreRadius * 0.5; r < ringRadius; r += 2) {
            const angle = (r / ringRadius) * Math.PI * 2 + arm * (Math.PI / 2);
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r;
            if (r === coreRadius * 0.5) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
    }
    ctx.restore();

    // Ring
    const pulseScale = 1 + Math.sin(time * 4) * 0.05;
    ctx.strokeStyle = progressColor;
    ctx.lineWidth = 3 + progress * 2;
    ctx.beginPath();
    ctx.arc(hole.pos.x, hole.pos.y, ringRadius * pulseScale, 0, Math.PI * 2);
    ctx.stroke();

    // Core
    const coreGradient = ctx.createRadialGradient(
        hole.pos.x, hole.pos.y, 0,
        hole.pos.x, hole.pos.y, coreRadius
    );
    coreGradient.addColorStop(0, '#000');
    coreGradient.addColorStop(0.7, '#111');
    coreGradient.addColorStop(1, '#333');
    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(hole.pos.x, hole.pos.y, coreRadius, 0, Math.PI * 2);
    ctx.fill();

    // Progress Ring
    ctx.strokeStyle = `hsla(45, 100%, 60%, 0.8)`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(hole.pos.x, hole.pos.y, ringRadius + 10, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    ctx.stroke();

    // 3. Draw Orbs
    state.orbs.forEach(orb => {
        // Tractor Beam for CAPTURING orbs
        if (orb.status === 'CAPTURING') {
            ctx.strokeStyle = `rgba(255, 215, 0, ${0.3 + orb.captureProgress * 0.7})`;
            ctx.lineWidth = 2 + orb.captureProgress * 4;
            ctx.beginPath();
            ctx.moveTo(hole.pos.x, hole.pos.y);
            ctx.lineTo(orb.pos.x, orb.pos.y);
            ctx.stroke();
        }

        // Trail
        if (orb.trail.length > 1) {
            ctx.strokeStyle = orb.orbType === 'BOMB' ? THEME_COLORS.BOMB : THEME_COLORS.ORB_SECONDARY;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.moveTo(orb.trail[0].x, orb.trail[0].y);
            for (let i = 1; i < orb.trail.length; i++) {
                ctx.lineTo(orb.trail[i].x, orb.trail[i].y);
            }
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        // Orb Body
        ctx.save();

        if (orb.orbType === 'BOMB') {
            // Bomb: Red pulsing glow
            const bombPulse = 1 + Math.sin(time * 8) * 0.2;
            ctx.shadowBlur = 15 * bombPulse;
            ctx.shadowColor = THEME_COLORS.BOMB;
            ctx.fillStyle = THEME_COLORS.BOMB;
        } else if (orb.status === 'CAPTURING') {
            const jitterX = (Math.random() - 0.5) * 4;
            const jitterY = (Math.random() - 0.5) * 4;
            ctx.translate(jitterX, jitterY);
            ctx.shadowBlur = 10 * orb.captureProgress;
            ctx.shadowColor = '#FFF';
            ctx.fillStyle = `rgb(255, ${200 + 55 * orb.captureProgress}, ${150 + 105 * orb.captureProgress})`;
        } else {
            ctx.fillStyle = orb.color;
        }

        ctx.beginPath();
        ctx.arc(orb.pos.x, orb.pos.y, orb.radius, 0, Math.PI * 2);
        ctx.fill();

        // Bomb icon (skull-like)
        if (orb.orbType === 'BOMB') {
            ctx.fillStyle = '#000';
            ctx.font = `${orb.radius}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('💣', orb.pos.x, orb.pos.y);
        }

        ctx.restore();
    });

    // 4. Draw Particles
    if (state.particles) {
        state.particles.forEach(p => {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.pos.x, p.pos.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        });
    }

    // 5. Draw Timer (top center)
    const elapsed = state.elapsedTime;
    const minutes = Math.floor(elapsed / 60);
    const seconds = Math.floor(elapsed % 60);
    const ms = Math.floor((elapsed % 1) * 100);
    const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;

    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(timeStr, width / 2, 40);

    // LEVEL PROGRESS (New) - instead of % victory
    const lvlProgress = Math.min(1, state.orbsAbsorbedInWave / (state.orbsRequiredForLevel || 1));
    const barW = 200;
    const barH = 4;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(width / 2 - barW / 2, 55, barW, barH);
    ctx.fillStyle = '#22d3ee'; // Cyan
    ctx.fillRect(width / 2 - barW / 2, 55, barW * lvlProgress, barH);

    // Level Text (Small)
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#888';
    ctx.fillText(`LEVEL UP: ${state.orbsAbsorbedInWave} / ${state.orbsRequiredForLevel}`, width / 2, 75);

    // 5. Wave HUD (TOP-RIGHT)
    // const waveConfig = getWaveConfig(state.currentWave); // usage removed if not needed below
    ctx.textAlign = 'right';

    // Wave
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(`WAVE ${state.currentWave}`, width - 20, 40);

    // Debug info (optional - removed to prevent clutter)


    // 6. Combo Display (bottom center)
    if (state.comboCount > 1) {
        const comboColors = ['#FFF', '#FCD34D', '#F59E0B', '#EF4444', '#8B5CF6'];
        const colorIndex = Math.min(state.comboCount - 1, comboColors.length - 1);

        // Combo count text
        ctx.fillStyle = comboColors[colorIndex];
        ctx.font = `bold ${32 + Math.min(state.comboCount, 5) * 4}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(`${state.comboCount}x COMBO!`, width / 2, height - 60);

        // Timer bar
        const barWidth = 200;
        const barHeight = 6;
        const comboProgress = state.comboTimerRemaining / GAME_CONSTANTS.COMBO_WINDOW_MS;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(width / 2 - barWidth / 2, height - 40, barWidth, barHeight);

        ctx.fillStyle = comboColors[colorIndex];
        ctx.fillRect(width / 2 - barWidth / 2, height - 40, barWidth * comboProgress, barHeight);
    }

    // 7. Wave Announcement Overlay (Non-Blocking Flash)
    if (state.wavePhase === 'ANNOUNCEMENT') {
        // Subtle Flash
        ctx.fillStyle = `rgba(255, 255, 255, ${0.1 + Math.sin(performance.now() / 100) * 0.05})`;
        // Or just text without full screen block

        ctx.save();
        ctx.shadowColor = '#22d3ee';
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 80px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`WAVE ${state.currentWave}`, width / 2, height / 2);

        ctx.font = '24px sans-serif';
        ctx.fillStyle = '#cyan';
        ctx.fillText(`DENSITY INCREASED!`, width / 2, height / 2 + 50);
        ctx.restore();
    }

    if (state.shakeTimer > 0) {
        ctx.restore();
    }
}
