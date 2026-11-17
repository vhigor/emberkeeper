// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between five screens: title, play,
// paused, victory and game over.
//
// ?seed=N fixes the meadow's pattern. ?shot=start|play|victory|over (with
// &seed=N) stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { createWorld, EVENT_COLLECT, EVENT_FLARE, EVENT_HEART, EVENT_HIT, EVENT_OVER, EVENT_STAR, EVENT_WAVE, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_FLARE, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, scene.best, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = world.readBest();
  let isNewBest = false;
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    isNewBest = false;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing. Three lives. Gather embers, dodge the wisps.');
  }

  function endGame(won) {
    if (world.state.score > best) {
      best = world.state.score;
      isNewBest = true;
      world.saveBest(best);
    }
    screen = won ? SCREEN_VICTORY : SCREEN_OVER;
    announce(won ? `Dawn breaks. You win with ${world.state.score} points.` : `Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function handleEvents(events) {
    if (events & EVENT_COLLECT) audio.collect(world.state.combo);
    if (events & EVENT_STAR) audio.star();
    if (events & EVENT_FLARE) audio.flare();
    if (events & EVENT_HEART) audio.heart();
    if (events & EVENT_HIT) audio.hit();
    if (events & EVENT_WAVE) audio.wave();
    if (events & EVENT_WIN) {
      audio.win();
      endGame(true);
    } else if (events & EVENT_OVER) {
      audio.lose();
      endGame(false);
    } else if (events & EVENT_HIT) {
      announce(world.state.lives === 1 ? 'Hit. 1 life left.' : `Hit. ${world.state.lives} lives left.`);
    }
  }

  function hitButton(clicks) {
    const buttons = renderer.screenButtons(screen);
    for (const click of clicks) {
      const point = renderer.toField(click);
      for (const button of buttons) {
        if (point.x >= button.x && point.x <= button.x + button.w && point.y >= button.y && point.y <= button.y + button.h) {
          return button.id;
        }
      }
    }
    return null;
  }

  function handleActions(actions, clicks) {
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMuted();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_RESTART && screen !== SCREEN_TITLE) {
      audio.click();
      startGame();
      return;
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM || clicks.length > 0) {
        audio.click();
        startGame();
      }
      return;
    }
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (screen === SCREEN_VICTORY) {
      const button = hitButton(clicks);
      if (button === 'continue') {
        audio.click();
        world.continueEndless();
        screen = SCREEN_PLAY;
        announce('Playing on into the endless night.');
      } else if (button === 'restart' || actions & ACTION_CONFIRM) {
        audio.click();
        startGame();
      }
      return;
    }
    if (screen === SCREEN_OVER) {
      if (hitButton(clicks) === 'restart' || actions & ACTION_CONFIRM || clicks.length > 0) {
        audio.click();
        startGame();
      }
    }
  }

  function moveDirection() {
    const keys = input.keyDirection();
    if (keys.x !== 0 || keys.y !== 0) return keys;
    const pointer = input.pointer();
    if (!pointer.down) return { x: 0, y: 0 };
    const target = renderer.toField(pointer);
    const dx = target.x - world.state.player.x;
    const dy = target.y - world.state.player.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 14) return { x: 0, y: 0 };
    return { x: dx / distance, y: dy / distance };
  }

  function step(wantFlare) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0 }, false, true);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const events = world.step(STEP, moveDirection(), wantFlare, false);
    handleEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // Actions are taken once per frame and shared: a press of Space is both
    // the confirm that starts a game and the flare that clears wisps.
    const actions = input.takeActions();
    const clicks = input.takeClicks();
    handleActions(actions, clicks);
    const wantFlare = (actions & ACTION_FLARE) !== 0;
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      let firstStep = true;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(firstStep && wantFlare);
        firstStep = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world, screen, best, isNewBest);
  }

  // Leaving the tab pauses a running game rather than letting wisps close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });
  canvas.addEventListener('pointerdown', () => audio.unlock());

  announce('Emberkeeper. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
