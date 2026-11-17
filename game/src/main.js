// Boot and the one loop. The shell owns the screens (title, play, level-up,
// paused, game over), feeds the world a plain input snapshot each fixed
// step, and turns world events into sound. The world itself never touches
// the DOM.
//
// ?seed=N fixes a run's randomness. ?shot=start|play|levelup|over (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld,
  EVENT_BRUTE_DOWN,
  EVENT_DASH,
  EVENT_EXPLODE,
  EVENT_HIT,
  EVENT_HURT,
  EVENT_LEVELUP,
  EVENT_OVER,
  EVENT_PICKUP,
  EVENT_SHOOT,
  EVENT_WAVE,
} from './world.js';
import { ACTION_CONFIRM, ACTION_DASH, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  createRenderer,
  SCREEN_LEVELUP,
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
} from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const runSeed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const input = createInput(canvas, renderer.toArena);
const audio = createAudio();

let world = createWorld(createRandom(runSeed));
let screen = SCREEN_TITLE;
let best = readBest();
let overTimer = 0;

window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyM') audio.toggleMute();
});

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score lasts this visit.
  }
}

function announce(message) {
  if (status) status.textContent = message;
}

function startRun() {
  world = createWorld(createRandom(Math.floor(Math.random() * 4294967296)));
  screen = SCREEN_PLAY;
  overTimer = 0;
  audio.unlock();
  announce('Run started. Wave 1 incoming.');
}

function playEvents(events) {
  for (const event of events) {
    if (event === EVENT_SHOOT) audio.shoot();
    else if (event === EVENT_HIT) audio.hit();
    else if (event === EVENT_EXPLODE) audio.explode(false);
    else if (event === EVENT_BRUTE_DOWN) audio.explode(true);
    else if (event === EVENT_HURT) audio.hurt();
    else if (event === EVENT_PICKUP) audio.pickup();
    else if (event === EVENT_DASH) audio.dash();
    else if (event === EVENT_WAVE) audio.wave();
    else if (event === EVENT_OVER) audio.gameover();
    else if (event === EVENT_LEVELUP) audio.levelup();
  }
}

function stepWorld(dt) {
  const move = input.moveVector();
  const snapshot = {
    moveX: move.x,
    moveY: move.y,
    aimX: input.mouse.x,
    aimY: input.mouse.y,
    firing: input.mouse.down || input.actionHeld(ACTION_CONFIRM),
    dash: input.actionHeld(ACTION_DASH),
  };
  const events = world.update(dt, snapshot);
  playEvents(events);
  if (world.state.over && screen === SCREEN_PLAY) {
    screen = SCREEN_OVER;
    overTimer = 0;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Game over. Score ${world.state.score}, wave ${world.state.wave}. Press R to retry.`);
  } else if (world.state.pendingLevels > 0 && screen === SCREEN_PLAY) {
    world.rollChoices();
    screen = SCREEN_LEVELUP;
    announce(`Level ${world.state.level}. Choose an upgrade: 1, 2 or 3.`);
  }
}

function chooseUpgrade(index) {
  if (index < 0 || index >= world.state.choices.length) return;
  world.applyChoice(index);
  audio.choose();
  if (world.state.pendingLevels > 0) {
    world.rollChoices();
  } else {
    screen = SCREEN_PLAY;
  }
}

function pickCardAt(x, y) {
  const rects = renderer.cardRects();
  for (let i = 0; i < rects.length; i += 1) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

function handleScreenInput() {
  if (screen === SCREEN_TITLE) {
    if (input.actionTapped(ACTION_CONFIRM) || input.mouse.clicked) startRun();
    return;
  }
  if (screen === SCREEN_OVER) {
    overTimer += STEP;
    if (overTimer > 0.6 && (input.actionTapped(ACTION_RESTART) || input.actionTapped(ACTION_CONFIRM) || input.mouse.clicked)) {
      startRun();
    }
    return;
  }
  if (screen === SCREEN_LEVELUP) {
    const number = input.numberTapped();
    if (number > 0) chooseUpgrade(number - 1);
    else if (input.mouse.clicked) chooseUpgrade(pickCardAt(input.mouse.x, input.mouse.y));
    return;
  }
  if (input.actionTapped(ACTION_PAUSE)) {
    screen = screen === SCREEN_PAUSED ? SCREEN_PLAY : SCREEN_PAUSED;
  }
}

let last = performance.now();
let accumulator = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let elapsed = (now - last) / 1000;
  last = now;
  if (elapsed > MAX_FRAME) elapsed = MAX_FRAME;
  accumulator += elapsed;
  while (accumulator >= STEP) {
    accumulator -= STEP;
    if (screen === SCREEN_PLAY) stepWorld(STEP);
    else if (screen === SCREEN_OVER) world.update(STEP, { moveX: 0, moveY: 0, aimX: 0, aimY: 0, firing: false, dash: false });
    else world.state.time += STEP;
    handleScreenInput();
  }
  renderer.draw(world.state, screen, { best, muted: audio.muted });
  input.endFrame();
}

if (shot) {
  const staged = stageShot(shot, world);
  screen = staged.screen;
  best = staged.best;
  let painted = 0;
  const paint = () => {
    renderer.draw(world.state, screen, { best, muted: false });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  };
  requestAnimationFrame(paint);
} else {
  announce('NEON SWARM. Press Enter or click to launch.');
  requestAnimationFrame(frame);
}
