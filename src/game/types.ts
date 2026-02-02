export type Vector2 = {
    x: number;
    y: number;
};

export type GravityMode = 'ATTRACT' | 'REPEL';

export interface BlackHole {
    pos: Vector2;
    mode: GravityMode;
}

export type OrbType = 'NORMAL' | 'BOMB';

export interface Orb {
    id: string;
    pos: Vector2;
    vel: Vector2;
    radius: number;
    mass: number;
    trail: Vector2[];
    color: string;
    status: 'WILD' | 'CAPTURING' | 'GOLD';
    captureProgress: number;
    orbType: OrbType;
}

export interface Particle {
    id: string;
    pos: Vector2;
    vel: Vector2;
    life: number;      // 0 to 1
    maxLife: number;   // seconds
    color: string;
    size: number;
}

export interface Crack {
    id: string;
    edge: 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT';
    pos: Vector2;
    timestamp: number;
}

export type GamePhase = 'INIT' | 'START' | 'PLAYING' | 'RESULT' | 'VICTORY';
export type WavePhase = 'PLAYING' | 'TRANSITION' | 'ANNOUNCEMENT';

export interface GameState {
    phase: GamePhase;
    hole: BlackHole;
    orbs: Orb[];
    particles: Particle[];

    // Visuals
    screenFlash: number; // 0 to 1 alpha

    // Blackhole growth

    // Blackhole growth
    blackholeRadius: number;
    lastAbsorbTime: number;

    // Time tracking
    elapsedTime: number;
    startTime: number;

    // Wave System
    currentWave: number;
    orbsRemainingInWave: number; // Deprecated but kept for compatibility or repurposed
    orbsRequiredForLevel: number; // Target to reach next wave
    orbsAbsorbedInWave: number; // Current progress
    orbsSpawnedInWave: number;
    waveStartTime: number;
    wavePhase: WavePhase;
    waveTransitionTimer: number;

    // Combo System
    comboCount: number;
    comboMultiplier: number;
    lastComboTime: number;
    comboTimerRemaining: number;

    // Legacy
    score: number;
    bestScore: number;
    cracks: number;
    activeCracks: Crack[];
    timeElapsed: number;
    shakeTimer: number;

    // Death tracking
    deathReason: 'WALL' | 'BOMB' | null;
}

export type HandInput = {
    hasHand: boolean;
    cursor: Vector2 | null;
    isPinched: boolean;
    rawPinchRatio?: number;
};
