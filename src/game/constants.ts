export const GAME_CONSTANTS = {
  // Physics
  GRAVITY_STRENGTH: 8000000, // 8M (Was 700k) - Needs massive force to pull from distance
  REPEL_STRENGTH: 10000000,  // 10M (Was 1.8M) - Instant "Get away" force
  SOFTENING: 3000,
  DAMPING: 0.99,            // Near frictionless
  MAX_SPEED: 1000,          // Fast as bullets
  DT: 0.016,

  // Tractor / Catching
  GRAB_RADIUS: 220,
  TRACTOR_FORCE: 4000,
  TRACTOR_DAMPING: 0.92,
  CAPTURE_TIME_MS: 1200,

  // Growth & Decay
  MIN_RADIUS: 30,
  VICTORY_RADIUS: 999999,   // Inaccessable (Endless)
  GROWTH_PER_ORB: 1,        // Micro-growth
  DECAY_RATE: 10,           // Aggressive shrinking
  DECAY_DELAY_MS: 1500,

  // Wave System (Seamless)
  WAVE_TRANSITION_MS: 2000,
  WAVE_DENSITY_BASE: 5,     // Start with 5 orbs constantly on screen
  WAVE_DENSITY_INCREMENT: 3, // +3 density per wave
  WAVE_MAX_DENSITY: 30,     // Cap density to prevent crash

  WAVE_REQUIRED_BASE: 10,   // Eat 10 to clear Wave 1
  WAVE_REQUIRED_INCREMENT: 5, // +5 requirement per wave

  WAVE_SPAWN_COOLDOWN: 200, // Min time between spawns to prevent gluts

  // Legacy / Deprecated
  WAVE_1_ORB_COUNT: 15,
  WAVE_ORB_INCREMENT: 5,
  WAVE_MAX_ORBS: 999,
  WAVE_SPAWN_RATE_BASE: 800,
  WAVE_SPAWN_RATE_MIN: 300,
  WAVE_SPAWN_RATE_DECAY: 100,

  // Input
  CURSOR_SMOOTHING: 0.25,
  PINCH_ON_RATIO: 0.35,
  PINCH_OFF_RATIO: 0.6,
  HAND_TIMEOUT: 500,
  INPUT_SENSITIVITY: 2.8,

  // Combo System
  COMBO_WINDOW_MS: 2000,
  COMBO_MULTIPLIERS: [1.0, 1.0, 1.5, 2.0, 2.5, 3.0],
  COMBO_GROWTH_BONUS: [0, 0, 4, 8, 12, 16],

  // Rendering
  ORB_RADIUS: 12,
  BOMB_RADIUS: 16,
  TRAIL_LENGTH: 15,
};

export const THEME_COLORS = {
  ATTRACT: '#22d3ee',
  REPEL: '#f472b6',
  ORB_PRIMARY: '#a78bfa',
  ORB_SECONDARY: '#c084fc',
  BOMB: '#ef4444',
  CRACK: '#ffffff',
  BG: '#020617',
};
