// Emberkeeper's world: the player, the embers, the wisps, the waves and the
// score. One fixed step advances everything; the step answers with an event
// bitmask so the shell (main.js) knows what happened without reading the world.
import {
  BEST_KEY,
  COMBO_MAX,
  EMBER,
  FIELD,
  FLARE,
  HEART,
  LIVES_MAX,
  LIVES_START,
  PALETTE,
  PLAYER,
  STAR_EMBER,
  WAVES_TO_DAWN,
  WAVE_BONUS,
  WAVE_QUOTA,
  WISP,
} from './config.js';

export const EVENT_NONE = 0;
export const EVENT_COLLECT = 1;
export const EVENT_FLARE = 2;
export const EVENT_HIT = 4;
export const EVENT_WAVE = 8;
export const EVENT_OVER = 16;
export const EVENT_WIN = 32;
export const EVENT_HEART = 64;
export const EVENT_STAR = 128;

const TAU = Math.PI * 2;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function createWorld(random) {
  const state = {
    time: 0,
    player: { x: FIELD.width / 2, y: FIELD.height / 2, vx: 0, vy: 0, invuln: 0, flareCooldown: 0, facing: 0 },
    embers: [],
    starEmbers: [],
    wisps: [],
    pickups: [],
    particles: [],
    texts: [],
    score: 0,
    combo: 0,
    bestCombo: 0,
    lives: LIVES_START,
    wave: 1,
    progress: 0,
    quota: WAVE_QUOTA(1),
    charges: FLARE.startCharges,
    embersSinceCharge: 0,
    shake: 0,
    flash: 0,
    banner: '',
    bannerTime: 0,
    won: false,
    over: false,
    endless: false,
    emberTimer: 0,
    wispTimer: 1.2,
    starTimer: STAR_EMBER.spawnSeconds,
    heartTimer: HEART.spawnSeconds,
    attract: true,
    stats: { collected: 0, dispelled: 0, flares: 0, wavesCleared: 0 },
  };

  // Decorative stars and grass, grown once from the seed so the meadow never
  // changes shape between frames.
  const stars = [];
  for (let index = 0; index < 90; index += 1) {
    stars.push({ x: random.range(0, FIELD.width), y: random.range(0, FIELD.height * 0.55), size: random.range(0.6, 2), twinkle: random.range(0, TAU) });
  }
  const grass = [];
  for (let index = 0; index < 70; index += 1) {
    grass.push({ x: random.range(0, FIELD.width), y: random.range(FIELD.height * 0.55, FIELD.height), height: random.range(10, 26), lean: random.range(-0.4, 0.4) });
  }
  const fireflies = [];
  for (let index = 0; index < 14; index += 1) {
    fireflies.push({ x: random.range(0, FIELD.width), y: random.range(0, FIELD.height), phase: random.range(0, TAU), speed: random.range(0.2, 0.6) });
  }

  function spawnEmber() {
    const margin = 40;
    state.embers.push({
      x: random.range(margin, FIELD.width - margin),
      y: random.range(70, FIELD.height - margin),
      phase: random.range(0, TAU),
      vx: random.range(-EMBER.driftSpeed, EMBER.driftSpeed),
      vy: random.range(-EMBER.driftSpeed, EMBER.driftSpeed),
    });
  }

  function spawnStarEmber() {
    const margin = 60;
    state.starEmbers.push({
      x: random.range(margin, FIELD.width - margin),
      y: random.range(90, FIELD.height - margin),
      phase: random.range(0, TAU),
    });
  }

  function wispKind() {
    const roll = random.next();
    if (state.wave >= 5 && roll < 0.16) return 'brute';
    if (state.wave >= 3 && roll < 0.45) return 'darter';
    return 'drifter';
  }

  function spawnWisp() {
    const kind = wispKind();
    const edge = random.int(0, 3);
    const margin = 30;
    let x;
    let y;
    if (edge === 0) { x = random.range(0, FIELD.width); y = -margin; }
    else if (edge === 1) { x = FIELD.width + margin; y = random.range(0, FIELD.height); }
    else if (edge === 2) { x = random.range(0, FIELD.width); y = FIELD.height + margin; }
    else { x = -margin; y = random.range(0, FIELD.height); }
    const speedScale = 1 + (state.wave - 1) * 0.06;
    state.wisps.push({
      kind,
      x,
      y,
      vx: 0,
      vy: 0,
      radius: WISP[kind].radius,
      speed: WISP[kind].speed * speedScale,
      phase: random.range(0, TAU),
      state: 'hunt',
      timer: random.range(0.5, 1.5),
      hits: 0,
    });
  }

  function spawnHeart() {
    const margin = 60;
    state.pickups.push({
      kind: 'heart',
      x: random.range(margin, FIELD.width - margin),
      y: random.range(90, FIELD.height - margin),
      phase: random.range(0, TAU),
    });
  }

  function burst(x, y, color, count, speed) {
    for (let index = 0; index < count; index += 1) {
      const angle = random.angle();
      const velocity = random.range(speed * 0.3, speed);
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life: random.range(0.35, 0.8),
        maxLife: 0.8,
        size: random.range(1.5, 3.5),
        color,
      });
    }
  }

  function ring(x, y, color) {
    state.particles.push({ ring: true, x, y, radius: 12, life: 0.45, maxLife: 0.45, color });
  }

  function floatText(x, y, text, color) {
    state.texts.push({ x, y, text, color, life: 1.1, maxLife: 1.1 });
  }

  function addScore(points, x, y) {
    state.score += points;
    floatText(x, y, `+${points}`, '#ffe9a8');
  }

  function startWave(wave) {
    state.wave = wave;
    state.quota = WAVE_QUOTA(wave);
    state.progress = 0;
    state.banner = wave <= WAVES_TO_DAWN ? `WAVE ${wave}` : `WAVE ${wave} — ENDLESS`;
    state.bannerTime = 2.2;
  }

  function clearWave() {
    const bonus = WAVE_BONUS(state.wave);
    state.score += bonus;
    state.stats.wavesCleared += 1;
    floatText(FIELD.width / 2, FIELD.height / 2 - 40, `WAVE BONUS +${bonus}`, '#ffd166');
    if (state.charges < FLARE.maxCharges) state.charges += 1;
    if (state.wave >= WAVES_TO_DAWN && !state.endless) {
      state.won = true;
      return EVENT_WIN;
    }
    startWave(state.wave + 1);
    return EVENT_WAVE;
  }

  function flare() {
    if (state.charges <= 0 || state.player.flareCooldown > 0) return EVENT_NONE;
    state.charges -= 1;
    state.stats.flares += 1;
    state.player.flareCooldown = FLARE.cooldownSeconds;
    const { x, y } = state.player;
    ring(x, y, PALETTE.lanternGlow);
    burst(x, y, PALETTE.ember, 26, 260);
    state.shake = Math.max(state.shake, 7);
    let events = EVENT_FLARE;
    for (let index = state.wisps.length - 1; index >= 0; index -= 1) {
      const wisp = state.wisps[index];
      if (distance(wisp, state.player) > FLARE.radius + wisp.radius) continue;
      if (wisp.kind === 'brute' && wisp.hits === 0) {
        wisp.hits = 1;
        wisp.radius = WISP.drifter.radius;
        wisp.speed = WISP.drifter.speed * 1.4;
        wisp.kind = 'drifter';
        burst(wisp.x, wisp.y, PALETTE.wispEdge, 14, 180);
        floatText(wisp.x, wisp.y - 20, 'CRACKED!', '#c9b8ff');
        continue;
      }
      state.wisps.splice(index, 1);
      state.stats.dispelled += 1;
      state.progress += 1;
      const points = WISP[wisp.kind].points;
      addScore(points, wisp.x, wisp.y);
      burst(wisp.x, wisp.y, '#b7a8ff', 16, 200);
    }
    return events;
  }

  function hitPlayer(wisp) {
    if (state.player.invuln > 0) return EVENT_NONE;
    state.lives -= 1;
    state.combo = 0;
    state.player.invuln = PLAYER.invulnSeconds;
    state.flash = 0.45;
    state.shake = Math.max(state.shake, 12);
    burst(state.player.x, state.player.y, PALETTE.danger, 30, 300);
    const index = state.wisps.indexOf(wisp);
    if (index !== -1) state.wisps.splice(index, 1);
    if (state.lives <= 0) {
      state.over = true;
      return EVENT_HIT | EVENT_OVER;
    }
    return EVENT_HIT;
  }

  function reset() {
    state.time = 0;
    state.player.x = FIELD.width / 2;
    state.player.y = FIELD.height / 2;
    state.player.vx = 0;
    state.player.vy = 0;
    state.player.invuln = 0;
    state.player.flareCooldown = 0;
    state.embers = [];
    state.starEmbers = [];
    state.wisps = [];
    state.pickups = [];
    state.particles = [];
    state.texts = [];
    state.score = 0;
    state.combo = 0;
    state.bestCombo = 0;
    state.lives = LIVES_START;
    state.wave = 1;
    state.progress = 0;
    state.quota = WAVE_QUOTA(1);
    state.charges = FLARE.startCharges;
    state.embersSinceCharge = 0;
    state.shake = 0;
    state.flash = 0;
    state.banner = '';
    state.bannerTime = 0;
    state.won = false;
    state.over = false;
    state.endless = false;
    state.emberTimer = 0;
    state.wispTimer = 1.2;
    state.starTimer = STAR_EMBER.spawnSeconds;
    state.heartTimer = HEART.spawnSeconds;
    state.stats = { collected: 0, dispelled: 0, flares: 0, wavesCleared: 0 };
    for (let index = 0; index < EMBER.targetOnField; index += 1) spawnEmber();
    for (let index = 0; index < 3; index += 1) spawnWisp();
  }

  function step(dt, move, wantFlare, attract) {
    state.time += dt;
    let events = EVENT_NONE;
    const player = state.player;

    // Timers that always tick.
    if (player.invuln > 0) player.invuln -= dt;
    if (player.flareCooldown > 0) player.flareCooldown -= dt;
    if (state.bannerTime > 0) state.bannerTime -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 26);
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 1.6);

    // Particles and floating text fade on their own.
    for (let index = state.particles.length - 1; index >= 0; index -= 1) {
      const particle = state.particles[index];
      particle.life -= dt;
      if (particle.life <= 0) {
        state.particles.splice(index, 1);
        continue;
      }
      if (particle.ring) particle.radius += dt * 520;
      else {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vx *= 1 - dt * 2.2;
        particle.vy *= 1 - dt * 2.2;
      }
    }
    for (let index = state.texts.length - 1; index >= 0; index -= 1) {
      const text = state.texts[index];
      text.life -= dt;
      text.y -= dt * 34;
      if (text.life <= 0) state.texts.splice(index, 1);
    }

    if (attract) {
      // The title screen's living backdrop: embers drift, wisps wander, nothing
      // scores and nothing can hurt the keeper.
      for (const ember of state.embers) {
        ember.x += ember.vx * dt;
        ember.y += ember.vy * dt;
        if (ember.x < 20 || ember.x > FIELD.width - 20) ember.vx *= -1;
        if (ember.y < 60 || ember.y > FIELD.height - 20) ember.vy *= -1;
      }
      for (const wisp of state.wisps) {
        wisp.phase += dt;
        wisp.x += Math.cos(wisp.phase * 0.7) * 26 * dt;
        wisp.y += Math.sin(wisp.phase * 0.5) * 20 * dt;
      }
      return EVENT_NONE;
    }

    // --- Player movement: acceleration with friction, clamped to the meadow.
    player.vx += move.x * PLAYER.accel * dt;
    player.vy += move.y * PLAYER.accel * dt;
    const drag = Math.max(0, 1 - PLAYER.friction * dt);
    player.vx *= drag;
    player.vy *= drag;
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > PLAYER.maxSpeed) {
      player.vx = (player.vx / speed) * PLAYER.maxSpeed;
      player.vy = (player.vy / speed) * PLAYER.maxSpeed;
    }
    player.x = clamp(player.x + player.vx * dt, PLAYER.radius, FIELD.width - PLAYER.radius);
    player.y = clamp(player.y + player.vy * dt, PLAYER.radius + 44, FIELD.height - PLAYER.radius);
    if (speed > 20) player.facing = Math.atan2(player.vy, player.vx);

    if (wantFlare) events |= flare();

    // --- Spawning.
    state.emberTimer -= dt;
    if (state.emberTimer <= 0 && state.embers.length < EMBER.targetOnField + state.wave) {
      spawnEmber();
      state.emberTimer = EMBER.spawnSeconds;
    }
    state.wispTimer -= dt;
    const wispCap = 4 + state.wave;
    const wispInterval = Math.max(1.1, 3.4 - state.wave * 0.22);
    if (state.wispTimer <= 0 && state.wisps.length < wispCap) {
      spawnWisp();
      state.wispTimer = wispInterval * random.range(0.7, 1.3);
    }
    state.starTimer -= dt;
    if (state.starTimer <= 0) {
      spawnStarEmber();
      state.starTimer = STAR_EMBER.spawnSeconds;
    }
    if (state.lives < LIVES_MAX) {
      state.heartTimer -= dt;
      if (state.heartTimer <= 0) {
        spawnHeart();
        state.heartTimer = HEART.spawnSeconds;
      }
    }

    // --- Embers drift and get collected.
    for (let index = state.embers.length - 1; index >= 0; index -= 1) {
      const ember = state.embers[index];
      ember.x += ember.vx * dt;
      ember.y += ember.vy * dt;
      if (ember.x < 20 || ember.x > FIELD.width - 20) ember.vx *= -1;
      if (ember.y < 60 || ember.y > FIELD.height - 20) ember.vy *= -1;
      if (distance(ember, player) < EMBER.collectRadius + PLAYER.radius) {
        state.embers.splice(index, 1);
        state.combo = Math.min(state.combo + 1, COMBO_MAX);
        state.bestCombo = Math.max(state.bestCombo, state.combo);
        state.stats.collected += 1;
        state.progress += 1;
        state.embersSinceCharge += 1;
        if (state.embersSinceCharge >= FLARE.embersPerCharge) {
          state.embersSinceCharge = 0;
          if (state.charges < FLARE.maxCharges) {
            state.charges += 1;
            floatText(player.x, player.y - 34, 'FLARE +1', '#ffd166');
          }
        }
        const points = EMBER.points * state.combo;
        addScore(points, ember.x, ember.y);
        burst(ember.x, ember.y, PALETTE.ember, 8, 120);
        events |= EVENT_COLLECT;
      }
    }

    // --- Star embers: worth five times an ember at the current combo.
    for (let index = state.starEmbers.length - 1; index >= 0; index -= 1) {
      const star = state.starEmbers[index];
      if (distance(star, player) < STAR_EMBER.collectRadius + PLAYER.radius) {
        state.starEmbers.splice(index, 1);
        state.combo = Math.min(state.combo + 2, COMBO_MAX);
        state.bestCombo = Math.max(state.bestCombo, state.combo);
        state.stats.collected += 1;
        state.progress += 2;
        const points = STAR_EMBER.points * state.combo;
        addScore(points, star.x, star.y);
        burst(star.x, star.y, PALETTE.starEmber, 22, 220);
        events |= EVENT_STAR;
      }
    }

    // --- Hearts: a lost life back.
    for (let index = state.pickups.length - 1; index >= 0; index -= 1) {
      const pickup = state.pickups[index];
      if (distance(pickup, player) < HEART.collectRadius + PLAYER.radius) {
        state.pickups.splice(index, 1);
        state.lives = Math.min(state.lives + 1, LIVES_MAX);
        floatText(player.x, player.y - 34, '+1 LIFE', PALETTE.heart);
        burst(player.x, player.y, PALETTE.heart, 16, 160);
        events |= EVENT_HEART;
      }
    }

    // --- Wisps hunt, telegraph, dash, and touch the keeper at their peril.
    for (let index = state.wisps.length - 1; index >= 0; index -= 1) {
      const wisp = state.wisps[index];
      const dx = player.x - wisp.x;
      const dy = player.y - wisp.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;
      if (wisp.kind === 'darter') {
        wisp.timer -= dt;
        if (wisp.state === 'hunt') {
          wisp.x += nx * wisp.speed * dt;
          wisp.y += ny * wisp.speed * dt;
          if (wisp.timer <= 0 && dist < 320) {
            wisp.state = 'telegraph';
            wisp.timer = WISP.darter.telegraphSeconds;
          }
        } else if (wisp.state === 'telegraph') {
          if (wisp.timer <= 0) {
            wisp.state = 'dash';
            wisp.timer = WISP.darter.dashSeconds;
            wisp.vx = nx * WISP.darter.dashSpeed;
            wisp.vy = ny * WISP.darter.dashSpeed;
          }
        } else if (wisp.state === 'dash') {
          wisp.x += wisp.vx * dt;
          wisp.y += wisp.vy * dt;
          if (wisp.timer <= 0) {
            wisp.state = 'rest';
            wisp.timer = WISP.darter.restSeconds;
          }
        } else {
          if (wisp.timer <= 0) {
            wisp.state = 'hunt';
            wisp.timer = random.range(0.8, 1.8);
          }
        }
      } else {
        // Drifters and brutes chase, with a slow wobble so they never march in
        // a straight line.
        wisp.phase += dt;
        const wobble = Math.sin(wisp.phase * 2.2) * 0.45;
        const wx = nx + -ny * wobble;
        const wy = ny + nx * wobble;
        const wobbleLength = Math.hypot(wx, wy) || 1;
        wisp.x += (wx / wobbleLength) * wisp.speed * dt;
        wisp.y += (wy / wobbleLength) * wisp.speed * dt;
      }
      // A wisp that wanders off the meadow is gone.
      if (wisp.x < -60 || wisp.x > FIELD.width + 60 || wisp.y < -60 || wisp.y > FIELD.height + 60) {
        state.wisps.splice(index, 1);
        continue;
      }
      if (dist < wisp.radius + PLAYER.radius - 2) {
        events |= hitPlayer(wisp);
        if (state.over) return events;
      }
    }

    // --- The wave ends when its quota of gathered light is met.
    if (state.progress >= state.quota && !state.over && !state.won) {
      events |= clearWave();
      if (state.won) return events;
    }

    return events;
  }

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
      // Storage can be off: the best score then lasts this visit only.
    }
  }

  // After a victory, keep playing into the endless night: the next wave
  // starts with its quota and banner, and the win flag clears.
  function continueEndless() {
    state.endless = true;
    state.won = false;
    startWave(state.wave + 1);
  }

  return {
    state,
    stars,
    grass,
    fireflies,
    reset,
    step,
    flare,
    continueEndless,
    readBest,
    saveBest,
  };
}
