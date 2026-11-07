// Particles, damage numbers, screen shake and one-shot visual effects.
import { rand, TAU } from '../core/util.js';
import { drawText } from '../core/font.js';

export class FX {
  constructor() {
    this.parts = [];
    this.glow = []; // additive particles drawn after lighting
    this.floaters = [];
    this.vfx = [];
    this.shakeMag = 0;
    this.flash = 0; // full-screen flash alpha
    this.flashCol = '#fff';
  }

  shake(m) { this.shakeMag = Math.max(this.shakeMag, m); }
  screenFlash(a, col = '#fff') { this.flash = Math.max(this.flash, a); this.flashCol = col; }

  burst(x, y, n, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = o.angle !== undefined ? o.angle + rand(-(o.spread ?? Math.PI), o.spread ?? Math.PI) : rand(0, TAU);
      const s = rand(o.smin ?? 20, o.smax ?? 80);
      const p = {
        x: x + rand(-(o.jitter || 0), o.jitter || 0),
        y: y + rand(-(o.jitter || 0), o.jitter || 0),
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - (o.up || 0),
        life: rand(o.lmin ?? 0.25, o.lmax ?? 0.6),
        t: 0,
        col: Array.isArray(o.col) ? o.col[Math.floor(Math.random() * o.col.length)] : o.col || '#fff',
        size: o.size || 1,
        g: o.g ?? 60,
        drag: o.drag ?? 3,
      };
      (o.glow ? this.glow : this.parts).push(p);
    }
  }

  float(x, y, text, col = '#fff', big = false, o = {}) {
    this.floaters.push({ x: x + rand(-4, 4), y, text, col, big, t: 0, life: o.life || (big ? 0.9 : 0.7), vy: o.vy || -38 });
    if (this.floaters.length > 60) this.floaters.shift();
  }

  add(v) { v.t = 0; this.vfx.push(v); return v; }

  update(dt) {
    this.shakeMag = Math.max(0, this.shakeMag - dt * 30);
    this.flash = Math.max(0, this.flash - dt * 3);
    for (const list of [this.parts, this.glow]) {
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.t += dt;
        if (p.t >= p.life) { list.splice(i, 1); continue; }
        p.vx -= p.vx * p.drag * dt;
        p.vy -= p.vy * p.drag * dt;
        p.vy += p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.t += dt;
      f.y += f.vy * dt;
      f.vy *= 1 - 3 * dt;
      if (f.t > f.life) this.floaters.splice(i, 1);
    }
    for (let i = this.vfx.length - 1; i >= 0; i--) {
      const v = this.vfx[i];
      v.t += dt;
      if (v.follow) { v.x = v.follow.x; v.y = v.follow.y; }
      if (v.t >= v.dur) this.vfx.splice(i, 1);
    }
  }

  shakeOffset() {
    if (this.shakeMag <= 0.2) return [0, 0];
    return [Math.round(rand(-1, 1) * this.shakeMag), Math.round(rand(-1, 1) * this.shakeMag)];
  }

  drawParts(ctx, list) {
    for (const p of list) {
      const k = 1 - p.t / p.life;
      ctx.globalAlpha = Math.min(1, k * 1.5);
      ctx.fillStyle = p.col;
      const s = p.size;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
    }
    ctx.globalAlpha = 1;
  }

  drawVfx(ctx) {
    for (const v of this.vfx) drawOne(ctx, v);
  }

  drawFloaters(ctx) {
    for (const f of this.floaters) {
      const a = f.t < f.life * 0.6 ? 1 : 1 - (f.t - f.life * 0.6) / (f.life * 0.4);
      const pop = f.big && f.t < 0.08 ? 2 : f.big ? 2 : 1;
      drawText(ctx, f.text, f.x, f.y - 4, { align: 'center', color: f.col, scale: pop, outline: '#140f17', alpha: a });
    }
  }
}

// --------------------------------------------------------------- vfx shapes
function arcPixels(ctx, x, y, r, a0, a1, col, thick = 1) {
  const steps = Math.max(6, Math.ceil(Math.abs(a1 - a0) * r / 1.5));
  ctx.fillStyle = col;
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (a1 - a0) * (i / steps);
    for (let k = 0; k < thick; k++) {
      ctx.fillRect(Math.round(x + Math.cos(a) * (r - k)), Math.round(y + Math.sin(a) * (r - k)), 1, 1);
    }
  }
}

function ringPixels(ctx, x, y, r, col, thick = 1) {
  arcPixels(ctx, x, y, r, 0, TAU, col, thick);
}

function drawOne(ctx, v) {
  const k = v.t / v.dur;
  switch (v.kind) {
    case 'slash': {
      // crescent sweeping from a0 to a1
      const sweep = Math.min(1, k * 2.2);
      const a0 = v.a0, a1 = v.a0 + (v.a1 - v.a0) * sweep;
      const fade = 1 - Math.max(0, (k - 0.45) / 0.55);
      ctx.globalAlpha = fade;
      arcPixels(ctx, v.x, v.y, v.r, a0, a1, v.col2 || '#ffffff', 2);
      arcPixels(ctx, v.x, v.y, v.r - 2, a0, a1, v.col, 2);
      arcPixels(ctx, v.x, v.y, v.r - 4, a0 + (a1 - a0) * 0.3, a1, v.col, 1);
      ctx.globalAlpha = 1;
      break;
    }
    case 'ring': {
      const r = v.r0 + (v.r1 - v.r0) * Math.sqrt(k);
      ctx.globalAlpha = 1 - k;
      ringPixels(ctx, v.x, v.y, r, v.col, v.thick || 2);
      if (v.col2) ringPixels(ctx, v.x, v.y, r - (v.thick || 2), v.col2, 1);
      ctx.globalAlpha = 1;
      break;
    }
    case 'disc': {
      ctx.globalAlpha = (1 - k) * (v.alpha ?? 0.6);
      ctx.fillStyle = v.col;
      ctx.beginPath();
      ctx.arc(v.x, v.y, v.r * (v.grow ? 0.4 + 0.6 * k : 1), 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case 'beam': {
      const len = v.len, w = v.w * (1 - k * 0.7);
      ctx.save();
      ctx.translate(v.x, v.y);
      ctx.rotate(v.ang);
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = v.col;
      ctx.fillRect(0, -w / 2, len, w);
      ctx.fillStyle = v.col2 || '#fff';
      ctx.fillRect(0, -w / 6, len, Math.max(1, w / 3));
      ctx.restore();
      ctx.globalAlpha = 1;
      break;
    }
    case 'line': {
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = v.col;
      ctx.lineWidth = v.w || 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(v.x) + 0.5, Math.round(v.y) + 0.5);
      ctx.lineTo(Math.round(v.x2) + 0.5, Math.round(v.y2) + 0.5);
      ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    }
    case 'chain': {
      const n = Math.floor(v.len / 4);
      const shown = Math.min(n, Math.floor(n * Math.min(1, k * 4)));
      ctx.fillStyle = '#9aa6b2';
      for (let i = 0; i < shown; i++) {
        const d = i * 4;
        const x = v.x + Math.cos(v.ang) * d, y = v.y + Math.sin(v.ang) * d;
        ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
        if (i % 2) { ctx.fillStyle = '#5f6974'; ctx.fillRect(Math.round(x) + 1, Math.round(y) + 1, 1, 1); ctx.fillStyle = '#9aa6b2'; }
      }
      break;
    }
    case 'spin': {
      const a = v.t * 22;
      ctx.globalAlpha = 0.9;
      arcPixels(ctx, v.x, v.y - 6, v.r, a, a + 2.2, '#ffffff', 2);
      arcPixels(ctx, v.x, v.y - 6, v.r - 2, a + Math.PI, a + Math.PI + 2.2, v.col, 2);
      ctx.globalAlpha = 1;
      break;
    }
    case 'meteor': {
      // falls from above toward (x, y)
      const fk = Math.min(1, k / 0.9);
      const sx = v.x + 80 * (1 - fk), sy = v.y - 160 * (1 - fk);
      ctx.fillStyle = '#ffe08a';
      ctx.fillRect(Math.round(sx) - 3, Math.round(sy) - 3, 7, 7);
      ctx.fillStyle = '#ff8a2a';
      for (let i = 1; i < 8; i++) ctx.fillRect(Math.round(sx + i * 4) - 2, Math.round(sy - i * 8) - 2, 5 - Math.floor(i / 2), 5 - Math.floor(i / 2));
      break;
    }
    case 'shield': {
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(v.t * 10);
      ringPixels(ctx, v.x, v.y - 9, 13, '#9ad4ff', 1);
      ringPixels(ctx, v.x, v.y - 9, 12, 'rgba(154,212,255,0.4)', 1);
      ctx.globalAlpha = 1;
      break;
    }
  }
}
