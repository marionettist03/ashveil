// Stage map: generation from arena layout, static pixel rendering, collision.
import { mulberry32, makeCanvas, clamp } from '../core/util.js';
import { ART } from '../data/art.js';
import { drawSprite } from '../core/sprite.js';

export const T = 16;
const FLOOR = 0, WALL = 1, OBST = 2;

export class GameMap {
  constructor(stage, theme, seed) {
    this.stage = stage;
    this.theme = theme;
    this.rng = mulberry32(seed);
    this.props = [];
    this.breakables = [];
    this.lights = [];
    this.gates = [];
    this.arenas = [];
    this.generate();
    this.render();
  }

  R() { return this.rng(); }
  ri(a, b) { return a + Math.floor(this.rng() * (b - a + 1)); }
  idx(tx, ty) { return ty * this.tw + tx; }
  get(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.tw || ty >= this.th) return WALL;
    return this.grid[ty * this.tw + tx];
  }
  set(tx, ty, v) {
    if (tx < 0 || ty < 0 || tx >= this.tw || ty >= this.th) return;
    this.grid[ty * this.tw + tx] = v;
  }

  generate() {
    const defs = this.stage.arenas;
    const organic = this.theme.wallStyle !== 'brick';
    const maxH = Math.max(...defs.map((a) => a.h + Math.abs(a.dy || 0) * 2));
    const pad = 3, gap = 7;
    this.th = maxH + pad * 2;
    let x = pad;
    for (const a of defs) {
      const y = Math.floor((this.th - a.h) / 2) + (a.dy || 0);
      this.arenas.push({ x, y, w: a.w, h: a.h, def: a, state: 'idle', wave: -1, gateIn: null, gateOut: null });
      x += a.w + gap;
    }
    this.tw = x - gap + pad;
    this.grid = new Uint8Array(this.tw * this.th).fill(WALL);

    // carve arenas
    for (const a of this.arenas) {
      for (let ty = a.y; ty < a.y + a.h; ty++) for (let tx = a.x; tx < a.x + a.w; tx++) this.set(tx, ty, FLOOR);
      if (organic) {
        for (let ty = a.y; ty < a.y + a.h; ty++) {
          for (let tx = a.x; tx < a.x + a.w; tx++) {
            const edge = tx === a.x || ty === a.y || tx === a.x + a.w - 1 || ty === a.y + a.h - 1;
            const corner = (tx - a.x < 2 || a.x + a.w - 1 - tx < 2) && (ty - a.y < 2 || a.y + a.h - 1 - ty < 2);
            if ((edge && this.R() < 0.4) || (corner && this.R() < 0.6)) this.set(tx, ty, WALL);
          }
        }
        // bumps outward
        for (let i = 0; i < a.w; i++) {
          if (this.R() < 0.2) this.set(a.x + i, a.y - 1, FLOOR);
          if (this.R() < 0.2) this.set(a.x + i, a.y + a.h, FLOOR);
        }
      }
    }

    // corridors + gates
    for (let i = 0; i < this.arenas.length - 1; i++) {
      const a = this.arenas[i], b = this.arenas[i + 1];
      const lo = Math.max(a.y + 2, b.y + 2), hi = Math.min(a.y + a.h - 3, b.y + b.h - 3);
      let cyA, cyB;
      const midX = a.x + a.w + Math.floor(gap / 2);
      if (lo <= hi) {
        cyA = cyB = Math.round((lo + hi) / 2);
        this.carve(a.x + a.w - 3, cyA - 1, b.x + 3, cyA + 1);
      } else {
        cyA = clamp(Math.round(b.y + b.h / 2), a.y + 2, a.y + a.h - 3);
        cyB = clamp(cyA, b.y + 2, b.y + b.h - 3);
        this.carve(a.x + a.w - 3, cyA - 1, midX + 1, cyA + 1);
        this.carve(midX - 1, Math.min(cyA, cyB) - 1, midX + 1, Math.max(cyA, cyB) + 1);
        this.carve(midX - 1, cyB - 1, b.x + 3, cyB + 1);
      }
      const gOut = { tiles: [[a.x + a.w, cyA - 1], [a.x + a.w, cyA], [a.x + a.w, cyA + 1]], closed: false, t: 0 };
      const gIn = { tiles: [[b.x - 1, cyB - 1], [b.x - 1, cyB], [b.x - 1, cyB + 1]], closed: false, t: 0 };
      a.gateOut = gOut; b.gateIn = gIn;
      a.exitY = cyA; b.entryY = cyB;
      this.gates.push(gOut, gIn);
    }
    const first = this.arenas[0];
    first.entryY = Math.round(first.y + first.h / 2);
    const last = this.arenas[this.arenas.length - 1];
    last.exitY = Math.round(last.y + last.h / 2);
    // make sure the spawn and exit spots are open
    this.carve(first.x + 1, first.entryY - 1, first.x + 3, first.entryY + 1);
    this.carve(last.x + last.w - 4, last.exitY - 1, last.x + last.w - 2, last.exitY + 1);
    this.start = { x: (first.x + 2) * T + T / 2, y: first.entryY * T + T / 2 };
    this.exit = { x: (last.x + last.w - 3) * T + T / 2, y: last.exitY * T + T / 2 };

    for (const a of this.arenas) this.decorateArena(a);
  }

  carve(x0, y0, x1, y1) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, FLOOR);
  }

  /** Is (tx,ty) free and far enough from the paths through the arena? */
  okForProp(a, tx, ty, margin = 1) {
    for (let y = ty - margin; y <= ty + margin; y++) for (let x = tx - margin; x <= tx + margin; x++) if (this.get(x, y) !== FLOOR) return false;
    // keep the horizontal lane from entry to exit clear
    if (a.entryY !== undefined && Math.abs(ty - a.entryY) <= 1 && tx - a.x < 5) return false;
    if (a.exitY !== undefined && Math.abs(ty - a.exitY) <= 1 && a.x + a.w - tx < 5) return false;
    for (const p of this.props) if (Math.abs(p.tx - tx) < 3 && Math.abs(p.ty - ty) < 3) return false;
    return true;
  }

  addProp(type, tx, ty, solid) {
    const p = { type, tx, ty, x: tx * T + T / 2, y: ty * T + T - 2, solid };
    this.props.push(p);
    if (solid) this.set(tx, ty, OBST);
    if (type === 'candle') this.lights.push({ x: p.x, y: p.y - 13, r: 46, col: 'fire', flicker: this.R() * 10 });
    return p;
  }

  decorateArena(a) {
    const th = this.theme;
    const boss = !!a.def.boss;
    const area = a.w * a.h;
    if (boss && th.wallStyle === 'brick') {
      // symmetric pillars around the boss floor
      for (let tx = a.x + 3; tx < a.x + a.w - 3; tx += 7) {
        for (const ty of [a.y + 2, a.y + a.h - 3]) if (this.get(tx, ty) === FLOOR) this.addProp('pillar', tx, ty, true);
      }
    } else if (!boss) {
      const n = Math.round(area / 38);
      for (let i = 0, tries = 0; i < n && tries < 200; tries++) {
        const tx = this.ri(a.x + 1, a.x + a.w - 2), ty = this.ri(a.y + 1, a.y + a.h - 2);
        if (!this.okForProp(a, tx, ty)) continue;
        let type = th.props[Math.floor(this.R() * th.props.length)];
        if (type === 'pew' && (this.get(tx - 1, ty) !== FLOOR || this.get(tx + 1, ty) !== FLOOR)) continue;
        this.addProp(type, tx, ty, type !== 'stump' || this.R() < 0.5);
        if (type === 'pew') { this.set(tx - 1, ty, OBST); this.set(tx + 1, ty, OBST); }
        i++;
      }
    } else {
      // forest boss clearing: trees around the rim only
      for (let i = 0, tries = 0; i < 10 && tries < 200; tries++) {
        const tx = this.ri(a.x + 1, a.x + a.w - 2), ty = this.ri(a.y + 1, a.y + a.h - 2);
        const rim = tx - a.x < 3 || a.x + a.w - tx < 4 || ty - a.y < 2 || a.y + a.h - ty < 3;
        if (!rim || !this.okForProp(a, tx, ty)) continue;
        this.addProp(this.R() < 0.7 ? 'tree' : 'rock', tx, ty, true);
        i++;
      }
    }
    // breakables (not solid tiles; they are entities)
    const nb = boss ? 2 : this.ri(2, 4);
    for (let i = 0, tries = 0; i < nb && tries < 100; tries++) {
      const tx = this.ri(a.x + 1, a.x + a.w - 2), ty = this.ri(a.y + 1, a.y + a.h - 2);
      if (!this.okForProp(a, tx, ty, 0)) continue;
      const type = th.breakables[Math.floor(this.R() * th.breakables.length)];
      this.breakables.push({ type, x: tx * T + T / 2, y: ty * T + T - 3, r: 5, hp: 1, tx, ty });
      i++;
    }
    // lights
    const nl = boss ? 8 : this.ri(3, 5);
    for (let i = 0, tries = 0; i < nl && tries < 200; tries++) {
      const tx = this.ri(a.x, a.x + a.w - 1), ty = this.ri(a.y, a.y + a.h - 1);
      if (th.lights === 'candle') {
        if (this.get(tx, ty) !== FLOOR || this.get(tx, ty - 1) !== WALL) continue;
        if (!this.okForProp(a, tx, ty, 0)) continue;
        this.addProp('candle', tx, ty, false);
      } else if (th.lights === 'torch') {
        // torch mounted on a wall face
        if (this.get(tx, ty) !== WALL || this.get(tx, ty + 1) !== FLOOR) continue;
        if (this.lights.some((l) => Math.abs(l.x - (tx * T + 8)) < 48 && Math.abs(l.y - ty * T) < 48)) continue;
        this.props.push({ type: 'torch', tx, ty, x: tx * T + T / 2, y: ty * T + T, solid: false, wall: true });
        this.lights.push({ x: tx * T + T / 2, y: ty * T + 6, r: 58, col: 'fire', flicker: this.R() * 10 });
      } else {
        // ember patches on the ground
        if (this.get(tx, ty) !== FLOOR) continue;
        this.lights.push({ x: tx * T + this.ri(2, 14), y: ty * T + this.ri(2, 14), r: 30, col: 'ember', flicker: this.R() * 10, ground: true });
      }
      i++;
    }
  }

  // ------------------------------------------------------------ rendering
  render() {
    const th = this.theme;
    const W = this.tw * T, H = this.th * T;
    const c = makeCanvas(W, H);
    const g = c.getContext('2d');
    const R = () => this.R();
    const ri = (a, b) => this.ri(a, b);

    // floors
    for (let ty = 0; ty < this.th; ty++) {
      for (let tx = 0; tx < this.tw; tx++) {
        if (this.get(tx, ty) === WALL) continue;
        const x = tx * T, y = ty * T;
        if (th.tiles) {
          let col = th.floor[(tx * 7 + ty * 13 + ((tx * ty) % 5)) % th.floor.length];
          g.fillStyle = col; g.fillRect(x, y, T, T);
          if (th.checker && (tx + ty) % 2) { g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(x, y, T, T); }
          g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x, y, T, 1); g.fillRect(x, y, 1, T);
          g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(x + 1, y + 1, T - 2, 1);
          if (R() < 0.15) { // crack
            g.fillStyle = 'rgba(0,0,0,0.35)';
            let cx = x + ri(3, 12), cy = y + ri(3, 12);
            for (let k = 0; k < 5; k++) { g.fillRect(cx, cy, 1, 1); cx += ri(-1, 1); cy += 1; }
          }
        } else {
          g.fillStyle = th.floor[0]; g.fillRect(x, y, T, T);
        }
      }
    }
    if (!th.tiles) {
      // organic blobs
      const n = this.tw * this.th * 4;
      for (let i = 0; i < n; i++) {
        const x = ri(0, W - 1), y = ri(0, H - 1);
        if (this.get(Math.floor(x / T), Math.floor(y / T)) === WALL) continue;
        g.fillStyle = th.floor[1 + Math.floor(R() * (th.floor.length - 1))];
        g.fillRect(x, y, ri(2, 6), ri(1, 3));
      }
    }
    // specks & tufts & decals
    for (let ty = 0; ty < this.th; ty++) {
      for (let tx = 0; tx < this.tw; tx++) {
        if (this.get(tx, ty) === WALL) continue;
        const x = tx * T, y = ty * T;
        for (let k = 0; k < 4; k++) { g.fillStyle = th.speck[k % th.speck.length]; g.fillRect(x + ri(0, 15), y + ri(0, 15), 1, 1); }
        if (th.tuft && R() < 0.22) {
          const px = x + ri(2, 13), py = y + ri(4, 13);
          g.fillStyle = th.tuft;
          g.fillRect(px, py, 1, 2); g.fillRect(px + 2, py - 1, 1, 3); g.fillRect(px + 4, py + 1, 1, 1);
        }
        if (R() < 0.03) { // bones
          g.fillStyle = '#b8b0a4';
          const px = x + ri(2, 10), py = y + ri(4, 12);
          g.fillRect(px, py, 5, 1); g.fillRect(px - 1, py - 1, 1, 3); g.fillRect(px + 5, py - 1, 1, 3);
        }
        if (R() < 0.04) { // ash drift
          g.fillStyle = 'rgba(200,195,190,0.12)';
          g.fillRect(x + ri(0, 6), y + ri(0, 10), ri(5, 10), ri(2, 4));
        }
      }
    }
    // nave carpet runner through each arena
    if (th.carpet) {
      for (const a of this.arenas) {
        const cy = a.exitY ?? a.entryY;
        const y0 = (cy - 1) * T + 4, y1 = (cy + 2) * T - 4;
        g.fillStyle = th.carpet; g.fillRect(a.x * T, y0, a.w * T, y1 - y0);
        g.fillStyle = '#6a2a2e'; g.fillRect(a.x * T, y0, a.w * T, 1); g.fillRect(a.x * T, y1 - 1, a.w * T, 1);
        g.fillStyle = '#c9a045';
        for (let x = a.x * T + 4; x < (a.x + a.w) * T; x += 8) { g.fillRect(x, y0 + 2, 1, 1); g.fillRect(x, y1 - 3, 1, 1); }
      }
    }

    // walls
    for (let ty = 0; ty < this.th; ty++) {
      for (let tx = 0; tx < this.tw; tx++) {
        if (this.get(tx, ty) !== WALL) continue;
        const x = tx * T, y = ty * T;
        const below = this.get(tx, ty + 1) !== WALL;
        if (below) this.drawFace(g, x, y, tx, ty);
        else this.drawTop(g, x, y, tx, ty);
      }
    }
    // soft shadow under faces & edges
    for (let ty = 0; ty < this.th; ty++) {
      for (let tx = 0; tx < this.tw; tx++) {
        if (this.get(tx, ty) === WALL) continue;
        const x = tx * T, y = ty * T;
        if (this.get(tx, ty - 1) === WALL) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, y, T, 3); g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(x, y + 3, T, 2); }
        if (this.get(tx - 1, ty) === WALL) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, y, 2, T); }
        if (this.get(tx + 1, ty) === WALL) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + T - 2, y, 2, T); }
      }
    }
    // static ground props that never overlap entities (fences, coffins are drawn sorted later)
    this.canvas = c;
  }

  drawTop(g, x, y, tx, ty) {
    const th = this.theme;
    g.fillStyle = th.wallTop; g.fillRect(x, y, T, T);
    if (th.wallStyle === 'forest') {
      // canopy blobs
      const cols = ['#121012', '#171315', '#0f0d0f', '#1c1719'];
      for (let k = 0; k < 4; k++) {
        g.fillStyle = cols[this.ri(0, 3)];
        const r = this.ri(3, 6), cx = x + this.ri(0, 15), cy = y + this.ri(0, 15);
        g.fillRect(cx - r, cy - r + 1, r * 2, r * 2 - 2);
        g.fillRect(cx - r + 1, cy - r, r * 2 - 2, r * 2);
      }
      if (this.R() < 0.2) { g.fillStyle = '#5a2a1a'; g.fillRect(x + this.ri(2, 13), y + this.ri(2, 13), 1, 1); }
    } else {
      for (let k = 0; k < 3; k++) { g.fillStyle = 'rgba(255,255,255,0.03)'; g.fillRect(x + this.ri(0, 13), y + this.ri(0, 13), 3, 1); }
    }
    // rim where top meets floor on the sides/top
    g.fillStyle = 'rgba(255,255,255,0.06)';
    if (this.get(tx - 1, ty) !== WALL) g.fillRect(x, y, 1, T);
    if (this.get(tx + 1, ty) !== WALL) g.fillRect(x + T - 1, y, 1, T);
    if (this.get(tx, ty - 1) !== WALL) g.fillRect(x, y, T, 1);
  }

  drawFace(g, x, y, tx, ty) {
    const th = this.theme;
    const [c1, c2] = th.wallFace;
    if (th.wallStyle === 'brick') {
      g.fillStyle = c1; g.fillRect(x, y, T, T);
      g.fillStyle = c2;
      for (let row = 0; row < 4; row++) {
        const yy = y + row * 4;
        g.fillRect(x, yy + 3, T, 1);
        const off = (row + tx) % 2 ? 0 : 4;
        for (let bx = off; bx < T; bx += 8) g.fillRect(x + bx, yy, 1, 3);
      }
      g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(x, y, T, 1);
      if (this.R() < 0.12) { g.fillStyle = '#2f4a2a'; g.fillRect(x + this.ri(1, 12), y + 12, this.ri(2, 4), 4); }
    } else if (th.wallStyle === 'palisade') {
      g.fillStyle = th.wallTop; g.fillRect(x, y, T, T);
      for (let px = 0; px < T; px += 4) {
        const h = this.ri(0, 2);
        g.fillStyle = px % 8 ? c1 : c2;
        g.fillRect(x + px, y + 2 + h, 3, T - 2 - h);
        g.fillRect(x + px + 1, y + 1 + h, 1, 1);
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + px + 2, y + 3 + h, 1, T - 3 - h);
      }
      g.fillStyle = '#2a201a'; g.fillRect(x, y + 7, T, 2);
    } else {
      // forest edge: trunks and undergrowth
      g.fillStyle = th.wallTop; g.fillRect(x, y, T, T);
      for (let k = 0; k < 3; k++) {
        const px = x + this.ri(0, 13);
        g.fillStyle = k % 2 ? c1 : c2; g.fillRect(px, y, 3, T);
        g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(px, y, 1, T);
      }
      g.fillStyle = '#1c1a1a';
      for (let k = 0; k < 6; k++) g.fillRect(x + this.ri(0, 14), y + 10 + this.ri(0, 4), 2, 3);
      if (this.R() < 0.3) { g.fillStyle = '#4a5236'; g.fillRect(x + this.ri(0, 12), y + 13, 3, 3); }
    }
  }

  // ------------------------------------------------------------ queries
  solidTile(tx, ty) {
    const v = this.get(tx, ty);
    if (v !== FLOOR) return true;
    for (const gt of this.gates) {
      if (!gt.closed) continue;
      for (const [gx, gy] of gt.tiles) if (gx === tx && gy === ty) return true;
    }
    return false;
  }
  solidAt(px, py) { return this.solidTile(Math.floor(px / T), Math.floor(py / T)); }

  /** Push a circle out of solid tiles. */
  collide(e) {
    const r = e.r;
    for (let pass = 0; pass < 2; pass++) {
      const tx0 = Math.floor((e.x - r) / T), tx1 = Math.floor((e.x + r) / T);
      const ty0 = Math.floor((e.y - r) / T), ty1 = Math.floor((e.y + r) / T);
      for (let ty = ty0; ty <= ty1; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          if (!this.solidTile(tx, ty)) continue;
          const nx = clamp(e.x, tx * T, tx * T + T), ny = clamp(e.y, ty * T, ty * T + T);
          let dx = e.x - nx, dy = e.y - ny;
          const d2 = dx * dx + dy * dy;
          if (d2 >= r * r) continue;
          if (d2 === 0) {
            // centre inside tile: push out along the shortest axis
            const l = e.x - tx * T, rr = tx * T + T - e.x, u = e.y - ty * T, dd = ty * T + T - e.y;
            const m = Math.min(l, rr, u, dd);
            if (m === l) e.x = tx * T - r; else if (m === rr) e.x = tx * T + T + r; else if (m === u) e.y = ty * T - r; else e.y = ty * T + T + r;
            e.hitWall = true;
            continue;
          }
          const d = Math.sqrt(d2);
          e.x = nx + (dx / d) * r;
          e.y = ny + (dy / d) * r;
          e.hitWall = true;
        }
      }
    }
  }

  /** Line of sight check using tile stepping. */
  los(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.ceil(d / 6);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const tx = Math.floor((x0 + (x1 - x0) * t) / T), ty = Math.floor((y0 + (y1 - y0) * t) / T);
      if (this.get(tx, ty) === WALL) return false;
    }
    return true;
  }

  /** Random open spot in an arena, at least minD px from (fx,fy). */
  randomSpot(a, fx, fy, minD = 60) {
    for (let i = 0; i < 80; i++) {
      const tx = this.ri(a.x + 1, a.x + a.w - 2), ty = this.ri(a.y + 1, a.y + a.h - 2);
      if (this.solidTile(tx, ty) || this.solidTile(tx + 1, ty) || this.solidTile(tx - 1, ty) || this.solidTile(tx, ty + 1) || this.solidTile(tx, ty - 1)) continue;
      const x = tx * T + T / 2, y = ty * T + T / 2;
      if (Math.hypot(x - fx, y - fy) < minD && i < 60) continue;
      return { x, y };
    }
    return { x: (a.x + a.w / 2) * T, y: (a.y + a.h / 2) * T };
  }

  arenaRectPx(a) { return { x: a.x * T, y: a.y * T, w: a.w * T, h: a.h * T }; }

  // ------------------------------------------------------------ dynamic drawing
  drawGates(ctx, t) {
    for (const gt of this.gates) {
      if (gt.t <= 0.01) continue;
      const k = gt.t;
      for (const [tx, ty] of gt.tiles) {
        const x = tx * T, y = ty * T;
        ctx.globalAlpha = k;
        ctx.fillStyle = '#1a1416';
        ctx.fillRect(x + 2, y - 6, T - 4, T + 6);
        for (let i = 0; i < 4; i++) {
          const px = x + 3 + i * 3;
          const fl = Math.sin(t * 6 + i * 1.7 + ty) * 0.5 + 0.5;
          ctx.fillStyle = fl > 0.5 ? '#ff8a2a' : '#b0401a';
          ctx.fillRect(px, y - 6 + ((t * 20 + i * 5) % 20), 1, 3);
          ctx.fillStyle = '#3a2a2a';
          ctx.fillRect(px + 1, y - 6, 1, T + 6);
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  drawProp(ctx, p, t) {
    if (p.type === 'torch') {
      ctx.fillStyle = '#3a2a1a'; ctx.fillRect(p.x - 1, p.y - 10, 2, 6);
      this.flame(ctx, p.x, p.y - 11, t, 1);
      return;
    }
    const spr = ART.props[p.type];
    if (!spr) return;
    drawSprite(ctx, spr, p.x, p.y + (p.type === 'pew' ? 2 : 0));
    if (p.type === 'candle') this.flame(ctx, p.x, p.y - 13, t, 0.8);
  }

  flame(ctx, x, y, t, s = 1) {
    const f = Math.floor(t * 10 + x) % 3;
    ctx.fillStyle = '#ffb347'; ctx.fillRect(Math.round(x - 1), Math.round(y - 2 - f % 2), 2, 3);
    ctx.fillStyle = '#ffe08a'; ctx.fillRect(Math.round(x - 1 + (f === 2 ? 1 : 0)), Math.round(y - 1), 1, 2);
    if (s >= 1) { ctx.fillStyle = '#ff7a2a'; ctx.fillRect(Math.round(x - 2), Math.round(y), 1, 1); ctx.fillRect(Math.round(x + 1), Math.round(y - 1), 1, 1); }
  }
}
