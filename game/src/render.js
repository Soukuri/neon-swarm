// All drawing: the arena, the actors, the HUD and the four screens (title,
// play, level-up choice, pause, game over). The renderer owns the letterbox
// transform between window pixels and arena coordinates, and paints with a
// restrained neon palette: glow is faked with layered strokes, never with
// shadow blur, so the frame stays cheap.

import { ARENA_H, ARENA_W, COLORS } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_LEVELUP = 'levelup';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const FONT = 'system-ui, "Segoe UI", Roboto, "Helvetica Neue", sans-serif';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let view = { scale: 1, ox: 0, oy: 0, w: 0, h: 0 };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const scale = Math.min(w / ARENA_W, h / ARENA_H);
    view = {
      scale: scale * dpr,
      ox: (w - ARENA_W * scale) * 0.5 * dpr,
      oy: (h - ARENA_H * scale) * 0.5 * dpr,
      w,
      h,
    };
  }
  window.addEventListener('resize', resize);
  resize();

  /** Convert client (CSS pixel) coordinates to arena coordinates. */
  function toArena(clientX, clientY) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    return {
      x: (clientX * dpr - view.ox) / view.scale,
      y: (clientY * dpr - view.oy) / view.scale,
    };
  }

  function draw(state, screen, ui) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const shakeX = state.shake ? (Math.sin(state.time * 91) * state.shake) : 0;
    const shakeY = state.shake ? (Math.cos(state.time * 113) * state.shake) : 0;
    ctx.setTransform(view.scale, 0, 0, view.scale, view.ox + shakeX * view.scale, view.oy + shakeY * view.scale);

    drawArena(state);
    if (screen === SCREEN_TITLE) {
      drawTitleAmbient(state);
    } else {
      drawShards(state);
      drawEnemies(state);
      drawBullets(state);
      if (!state.over) drawPlayer(state);
      drawParticles(state);
      drawTexts(state);
    }

    if (state.flash > 0) {
      ctx.fillStyle = `rgba(255, 60, 90, ${0.22 * state.flash})`;
      ctx.fillRect(0, 0, ARENA_W, ARENA_H);
    }

    if (screen === SCREEN_PLAY || screen === SCREEN_LEVELUP || screen === SCREEN_PAUSED) {
      drawHud(state, ui);
    }
    if (screen === SCREEN_TITLE) drawTitle(state, ui);
    if (screen === SCREEN_LEVELUP) drawLevelUp(state);
    if (screen === SCREEN_PAUSED) drawPaused(ui);
    if (screen === SCREEN_OVER) drawGameOver(state, ui);
  }

  function drawArena(state) {
    const glow = ctx.createRadialGradient(ARENA_W / 2, ARENA_H / 2, 80, ARENA_W / 2, ARENA_H / 2, 720);
    glow.addColorStop(0, COLORS.bgGlow);
    glow.addColorStop(1, COLORS.bg);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= ARENA_W; x += 64) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ARENA_H);
    }
    for (let y = 0; y <= ARENA_H; y += 64) {
      ctx.moveTo(0, y);
      ctx.lineTo(ARENA_W, y);
    }
    ctx.stroke();
    ctx.strokeStyle = COLORS.wall;
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, ARENA_W - 3, ARENA_H - 3);
    // Drifting star specks behind everything, deterministic from time.
    ctx.fillStyle = 'rgba(160, 190, 255, 0.35)';
    for (let i = 0; i < 46; i += 1) {
      const sx = ((i * 173.3 + state.time * (4 + (i % 5))) % (ARENA_W + 40)) - 20;
      const sy = (i * 269.7) % ARENA_H;
      ctx.fillRect(sx, sy, 2, 2);
    }
  }

  /** Decorative swarm silhouettes that patrol the arena's edge on the title
   * screen, so they frame the text instead of crossing it. */
  function drawTitleAmbient(state) {
    const cx = ARENA_W / 2;
    const cy = ARENA_H / 2;
    const x0 = 96;
    const y0 = 92;
    const x1 = ARENA_W - 96;
    const y1 = ARENA_H - 84;
    const w = x1 - x0;
    const h = y1 - y0;
    const perimeter = 2 * (w + h);
    const kinds = ['chaser', 'darter', 'splitter', 'brute', 'chaser', 'darter', 'splitter'];
    for (let i = 0; i < kinds.length; i += 1) {
      let d = (state.time * 42 + (i * perimeter) / kinds.length) % perimeter;
      let x = x0;
      let y = y0;
      let angle = 0;
      if (d < w) { x = x0 + d; y = y0; angle = 0; }
      else if (d < w + h) { x = x1; y = y0 + (d - w); angle = Math.PI / 2; }
      else if (d < 2 * w + h) { x = x1 - (d - w - h); y = y1; angle = Math.PI; }
      else { x = x0; y = y1 - (d - 2 * w - h); angle = -Math.PI / 2; }
      drawEnemyShape({ type: kinds[i], x, y, radius: i === 3 ? 30 : 16, flashTimer: 0, wobble: i }, angle);
    }
    drawPlayerAt(cx, cy + 6, -Math.PI / 2, 1, false);
  }

  function drawPlayer(state) {
    const p = state.player;
    const blink = p.invulnTimer > 0 && Math.floor(state.time * 18) % 2 === 0;
    drawPlayerAt(p.x, p.y, p.aim, p.dashTimer > 0 ? 1.25 : 1, blink);
    if (p.dashCooldownTimer > 0) {
      const frac = 1 - p.dashCooldownTimer / p.stats.dashCooldown;
      ctx.strokeStyle = 'rgba(57, 230, 255, 0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.stats.radius + 9, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawPlayerAt(x, y, aim, stretch, blink) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(aim);
    ctx.globalAlpha = blink ? 0.35 : 1;
    ctx.beginPath();
    ctx.moveTo(18 * stretch, 0);
    ctx.lineTo(-12, 11);
    ctx.lineTo(-7, 0);
    ctx.lineTo(-12, -11);
    ctx.closePath();
    ctx.fillStyle = COLORS.player;
    ctx.fill();
    ctx.strokeStyle = COLORS.playerCore;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(2, 0, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.playerCore;
    ctx.fill();
    ctx.restore();
  }

  function drawEnemies(state) {
    for (const enemy of state.enemies) {
      const angle = Math.atan2(state.player.y - enemy.y, state.player.x - enemy.x);
      drawEnemyShape(enemy, angle);
      if (enemy.maxHp > 4 && enemy.hp < enemy.maxHp) {
        const w = enemy.radius * 2;
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 12, w, 4);
        ctx.fillStyle = '#eef4ff';
        ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 12, w * (enemy.hp / enemy.maxHp), 4);
      }
      if (enemy.type === 'darter' && enemy.state === 'aim') {
        ctx.strokeStyle = 'rgba(255, 176, 46, 0.55)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(enemy.x, enemy.y);
        ctx.lineTo(enemy.x + Math.cos(angle) * 120, enemy.y + Math.sin(angle) * 120);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  function drawEnemyShape(enemy, angle) {
    const color = {
      chaser: COLORS.chaser,
      darter: COLORS.darter,
      splitter: COLORS.splitter,
      mite: COLORS.mite,
      brute: COLORS.brute,
    }[enemy.type];
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    const flash = enemy.flashTimer > 0;
    ctx.fillStyle = flash ? '#ffffff' : color;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1.6;
    const r = enemy.radius;
    ctx.beginPath();
    if (enemy.type === 'chaser') {
      ctx.rotate(angle);
      ctx.moveTo(r, 0);
      ctx.lineTo(-r * 0.8, r * 0.75);
      ctx.lineTo(-r * 0.4, 0);
      ctx.lineTo(-r * 0.8, -r * 0.75);
      ctx.closePath();
    } else if (enemy.type === 'darter') {
      ctx.rotate(angle);
      ctx.moveTo(r * 1.15, 0);
      ctx.lineTo(-r, r * 0.55);
      ctx.lineTo(-r * 0.6, 0);
      ctx.lineTo(-r, -r * 0.55);
      ctx.closePath();
    } else if (enemy.type === 'splitter') {
      const wob = 1 + Math.sin(enemy.wobble) * 0.08;
      for (let i = 0; i < 7; i += 1) {
        const a = (i / 7) * Math.PI * 2 + enemy.wobble * 0.2;
        const px = Math.cos(a) * r * wob;
        const py = Math.sin(a) * r * wob;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else if (enemy.type === 'mite') {
      ctx.arc(0, 0, r, 0, Math.PI * 2);
    } else {
      // brute: a heavy hexagon with an inner ring
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + enemy.wobble * 0.1;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
    if (enemy.type === 'brute') {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
      ctx.strokeStyle = flash ? '#c95bff' : 'rgba(10, 8, 24, 0.65)';
      ctx.lineWidth = 4;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBullets(state) {
    ctx.fillStyle = COLORS.bullet;
    for (const bullet of state.bullets) {
      ctx.save();
      ctx.translate(bullet.x, bullet.y);
      ctx.rotate(Math.atan2(bullet.vy, bullet.vx));
      ctx.fillRect(-7, -2.2, 14, 4.4);
      ctx.restore();
    }
  }

  function drawShards(state) {
    ctx.fillStyle = COLORS.shard;
    for (const shard of state.shards) {
      ctx.save();
      ctx.translate(shard.x, shard.y);
      ctx.rotate(Math.PI / 4 + state.time * 2);
      ctx.fillRect(-4.5, -4.5, 9, 9);
      ctx.restore();
    }
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawTexts(state) {
    ctx.textAlign = 'center';
    ctx.font = `bold 17px ${FONT}`;
    for (const t of state.texts) {
      ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  function text(str, x, y, size, color, align = 'center', weight = 'bold') {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  function drawHud(state, ui) {
    const p = state.player;
    // Hearts, top-left.
    for (let i = 0; i < p.maxHp; i += 1) {
      const x = 30 + i * 30;
      const y = 36;
      ctx.beginPath();
      ctx.moveTo(x, y + 8);
      ctx.bezierCurveTo(x - 11, y - 6, x - 4, y - 13, x, y - 5);
      ctx.bezierCurveTo(x + 4, y - 13, x + 11, y - 6, x, y + 8);
      ctx.closePath();
      ctx.fillStyle = i < p.hp ? COLORS.heart : 'rgba(255, 93, 115, 0.22)';
      ctx.fill();
    }
    text(`LEVEL ${state.level}`, 26, 78, 15, COLORS.dim, 'left');
    // Score and wave, top-center.
    text(String(state.score).padStart(6, '0'), ARENA_W / 2, 44, 30, COLORS.text);
    text(`WAVE ${Math.max(1, state.wave)}`, ARENA_W / 2, 72, 16, COLORS.dim);
    // Combo, top-right.
    if (state.combo >= 3) {
      text(`COMBO x${state.combo}`, ARENA_W - 26, 44, 22, COLORS.gold, 'right');
      const frac = Math.max(0, state.comboTimer / 2.5);
      ctx.fillStyle = 'rgba(255, 217, 77, 0.3)';
      ctx.fillRect(ARENA_W - 26 - 150, 54, 150, 5);
      ctx.fillStyle = COLORS.gold;
      ctx.fillRect(ARENA_W - 26 - 150, 54, 150 * frac, 5);
    }
    text(ui.muted ? 'MUTED (M)' : 'SOUND ON (M)', ARENA_W - 26, 78, 13, COLORS.dim, 'right');
    // XP bar along the bottom.
    const frac = state.xpNext > 0 ? state.xp / state.xpNext : 0;
    ctx.fillStyle = 'rgba(89, 255, 200, 0.16)';
    ctx.fillRect(0, ARENA_H - 10, ARENA_W, 10);
    ctx.fillStyle = COLORS.shard;
    ctx.fillRect(0, ARENA_H - 10, ARENA_W * frac, 10);
    if (state.spawnQueue <= 0 && state.enemies.length === 0 && !state.over) {
      text('WAVE CLEAR', ARENA_W / 2, ARENA_H / 2 - 120, 30, COLORS.shard);
    }
  }

  function drawTitle(state, ui) {
    const cx = ARENA_W / 2;
    text('NEON', cx, 218, 96, COLORS.player);
    text('SWARM', cx, 312, 96, COLORS.chaser);
    text('A twin-stick arena survival', cx, 356, 20, COLORS.dim, 'center', 'normal');
    const pulse = 0.65 + Math.sin(state.time * 4) * 0.35;
    ctx.globalAlpha = pulse;
    text('CLICK OR PRESS ENTER TO LAUNCH', cx, 470, 24, COLORS.text);
    ctx.globalAlpha = 1;
    text('WASD / ARROWS — move      MOUSE — aim      HOLD CLICK — fire', cx, 560, 18, COLORS.dim, 'center', 'normal');
    text('SHIFT — dash (briefly untouchable)      P — pause      M — mute', cx, 590, 18, COLORS.dim, 'center', 'normal');
    text('Survive the waves. Eat the shards. Choose your upgrades.', cx, 620, 18, COLORS.dim, 'center', 'normal');
    if (ui.best > 0) text(`BEST SCORE ${ui.best}`, cx, 676, 20, COLORS.gold);
  }

  /** Card rectangles for the level-up screen, shared by draw and picking. */
  function cardRects() {
    const w = 300;
    const h = 240;
    const gap = 36;
    const total = w * 3 + gap * 2;
    const x0 = (ARENA_W - total) / 2;
    const y = 300;
    return [0, 1, 2].map((i) => ({ x: x0 + i * (w + gap), y, w, h }));
  }

  function drawLevelUp(state) {
    ctx.fillStyle = 'rgba(4, 6, 16, 0.78)';
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);
    text('LEVEL UP', ARENA_W / 2, 190, 44, COLORS.shard);
    text('Choose one upgrade — click a card or press 1, 2, 3', ARENA_W / 2, 232, 18, COLORS.dim, 'center', 'normal');
    const rects = cardRects();
    state.choices.forEach((card, i) => {
      const r = rects[i];
      ctx.fillStyle = '#101736';
      ctx.strokeStyle = COLORS.shard;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 14);
      ctx.fill();
      ctx.stroke();
      text(String(i + 1), r.x + r.w / 2, r.y + 52, 20, COLORS.dim);
      wrapText(card.name, r.x + r.w / 2, r.y + 108, 25, COLORS.text, r.w - 36);
      wrapText(card.blurb, r.x + r.w / 2, r.y + 168, 18, COLORS.dim, r.w - 36, 'normal');
    });
  }

  function wrapText(str, x, y, size, color, maxWidth, weight = 'bold') {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    const words = str.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const trial = line ? `${line} ${word}` : word;
      if (ctx.measureText(trial).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = trial;
      }
    }
    if (line) lines.push(line);
    lines.forEach((l, i) => ctx.fillText(l, x, y + i * (size + 6)));
  }

  function drawPaused(ui) {
    ctx.fillStyle = 'rgba(4, 6, 16, 0.7)';
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);
    text('PAUSED', ARENA_W / 2, 380, 48, COLORS.text);
    text('Press P to resume', ARENA_W / 2, 430, 18, COLORS.dim, 'center', 'normal');
    if (ui.best > 0) text(`BEST SCORE ${ui.best}`, ARENA_W / 2, 470, 16, COLORS.gold);
  }

  function drawGameOver(state, ui) {
    ctx.fillStyle = 'rgba(10, 4, 14, 0.62)';
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);
    const cx = ARENA_W / 2;
    text('SWARMED', cx, 250, 84, COLORS.chaser);
    text(`SCORE  ${state.score}`, cx, 360, 34, COLORS.text);
    text(`WAVE ${Math.max(1, state.wave)}   ·   KILLS ${state.kills}   ·   BEST COMBO x${state.bestCombo}`, cx, 404, 20, COLORS.dim, 'center', 'normal');
    if (state.score >= ui.best && state.score > 0) {
      text('NEW BEST!', cx, 452, 22, COLORS.gold);
    } else if (ui.best > 0) {
      text(`BEST  ${ui.best}`, cx, 452, 20, COLORS.gold);
    }
    const pulse = 0.65 + Math.sin(state.time * 4) * 0.35;
    ctx.globalAlpha = pulse;
    text('PRESS R OR CLICK TO RETRY', cx, 540, 24, COLORS.text);
    ctx.globalAlpha = 1;
  }

  return { draw, toArena, cardRects, resize };
}
