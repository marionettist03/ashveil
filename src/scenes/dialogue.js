// Story dialogue box with portraits and a typewriter effect.
import { G } from '../core/G.js';
import { drawText, wrap } from '../core/font.js';
import { panel, button, COL, shade } from '../core/ui.js';
import { drawSprite } from '../core/sprite.js';
import { ART } from '../data/art.js';
import { SPEAKERS } from '../data/story.js';

function portraitSprite(who) {
  if (ART.heroes[who]) return ART.heroes[who].idle[0];
  if (who === 'maud') return ART.maud.idle[0];
  if (who === 'ansel') return ART.ansel.idle[0];
  if (who === 'stag') return ART.enemies.stag.idle[0];
  if (who === 'warden') return ART.enemies.warden.idle[0];
  return null;
}

export class Dialogue {
  constructor(lines, onDone) {
    this.lines = lines;
    this.i = 0;
    this.chars = 0;
    this.onDone = onDone;
    this.t = 0;
    this.done = false;
  }

  get line() { return this.lines[this.i]; }

  advance() {
    const [, text] = this.line;
    if (this.chars < text.length) { this.chars = text.length; return; }
    this.i++;
    this.chars = 0;
    if (this.i >= this.lines.length) this.finish();
    else G.audio.play('ui', { vol: 0.5 });
  }

  finish() {
    if (this.done) return;
    this.done = true;
    if (this.onDone) this.onDone();
  }

  update(dt) {
    if (this.done) return;
    this.t += dt;
    const line = this.line;
    if (line) this.chars = Math.min(line[1].length, this.chars + dt * 60);
  }

  draw(ctx) {
    if (this.done || !this.line) return;
    const W = G.W, H = G.H;
    const [who, text] = this.line;
    const sp = SPEAKERS[who] || SPEAKERS.narr;
    const narr = who === 'narr';
    shade(ctx, narr ? 0.55 : 0.25);
    const bh = 66;
    const bx = G.safeL + 8, bw = W - G.safeL - G.safeR - 16, by = H - bh - 6;
    panel(ctx, bx, by, bw, bh, { fill: '#120e15', edge: narr ? '#3a3040' : COL.bronzeD });
    let tx = bx + 10;
    if (!narr) {
      const ps = portraitSprite(who);
      panel(ctx, bx + 5, by + 5, 56, 56, { fill: '#1c1621', edge: '#3a3040' });
      if (ps) {
        const bust = ps.h <= 34; // people: head and shoulders at 2x; big creatures: whole body
        const sc = bust ? 2 : Math.max(1, Math.floor(Math.min(50 / ps.w, 50 / ps.h)));
        const flip = who === 'stag' || who === 'warden';
        ctx.save();
        ctx.beginPath(); ctx.rect(bx + 6, by + 6, 54, 54); ctx.clip();
        drawSprite(ctx, ps, bx + 33, bust ? by + 4 + ps.h * 2 : by + 58, { scale: sc, flip });
        ctx.restore();
      } else {
        drawText(ctx, '?', bx + 33, by + 26, { align: 'center', color: sp.col, scale: 2 });
      }
      tx = bx + 68;
      drawText(ctx, sp.name, tx, by + 7, { color: sp.col });
    }
    const maxW = bx + bw - tx - 10;
    const shown = text.slice(0, Math.floor(this.chars));
    const lines = wrap(text, maxW);
    // re-wrap the visible slice using the full-text line breaks so words don't jump
    let remaining = shown.length;
    let y = narr ? by + 12 : by + 20;
    for (const ln of lines) {
      if (remaining <= 0) break;
      const part = ln.slice(0, remaining);
      drawText(ctx, part, tx, y, { color: narr ? '#cfc2b4' : COL.text });
      remaining -= ln.length + 1;
      y += 11;
    }
    if (this.chars >= text.length && Math.floor(this.t * 3) % 2 === 0) {
      ctx.fillStyle = COL.bronze;
      ctx.fillRect(bx + bw - 12, by + bh - 9, 5, 1);
      ctx.fillRect(bx + bw - 11, by + bh - 8, 3, 1);
      ctx.fillRect(bx + bw - 10, by + bh - 7, 1, 1);
    }
    // skip
    if (button(ctx, bx + bw - 46, by - 18, 46, 15, 'Skip', { sound: 'uiBack' })) { this.finish(); return; }
    const inp = G.input;
    if (inp.keyPressed('Escape')) { this.finish(); return; }
    if (inp.consumeAnyTap() || inp.keyPressed('Enter', 'Space', 'KeyJ')) this.advance();
  }
}
