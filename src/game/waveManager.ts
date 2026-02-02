import { GAME_CONSTANTS } from './constants';
import { GameState } from './types';

export interface WaveConfig {
    targetDensity: number;
    orbsRequired: number;
    bombChance: number;
}

export function getWaveConfig(wave: number): WaveConfig {
    const targetDensity = Math.min(
        GAME_CONSTANTS.WAVE_DENSITY_BASE + (wave - 1) * GAME_CONSTANTS.WAVE_DENSITY_INCREMENT,
        GAME_CONSTANTS.WAVE_MAX_DENSITY
    );

    const orbsRequired = GAME_CONSTANTS.WAVE_REQUIRED_BASE + (wave - 1) * GAME_CONSTANTS.WAVE_REQUIRED_INCREMENT;

    // Bombs: 15% base + 5% per wave, cap at 50%
    const bombChance = Math.min(0.15 + (wave - 1) * 0.05, 0.50);

    return { targetDensity, orbsRequired, bombChance };
}

export function updateWaveState(state: GameState, dt: number): GameState {
    let nextState = { ...state };

    // 1. ANNOUNCEMENT OVERLAY TIMER
    // Just for showing the "WAVE X" text, doesn't stop gameplay logic.
    if (nextState.waveTransitionTimer > 0) {
        nextState.waveTransitionTimer -= dt * 1000;
        if (nextState.waveTransitionTimer <= 0) {
            nextState.wavePhase = 'PLAYING'; // Changes UI state only
        }
    }

    // 2. LEVEL UP CHECK
    // If we have absorbed enough orbs, we advance to next wave INSTANTLY
    if (nextState.orbsAbsorbedInWave >= nextState.orbsRequiredForLevel) {
        // Level Up!
        nextState.currentWave++;

        // Reset Progress logic for new wave
        nextState.orbsAbsorbedInWave = 0;

        // Update requirements for new wave
        const newConfig = getWaveConfig(nextState.currentWave);
        nextState.orbsRequiredForLevel = newConfig.orbsRequired;

        // Trigger Advertisement
        nextState.wavePhase = 'ANNOUNCEMENT';
        nextState.waveTransitionTimer = 3000; // Show text for 3s
        // Note: orbsRemainingInWave is deprecated in this density model
    }

    return nextState;
}
