// ASCII pixel-art sprites -> canvases, plus simple frame generation.
import { makeCanvas } from './util.js';

/** Build a sprite from rows of palette keys ('.' = transparent). */
export function makeSprite(rows, pal) {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const c = makeCanvas(w, h);
  const x = c.getContext('2d');
  for (let y = 0; y < h; y++) {
    const r = rows[y];
    for (let i = 0; i < r.length; i++) {
      const ch = r[i];
      if (ch === '.' || ch === ' ') continue;
      const col = pal[ch];
      if (!col) continue;
      x.fillStyle = col;
      x.fillRect(i, y, 1, 1);
    }
  }
  return { c, w, h, tints: new Map() };
}

/** Solid-colour silhouette of a sprite (cached per colour). */
export function tintOf(spr, color) {
  let t = spr.tints.get(color);
  if (!t) {
    t = makeCanvas(spr.w, spr.h);
    const x = t.getContext('2d');
    x.drawImage(spr.c, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color;
    x.fillRect(0, 0, spr.w, spr.h);
    spr.tints.set(color, t);
  }
  return t;
}

/**
 * Draw a sprite anchored at its bottom-centre (x, y).
 * opt: flip, scale, tint (colour silhouette), alpha, outline (colour)
 */
export function drawSprite(ctx, spr, x, y, opt = {}) {
  const s = opt.scale || 1;
  const w = spr.w * s, h = spr.h * s;
  const dx = Math.round(x - w / 2), dy = Math.round(y - h);
  const prevA = ctx.globalAlpha;
  if (opt.alpha !== undefined) ctx.globalAlpha = prevA * opt.alpha;
  const blit = (img, ox, oy) => {
    if (opt.flip) {
      ctx.save();
      ctx.translate(dx + ox + w, dy + oy);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, w, h);
      ctx.restore();
    } else ctx.drawImage(img, dx + ox, dy + oy, w, h);
  };
  if (opt.outline) {
    const o = tintOf(spr, opt.outline);
    blit(o, -s, 0); blit(o, s, 0); blit(o, 0, -s); blit(o, 0, s);
  }
  blit(opt.tint ? tintOf(spr, opt.tint) : spr.c, 0, 0);
  ctx.globalAlpha = prevA;
}

// ---- char-grid helpers used to derive animation frames ----
function toGrid(rows) {
  const w = Math.max(...rows.map((r) => r.length));
  return rows.map((r) => r.padEnd(w, '.').split(''));
}
const fromGrid = (g) => g.map((r) => r.join(''));
const cloneGrid = (g) => g.map((r) => r.slice());

/** Move a rectangular region of the grid by (dx, dy); vacated cells become '.' */
function shiftRegion(g, x0, y0, x1, y1, dx, dy) {
  const src = cloneGrid(g);
  const out = cloneGrid(g);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) out[y][x] = '.';
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const ny = y + dy, nx = x + dx;
      if (ny < 0 || ny >= g.length || nx < 0 || nx >= g[0].length) continue;
      if (src[y][x] !== '.') out[ny][nx] = src[y][x];
    }
  }
  return out;
}

/**
 * Derive idle / walk / attack frames from one standing pose.
 * legTop: first row of legs; split: column dividing left/right leg; mode: 'legs' | 'sway'
 */
export function buildFrames(rows, pal, { legTop, split, mode = 'legs' }) {
  const g = toGrid(rows);
  const H = g.length, W = g[0].length;
  const top = (grid, dy) => shiftRegion(grid, 0, 0, W, legTop, 0, dy);
  const idle0 = g;
  const idle1 = top(g, 1);
  let walk;
  if (mode === 'legs') {
    const liftL = shiftRegion(g, 0, legTop + 1, split, H, 0, -1);
    const liftR = shiftRegion(g, split, legTop + 1, W, H, 0, -1);
    walk = [g, top(liftL, 1), g, top(liftR, 1)];
  } else {
    const swayL = shiftRegion(g, 0, legTop, W, H, -1, 0);
    const swayR = shiftRegion(g, 0, legTop, W, H, 1, 0);
    walk = [g, top(swayL, 1), g, top(swayR, 1)];
  }
  const atk = shiftRegion(g, 0, 0, W, legTop, 1, 0);
  const mk = (gr) => makeSprite(fromGrid(gr), pal);
  return {
    idle: [mk(idle0), mk(idle1)],
    walk: walk.map(mk),
    atk: [mk(atk)],
    w: W,
    h: H,
  };
}

/**
 * Paper-doll frame: stamp parts onto one grid. layers = [[partName, dx, dy], ...] back to front.
 * Each part is { x, y, rows } in the base sprite's coordinates; ox shifts everything right.
 */
export function composeRows(parts, layers, W, H, ox = 0) {
  const g = Array.from({ length: H }, () => Array(W).fill('.'));
  for (const [name, dx, dy] of layers) {
    const p = parts[name];
    if (!p) throw new Error('unknown sprite part: ' + name);
    p.rows.forEach((row, i) => {
      const y = p.y + i + dy;
      if (y < 0 || y >= H) return;
      for (let j = 0; j < row.length; j++) {
        const ch = row[j];
        if (ch === '.' || ch === ' ') continue;
        const x = (p.x || 0) + j + dx + ox;
        if (x >= 0 && x < W) g[y][x] = ch;
      }
    });
  }
  return g.map((r) => r.join(''));
}
