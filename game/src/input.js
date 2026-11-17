// Keyboard and mouse, read once per frame: held keys become a movement vector,
// fresh presses become actions (confirm, pause, flare, mute), and clicks become
// points the game can test against its on-screen buttons. Pointer coordinates are
// in canvas CSS pixels; main.js converts them into field coordinates.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_FLARE = 4;
export const ACTION_MUTE = 8;
export const ACTION_RESTART = 16;

const MOVE_KEYS = new Set(['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let pointer = { x: 0, y: 0, down: false };
  let clicks = [];

  function keyName(event) {
    return event.key.toLowerCase();
  }

  window.addEventListener('keydown', (event) => {
    const key = keyName(event);
    if (MOVE_KEYS.has(key) || key === ' ') event.preventDefault();
    if (event.repeat) return;
    held.add(key);
    if (key === ' ' || key === 'enter') actions |= ACTION_CONFIRM | ACTION_FLARE;
    if (key === 'p' || key === 'escape') actions |= ACTION_PAUSE;
    if (key === 'm') actions |= ACTION_MUTE;
    if (key === 'r') actions |= ACTION_RESTART;
  });
  window.addEventListener('keyup', (event) => {
    held.delete(keyName(event));
  });
  window.addEventListener('blur', () => {
    held.clear();
    pointer.down = false;
  });

  function pointFrom(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  canvas.addEventListener('pointermove', (event) => {
    const point = pointFrom(event);
    pointer = { x: point.x, y: point.y, down: pointer.down };
  });
  canvas.addEventListener('pointerdown', (event) => {
    const point = pointFrom(event);
    pointer = { x: point.x, y: point.y, down: true };
    clicks.push(point);
    if (event.button === 2) actions |= ACTION_FLARE;
    else actions |= ACTION_CONFIRM;
  });
  canvas.addEventListener('pointerup', () => {
    pointer.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    // A unit movement vector from the held keys, or {x: 0, y: 0} when none are held.
    keyDirection() {
      let x = 0;
      let y = 0;
      if (held.has('arrowleft') || held.has('a')) x -= 1;
      if (held.has('arrowright') || held.has('d')) x += 1;
      if (held.has('arrowup') || held.has('w')) y -= 1;
      if (held.has('arrowdown') || held.has('s')) y += 1;
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const length = Math.hypot(x, y);
      return { x: x / length, y: y / length };
    },
    pointer() {
      return pointer;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    takeClicks() {
      const taken = clicks;
      clicks = [];
      return taken;
    },
  };
}
