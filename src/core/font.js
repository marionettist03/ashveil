// Hand-made proportional bitmap font (7px cap height, 2px descenders).
// Each glyph: rows separated by '|', '#' = pixel.
import { makeCanvas } from './util.js';

const RAW = {
  A: '.###.|#...#|#...#|#####|#...#|#...#|#...#',
  B: '####.|#...#|#...#|####.|#...#|#...#|####.',
  C: '.###.|#...#|#....|#....|#....|#...#|.###.',
  D: '####.|#...#|#...#|#...#|#...#|#...#|####.',
  E: '#####|#....|#....|####.|#....|#....|#####',
  F: '#####|#....|#....|####.|#....|#....|#....',
  G: '.###.|#...#|#....|#.###|#...#|#...#|.####',
  H: '#...#|#...#|#...#|#####|#...#|#...#|#...#',
  I: '###|.#.|.#.|.#.|.#.|.#.|###',
  J: '..###|...#.|...#.|...#.|...#.|#..#.|.##..',
  K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#',
  L: '#....|#....|#....|#....|#....|#....|#####',
  M: '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#',
  N: '#...#|#...#|##..#|#.#.#|#..##|#...#|#...#',
  O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.',
  P: '####.|#...#|#...#|####.|#....|#....|#....',
  Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#',
  R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
  S: '.####|#....|#....|.###.|....#|....#|####.',
  T: '#####|..#..|..#..|..#..|..#..|..#..|..#..',
  U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.',
  V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..',
  W: '#...#|#...#|#...#|#.#.#|#.#.#|#.#.#|.#.#.',
  X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
  Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..',
  Z: '#####|....#|...#.|..#..|.#...|#....|#####',
  a: '....|....|.##.|...#|.###|#..#|.###',
  b: '#...|#...|###.|#..#|#..#|#..#|###.',
  c: '...|...|.##|#..|#..|#..|.##',
  d: '...#|...#|.###|#..#|#..#|#..#|.###',
  e: '....|....|.##.|#..#|####|#...|.##.',
  f: '..#|.#.|###|.#.|.#.|.#.|.#.',
  g: '....|....|.###|#..#|#..#|#..#|.###|...#|.##.',
  h: '#...|#...|###.|#..#|#..#|#..#|#..#',
  i: '#|.|#|#|#|#|#',
  j: '..#|...|..#|..#|..#|..#|..#|#.#|.#.',
  k: '#...|#...|#..#|#.#.|##..|#.#.|#..#',
  l: '#.|#.|#.|#.|#.|#.|.#',
  m: '.....|.....|##.#.|#.#.#|#.#.#|#.#.#|#.#.#',
  n: '....|....|###.|#..#|#..#|#..#|#..#',
  o: '....|....|.##.|#..#|#..#|#..#|.##.',
  p: '....|....|###.|#..#|#..#|#..#|###.|#...|#...',
  q: '....|....|.###|#..#|#..#|#..#|.###|...#|...#',
  r: '...|...|#.#|##.|#..|#..|#..',
  s: '....|....|.###|#...|.##.|...#|###.',
  t: '.#..|.#..|###.|.#..|.#..|.#..|..##',
  u: '....|....|#..#|#..#|#..#|#..#|.###',
  v: '.....|.....|#...#|#...#|#...#|.#.#.|..#..',
  w: '.....|.....|#...#|#...#|#.#.#|#.#.#|.#.#.',
  x: '....|....|#..#|#..#|.##.|#..#|#..#',
  y: '....|....|#..#|#..#|#..#|#..#|.###|...#|.##.',
  z: '....|....|####|...#|.##.|#...|####',
  0: '.##.|#..#|#.##|##.#|#..#|#..#|.##.',
  1: '.#.|##.|.#.|.#.|.#.|.#.|###',
  2: '.##.|#..#|...#|..#.|.#..|#...|####',
  3: '###.|...#|...#|.##.|...#|...#|###.',
  4: '#..#|#..#|#..#|####|...#|...#|...#',
  5: '####|#...|#...|###.|...#|...#|###.',
  6: '.##.|#...|#...|###.|#..#|#..#|.##.',
  7: '####|...#|...#|..#.|.#..|.#..|.#..',
  8: '.##.|#..#|#..#|.##.|#..#|#..#|.##.',
  9: '.##.|#..#|#..#|.###|...#|...#|.##.',
  '.': '.|.|.|.|.|.|#',
  ',': '..|..|..|..|..|.#|.#|#.',
  '!': '#|#|#|#|#|.|#',
  '?': '.##.|#..#|...#|..#.|.#..|....|.#..',
  ':': '.|.|#|.|.|#|.',
  ';': '..|..|.#|..|..|.#|#.',
  "'": '#|#|.',
  '"': '#.#|#.#|...',
  '-': '...|...|...|###|...|...|...',
  '+': '...|...|.#.|###|.#.|...|...',
  '=': '...|...|###|...|###|...|...',
  '/': '..#|..#|.#.|.#.|.#.|#..|#..',
  '(': '.#|#.|#.|#.|#.|#.|.#',
  ')': '#.|.#|.#|.#|.#|.#|#.',
  '[': '##|#.|#.|#.|#.|#.|##',
  ']': '##|.#|.#|.#|.#|.#|##',
  '<': '...|..#|.#.|#..|.#.|..#|...',
  '>': '...|#..|.#.|..#|.#.|#..|...',
  '%': '#...#|#..#.|...#.|..#..|.#...|.#..#|#...#',
  '*': '...|#.#|.#.|#.#|...|...|...',
  '_': '....|....|....|....|....|....|####',
  '#': '.#.#.|#####|.#.#.|.#.#.|#####|.#.#.|.....',
  '&': '.##..|#..#.|#.#..|.#...|#.#.#|#..#.|.##.#',
  '~': '.....|.....|.#..#|#.##.|.....|.....|.....',
};

export const CELL_H = 9;
export const LINE_H = 10;
const SPACE_W = 3;

const meta = {};
let atlasW = 0;
for (const ch of Object.keys(RAW)) {
  const rows = RAW[ch].split('|');
  const w = Math.max(...rows.map((r) => r.length));
  meta[ch] = { x: atlasW, w, rows };
  atlasW += w + 1;
}
const base = makeCanvas(atlasW, CELL_H);
{
  const b = base.getContext('2d');
  b.fillStyle = '#fff';
  for (const ch in meta) {
    const m = meta[ch];
    m.rows.forEach((r, y) => {
      for (let x = 0; x < r.length; x++) if (r[x] === '#') b.fillRect(m.x + x, y, 1, 1);
    });
  }
}
const tinted = new Map();
function atlasFor(color) {
  if (color === '#fff' || color === '#ffffff') return base;
  let c = tinted.get(color);
  if (!c) {
    c = makeCanvas(base.width, base.height);
    const x = c.getContext('2d');
    x.drawImage(base, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    tinted.set(color, c);
  }
  return c;
}

function glyph(ch) { return meta[ch] || meta['?']; }

export function measure(text, scale = 1) {
  let w = 0;
  for (const ch of String(text)) w += (ch === ' ' ? SPACE_W : glyph(ch).w) + 1;
  return Math.max(0, w - 1) * scale;
}

function pass(ctx, text, x, y, color, scale) {
  const atlas = atlasFor(color);
  let cx = x;
  for (const ch of text) {
    if (ch === ' ') { cx += (SPACE_W + 1) * scale; continue; }
    const m = glyph(ch);
    ctx.drawImage(atlas, m.x, 0, m.w, CELL_H, cx, y, m.w * scale, CELL_H * scale);
    cx += (m.w + 1) * scale;
  }
}

/**
 * Draw text. y is the top of the cap height.
 * opt: color, align ('left'|'center'|'right'), scale, shadow (bool), outline (color), alpha
 */
export function drawText(ctx, text, x, y, opt = {}) {
  text = String(text);
  const scale = opt.scale || 1;
  const color = opt.color || '#fff';
  const w = measure(text, scale);
  let cx = x;
  if (opt.align === 'center') cx = x - w / 2;
  else if (opt.align === 'right') cx = x - w;
  cx = Math.round(cx);
  y = Math.round(y);
  const prevA = ctx.globalAlpha;
  if (opt.alpha !== undefined) ctx.globalAlpha = prevA * opt.alpha;
  if (opt.outline) {
    const o = opt.outline;
    pass(ctx, text, cx - scale, y, o, scale);
    pass(ctx, text, cx + scale, y, o, scale);
    pass(ctx, text, cx, y - scale, o, scale);
    pass(ctx, text, cx, y + scale, o, scale);
    pass(ctx, text, cx + scale, y + scale, o, scale);
  } else if (opt.shadow !== false) {
    pass(ctx, text, cx, y + scale, opt.shadowColor || '#0a070c', scale);
  }
  pass(ctx, text, cx, y, color, scale);
  ctx.globalAlpha = prevA;
  return w;
}

/** Word-wrap into lines that fit maxW pixels. Honors '\n'. */
export function wrap(text, maxW, scale = 1) {
  const out = [];
  for (const para of String(text).split('\n')) {
    const words = para.split(' ');
    let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (measure(t, scale) <= maxW || !line) line = t;
      else { out.push(line); line = w; }
    }
    out.push(line);
  }
  return out;
}
