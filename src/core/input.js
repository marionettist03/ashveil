// Touch / mouse / keyboard input mapped to internal pixel coordinates.
import { G } from './G.js';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.pointers = new Map();
    this.taps = [];
    this.keys = new Set();
    this.pressed = new Set();
    this.anyTap = false;
    this.onFirstGesture = null;

    const opts = { passive: false };
    canvas.addEventListener('pointerdown', (e) => this._down(e), opts);
    window.addEventListener('pointermove', (e) => this._move(e), opts);
    window.addEventListener('pointerup', (e) => this._up(e, false), opts);
    window.addEventListener('pointercancel', (e) => this._up(e, true), opts);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      if (this.onFirstGesture) { this.onFirstGesture(); }
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.resetPointers(); });
  }

  toInternal(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * G.W, y: ((e.clientY - r.top) / r.height) * G.H };
  }

  _down(e) {
    e.preventDefault();
    if (this.onFirstGesture) this.onFirstGesture();
    try { this.canvas.setPointerCapture(e.pointerId); } catch (err) { /* not supported */ }
    const { x, y } = this.toInternal(e);
    const p = { id: e.pointerId, x, y, sx: x, sy: y, t0: performance.now(), role: null, moved: 0 };
    this.pointers.set(e.pointerId, p);
    if (G.scene && G.scene.claimPointer) p.role = G.scene.claimPointer(p) || null;
  }

  _move(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const { x, y } = this.toInternal(e);
    p.moved = Math.max(p.moved, Math.hypot(x - p.sx, y - p.sy));
    p.x = x; p.y = y;
  }

  _up(e, cancel) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    if (cancel) return;
    if (!p.role && p.moved < 12 && performance.now() - p.t0 < 900) {
      this.taps.push({ x: p.sx, y: p.sy });
      this.anyTap = true;
    }
    if (G.scene && G.scene.releasePointer) G.scene.releasePointer(p);
  }

  resetPointers() {
    this.pointers.clear();
    this.taps.length = 0;
  }

  /** Consume the first tap inside the rect. */
  tapIn(x, y, w, h) {
    for (let i = 0; i < this.taps.length; i++) {
      const t = this.taps[i];
      if (t.x >= x && t.y >= y && t.x < x + w && t.y < y + h) { this.taps.splice(i, 1); return true; }
    }
    return false;
  }
  tapInCircle(cx, cy, r) {
    for (let i = 0; i < this.taps.length; i++) {
      const t = this.taps[i];
      if (Math.hypot(t.x - cx, t.y - cy) <= r) { this.taps.splice(i, 1); return true; }
    }
    return false;
  }
  /** Is an unclaimed pointer currently held inside the rect? */
  heldIn(x, y, w, h) {
    for (const p of this.pointers.values()) {
      if (!p.role && p.sx >= x && p.sy >= y && p.sx < x + w && p.sy < y + h && p.x >= x && p.y >= y && p.x < x + w && p.y < y + h) return true;
    }
    return false;
  }
  key(...codes) { return codes.some((c) => this.keys.has(c)); }
  keyPressed(...codes) { return codes.some((c) => this.pressed.has(c)); }
  consumeAnyTap() {
    if (this.taps.length) { this.taps.length = 0; return true; }
    return false;
  }

  endFrame() {
    this.taps.length = 0;
    this.pressed.clear();
    this.anyTap = false;
  }
}
