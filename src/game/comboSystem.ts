import { GAME_CONSTANTS } from './constants';
import { GameState, Orb } from './types';

export function onOrbAbsorbed(state: GameState, orb: Orb): GameState {
    const now = performance.now();
    const timeSinceLast = now - state.lastComboTime;

    let comboCount = state.comboCount;

    if (state.lastComboTime === 0 || timeSinceLast <= GAME_CONSTANTS.COMBO_WINDOW_MS) {
        // Build combo: bombs give +2, normal orbs give +1
        comboCount += orb.orbType === 'BOMB' ? 2 : 1;
    } else {
        // Reset combo (started new chain)
        comboCount = 1;
    }

    // Cap combo at multiplier array max index
    const cappedCombo = Math.min(comboCount, GAME_CONSTANTS.COMBO_MULTIPLIERS.length - 1);

    return {
        ...state,
        comboCount,
        comboMultiplier: GAME_CONSTANTS.COMBO_MULTIPLIERS[cappedCombo],
        lastComboTime: now,
        comboTimerRemaining: GAME_CONSTANTS.COMBO_WINDOW_MS,
    };
}

export function updateComboTimer(state: GameState, dt: number): GameState {
    if (state.comboCount === 0) return state;

    const newTimer = state.comboTimerRemaining - dt * 1000;

    if (newTimer <= 0) {
        // Combo expired
        return {
            ...state,
            comboCount: 0,
            comboMultiplier: 1.0,
            comboTimerRemaining: 0,
        };
    }

    return {
        ...state,
        comboTimerRemaining: newTimer,
    };
}

export function getComboGrowthBonus(comboCount: number): number {
    const tier = Math.min(comboCount, GAME_CONSTANTS.COMBO_GROWTH_BONUS.length - 1);
    return GAME_CONSTANTS.COMBO_GROWTH_BONUS[tier];
}
