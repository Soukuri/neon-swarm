// NEON SWARM — every tunable number and the shared palette live here, so the
// simulation, the renderer and the staged screenshots all agree on one tuning.

/** Fixed simulation step, in seconds: the world advances in 1/60 s ticks. */
export const STEP = 1 / 60;

/** The arena is a fixed logical field; the renderer letterboxes it to fit. */
export const ARENA_W = 1280;
export const ARENA_H = 800;

/** localStorage key for the best score. */
export const BEST_KEY = 'neon-swarm-best';

/** The palette: deep space navy, one hero colour per actor, white text. */
export const COLORS = {
  bg: '#070a18',
  bgGlow: '#0d1330',
  grid: 'rgba(96, 140, 255, 0.10)',
  gridMajor: 'rgba(96, 140, 255, 0.20)',
  wall: '#2b3a6e',
  player: '#39e6ff',
  playerCore: '#e8fbff',
  bullet: '#aef4ff',
  chaser: '#ff4d8d',
  darter: '#ffb02e',
  splitter: '#7dff5e',
  mite: '#b6ff9e',
  brute: '#c95bff',
  shard: '#59ffc8',
  heart: '#ff5d73',
  text: '#eef4ff',
  dim: '#8fa3d9',
  gold: '#ffd94d',
};

/** Player base stats; upgrades add to these. */
export const PLAYER_BASE = {
  radius: 14,
  speed: 300,
  hp: 5,
  fireInterval: 0.22,
  bulletDamage: 1,
  bulletSpeed: 640,
  multishot: 1,
  magnet: 90,
  dashCooldown: 2.2,
  dashTime: 0.16,
  dashSpeed: 1150,
};

/** Enemy archetypes: stats and the first wave each one appears in. */
export const ENEMY_TYPES = {
  chaser: { radius: 15, hp: 2, speed: 118, score: 100, xp: 1, fromWave: 1 },
  darter: { radius: 13, hp: 2, speed: 92, score: 150, xp: 1, fromWave: 2 },
  splitter: { radius: 19, hp: 4, speed: 74, score: 200, xp: 2, fromWave: 3 },
  mite: { radius: 9, hp: 1, speed: 168, score: 50, xp: 1, fromWave: 3 },
  brute: { radius: 30, hp: 16, speed: 52, score: 600, xp: 6, fromWave: 5 },
};

/** XP needed to reach the next level: level n needs XP_CURVE[n-1] shards. */
export const XP_CURVE = [5, 8, 12, 17, 23, 30, 38, 47, 57, 68, 80, 93, 107, 122, 138];

/**
 * The upgrade pool. Each level-up offers three distinct cards drawn from it;
 * `apply` mutates the player's stat block, `blurb` is what the card promises.
 */
export const UPGRADES = [
  { id: 'rapid', name: 'RAPID CYCLER', blurb: 'Fire 18% faster', apply: (p) => { p.fireInterval *= 0.82; } },
  { id: 'split', name: 'SPLIT CANNON', blurb: '+1 bullet per shot', apply: (p) => { p.multishot += 1; } },
  { id: 'heavy', name: 'HEAVY ROUNDS', blurb: '+1 bullet damage', apply: (p) => { p.bulletDamage += 1; } },
  { id: 'swift', name: 'ION THRUSTERS', blurb: 'Move 12% faster', apply: (p) => { p.speed *= 1.12; } },
  { id: 'magnet', name: 'WIDER TRACTOR', blurb: '+70% shard pull range', apply: (p) => { p.magnet *= 1.7; } },
  { id: 'hull', name: 'REINFORCED HULL', blurb: '+1 max heart, healed', apply: (p) => { p.maxHp += 1; p.hp += 1; } },
  { id: 'dash', name: 'PHASE DASH+', blurb: 'Dash recharges 30% faster', apply: (p) => { p.dashCooldown *= 0.7; } },
  { id: 'velocity', name: 'RAIL VELOCITY', blurb: 'Bullets fly 25% faster', apply: (p) => { p.bulletSpeed *= 1.25; } },
];
