// Immediate-mode pixel UI helpers drawn straight onto the game canvas.
import { G } from './G.js';
import { drawText, measure } from './font.js';
import { drawSprite } from './sprite.js';

export const COL = {
  bg: '#0d0a10',
  panel: '#17131c',
  panel2: '#211b28',
  edge: '#4a4052',
  edgeHi: '#6d5f78',
  bronze: '#b8874a',
  bronzeD: '#6b4e2c',
  text: '#ece4d8',
  dim: '#958a9c',
  faint: '#5e5566',
  ember: '#ff8a2a',
  gold: '#ffd24a',
  red: '#e0453a',
  green: '#6ad46a',
  hp: '#d8343a',
  hpD: '#5a1418',
  xp: '#8ec6ff',
  teal: '#35b8a8',
};

export const RARITY = [
  { name: 'Common', col: '#cfc8c2' },
  { name: 'Magic', col: '#5aa0ff' },
  { name: 'Rare', col: '#ffd24a' },
  { name: 'Epic', col: '#c06bff' },
  { name: 'Legendary', col: '#ff8a2a' },
];

export function rect(ctx, x, y, w, h, col) {
  ctx.fillStyle = col;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** Pixel panel with cut corners. */
export function panel(ctx, x, y, w, h, opt = {}) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  const fill = opt.fill || COL.panel;
  const edge = opt.edge || COL.edge;
  const a = ctx.globalAlpha;
  if (opt.alpha !== undefined) ctx.globalAlpha = a * opt.alpha;
  ctx.fillStyle = edge;
  ctx.fillRect(x + 1, y, w - 2, h);
  ctx.fillRect(x, y + 1, w, h - 2);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  if (opt.hi !== false) {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(x + 2, y + 1, w - 4, 1);
  }
  ctx.globalAlpha = a;
}

/**
 * Button. Returns true when tapped this frame.
 * opt: disabled, color (text), fill, edge, icon (sprite), sound, selected, small
 */
export function button(ctx, x, y, w, h, label, opt = {}) {
  const inp = G.input;
  const held = !opt.disabled && inp.heldIn(x, y, w, h);
  const sel = opt.selected;
  panel(ctx, x, y + (held ? 1 : 0), w, h, {
    fill: opt.disabled ? '#141117' : held ? '#3a3040' : sel ? '#33283a' : opt.fill || '#251e2b',
    edge: opt.disabled ? '#2e2833' : sel ? COL.bronze : opt.edge || '#5a4a3c',
  });
  if (!opt.disabled && !held) rect(ctx, x + 2, y + h - 2, w - 4, 1, 'rgba(0,0,0,0.35)');
  const oy = held ? 1 : 0;
  let tx = x + w / 2;
  if (opt.icon) {
    const iw = opt.icon.w;
    const tw = label ? measure(label) + 3 : 0;
    const sx = Math.round(x + w / 2 - (iw + tw) / 2);
    drawSprite(ctx, opt.icon, sx + iw / 2, y + h / 2 + opt.icon.h / 2 + oy, { alpha: opt.disabled ? 0.4 : 1 });
    tx = sx + iw + 3 + tw / 2;
  }
  if (label) {
    drawText(ctx, label, tx, Math.round(y + h / 2 - 3.5 + oy), {
      align: 'center',
      color: opt.disabled ? COL.faint : opt.color || COL.text,
    });
  }
  if (!opt.disabled && inp.tapIn(x, y, w, h)) {
    if (opt.sound !== false) G.audio.play(opt.sound || 'ui');
    return true;
  }
  if (opt.disabled && inp.tapIn(x, y, w, h)) G.audio.play('deny');
  return false;
}

export function bar(ctx, x, y, w, h, frac, col, bg = '#120e14', edge = '#000') {
  x = Math.round(x); y = Math.round(y);
  rect(ctx, x - 1, y - 1, w + 2, h + 2, edge);
  rect(ctx, x, y, w, h, bg);
  const fw = Math.round(w * Math.max(0, Math.min(1, frac)));
  if (fw > 0) {
    rect(ctx, x, y, fw, h, col);
    rect(ctx, x, y, fw, 1, 'rgba(255,255,255,0.25)');
  }
}

export function iconFrame(ctx, x, y, size, rarity = -1, opt = {}) {
  const col = rarity >= 0 ? RARITY[rarity].col : '#3a3240';
  panel(ctx, x, y, size, size, { fill: opt.fill || '#120e15', edge: opt.selected ? '#ffffff' : rarity >= 0 ? col : '#3a3240' });
  if (rarity >= 3) {
    ctx.fillStyle = rarity === 4 ? 'rgba(255,138,42,0.18)' : 'rgba(192,107,255,0.15)';
    ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
  }
}

/** Dim the whole screen. */
export function shade(ctx, a = 0.6) {
  ctx.fillStyle = `rgba(6,4,8,${a})`;
  ctx.fillRect(0, 0, G.W, G.H);
}

export function title(ctx, text, x, y, col = COL.bronze) {
  drawText(ctx, text, x, y, { align: 'center', color: col, scale: 2, shadowColor: '#000' });
}
