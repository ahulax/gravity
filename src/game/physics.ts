import { GAME_CONSTANTS } from './constants';
import { GameState, Orb, Vector2, GamePhase } from './types';
import { createOrb } from './state';
import { getWaveConfig, updateWaveState } from './waveManager';
import { onOrbAbsorbed, updateComboTimer, getComboGrowthBonus } from './comboSystem';
import { createBurst, updateParticles } from './particleSystem';

// Helper: Vector math
const vAdd = (a: Vector2, b: Vector2): Vector2 => ({ x: a.x + b.x, y: a.y + b.y });
const vSub = (a: Vector2, b: Vector2): Vector2 => ({ x: a.x - b.x, y: a.y - b.y });
const vScale = (v: Vector2, s: number): Vector2 => ({ x: v.x * s, y: v.y * s });
const vLen = (v: Vector2): number => Math.sqrt(v.x * v.x + v.y * v.y);
const vNorm = (v: Vector2): Vector2 => {
    const len = vLen(v);
    return len > 0 ? vScale(v, 1 / len) : { x: 0, y: 0 };
};

// Track last spawn time
let lastSpawnTime = 0;

export function updatePhysics(
    state: GameState,
    dt: number,
    canvasWidth: number,
    canvasHeight: number
): GameState {
    if (state.phase !== 'PLAYING') return state;

    const now = performance.now();
    const isPinching = state.hole.mode === 'REPEL';

    // Update wave state (transitions, announcements)
    let nextState = updateWaveState(state, dt);

    // Update combo timer
    nextState = updateComboTimer(nextState, dt);

    // 3. SEAMLESS PHYSICS LOOP
    // We NO LONGER check wavePhase here to allow continuous movement during announcements.

    // Update Particles
    let nextParticles = updateParticles(nextState.particles || [], dt);

    // Update Screen Flash
    let screenFlash = nextState.screenFlash > 0 ? Math.max(0, nextState.screenFlash - dt * 2) : 0;

    let blackholeRadius = nextState.blackholeRadius;
    let lastAbsorbTime = nextState.lastAbsorbTime;
    let orbsAbsorbedInWave = nextState.orbsAbsorbedInWave;

    const nextOrbs: Orb[] = [];

    for (const orb of nextState.orbs) {
        let { pos, vel, status, captureProgress } = orb;
        let accel = { x: 0, y: 0 };
        const d = vSub(nextState.hole.pos, pos);
        const distSq = d.x * d.x + d.y * d.y;
        const dist = Math.sqrt(distSq);

        // --- 1. ABSORPTION & CAPTURE LOGIC ---
        if (status === 'GOLD') {
            if (dist < blackholeRadius * 0.9) {
                // Apply combo bonus
                const baseGrowth = GAME_CONSTANTS.GROWTH_PER_ORB;
                const comboBonus = getComboGrowthBonus(nextState.comboCount);
                blackholeRadius += baseGrowth + comboBonus;
                lastAbsorbTime = now;
                orbsAbsorbedInWave++;

                // BOMB DEATH CHECK
                if (orb.orbType === 'BOMB') {
                    return { ...nextState, phase: 'RESULT', deathReason: 'BOMB' };
                }

                nextState = onOrbAbsorbed(nextState, orb);
                const burstColor = orb.orbType === 'BOMB' ? THEME_COLORS.BOMB : (nextState.comboCount >= 2 ? '#FCD34D' : orb.color);
                const newParticles = createBurst(orb.pos, 15 + nextState.comboCount * 5, burstColor);
                nextParticles = [...nextParticles, ...newParticles];
                if (nextState.comboCount >= 5) screenFlash = 0.5;
                continue;
            }
        }

        // --- 2. BATTING / GRAVITY ENGINE ---
        const forceMagnitude = isPinching ? -GAME_CONSTANTS.REPEL_STRENGTH : GAME_CONSTANTS.GRAVITY_STRENGTH;
        const force = forceMagnitude / (distSq + GAME_CONSTANTS.SOFTENING);
        accel = vScale(vNorm(d), force);

        // --- 3. TAMING MECHANIC ---
        if (!isPinching && dist < GAME_CONSTANTS.GRAB_RADIUS) {
            status = 'CAPTURING';
            captureProgress += (dt * 1000) / GAME_CONSTANTS.CAPTURE_TIME_MS;
            if (captureProgress >= 1) {
                status = 'GOLD';
                captureProgress = 1;
            }
        } else if (isPinching) {
            status = 'WILD';
            captureProgress = 0;
        } else if (status === 'CAPTURING') {
            captureProgress -= dt * 0.5;
            if (captureProgress <= 0) {
                status = 'WILD';
                captureProgress = 0;
            }
        }

        // Apply Friction & Speed Limit
        vel = vScale(vel, GAME_CONSTANTS.DAMPING);
        vel = vAdd(vel, vScale(accel, dt));
        const speed = vLen(vel);
        if (speed > GAME_CONSTANTS.MAX_SPEED) vel = vScale(vel, GAME_CONSTANTS.MAX_SPEED / speed);

        // Integrate Position
        let nextPos = vAdd(pos, vScale(vel, dt));

        // ORB WALL BOUNCE
        if (nextPos.x < orb.radius) {
            nextPos.x = orb.radius;
            vel.x = Math.abs(vel.x) * 0.8;
        } else if (nextPos.x > canvasWidth - orb.radius) {
            nextPos.x = canvasWidth - orb.radius;
            vel.x = -Math.abs(vel.x) * 0.8;
        }

        if (nextPos.y < orb.radius) {
            nextPos.y = orb.radius;
            vel.y = Math.abs(vel.y) * 0.8;
        } else if (nextPos.y > canvasHeight - orb.radius) {
            nextPos.y = canvasHeight - orb.radius;
            vel.y = -Math.abs(vel.y) * 0.8;
        }

        // Trail Update
        const nextTrail = [...orb.trail, { ...nextPos }];
        if (nextTrail.length > GAME_CONSTANTS.TRAIL_LENGTH) {
            nextTrail.shift();
        }

        nextOrbs.push({
            ...orb,
            pos: nextPos,
            vel,
            trail: nextTrail,
            status,
            captureProgress
        });
    }

    // --- DECAY LOGIC ---
    const timeSinceAbsorb = now - lastAbsorbTime;
    if (lastAbsorbTime > 0 && timeSinceAbsorb > GAME_CONSTANTS.DECAY_DELAY_MS) {
        blackholeRadius -= GAME_CONSTANTS.DECAY_RATE * dt;
        blackholeRadius = Math.max(GAME_CONSTANTS.MIN_RADIUS, blackholeRadius);
    }

    // --- WAVE SPAWNING (Density Mode) ---
    const waveConfig = getWaveConfig(nextState.currentWave);
    // Spawning logic: keep Normal orbs at target density
    const activeNormalOrbs = nextOrbs.filter(o => o.orbType === 'NORMAL').length;

    if (activeNormalOrbs < waveConfig.targetDensity &&
        now - lastSpawnTime > GAME_CONSTANTS.WAVE_SPAWN_COOLDOWN) {
        lastSpawnTime = now;

        const edge = Math.floor(Math.random() * 4);
        let sx: number, sy: number;
        const margin = 20;

        switch (edge) {
            case 0: sx = margin + Math.random() * (canvasWidth - 2 * margin); sy = margin; break;
            case 1: sx = margin + Math.random() * (canvasWidth - 2 * margin); sy = canvasHeight - margin; break;
            case 2: sx = margin; sy = margin + Math.random() * (canvasHeight - 2 * margin); break;
            default: sx = canvasWidth - margin; sy = margin + Math.random() * (canvasHeight - 2 * margin);
        }

        const isBomb = Math.random() < waveConfig.bombChance;
        const newOrb = createOrb(sx, sy, isBomb ? 'BOMB' : 'NORMAL');

        // Aim toward center
        const cx = canvasWidth / 2;
        const cy = canvasHeight / 2;
        const toCenter = vNorm(vSub({ x: cx, y: cy }, newOrb.pos));
        const angle = Math.atan2(toCenter.y, toCenter.x) + (Math.random() - 0.5) * 0.5;
        const spd = 40 + Math.random() * 60;
        newOrb.vel = { x: Math.cos(angle) * spd, y: Math.sin(angle) * spd };

        nextOrbs.push(newOrb);
        nextState.orbsSpawnedInWave++;
    }

    // --- GAME OVER CHECK ---
    let nextPhase: GamePhase = nextState.phase;
    const holeEdgeHitsWall =
        nextState.hole.pos.x - blackholeRadius < 0 ||
        nextState.hole.pos.x + blackholeRadius > canvasWidth ||
        nextState.hole.pos.y - blackholeRadius < 0 ||
        nextState.hole.pos.y + blackholeRadius > canvasHeight;

    if (holeEdgeHitsWall) {
        nextPhase = 'RESULT';
        if (nextState.phase !== 'RESULT') {
            nextState.deathReason = 'WALL';
        }
    }

    return {
        ...nextState,
        orbs: nextOrbs,
        particles: nextParticles,
        screenFlash,
        blackholeRadius,
        lastAbsorbTime,
        orbsAbsorbedInWave,
        phase: nextPhase,
        elapsedTime: nextState.elapsedTime + dt,
    };
}
