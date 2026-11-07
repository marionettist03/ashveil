// Title screen and hero selection.
import { G } from '../core/G.js';
import { rand, TAU } from '../core/util.js';
import { drawText, wrap } from '../core/font.js';
import { drawSprite } from '../core/sprite.js';
import { button, panel, COL, shade, title } from '../core/ui.js';
import { newHeroState, writeSave, wipeHero } from '../core/save.js';
import { ART } from '../data/art.js';
import { HEROES, HERO_ORDER } from '../data/heroes.js';
import { CHAPTER_NAME } from '../data/stages.js';
import { CampScene } from './camp.js';

// ------------------------------------------------------------ shared backdrop
export class Backdrop {
  constructor() { this.flakes = []; this.t = 0; }
  update(dt) {
    this.t += dt;
    while (this.flakes.length < 90) this.flakes.push({ x: rand(0, G.W), y: rand(-G.H, G.H), vx: rand(-12, -4), vy: rand(8, 20), e: Math.random() < 0.15, ph: rand(0, 6) });
    for (const f of this.flakes) {
      f.x += (f.vx + Math.sin(this.t + f.ph) * 3) * dt; f.y += f.vy * dt;
      if (f.y > G.H) { f.y = -2; f.x = rand(0, G.W + 40); }
      if (f.x < -2) f.x = G.W + 2;
    }
  }
  draw(ctx, opt = {}) {
    const W = G.W, H = G.H;
    // sky gradient (banded)
    const bands = ['#0a070c', '#0e0a10', '#130d13', '#1a1015', '#231316', '#2e1715'];
    for (let i = 0; i < bands.length; i++) { ctx.fillStyle = bands[i]; ctx.fillRect(0, Math.floor((H * i) / bands.length), W, Math.ceil(H / bands.length) + 1); }
    // distant burning glow on the horizon (Lumenhold)
    ctx.fillStyle = 'rgba(255,110,40,0.10)';
    ctx.fillRect(0, H * 0.62, W, 6);
    ctx.fillStyle = 'rgba(255,110,40,0.06)';
    ctx.fillRect(0, H * 0.58, W, 14);
    // far hills
    ctx.fillStyle = '#100b0e';
    for (let x = 0; x < W; x++) {
      const h = 18 + Math.sin(x * 0.02) * 6 + Math.sin(x * 0.07 + 1) * 3;
      ctx.fillRect(x, Math.round(H * 0.66 - h), 1, Math.round(h) + 2);
    }
    // the hill with the chapel & bell tower
    const hx = opt.hillX ?? W * 0.7;
    ctx.fillStyle = '#0a0709';
    for (let x = 0; x < W; x++) {
      const d = (x - hx) / (W * 0.28);
      const h = Math.max(0, 1 - d * d) * 54 + 8;
      ctx.fillRect(x, Math.round(H * 0.72 - h), 1, Math.round(h) + H);
    }
    const cx = Math.round(hx), cy = Math.round(H * 0.72 - 62);
    ctx.fillStyle = '#0a0709';
    ctx.fillRect(cx - 16, cy - 2, 32, 12); // nave
    ctx.fillRect(cx - 14, cy - 6, 28, 4);
    ctx.fillRect(cx + 6, cy - 28, 10, 28); // tower
    ctx.fillRect(cx + 5, cy - 31, 12, 3);
    ctx.fillRect(cx + 8, cy - 36, 6, 5);
    ctx.fillRect(cx + 10, cy - 40, 2, 4);
    // tower opening with the bell glow
    const glow = 0.5 + 0.5 * Math.sin(this.t * 1.3);
    ctx.fillStyle = `rgba(255,170,70,${0.35 + glow * 0.4})`;
    ctx.fillRect(cx + 9, cy - 24, 4, 6);
    ctx.fillStyle = '#0a0709';
    ctx.fillRect(cx + 10, cy - 22, 2, 3);
    // near ground
    ctx.fillStyle = '#070506';
    ctx.fillRect(0, Math.round(H * 0.86), W, H);
    // dead trees silhouettes
    const tree = (x, s) => {
      ctx.fillStyle = '#070506';
      ctx.fillRect(x, Math.round(H * 0.86 - 30 * s), 2, Math.round(30 * s));
      ctx.fillRect(x - 5, Math.round(H * 0.86 - 22 * s), 5, 1);
      ctx.fillRect(x - 6, Math.round(H * 0.86 - 26 * s), 1, 4);
      ctx.fillRect(x + 2, Math.round(H * 0.86 - 18 * s), 6, 1);
      ctx.fillRect(x + 7, Math.round(H * 0.86 - 24 * s), 1, 6);
    };
    tree(Math.round(W * 0.08), 1.2); tree(Math.round(W * 0.2), 0.8); tree(Math.round(W * 0.92), 1);
    for (const f of this.flakes) {
      ctx.fillStyle = f.e ? (Math.sin(this.t * 5 + f.ph) > 0 ? '#ff8a2a' : '#8a3010') : 'rgba(200,192,186,0.55)';
      ctx.fillRect(Math.round(f.x), Math.round(f.y), 1, 1);
    }
  }
}

// ------------------------------------------------------------ title
export class TitleScene {
  constructor() { this.bg = new Backdrop(); this.t = 0; }
  enter() { G.audio.music('calm'); }
  update(dt) { this.bg.update(dt); this.t += dt; }
  draw(ctx) {
    this.bg.draw(ctx);
    const W = G.W, H = G.H;
    const y = Math.round(H * 0.2);
    // logo with an ember shimmer
    drawText(ctx, 'ASHVEIL', W / 2 + 2, y + 2, { align: 'center', scale: 5, color: '#2a1408', shadow: false });
    drawText(ctx, 'ASHVEIL', W / 2, y, { align: 'center', scale: 5, color: '#c89458', shadow: false });
    const sh = (this.t * 60) % (W + 200) - 100;
    ctx.save();
    ctx.beginPath(); ctx.rect(sh, y - 4, 26, 44); ctx.clip();
    drawText(ctx, 'ASHVEIL', W / 2, y, { align: 'center', scale: 5, color: '#ffe0a0', shadow: false });
    ctx.restore();
    drawText(ctx, CHAPTER_NAME, W / 2, y + 44, { align: 'center', color: '#a89888' });
    if (Math.floor(this.t * 2) % 2 === 0) drawText(ctx, 'Tap to begin', W / 2, H * 0.74, { align: 'center', color: COL.text, outline: '#000' });
    drawText(ctx, 'An original game. Offline. No ads.', W / 2, H - 12, { align: 'center', color: COL.faint });
    if (G.input.consumeAnyTap() || G.input.keyPressed('Enter', 'Space')) {
      G.audio.play('ui');
      G.setScene(new HeroSelectScene(this.bg));
    }
  }
}

// ------------------------------------------------------------ hero select
export class HeroSelectScene {
  constructor(bg) {
    this.bg = bg || new Backdrop();
    this.sel = G.save.last && HEROES[G.save.last] ? HERO_ORDER.indexOf(G.save.last) : 0;
    this.t = 0;
    this.confirmReset = false;
  }
  enter() { G.audio.music('calm'); }
  update(dt) { this.bg.update(dt); this.t += dt; }
  draw(ctx) {
    this.bg.draw(ctx);
    shade(ctx, 0.35);
    const W = G.W, H = G.H, L = G.safeL + 6, R = W - G.safeR - 6;
    title(ctx, 'Choose your hero', W / 2, 6);
    const n = HERO_ORDER.length;
    const gap = 6;
    const cw = Math.min(104, Math.floor((R - L - gap * (n - 1)) / n));
    const ch = 104;
    const x0 = Math.round(W / 2 - (cw * n + gap * (n - 1)) / 2);
    const y0 = 26;
    HERO_ORDER.forEach((id, i) => {
      const h = HEROES[id];
      const x = x0 + i * (cw + gap);
      const sel = i === this.sel;
      const hs = G.save.heroes[id];
      panel(ctx, x, y0 + (sel ? 0 : 3), cw, ch, { fill: sel ? '#241c2a' : '#17131c', edge: sel ? h.color : '#3a3040' });
      const art = ART.heroes[id];
      const spr = sel ? art.walk[Math.floor(this.t * 6) % 4] : art.idle[Math.floor(this.t * 2) % 2];
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x + cw / 2 - 12, y0 + 64, 24, 3);
      drawSprite(ctx, spr, x + cw / 2, y0 + 66 + (sel ? 0 : 3), { scale: 2 });
      drawText(ctx, h.name, x + cw / 2, y0 + 70, { align: 'center', color: sel ? h.color : COL.text });
      drawText(ctx, h.role, x + cw / 2, y0 + 80, { align: 'center', color: COL.dim });
      // difficulty pips
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = k < h.difficulty ? '#ff8a2a' : '#3a3040';
        ctx.fillRect(Math.round(x + cw / 2 - 10 + k * 8), y0 + 92, 5, 3);
      }
      if (hs) drawText(ctx, 'Lv ' + hs.level, x + 4, y0 + 5, { color: '#ffd24a' });
      if (G.input.tapIn(x, y0, cw, ch)) { if (this.sel !== i) G.audio.play('ui'); this.sel = i; this.confirmReset = false; }
    });
    // details
    const h = HEROES[HERO_ORDER[this.sel]];
    const hs = G.save.heroes[h.id];
    const dy = y0 + ch + 6;
    const dw = R - L;
    panel(ctx, L, dy, dw, H - dy - 4, { fill: '#120e15' });
    drawText(ctx, `${h.name}, ${h.title}`, L + 8, dy + 6, { color: h.color });
    const lines = wrap(h.blurb + '  ' + h.style, dw - 120);
    lines.slice(0, 5).forEach((ln, i) => drawText(ctx, ln, L + 8, dy + 18 + i * 10, { color: COL.text }));
    const bw = 96, bx = R - bw - 8;
    if (button(ctx, bx, dy + 8, bw, 20, hs ? `Continue  Lv ${hs.level}` : 'Begin', { color: '#ffe0a0' }) || G.input.keyPressed('Enter')) this.start(h.id);
    if (hs) {
      if (!this.confirmReset) { if (button(ctx, bx, dy + 32, bw, 14, 'Start over', { color: COL.dim })) this.confirmReset = true; }
      else if (button(ctx, bx, dy + 32, bw, 14, 'Tap again to erase', { color: '#e0453a' })) { wipeHero(G.save, h.id); this.confirmReset = false; }
    }
    if (G.input.keyPressed('ArrowRight', 'KeyD')) this.sel = (this.sel + 1) % n;
    if (G.input.keyPressed('ArrowLeft', 'KeyA')) this.sel = (this.sel + n - 1) % n;
  }

  start(id) {
    G.audio.play('ui');
    let fresh = false;
    if (!G.save.heroes[id]) { G.save.heroes[id] = newHeroState(id); fresh = true; }
    G.save.last = id;
    writeSave(G.save);
    G.setScene(new CampScene(G.save.heroes[id], { fresh }));
  }
}
