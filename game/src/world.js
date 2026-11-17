// The simulation: player, bullets, enemies, shards and particles, advanced
// in fixed steps. The world knows nothing about the DOM or the canvas; it
// reads a plain input snapshot and emits events the shell turns into sound
// and screen changes. Waves grow denser and unlock new enemy types; kills
// drop XP shards, and filling the XP bar opens an upgrade choice.

import { ARENA_H, ARENA_W, ENEMY_TYPES, PLAYER_BASE, UPGRADES, XP_CURVE } from './config.js';

export const EVENT_SHOOT = 'shoot';
export const EVENT_HIT = 'hit';
export const EVENT_EXPLODE = 'explode';
export const EVENT_BRUTE_DOWN = 'brute-down';
export const EVENT_HURT = 'hurt';
export const EVENT_PICKUP = 'pickup';
export const EVENT_LEVELUP = 'levelup';
export const EVENT_DASH = 'dash';
export const EVENT_WAVE = 'wave';
export const EVENT_OVER = 'over';

const ENEMY_SEPARATION = 0.6;
const CONTACT_COOLDOWN = 0.8;

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createWorld(random) {
  const state = {
    time: 0,
    wave: 0,
    waveTimer: 0,
    spawnQueue: 0,
    spawnTimer: 0,
    score: 0,
    kills: 0,
    combo: 0,
    comboTimer: 0,
    bestCombo: 0,
    level: 1,
    xp: 0,
    xpNext: XP_CURVE[0],
    pendingLevels: 0,
    choices: [],
    shake: 0,
    flash: 0,
    over: false,
    player: null,
    bullets: [],
    enemies: [],
    shards: [],
    particles: [],
    texts: [],
  };

  function resetPlayer() {
    // The stats block is the single source of truth for hp too: upgrades
    // write there, and syncStats mirrors hp/maxHp onto the player object.
    const stats = { ...PLAYER_BASE, maxHp: PLAYER_BASE.hp };
    state.player = {
      x: ARENA_W / 2,
      y: ARENA_H / 2,
      vx: 0,
      vy: 0,
      aim: 0,
      hp: stats.hp,
      maxHp: stats.maxHp,
      fireTimer: 0,
      dashTimer: 0,
      dashCooldownTimer: 0,
      invulnTimer: 0,
      contactTimer: 0,
      stats,
    };
  }
  resetPlayer();

  /** Build one enemy of `type` at a position, with this wave's hp scaling. */
  function makeEnemy(type, x, y) {
    const spec = ENEMY_TYPES[type];
    return {
      type,
      x,
      y,
      vx: 0,
      vy: 0,
      radius: spec.radius,
      hp: spec.hp + Math.floor(state.wave / 4),
      maxHp: spec.hp + Math.floor(state.wave / 4),
      speed: spec.speed * random.range(0.9, 1.1),
      score: spec.score,
      xp: spec.xp,
      state: 'chase',
      stateTimer: random.range(0.4, 1.2),
      dashVx: 0,
      dashVy: 0,
      flashTimer: 0,
      wobble: random.range(0, Math.PI * 2),
    };
  }

  /** Spawn one enemy of `type` just outside a random arena edge. */
  function spawnEnemy(type) {
    const edge = random.int(0, 3);
    const margin = 40;
    let x = 0;
    let y = 0;
    if (edge === 0) { x = random.range(0, ARENA_W); y = -margin; }
    if (edge === 1) { x = ARENA_W + margin; y = random.range(0, ARENA_H); }
    if (edge === 2) { x = random.range(0, ARENA_W); y = ARENA_H + margin; }
    if (edge === 3) { x = -margin; y = random.range(0, ARENA_H); }
    state.enemies.push(makeEnemy(type, x, y));
  }

  /** Spawn one enemy of `type` at an exact spot (screenshot staging). */
  function spawnAt(type, x, y) {
    const enemy = makeEnemy(type, x, y);
    state.enemies.push(enemy);
    return enemy;
  }

  /** Begin a wave: queue its enemies; composition unlocks with the wave. */
  function startWave(events) {
    state.wave += 1;
    const count = 5 + state.wave * 3;
    state.spawnQueue = count;
    state.spawnTimer = 0;
    state.waveTimer = 0;
    events.push(EVENT_WAVE);
    if (state.wave % 5 === 0) {
      for (let i = 0; i < state.wave / 5; i += 1) spawnEnemy('brute');
    }
  }

  /** Pick the type for the next queued spawn, weighted by the wave. */
  function nextSpawnType() {
    const wave = state.wave;
    const pool = ['chaser', 'chaser'];
    if (wave >= 2) pool.push('darter', 'darter');
    if (wave >= 3) pool.push('splitter');
    if (wave >= 4) pool.push('chaser');
    if (wave >= 6) pool.push('darter', 'splitter');
    return random.pick(pool);
  }

  function burst(x, y, color, count, speed, life, size) {
    for (let i = 0; i < count; i += 1) {
      const angle = random.range(0, Math.PI * 2);
      const v = random.range(speed * 0.3, speed);
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life: random.range(life * 0.5, life),
        maxLife: life,
        size: random.range(size * 0.5, size),
        color,
      });
    }
  }

  function floatText(x, y, text, color) {
    state.texts.push({ x, y, text, color, life: 0.9, maxLife: 0.9 });
  }

  function killEnemy(enemy, events) {
    state.kills += 1;
    state.combo += 1;
    state.comboTimer = 2.5;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    const gained = Math.round(enemy.score * (1 + Math.min(state.combo, 40) * 0.05));
    state.score += gained;
    burst(enemy.x, enemy.y, specColor(enemy.type), enemy.type === 'brute' ? 42 : 16, 260, 0.5, 4);
    floatText(enemy.x, enemy.y - enemy.radius - 6, `+${gained}`, '#eef4ff');
    events.push(enemy.type === 'brute' ? EVENT_BRUTE_DOWN : EVENT_EXPLODE);
    state.shake = Math.min(14, state.shake + (enemy.type === 'brute' ? 10 : 3));
    for (let i = 0; i < enemy.xp; i += 1) {
      state.shards.push({
        x: enemy.x + random.range(-10, 10),
        y: enemy.y + random.range(-10, 10),
        vx: random.range(-40, 40),
        vy: random.range(-40, 40),
        value: 1,
      });
    }
    if (enemy.type === 'splitter') {
      for (let i = 0; i < 3; i += 1) {
        const mite = {
          type: 'mite',
          x: enemy.x + random.range(-16, 16),
          y: enemy.y + random.range(-16, 16),
          vx: 0,
          vy: 0,
          radius: ENEMY_TYPES.mite.radius,
          hp: ENEMY_TYPES.mite.hp,
          maxHp: ENEMY_TYPES.mite.hp,
          speed: ENEMY_TYPES.mite.speed,
          score: ENEMY_TYPES.mite.score,
          xp: 0,
          state: 'chase',
          stateTimer: 1,
          dashVx: 0,
          dashVy: 0,
          flashTimer: 0,
          wobble: random.range(0, Math.PI * 2),
        };
        state.enemies.push(mite);
      }
    }
  }

  function specColor(type) {
    return {
      chaser: '#ff4d8d',
      darter: '#ffb02e',
      splitter: '#7dff5e',
      mite: '#b6ff9e',
      brute: '#c95bff',
    }[type];
  }

  function gainXp(value, events) {
    state.xp += value;
    while (state.xp >= state.xpNext) {
      state.xp -= state.xpNext;
      state.level += 1;
      state.pendingLevels += 1;
      state.xpNext = XP_CURVE[Math.min(state.level - 1, XP_CURVE.length - 1)];
      events.push(EVENT_LEVELUP);
    }
  }

  /** Draw three distinct upgrade cards for a pending level-up. */
  function rollChoices() {
    const pool = [...UPGRADES];
    const drawn = [];
    while (drawn.length < 3 && pool.length > 0) {
      const index = random.int(0, pool.length - 1);
      drawn.push(pool.splice(index, 1)[0]);
    }
    state.choices = drawn;
    return drawn;
  }

  function applyChoice(index) {
    const card = state.choices[index];
    if (!card) return;
    card.apply(state.player.stats);
    syncStats();
    state.pendingLevels = Math.max(0, state.pendingLevels - 1);
    state.choices = [];
  }

  /** Mirror hp/maxHp from the stats block onto the player object. */
  function syncStats() {
    const stats = state.player.stats;
    state.player.maxHp = stats.maxHp;
    state.player.hp = Math.min(stats.hp, stats.maxHp);
    stats.hp = state.player.hp;
  }

  /**
   * Advance the world by one fixed step.
   * `input` is { moveX, moveY, aimX, aimY, firing, dash }.
   * Returns the events that happened this step.
   */
  function update(dt, input) {
    const events = [];
    if (state.over) {
      updateFx(dt);
      return events;
    }
    const player = state.player;
    const stats = player.stats;
    state.time += dt;

    // Waves: a new one starts when the field is clear and the queue is empty.
    state.waveTimer += dt;
    if (state.spawnQueue <= 0 && state.enemies.length === 0) startWave(events);
    if (state.spawnQueue > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        spawnEnemy(nextSpawnType());
        state.spawnQueue -= 1;
        state.spawnTimer = Math.max(0.18, 0.85 - state.wave * 0.05);
      }
    }

    // Combo decay.
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }

    // Player movement and dash.
    player.dashCooldownTimer = Math.max(0, player.dashCooldownTimer - dt);
    player.invulnTimer = Math.max(0, player.invulnTimer - dt);
    player.contactTimer = Math.max(0, player.contactTimer - dt);
    if (input.dash && player.dashCooldownTimer <= 0 && player.dashTimer <= 0) {
      player.dashTimer = stats.dashTime;
      player.dashCooldownTimer = stats.dashCooldown;
      player.invulnTimer = Math.max(player.invulnTimer, stats.dashTime + 0.05);
      events.push(EVENT_DASH);
    }
    let speed = stats.speed;
    if (player.dashTimer > 0) {
      player.dashTimer -= dt;
      speed = stats.dashSpeed;
    }
    player.vx = input.moveX * speed;
    player.vy = input.moveY * speed;
    if (player.dashTimer > 0 && input.moveX === 0 && input.moveY === 0) {
      player.vx = Math.cos(player.aim) * speed;
      player.vy = Math.sin(player.aim) * speed;
    }
    player.x += player.vx * dt;
    player.x = Math.max(playerRadius(), Math.min(ARENA_W - playerRadius(), player.x));
    player.y = Math.max(playerRadius(), Math.min(ARENA_H - playerRadius(), player.y + player.vy * dt));
    player.aim = Math.atan2(input.aimY - player.y, input.aimX - player.x);

    // Firing.
    player.fireTimer -= dt;
    if (input.firing && player.fireTimer <= 0) {
      player.fireTimer = stats.fireInterval;
      const shots = stats.multishot;
      for (let i = 0; i < shots; i += 1) {
        const spread = (i - (shots - 1) / 2) * 0.09;
        const angle = player.aim + spread;
        state.bullets.push({
          x: player.x + Math.cos(player.aim) * (playerRadius() + 6),
          y: player.y + Math.sin(player.aim) * (playerRadius() + 6),
          vx: Math.cos(angle) * stats.bulletSpeed,
          vy: Math.sin(angle) * stats.bulletSpeed,
          damage: stats.bulletDamage,
          life: 0.9,
        });
      }
      events.push(EVENT_SHOOT);
    }

    // Bullets.
    for (const bullet of state.bullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
    }
    state.bullets = state.bullets.filter(
      (b) => b.life > 0 && b.x > -20 && b.x < ARENA_W + 20 && b.y > -20 && b.y < ARENA_H + 20,
    );

    // Enemies.
    for (const enemy of state.enemies) {
      enemy.flashTimer = Math.max(0, enemy.flashTimer - dt);
      enemy.wobble += dt * 3;
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const d = Math.hypot(dx, dy) || 1;
      if (enemy.type === 'darter') {
        enemy.stateTimer -= dt;
        if (enemy.state === 'chase' && enemy.stateTimer <= 0 && d < 340) {
          enemy.state = 'aim';
          enemy.stateTimer = 0.45;
        } else if (enemy.state === 'aim' && enemy.stateTimer <= 0) {
          enemy.state = 'dash';
          enemy.stateTimer = 0.32;
          enemy.dashVx = (dx / d) * 560;
          enemy.dashVy = (dy / d) * 560;
        } else if (enemy.state === 'dash' && enemy.stateTimer <= 0) {
          enemy.state = 'chase';
          enemy.stateTimer = random.range(0.7, 1.4);
        }
        if (enemy.state === 'dash') {
          enemy.vx = enemy.dashVx;
          enemy.vy = enemy.dashVy;
        } else {
          enemy.vx = (dx / d) * enemy.speed;
          enemy.vy = (dy / d) * enemy.speed;
        }
      } else {
        enemy.vx = (dx / d) * enemy.speed;
        enemy.vy = (dy / d) * enemy.speed;
      }
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
    }
    // Gentle separation so the swarm does not stack into one blob.
    for (let i = 0; i < state.enemies.length; i += 1) {
      for (let j = i + 1; j < state.enemies.length; j += 1) {
        const a = state.enemies[i];
        const b = state.enemies[j];
        const min = (a.radius + b.radius) * ENEMY_SEPARATION;
        const d2 = dist2(a.x, a.y, b.x, b.y);
        if (d2 > 0.01 && d2 < min * min) {
          const d = Math.sqrt(d2);
          const push = ((min - d) / d) * 0.5;
          const px = (a.x - b.x) * push;
          const py = (a.y - b.y) * push;
          a.x += px;
          a.y += py;
          b.x -= px;
          b.y -= py;
        }
      }
    }

    // Bullet hits.
    const dead = new Set();
    for (const bullet of state.bullets) {
      for (const enemy of state.enemies) {
        if (dead.has(enemy)) continue;
        const rr = enemy.radius + 5;
        if (dist2(bullet.x, bullet.y, enemy.x, enemy.y) < rr * rr) {
          bullet.life = 0;
          enemy.hp -= bullet.damage;
          enemy.flashTimer = 0.08;
          events.push(EVENT_HIT);
          if (enemy.hp <= 0) {
            dead.add(enemy);
            killEnemy(enemy, events);
          }
          break;
        }
      }
    }
    if (dead.size > 0) state.enemies = state.enemies.filter((e) => !dead.has(e));
    state.bullets = state.bullets.filter((b) => b.life > 0);

    // Contact damage.
    if (player.invulnTimer <= 0 && player.contactTimer <= 0) {
      for (const enemy of state.enemies) {
        const rr = enemy.radius + playerRadius();
        if (dist2(enemy.x, enemy.y, player.x, player.y) < rr * rr) {
          player.hp -= 1;
          player.stats.hp = player.hp;
          player.contactTimer = CONTACT_COOLDOWN;
          player.invulnTimer = 0.6;
          state.flash = 0.5;
          state.shake = Math.min(16, state.shake + 8);
          burst(player.x, player.y, '#ff5d73', 18, 240, 0.4, 4);
          events.push(EVENT_HURT);
          if (player.hp <= 0) {
            state.over = true;
            burst(player.x, player.y, '#39e6ff', 60, 340, 0.9, 5);
            events.push(EVENT_OVER);
          }
          break;
        }
      }
    }

    // Shards drift, then fly to the player inside the magnet radius.
    for (const shard of state.shards) {
      const dx = player.x - shard.x;
      const dy = player.y - shard.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < stats.magnet) {
        const pull = 520 * (1 - d / (stats.magnet * 1.6));
        shard.vx += (dx / d) * pull * dt * 4;
        shard.vy += (dy / d) * pull * dt * 4;
      }
      shard.vx *= 0.92;
      shard.vy *= 0.92;
      shard.x += shard.vx * dt;
      shard.y += shard.vy * dt;
      if (d < playerRadius() + 12) {
        shard.taken = true;
        gainXp(shard.value, events);
        events.push(EVENT_PICKUP);
      }
    }
    state.shards = state.shards.filter((s) => !s.taken);

    updateFx(dt);
    state.shake = Math.max(0, state.shake - dt * 26);
    state.flash = Math.max(0, state.flash - dt * 1.4);
    return events;
  }

  function playerRadius() {
    return state.player.stats.radius;
  }

  function updateFx(dt) {
    for (const particle of state.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.94;
      particle.vy *= 0.94;
      particle.life -= dt;
    }
    state.particles = state.particles.filter((p) => p.life > 0);
    for (const text of state.texts) {
      text.y -= 34 * dt;
      text.life -= dt;
    }
    state.texts = state.texts.filter((t) => t.life > 0);
  }

  return {
    state,
    update,
    rollChoices,
    applyChoice,
    spawnEnemy,
    spawnAt,
    burst,
    /** Test and screenshot staging: place the player and set core fields. */
    stage(patch) {
      Object.assign(state, patch.state ?? {});
      if (patch.player) Object.assign(state.player, patch.player);
      if (patch.stats) Object.assign(state.player.stats, patch.stats);
      syncStats();
    },
  };
}
