// Emberkeeper's renderer: one canvas, one field of 1280x720 logical pixels, scaled
// to fit the window. It paints the night meadow, every entity, the HUD and the
// five screens (title, play, paused, victory, game over). Nothing here loads
// anything: every shape is drawn, every glow is a gradient.
import { FIELD, FLARE, LIVES_MAX, PALETTE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_VICTORY = 'victory';
export const SCREEN_OVER = 'over';

const TAU = Math.PI * 2;

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function heartPath(context, x, y, size) {
  context.beginPath();
  context.moveTo(x, y + size * 0.9);
  context.bezierCurveTo(x - size * 1.2, y, x - size * 0.6, y - size, x, y - size * 0.35);
  context.bezierCurveTo(x + size * 0.6, y - size, x + size * 1.2, y, x, y + size * 0.9);
  context.closePath();
}

function starPath(context, x, y, outer, inner, points, rotation) {
  context.beginPath();
  for (let index = 0; index < points * 2; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = rotation + (index * Math.PI) / points;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (index === 0) context.moveTo(px, py);
    else context.lineTo(px, py);
  }
  context.closePath();
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  let view = { scale: 1, offsetX: 0, offsetY: 0, width: 0, height: 0 };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    const scale = Math.min(rect.width / FIELD.width, rect.height / FIELD.height);
    view = {
      scale: scale * dpr,
      offsetX: (rect.width * dpr - FIELD.width * scale * dpr) / 2,
      offsetY: (rect.height * dpr - FIELD.height * scale * dpr) / 2,
      width: rect.width,
      height: rect.height,
    };
  }

  window.addEventListener('resize', resize);
  resize();

  function toField(point) {
    return { x: (point.x * (canvas.width / view.width) - view.offsetX) / view.scale, y: (point.y * (canvas.height / view.height) - view.offsetY) / view.scale };
  }

  function drawBackground(world, time) {
    const { state } = world;
    const gradient = context.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, PALETTE.skyTop);
    gradient.addColorStop(0.55, PALETTE.skyBottom);
    gradient.addColorStop(0.551, PALETTE.meadow);
    gradient.addColorStop(1, PALETTE.meadowEdge);
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);

    // Stars, twinkling on the seeded clock.
    for (const star of world.stars) {
      const alpha = 0.35 + 0.4 * Math.abs(Math.sin(time * 0.7 + star.twinkle));
      context.globalAlpha = alpha;
      context.fillStyle = '#dfe6ff';
      context.fillRect(star.x, star.y, star.size, star.size);
    }
    context.globalAlpha = 1;

    // The moon, low and watchful.
    const moonX = FIELD.width - 150;
    const moonY = 92;
    const moonGlow = context.createRadialGradient(moonX, moonY, 8, moonX, moonY, 90);
    moonGlow.addColorStop(0, 'rgba(240, 236, 255, 0.35)');
    moonGlow.addColorStop(1, 'rgba(240, 236, 255, 0)');
    context.fillStyle = moonGlow;
    context.fillRect(moonX - 90, moonY - 90, 180, 180);
    context.fillStyle = '#efeaff';
    context.beginPath();
    context.arc(moonX, moonY, 34, 0, TAU);
    context.fill();
    context.fillStyle = 'rgba(180, 170, 220, 0.5)';
    context.beginPath();
    context.arc(moonX - 10, moonY - 6, 7, 0, TAU);
    context.arc(moonX + 9, moonY + 10, 5, 0, TAU);
    context.fill();

    // Grass tufts along the meadow.
    context.strokeStyle = PALETTE.grass;
    context.lineWidth = 2;
    for (const tuft of world.grass) {
      context.beginPath();
      context.moveTo(tuft.x - 6, tuft.y);
      context.quadraticCurveTo(tuft.x - 3 + tuft.lean * 8, tuft.y - tuft.height * 0.7, tuft.x + tuft.lean * 10, tuft.y - tuft.height);
      context.moveTo(tuft.x, tuft.y);
      context.quadraticCurveTo(tuft.x + 1, tuft.y - tuft.height * 0.8, tuft.x + 2, tuft.y - tuft.height * 1.1);
      context.moveTo(tuft.x + 6, tuft.y);
      context.quadraticCurveTo(tuft.x + 5 + tuft.lean * 8, tuft.y - tuft.height * 0.7, tuft.x + 8 + tuft.lean * 10, tuft.y - tuft.height * 0.9);
      context.stroke();
    }

    // Ambient fireflies, drifting on their own slow clock.
    for (const fly of world.fireflies) {
      const fx = fly.x + Math.sin(time * fly.speed + fly.phase) * 26;
      const fy = fly.y + Math.cos(time * fly.speed * 0.8 + fly.phase) * 18;
      const alpha = 0.25 + 0.45 * Math.abs(Math.sin(time * 1.4 + fly.phase));
      context.globalAlpha = alpha;
      context.fillStyle = '#ffe9a8';
      context.beginPath();
      context.arc(fx, fy, 2.2, 0, TAU);
      context.fill();
    }
    context.globalAlpha = 1;

    // A soft vignette so the edges of the meadow fall into night.
    const vignette = context.createRadialGradient(
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.45,
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.95,
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(4, 6, 20, 0.5)');
    context.fillStyle = vignette;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    void state;
  }

  function drawEmber(ember, time) {
    const pulse = 1 + 0.18 * Math.sin(time * 3 + ember.phase);
    const glow = context.createRadialGradient(ember.x, ember.y, 1, ember.x, ember.y, 26 * pulse);
    glow.addColorStop(0, 'rgba(255, 179, 71, 0.85)');
    glow.addColorStop(0.4, 'rgba(255, 179, 71, 0.25)');
    glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
    context.fillStyle = glow;
    context.fillRect(ember.x - 26 * pulse, ember.y - 26 * pulse, 52 * pulse, 52 * pulse);
    context.fillStyle = PALETTE.emberCore;
    context.beginPath();
    context.arc(ember.x, ember.y, 6 * pulse, 0, TAU);
    context.fill();
    context.fillStyle = PALETTE.ember;
    context.beginPath();
    context.arc(ember.x, ember.y, 3.4 * pulse, 0, TAU);
    context.fill();
  }

  function drawStarEmber(star, time) {
    const rotation = time * 0.8 + star.phase;
    const glow = context.createRadialGradient(star.x, star.y, 2, star.x, star.y, 44);
    glow.addColorStop(0, 'rgba(255, 209, 102, 0.9)');
    glow.addColorStop(0.5, 'rgba(255, 209, 102, 0.25)');
    glow.addColorStop(1, 'rgba(255, 209, 102, 0)');
    context.fillStyle = glow;
    context.fillRect(star.x - 44, star.y - 44, 88, 88);
    context.fillStyle = PALETTE.starEmber;
    starPath(context, star.x, star.y, 17, 7, 4, rotation);
    context.fill();
    context.fillStyle = '#fff6d8';
    starPath(context, star.x, star.y, 9, 3.5, 4, rotation + 0.4);
    context.fill();
  }

  function drawWisp(wisp, time) {
    const wobble = Math.sin(time * 5 + wisp.phase) * 2;
    const flash = wisp.state === 'telegraph' ? 0.5 + 0.5 * Math.sin(time * 24) : 0;
    const body = wisp.kind === 'brute' ? '#1d1533' : PALETTE.wispBody;
    const edge = flash > 0.4 ? '#ff8f8f' : PALETTE.wispEdge;
    context.fillStyle = body;
    context.strokeStyle = edge;
    context.lineWidth = wisp.kind === 'brute' ? 3 : 2;
    context.beginPath();
    context.ellipse(wisp.x, wisp.y + wobble * 0.4, wisp.radius, wisp.radius * 0.9 + wobble * 0.3, 0, 0, TAU);
    context.fill();
    context.stroke();
    if (wisp.kind === 'brute' && wisp.hits === 0) {
      context.strokeStyle = 'rgba(201, 184, 255, 0.7)';
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(wisp.x - 12, wisp.y - 14);
      context.lineTo(wisp.x - 4, wisp.y - 2);
      context.lineTo(wisp.x - 12, wisp.y + 10);
      context.moveTo(wisp.x + 12, wisp.y - 12);
      context.lineTo(wisp.x + 4, wisp.y + 2);
      context.lineTo(wisp.x + 12, wisp.y + 12);
      context.stroke();
    }
    // Two watching eyes.
    const eyeY = wisp.y - wisp.radius * 0.15 + wobble * 0.4;
    const eyeGap = wisp.radius * 0.42;
    context.fillStyle = flash > 0.4 ? '#ff5d5d' : PALETTE.wispEye;
    context.beginPath();
    context.arc(wisp.x - eyeGap, eyeY, 3.2, 0, TAU);
    context.arc(wisp.x + eyeGap, eyeY, 3.2, 0, TAU);
    context.fill();
    context.fillStyle = '#241f3d';
    context.beginPath();
    context.arc(wisp.x - eyeGap, eyeY, 1.4, 0, TAU);
    context.arc(wisp.x + eyeGap, eyeY, 1.4, 0, TAU);
    context.fill();
  }

  function drawPlayer(player, time) {
    const blink = player.invuln > 0 && Math.floor(time * 12) % 2 === 0;
    context.save();
    if (blink) context.globalAlpha = 0.35;
    // The lantern's warm pool of light.
    const glow = context.createRadialGradient(player.x, player.y, 6, player.x, player.y, 120);
    glow.addColorStop(0, PALETTE.lanternGlow);
    glow.addColorStop(1, 'rgba(255, 190, 90, 0)');
    context.fillStyle = glow;
    context.fillRect(player.x - 120, player.y - 120, 240, 240);
    // Cloak.
    context.fillStyle = PALETTE.playerCloak;
    context.beginPath();
    context.moveTo(player.x, player.y - 18);
    context.quadraticCurveTo(player.x + 17, player.y - 6, player.x + 13, player.y + 14);
    context.quadraticCurveTo(player.x, player.y + 19, player.x - 13, player.y + 14);
    context.quadraticCurveTo(player.x - 17, player.y - 6, player.x, player.y - 18);
    context.fill();
    // Hood.
    context.fillStyle = PALETTE.playerHood;
    context.beginPath();
    context.arc(player.x, player.y - 8, 10, 0, TAU);
    context.fill();
    context.fillStyle = '#0d0a1e';
    context.beginPath();
    context.arc(player.x, player.y - 7, 6.5, 0, TAU);
    context.fill();
    // Two small eyes in the hood's dark.
    context.fillStyle = '#ffe9a8';
    context.beginPath();
    context.arc(player.x - 2.6, player.y - 8, 1.4, 0, TAU);
    context.arc(player.x + 2.6, player.y - 8, 1.4, 0, TAU);
    context.fill();
    // The lantern, swinging on the side the keeper faces.
    const side = Math.cos(player.facing) >= 0 ? 1 : -1;
    const lanternX = player.x + side * 22;
    const lanternY = player.y + 4 + Math.sin(time * 2.4) * 1.5;
    context.strokeStyle = '#8a6d3b';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(player.x + side * 12, player.y + 2);
    context.lineTo(lanternX, lanternY - 6);
    context.stroke();
    context.fillStyle = PALETTE.lantern;
    roundRect(context, lanternX - 5, lanternY - 6, 10, 13, 3);
    context.fill();
    context.fillStyle = '#fff6d8';
    context.beginPath();
    context.arc(lanternX, lanternY, 3, 0, TAU);
    context.fill();
    context.restore();
  }

  function drawParticles(world) {
    for (const particle of world.state.particles) {
      const alpha = Math.max(0, particle.life / particle.maxLife);
      if (particle.ring) {
        context.globalAlpha = alpha;
        context.strokeStyle = particle.color;
        context.lineWidth = 3;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius, 0, TAU);
        context.stroke();
      } else {
        context.globalAlpha = alpha;
        context.fillStyle = particle.color;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.size, 0, TAU);
        context.fill();
      }
    }
    context.globalAlpha = 1;
  }

  function drawTexts(world) {
    context.textAlign = 'center';
    context.font = '700 17px system-ui, sans-serif';
    for (const text of world.state.texts) {
      context.globalAlpha = Math.max(0, text.life / text.maxLife);
      context.fillStyle = text.color;
      context.fillText(text.text, text.x, text.y);
    }
    context.globalAlpha = 1;
  }

  function drawHud(world, best) {
    const { state } = world;
    // Top bar.
    context.fillStyle = 'rgba(8, 11, 30, 0.55)';
    context.fillRect(0, 0, FIELD.width, 56);
    context.textBaseline = 'alphabetic';
    context.textAlign = 'left';
    context.fillStyle = PALETTE.textDim;
    context.font = '600 13px system-ui, sans-serif';
    context.fillText('SCORE', 24, 22);
    context.fillStyle = PALETTE.text;
    context.font = '700 26px system-ui, sans-serif';
    context.fillText(String(state.score).padStart(6, '0'), 24, 48);
    context.fillStyle = PALETTE.textDim;
    context.font = '600 13px system-ui, sans-serif';
    context.fillText(`BEST ${best}`, 170, 22);
    if (state.combo >= 2) {
      context.fillStyle = PALETTE.starEmber;
      context.font = '700 17px system-ui, sans-serif';
      context.fillText(`COMBO x${state.combo}`, 170, 46);
    }
    // Wave, centred, with its progress bar.
    context.textAlign = 'center';
    context.fillStyle = PALETTE.text;
    context.font = '700 20px system-ui, sans-serif';
    context.fillText(state.wave <= 10 ? `WAVE ${state.wave} / 10` : `WAVE ${state.wave} — ENDLESS`, FIELD.width / 2, 26);
    const barWidth = 220;
    const barX = FIELD.width / 2 - barWidth / 2;
    context.fillStyle = 'rgba(255, 255, 255, 0.14)';
    roundRect(context, barX, 34, barWidth, 8, 4);
    context.fill();
    context.fillStyle = PALETTE.ember;
    const progress = Math.min(1, state.progress / state.quota);
    if (progress > 0) {
      roundRect(context, barX, 34, Math.max(8, barWidth * progress), 8, 4);
      context.fill();
    }
    // Lives, right.
    context.textAlign = 'right';
    for (let index = 0; index < LIVES_MAX; index += 1) {
      const x = FIELD.width - 24 - index * 30;
      context.fillStyle = index < state.lives ? PALETTE.heart : 'rgba(255, 107, 129, 0.22)';
      heartPath(context, x, 26, 9);
      context.fill();
    }
    // Flare charges, under the lives.
    context.fillStyle = PALETTE.textDim;
    context.font = '600 12px system-ui, sans-serif';
    context.fillText('FLARE', FIELD.width - 24, 58);
    for (let index = 0; index < FLARE.maxCharges; index += 1) {
      const x = FIELD.width - 30 - index * 22;
      context.fillStyle = index < state.charges ? PALETTE.lantern : 'rgba(255, 233, 168, 0.2)';
      context.beginPath();
      context.arc(x, 74, 6, 0, TAU);
      context.fill();
    }
    // The wave banner.
    if (state.bannerTime > 0 && state.banner) {
      const alpha = Math.min(1, state.bannerTime);
      context.globalAlpha = alpha;
      context.textAlign = 'center';
      context.fillStyle = PALETTE.text;
      context.font = '700 52px Georgia, serif';
      context.shadowColor = 'rgba(255, 190, 90, 0.7)';
      context.shadowBlur = 26;
      context.fillText(state.banner, FIELD.width / 2, FIELD.height / 2 - 60);
      context.shadowBlur = 0;
      context.globalAlpha = 1;
    }
    // The quiet hint along the bottom.
    context.textAlign = 'center';
    context.fillStyle = 'rgba(185, 179, 214, 0.75)';
    context.font = '600 13px system-ui, sans-serif';
    context.fillText('WASD / arrows / mouse to move · SPACE to flare · P to pause · M to mute', FIELD.width / 2, FIELD.height - 14);
  }

  function drawPanel(x, y, width, height) {
    context.fillStyle = PALETTE.panel;
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    roundRect(context, x, y, width, height, 16);
    context.fill();
    context.stroke();
  }

  function drawButton(button, label, primary) {
    context.fillStyle = primary ? '#ffb347' : 'rgba(255, 255, 255, 0.1)';
    context.strokeStyle = primary ? '#ffd166' : 'rgba(255, 255, 255, 0.35)';
    context.lineWidth = 2;
    roundRect(context, button.x, button.y, button.w, button.h, 10);
    context.fill();
    context.stroke();
    context.fillStyle = primary ? '#241a08' : PALETTE.text;
    context.font = '700 18px system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(label, button.x + button.w / 2, button.y + button.h / 2 + 1);
    context.textBaseline = 'alphabetic';
  }

  function titleScreen(world, best) {
    drawBackground(world, world.state.time);
    for (const ember of world.state.embers) drawEmber(ember, world.state.time);
    for (const wisp of world.state.wisps) drawWisp(wisp, world.state.time);
    drawPlayer(world.state.player, world.state.time);
    context.fillStyle = 'rgba(6, 9, 26, 0.55)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.textAlign = 'center';
    context.fillStyle = PALETTE.text;
    context.font = '700 84px Georgia, serif';
    context.shadowColor = 'rgba(255, 190, 90, 0.8)';
    context.shadowBlur = 34;
    context.fillText('EMBERKEEPER', FIELD.width / 2, 190);
    context.shadowBlur = 0;
    context.fillStyle = PALETTE.textDim;
    context.font = '400 22px Georgia, serif';
    context.fillText('Keep the last lantern burning until dawn.', FIELD.width / 2, 232);
    drawPanel(FIELD.width / 2 - 300, 268, 600, 148);
    context.fillStyle = PALETTE.text;
    context.font = '400 18px system-ui, sans-serif';
    context.fillText('Gather embers to score — each one feeds your combo.', FIELD.width / 2, 306);
    context.fillText('Shadow wisps snuff your light. Flare (SPACE) to drive them back.', FIELD.width / 2, 338);
    context.fillText('Survive 10 waves and the dawn is yours.', FIELD.width / 2, 370);
    context.fillStyle = PALETTE.textDim;
    context.font = '600 15px system-ui, sans-serif';
    context.fillText('Move: WASD / arrows / mouse · Flare: SPACE · Pause: P · Mute: M', FIELD.width / 2, 396);
    if (best > 0) {
      context.fillStyle = PALETTE.starEmber;
      context.font = '700 20px system-ui, sans-serif';
      context.fillText(`BEST SCORE  ${best}`, FIELD.width / 2, 462);
    }
    const pulse = 0.6 + 0.4 * Math.sin(world.state.time * 3);
    context.globalAlpha = pulse;
    context.fillStyle = PALETTE.lantern;
    context.font = '700 24px system-ui, sans-serif';
    context.fillText('PRESS SPACE OR CLICK TO BEGIN', FIELD.width / 2, 528);
    context.globalAlpha = 1;
  }

  function pausedScreen(world) {
    context.fillStyle = 'rgba(6, 9, 26, 0.6)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.textAlign = 'center';
    context.fillStyle = PALETTE.text;
    context.font = '700 56px Georgia, serif';
    context.fillText('PAUSED', FIELD.width / 2, 330);
    context.fillStyle = PALETTE.textDim;
    context.font = '400 20px system-ui, sans-serif';
    context.fillText('Press P to keep playing · R to restart', FIELD.width / 2, 380);
    void world;
  }

  function victoryScreen(world, best) {
    const { state } = world;
    context.fillStyle = 'rgba(20, 16, 40, 0.55)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.textAlign = 'center';
    context.fillStyle = '#ffe9a8';
    context.font = '700 72px Georgia, serif';
    context.shadowColor = 'rgba(255, 190, 90, 0.9)';
    context.shadowBlur = 30;
    context.fillText('DAWN BREAKS', FIELD.width / 2, 190);
    context.shadowBlur = 0;
    context.fillStyle = PALETTE.text;
    context.font = '400 22px Georgia, serif';
    context.fillText('You kept the light alive through all ten waves.', FIELD.width / 2, 234);
    drawPanel(FIELD.width / 2 - 260, 268, 520, 150);
    context.font = '700 44px system-ui, sans-serif';
    context.fillStyle = PALETTE.text;
    context.fillText(`SCORE  ${state.score}`, FIELD.width / 2, 330);
    context.fillStyle = PALETTE.textDim;
    context.font = '400 18px system-ui, sans-serif';
    context.fillText(`Best ${best} · Embers ${state.stats.collected} · Wisps ${state.stats.dispelled} · Combo x${state.bestCombo}`, FIELD.width / 2, 372);
    context.fillText('The meadow is yours — play on, or begin again.', FIELD.width / 2, 400);
    drawButton({ x: FIELD.width / 2 - 260, y: 452, w: 250, h: 54 }, 'KEEP PLAYING', true);
    drawButton({ x: FIELD.width / 2 + 10, y: 452, w: 250, h: 54 }, 'PLAY AGAIN', false);
  }

  function overScreen(world, best, isNewBest) {
    const { state } = world;
    context.fillStyle = 'rgba(10, 8, 24, 0.62)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.textAlign = 'center';
    context.fillStyle = '#ff8f8f';
    context.font = '700 64px Georgia, serif';
    context.shadowColor = 'rgba(255, 93, 93, 0.6)';
    context.shadowBlur = 26;
    context.fillText('THE LIGHT FADES', FIELD.width / 2, 180);
    context.shadowBlur = 0;
    context.fillStyle = PALETTE.text;
    context.font = '400 21px Georgia, serif';
    context.fillText(`The wisps close in on wave ${state.wave}. The lantern gutters out — for now.`, FIELD.width / 2, 224);
    drawPanel(FIELD.width / 2 - 260, 258, 520, 158);
    context.font = '700 44px system-ui, sans-serif';
    context.fillStyle = PALETTE.text;
    context.fillText(`SCORE  ${state.score}`, FIELD.width / 2, 320);
    if (isNewBest) {
      context.fillStyle = PALETTE.starEmber;
      context.font = '700 20px system-ui, sans-serif';
      context.fillText('★ NEW BEST ★', FIELD.width / 2, 352);
    }
    context.fillStyle = PALETTE.textDim;
    context.font = '400 18px system-ui, sans-serif';
    context.fillText(`Best ${best} · Embers ${state.stats.collected} · Wisps ${state.stats.dispelled} · Combo x${state.bestCombo}`, FIELD.width / 2, 384);
    drawButton({ x: FIELD.width / 2 - 125, y: 448, w: 250, h: 54 }, 'PLAY AGAIN', true);
    context.fillStyle = PALETTE.textDim;
    context.font = '600 15px system-ui, sans-serif';
    context.fillText('or press R', FIELD.width / 2, 534);
  }

  function draw(world, screen, best, isNewBest) {
    const { state } = world;
    resize();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.offsetX, view.offsetY);
    // Screen shake, from a deterministic wobble of the clock.
    if (state.shake > 0.2) {
      const magnitude = state.shake;
      context.translate(Math.sin(state.time * 61) * magnitude * 0.6, Math.cos(state.time * 53) * magnitude * 0.6);
    }
    if (screen === SCREEN_TITLE) {
      titleScreen(world, best);
      return;
    }
    drawBackground(world, state.time);
    for (const ember of state.embers) drawEmber(ember, state.time);
    for (const star of state.starEmbers) drawStarEmber(star, state.time);
    for (const pickup of state.pickups) {
      const pulse = 1 + 0.15 * Math.sin(state.time * 4 + pickup.phase);
      context.fillStyle = PALETTE.heart;
      heartPath(context, pickup.x, pickup.y, 12 * pulse);
      context.fill();
    }
    for (const wisp of state.wisps) drawWisp(wisp, state.time);
    drawPlayer(state.player, state.time);
    drawParticles(world);
    drawTexts(world);
    drawHud(world, best);
    if (screen === SCREEN_PAUSED) pausedScreen(world);
    else if (screen === SCREEN_VICTORY) victoryScreen(world, best);
    else if (screen === SCREEN_OVER) overScreen(world, best, isNewBest);
    // A red flash on a hit.
    if (state.flash > 0) {
      context.fillStyle = `rgba(255, 60, 60, ${state.flash * 0.35})`;
      context.fillRect(-20, -20, FIELD.width + 40, FIELD.height + 40);
    }
  }

  return {
    draw,
    toField,
    // The buttons a screen shows, in field coordinates, for click hit-testing.
    screenButtons(screen) {
      if (screen === SCREEN_VICTORY) {
        return [
          { id: 'continue', x: FIELD.width / 2 - 260, y: 452, w: 250, h: 54 },
          { id: 'restart', x: FIELD.width / 2 + 10, y: 452, w: 250, h: 54 },
        ];
      }
      if (screen === SCREEN_OVER) {
        return [{ id: 'restart', x: FIELD.width / 2 - 125, y: 448, w: 250, h: 54 }];
      }
      return [];
    },
  };
}
