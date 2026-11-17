// Emberkeeper: every number that tunes the game lives here, so the rest of the
// code reads like the rules of the game instead of a pile of literals.
export const STEP = 1 / 60;

export const FIELD = { width: 1280, height: 720 };

export const PLAYER = {
  radius: 16,
  accel: 2600,
  maxSpeed: 340,
  friction: 6,
  invulnSeconds: 1.6,
};

export const LIVES_START = 3;
export const LIVES_MAX = 3;

export const FLARE = {
  startCharges: 2,
  maxCharges: 3,
  radius: 150,
  cooldownSeconds: 0.6,
  embersPerCharge: 8,
};

export const EMBER = {
  radius: 9,
  collectRadius: 30,
  points: 10,
  targetOnField: 12,
  spawnSeconds: 0.9,
  driftSpeed: 14,
};

export const STAR_EMBER = {
  radius: 16,
  collectRadius: 38,
  points: 50,
  spawnSeconds: 22,
};

export const HEART = {
  radius: 14,
  collectRadius: 32,
  spawnSeconds: 45,
};

export const WISP = {
  drifter: { radius: 14, speed: 78, points: 15 },
  darter: { radius: 13, speed: 62, dashSpeed: 430, dashSeconds: 0.5, telegraphSeconds: 0.55, restSeconds: 1.4, points: 20 },
  brute: { radius: 27, speed: 46, points: 30 },
};

export const WAVES_TO_DAWN = 10;
export const WAVE_QUOTA = (wave) => 10 + 5 * wave;
export const WAVE_BONUS = (wave) => 100 * wave;
export const COMBO_MAX = 8;

export const BEST_KEY = 'emberkeeper.best';
export const MUTE_KEY = 'emberkeeper.muted';

export const PALETTE = {
  skyTop: '#0a0f2e',
  skyBottom: '#1b1440',
  meadow: '#141b38',
  meadowEdge: '#0d1330',
  grass: '#1e2c52',
  grassTip: '#2c3f6e',
  ember: '#ffb347',
  emberCore: '#ffe9a8',
  starEmber: '#ffd166',
  wispBody: '#241f3d',
  wispEdge: '#6d5bd0',
  wispEye: '#c9b8ff',
  playerCloak: '#3b2f5e',
  playerHood: '#54448a',
  lantern: '#ffe9a8',
  lanternGlow: 'rgba(255, 190, 90, 0.55)',
  text: '#f2ead8',
  textDim: '#b9b3d6',
  heart: '#ff6b81',
  danger: '#ff5d5d',
  panel: 'rgba(10, 14, 38, 0.82)',
  panelEdge: '#6d5bd0',
};
