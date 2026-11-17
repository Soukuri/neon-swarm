// Staged scenes for the maker's screenshots: `?shot=<name>&seed=<n>` builds
// one frozen moment with the game's own simulation and renderer, so every
// screenshot is a real render of the code that ships. Scenes are assembled
// through the world's public staging hooks, never by editing pixels.

import { UPGRADES } from './config.js';
import { SCREEN_LEVELUP, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

/** A busy mid-wave fight: the player kiting a mixed swarm, combo running. */
function stagePlay(world) {
  const { state } = world;
  world.stage({
    state: {
      time: 34.2,
      wave: 4,
      score: 12450,
      kills: 87,
      combo: 9,
      comboTimer: 1.8,
      bestCombo: 14,
      level: 6,
      xp: 9,
      xpNext: 23,
    },
    player: { x: 430, y: 440, aim: -0.5, hp: 4 },
    stats: { maxHp: 5, hp: 4, multishot: 2 },
  });
  world.spawnAt('chaser', 760, 300);
  world.spawnAt('chaser', 830, 420);
  world.spawnAt('chaser', 700, 520);
  world.spawnAt('darter', 950, 240);
  const darter = world.spawnAt('darter', 880, 560);
  darter.state = 'aim';
  world.spawnAt('splitter', 620, 210);
  world.spawnAt('mite', 660, 250);
  world.spawnAt('mite', 590, 180);
  world.spawnAt('brute', 1050, 430);
  world.spawnAt('chaser', 240, 620);
  world.spawnAt('splitter', 180, 240);
  // Bullets in flight along the aim line, and a fresh kill's debris.
  for (let i = 0; i < 5; i += 1) {
    state.bullets.push({
      x: 470 + i * 52,
      y: 415 - i * 26,
      vx: 560,
      vy: -280,
      damage: 1,
      life: 0.8,
    });
  }
  world.burst(700, 330, '#ff4d8d', 14, 240, 0.55, 4);
  state.texts.push({ x: 700, y: 290, text: '+315', color: '#eef4ff', life: 0.8, maxLife: 0.9 });
  for (let i = 0; i < 7; i += 1) {
    state.shards.push({
      x: 520 + (i % 3) * 44,
      y: 350 + Math.floor(i / 3) * 46,
      vx: 0,
      vy: 0,
      value: 1,
    });
  }
  return SCREEN_PLAY;
}

/** The level-up choice, over the same fight dimmed behind the cards. */
function stageLevelUp(world) {
  stagePlay(world);
  const wanted = ['split', 'hull', 'rapid'];
  world.state.choices = wanted.map((id) => UPGRADES.find((u) => u.id === id));
  return SCREEN_LEVELUP;
}

/** The moment after the swarm wins: wreckage, hunters closing in. */
function stageOver(world) {
  const { state } = world;
  world.stage({
    state: {
      time: 96.7,
      wave: 7,
      score: 18930,
      kills: 164,
      bestCombo: 21,
      level: 9,
      over: true,
    },
    player: { x: 640, y: 400, hp: 0 },
    stats: { maxHp: 6, hp: 0 },
  });
  world.spawnAt('chaser', 430, 300);
  world.spawnAt('chaser', 990, 260);
  world.spawnAt('darter', 850, 300);
  world.spawnAt('splitter', 250, 520);
  world.spawnAt('brute', 640, 150);
  world.spawnAt('chaser', 420, 640);
  world.spawnAt('mite', 860, 650);
  // The wreck: debris scattered on two rings where the ship blew apart.
  // (Placed by hand — a burst would sit stacked on one point in a still.)
  for (let i = 0; i < 26; i += 1) {
    const angle = (i / 26) * Math.PI * 2;
    const ring = i % 2 === 0 ? 66 : 118;
    state.particles.push({
      x: 640 + Math.cos(angle) * ring,
      y: 400 + Math.sin(angle) * ring * 0.8,
      vx: 0,
      vy: 0,
      life: 0.5 + (i % 5) * 0.12,
      maxLife: 0.95,
      size: 4 + (i % 3),
      color: i % 3 === 0 ? '#ff4d8d' : '#39e6ff',
    });
  }
  return SCREEN_OVER;
}

/**
 * Build the named scene in `world` and return the screen to show.
 * The title scene needs no staging: the renderer animates it from time.
 */
export function stageShot(name, world) {
  if (name === 'play') return { screen: stagePlay(world), best: 15200 };
  if (name === 'levelup') return { screen: stageLevelUp(world), best: 15200 };
  if (name === 'over') return { screen: stageOver(world), best: 15200 };
  world.state.time = 2.4;
  return { screen: SCREEN_TITLE, best: 15200 };
}
