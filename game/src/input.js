// Keyboard and mouse state, sampled by the loop each tick. Keys are tracked
// as a held-set plus a pressed-this-frame set, so menus can react to a tap
// while movement reads what is held. Mouse position is reported in arena
// coordinates through a transform the renderer owns (letterboxing).

export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_RESTART = 'restart';
export const ACTION_DASH = 'dash';

const KEY_ACTIONS = new Map([
  ['Enter', ACTION_CONFIRM],
  ['Space', ACTION_CONFIRM],
  ['KeyP', ACTION_PAUSE],
  ['Escape', ACTION_PAUSE],
  ['KeyR', ACTION_RESTART],
  ['ShiftLeft', ACTION_DASH],
  ['ShiftRight', ACTION_DASH],
]);

export function createInput(canvas, toArena) {
  const held = new Set();
  const tapped = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) {
      held.add(event.code);
      tapped.add(event.code);
    }
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
    mouse.down = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const point = toArena(event.clientX, event.clientY);
    mouse.x = point.x;
    mouse.y = point.y;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const point = toArena(event.clientX, event.clientY);
    mouse.x = point.x;
    mouse.y = point.y;
    mouse.down = true;
    mouse.clicked = true;
    canvas.setPointerCapture?.(event.pointerId);
  });
  window.addEventListener('pointerup', () => {
    mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    mouse,
    /** Movement vector from WASD or the arrow keys, normalised. */
    moveVector() {
      let x = 0;
      let y = 0;
      if (held.has('KeyA') || held.has('ArrowLeft')) x -= 1;
      if (held.has('KeyD') || held.has('ArrowRight')) x += 1;
      if (held.has('KeyW') || held.has('ArrowUp')) y -= 1;
      if (held.has('KeyS') || held.has('ArrowDown')) y += 1;
      if (x !== 0 && y !== 0) {
        const inv = Math.SQRT1_2;
        x *= inv;
        y *= inv;
      }
      return { x, y };
    },
    /** True while the given action's key is held. */
    actionHeld(action) {
      for (const code of held) {
        if (KEY_ACTIONS.get(code) === action) return true;
      }
      return false;
    },
    /** True only on the frame the given action's key was first pressed. */
    actionTapped(action) {
      for (const code of tapped) {
        if (KEY_ACTIONS.get(code) === action) return true;
      }
      return false;
    },
    /** Number keys 1-3, for choosing an upgrade card. */
    numberTapped() {
      if (tapped.has('Digit1')) return 1;
      if (tapped.has('Digit2')) return 2;
      if (tapped.has('Digit3')) return 3;
      return 0;
    },
    /** Called at the end of each frame: per-frame taps do not carry over. */
    endFrame() {
      tapped.clear();
      mouse.clicked = false;
    },
  };
}
