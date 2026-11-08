// Keyboard bindings (player-editable) and touch / keyboard mode detection.
import { G } from './G.js';

/** Every bindable action, in the order the Controls screen lists them. */
export const ACTIONS = [
  ['up', 'Move up'],
  ['down', 'Move down'],
  ['left', 'Move left'],
  ['right', 'Move right'],
  ['attack', 'Attack (hold)'],
  ['s0', 'Skill 1'],
  ['s1', 'Skill 2'],
  ['s2', 'Skill 3'],
  ['ult', 'Ultimate'],
  ['dodge', 'Dodge roll'],
  ['potion', 'Drink potion'],
  ['pause', 'Pause'],
];

// two keys per action; null = empty slot. Esc always pauses / goes back as well.
export const DEFAULT_KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  attack: ['KeyJ', null],
  s0: ['Digit1', 'KeyK'],
  s1: ['Digit2', 'KeyL'],
  s2: ['Digit3', 'KeyI'],
  ult: ['KeyR', 'KeyU'],
  dodge: ['Space', 'Shift'],
  potion: ['KeyQ', 'KeyH'],
  pause: ['KeyP', null],
};

/** Current bindings: the player's edits on top of the defaults. */
export function binds() {
  const s = (G.save && G.save.settings) || {};
  const out = {};
  for (const [a] of ACTIONS) {
    const mine = s.keys && Array.isArray(s.keys[a]) ? s.keys[a] : null;
    out[a] = mine ? [mine[0] ?? null, mine[1] ?? null] : DEFAULT_KEYS[a].slice();
  }
  return out;
}

/** Put `code` on action `a`, slot `slot`. A key can only do one thing: it is removed from any other action. */
export function setBind(a, slot, code) {
  const b = binds();
  let moved = null;
  if (code) {
    for (const [o] of ACTIONS) {
      for (let i = 0; i < 2; i++) if (b[o][i] === code && !(o === a && i === slot)) { b[o][i] = null; moved = o; }
    }
  }
  b[a][slot] = code;
  G.save.settings.keys = b;
  return moved;
}

export function resetBinds() { delete G.save.settings.keys; }

const held = (a, B) => G.input.key(...B[a].filter(Boolean));
const tapped = (a, B) => G.input.keyPressed(...B[a].filter(Boolean));
export function actionHeld(a, B = binds()) { return held(a, B); }
export function actionPressed(a, B = binds()) { return tapped(a, B); }

const NAMES = {
  ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', Space: 'Space', Shift: 'Shift',
  Control: 'Ctrl', Alt: 'Alt', Enter: 'Enter', Tab: 'Tab', Backspace: 'Bksp', CapsLock: 'Caps',
  Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\',
  Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/',
};
/** Short label for a key code, e.g. KeyW -> W, Digit1 -> 1. */
export function keyName(code) {
  if (!code) return '-';
  if (NAMES[code]) return NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num' + code.slice(6);
  return code.length > 6 ? code.slice(0, 6) : code;
}

/**
 * Show touch controls? 'auto' follows the last thing the player used:
 * a finger on the screen shows them, a key press or the mouse hides them.
 */
export function touchUI() {
  const pref = (G.save && G.save.settings && G.save.settings.controls) || 'auto';
  if (pref === 'touch') return true;
  if (pref === 'keys') return false;
  return G.inputMode !== 'keys';
}
