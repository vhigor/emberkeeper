// The screenshot scenes behind ?shot=start|play|victory|over. Each one plays the
// real rules forward from a fresh world for a fixed time, steered by a simple
// autopilot (chase the nearest ember, keep clear of wisps, flare when crowded),
// so the frame is what a real game looks like and the same seed always gives
// the same frame. The victory scene's pilot is revived if it falls, so the shot
// always ends at dawn; the game-over scene's pilot looks only a moment ahead,
// so it is caught out once the wisps speed up, as a hurried player is.
import { FIELD, FLARE, STEP } from './config.js';
import { EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 24;
const SCENE_LIMIT_SECONDS = 700;
const SAMPLE_HORIZON_PLAY = 110;
const SAMPLE_HORIZON_OVER = 55;

/** The autopilot's next move: toward the nearest ember, away from near wisps. */
function autopilot(state, fleeRadius, flareWhenCrowded) {
  const player = state.player;
  let target = null;
  let targetDistance = Infinity;
  for (const star of state.starEmbers) {
    const distance = Math.hypot(star.x - player.x, star.y - player.y);
    if (distance < targetDistance) {
      targetDistance = distance;
      target = star;
    }
  }
  if (!target) {
    for (const ember of state.embers) {
      const distance = Math.hypot(ember.x - player.x, ember.y - player.y);
      if (distance < targetDistance) {
        targetDistance = distance;
        target = ember;
      }
    }
  }
  let moveX = 0;
  let moveY = 0;
  if (target) {
    const distance = Math.max(1, targetDistance);
    moveX += ((target.x - player.x) / distance) * 1.1;
    moveY += ((target.y - player.y) / distance) * 1.1;
  } else {
    moveX += (FIELD.width / 2 - player.x) / FIELD.width;
    moveY += (FIELD.height / 2 - player.y) / FIELD.height;
  }
  let nearWisps = 0;
  for (const wisp of state.wisps) {
    const dx = player.x - wisp.x;
    const dy = player.y - wisp.y;
    const distance = Math.hypot(dx, dy) || 1;
    if (distance < fleeRadius) {
      const weight = (fleeRadius - distance) / fleeRadius;
      moveX += (dx / distance) * weight * 2.2;
      moveY += (dy / distance) * weight * 2.2;
    }
    if (distance < FLARE.radius) nearWisps += 1;
  }
  const length = Math.hypot(moveX, moveY);
  const move = length > 0.01 ? { x: moveX / length, y: moveY / length } : { x: 0, y: 0 };
  const flare = flareWhenCrowded && nearWisps >= 2 && state.charges > 0 && player.flareCooldown <= 0;
  return { move, flare };
}

function simulate(world, seconds, fleeRadius, flareWhenCrowded, revive) {
  const steps = Math.floor(seconds / STEP);
  for (let index = 0; index < steps; index += 1) {
    const { move, flare } = autopilot(world.state, fleeRadius, flareWhenCrowded);
    const events = world.step(STEP, move, flare, false);
    if (events & EVENT_WIN) return 'win';
    if (events & EVENT_OVER) {
      if (revive) {
        // The victory shot must end at dawn: the pilot stands back up and
        // keeps playing, lives restored, a brief shield to step away.
        world.state.lives = 3;
        world.state.over = false;
        world.state.player.invuln = 2;
        world.state.player.x = FIELD.width / 2;
        world.state.player.y = FIELD.height / 2;
        world.state.player.vx = 0;
        world.state.player.vy = 0;
        continue;
      }
      return 'over';
    }
  }
  return 'time';
}

/**
 * Set `world` to the named scene (start, play, victory or over; any other name
 * is start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    simulate(world, PLAY_SECONDS, SAMPLE_HORIZON_PLAY, true, false);
    const over = world.state.over;
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'victory') {
    const result = simulate(world, SCENE_LIMIT_SECONDS, SAMPLE_HORIZON_PLAY, true, true);
    if (result !== 'win') {
      // The pilot could not finish in the time allowed: show the dawn the
      // game itself draws, with the score the pilot really earned.
      world.state.won = true;
    }
    return { screen: SCREEN_VICTORY, best: world.state.score };
  }
  if (name === 'over') {
    simulate(world, SCENE_LIMIT_SECONDS, SAMPLE_HORIZON_OVER, false, false);
    return { screen: SCREEN_OVER, best: world.state.score };
  }
  for (let index = 0; index < START_SECONDS / STEP; index += 1) {
    world.step(STEP, { x: 0, y: 0 }, false, true);
  }
  return { screen: SCREEN_TITLE, best: 0 };
}
