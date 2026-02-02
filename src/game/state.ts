import { GAME_CONSTANTS, THEME_COLORS } from './constants';
import { GameState, Orb } from './types';

export function createOrb(x: number, y: number, orbType: 'NORMAL' | 'BOMB' = 'NORMAL'): Orb {
    const angle = Math.random() * Math.PI * 2;
    const speed = 50 + Math.random() * 100;
    const isBomb = orbType === 'BOMB';

    return {
        id: Math.random().toString(36).substr(2, 9),
        pos: { x, y },
        vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        radius: isBomb ? GAME_CONSTANTS.BOMB_RADIUS : GAME_CONSTANTS.ORB_RADIUS,
        mass: 1,
        trail: [],
        color: isBomb ? THEME_COLORS.BOMB : (Math.random() > 0.5 ? THEME_COLORS.ORB_PRIMARY : THEME_COLORS.ORB_SECONDARY),
        status: 'WILD',
        captureProgress: 0,
        orbType,
    };
}

export function createInitialState(width: number, height: number): GameState {
    const cx = width / 2;
    const cy = height / 2;

    const bestTime = parseFloat(localStorage.getItem('blackhole_juggler_best_time') || '999999');

    return {
        phase: 'INIT',
        hole: {
            pos: { x: cx, y: cy },
            mode: 'ATTRACT',
        },
        orbs: [],
        particles: [],
        screenFlash: 0,

        // Blackhole growth
        blackholeRadius: GAME_CONSTANTS.MIN_RADIUS,
        lastAbsorbTime: 0,

        // Time tracking
        elapsedTime: 0,
        startTime: 0,

        // Wave System
        currentWave: 1,
        orbsRemainingInWave: 999, // Unused
        orbsRequiredForLevel: GAME_CONSTANTS.WAVE_REQUIRED_BASE, // Start with base requirement
        orbsAbsorbedInWave: 0,
        orbsSpawnedInWave: 0,
        waveStartTime: 0,
        wavePhase: 'ANNOUNCEMENT',
        waveTransitionTimer: GAME_CONSTANTS.WAVE_TRANSITION_MS,

        // Combo System
        comboCount: 0,
        comboMultiplier: 1.0,
        lastComboTime: 0,
        comboTimerRemaining: 0,

        // Legacy
        score: 0,
        bestScore: bestTime,
        cracks: 0,
        activeCracks: [],
        timeElapsed: 0,
        shakeTimer: 0,
    };
}

export function resetRound(currentState: GameState, width: number, height: number): GameState {
    const newState = createInitialState(width, height);
    newState.phase = 'PLAYING';
    newState.startTime = performance.now();
    newState.wavePhase = 'ANNOUNCEMENT';
    newState.waveTransitionTimer = GAME_CONSTANTS.WAVE_TRANSITION_MS;
    return newState;
}
