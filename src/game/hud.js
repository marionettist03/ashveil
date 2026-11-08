// In-stage HUD and on-screen touch controls (all drawn as crisp pixel art).
import { G } from '../core/G.js';
import { TAU, makeCanvas } from '../core/util.js';
import { drawText, measure } from '../core/font.js';
import { bar, COL, panel } from '../core/ui.js';
import { drawSprite } from '../core/sprite.js';
import { ART } from '../data/art.js';
import { skillPower, xpToNext } from '../data/heroes.js';
import { touchUI, binds, keyName } from '../core/keys.js';

export function layout() {
  const W = G.W, H = G.H, R = W - G.safeR, L = G.safeL;
  return {
    attack: { x: R - 40, y: H - 40, r: 24 },
    s0: { x: R - 94, y: H - 26, r: 15 },
    s1: { x: R - 82, y: H - 74, r: 15 },
    s2: { x: R - 40, y: H - 96, r: 15 },
    ult: { x: R - 128, y: H - 64, r: 16 },
    dodge: { x: R - 138, y: H - 24, r: 13 },
    potion: { x: L + 16, y: 52, r: 11 },
    pause: { x: R - 14, y: 14, r: 11 },
    interact: { x: R - 40, y: H - 134, r: 15 },
    joyHome: { x: L + 52, y: H - 50 },
    joyR: 24,
  };
}

/** Which control a new touch at (x,y) belongs to. */
export function claimControl(p, S) {
  const Lo = layout();
  const hit = (b, pad = 7) => Math.hypot(p.x - b.x, p.y - b.y) <= b.r + pad;
  const keys = ['attack', 's0', 's1', 's2', 'ult', 'dodge', 'potion', 'pause'];
  if (S && S.interactable) keys.unshift('interact');
  for (const k of keys) if (hit(Lo[k], k === 'attack' ? 10 : 6)) return k;
  // mouse on a computer: left button held = attack, right click = dodge
  if (p.type === 'mouse' && !touchUI()) return p.button === 2 ? 'dodge' : p.y > 34 ? 'attack' : null;
  if (p.x < G.W * 0.48 && p.y > 34) return 'joy';
  return null;
}

// ------------------------------------------------------------------ pixel discs
function rgba(c) {
  if (c.startsWith('#')) {
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  const p = m[1].split(',').map((v) => parseFloat(v));
  return [p[0], p[1], p[2], Math.round((p[3] ?? 1) * 255)];
}

const discCache = new Map();
/** A filled pixel circle with a 1px outline, a bevel highlight (top-left) and shade (bottom-right). */
function disc(r, fill, edge, hi, lo) {
  const key = [r, fill, edge, hi, lo].join('|');
  let c = discCache.get(key);
  if (c) return c;
  const size = r * 2 + 1;
  c = makeCanvas(size, size);
  const x = c.getContext('2d');
  const img = x.createImageData(size, size);
  const inside = (dx, dy) => dx * dx + dy * dy <= (r + 0.35) * (r + 0.35);
  const F = rgba(fill), E = rgba(edge), Hc = hi ? rgba(hi) : null, Lc = lo ? rgba(lo) : null;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const dx = px - r, dy = py - r;
      if (!inside(dx, dy)) continue;
      const isEdge = !inside(dx + 1, dy) || !inside(dx - 1, dy) || !inside(dx, dy + 1) || !inside(dx, dy - 1);
      let col = F;
      if (isEdge) col = E;
      else if (Hc && (!inside(dx - 2, dy) || !inside(dx, dy - 2)) && dx + dy < 0) col = Hc;
      else if (Lc && (!inside(dx + 2, dy) || !inside(dx, dy + 2)) && dx + dy > 0) col = Lc;
      const i = (py * size + px) * 4;
      img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = col[3];
    }
  }
  x.putImageData(img, 0, 0);
  discCache.set(key, c);
  return c;
}
function blitDisc(ctx, cx, cy, r, fill, edge, hi, lo) {
  ctx.drawImage(disc(r, fill, edge, hi, lo), Math.round(cx) - r, Math.round(cy) - r);
}
/** Fill a fraction of a pixel circle: from the top (cooldown) or from the bottom (charge). */
function discRows(ctx, cx, cy, r, frac, col, fromBottom) {
  if (frac <= 0) return;
  cx = Math.round(cx); cy = Math.round(cy);
  const rows = Math.round((r * 2 - 1) * Math.min(1, frac));
  ctx.fillStyle = col;
  for (let k = 0; k < rows; k++) {
    const y = fromBottom ? r - 1 - k : -r + 1 + k;
    const w = Math.floor(Math.sqrt(Math.max(0, (r - 1) * (r - 1) - y * y)));
    ctx.fillRect(cx - w, cy + y, w * 2 + 1, 1);
  }
}

// ------------------------------------------------------------------ skill glyphs
function glyph(ctx, id, x, y, col) {
  x = Math.round(x); y = Math.round(y);
  const px = (dx, dy, w = 1, h = 1, c = col) => { ctx.fillStyle = c; ctx.fillRect(x + dx, y + dy, w, h); };
  switch (id) {
    case 'feather': px(-6, 0, 9, 1); px(1, -3, 1, 1); px(2, -2, 1, 1); px(3, -1, 1, 3); px(2, 2, 1, 1); px(1, 3, 1, 1); px(-6, -3, 3, 1, '#ffffff'); px(-6, 3, 3, 1, '#ffffff'); break;
    case 'talon': for (let i = 0; i < 9; i++) { px(-5 + i, -5 + i); px(-4 + i, -5 + i, 1, 1, '#ffffff'); } px(3, 3, 3, 3, '#ffd24a'); px(-6, 2, 3, 1); px(-6, 4, 2, 1); break;
    case 'whirl': for (let a = 0; a < 5.5; a += 0.3) px(Math.round(Math.cos(a) * (2 + a)), Math.round(Math.sin(a) * (2 + a))); break;
    case 'hundred': for (let i = 0; i < 12; i++) { px(-6 + i, -6 + i); px(6 - i, -6 + i, 1, 1, '#ffffff'); } break;
    case 'oathbreaker': px(-1, -7, 3, 7); px(-3, -7, 7, 3); px(-6, 3, 13, 1); px(-4, 1, 1, 2); px(4, 1, 1, 2); break;
    case 'bulwark': px(-4, -6, 9, 2); px(-5, -4, 11, 5); px(-4, 1, 9, 2); px(-2, 3, 5, 2); px(0, 5, 1, 1); px(0, -4, 1, 6, '#140f17'); px(-2, -2, 5, 1, '#140f17'); break;
    case 'chain': for (let i = 0; i < 5; i++) px(-6 + i * 3, -1 + (i % 2), 2, 2); px(7, -3, 1, 6); break;
    case 'fall': for (const r of [3, 6]) for (let a = 0; a < TAU; a += 0.4) px(Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r * 0.8)); px(0, 0); break;
    case 'nova': for (let a = 0; a < TAU; a += TAU / 8) for (let r = 2; r < 7; r++) px(Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r)); break;
    case 'pyre': for (let i = 0; i < 5; i++) { px(-6 + i * 3, 2 - (i % 2) * 2, 2, 4); px(-6 + i * 3, 0 - (i % 2) * 2, 1, 2, '#ffe08a'); } break;
    case 'orbs': for (let i = 0; i < 3; i++) { const a = (i * TAU) / 3 - Math.PI / 2; px(Math.round(Math.cos(a) * 5) - 1, Math.round(Math.sin(a) * 5) - 1, 3, 3); } break;
    case 'star': px(-1, -1, 4, 4); px(-1, -1, 2, 2, '#ffffff'); for (let i = 1; i < 6; i++) px(2 + i, -2 - i, 2, 1); break;
    case 'tumble': for (let a = 0.5; a < 5.5; a += 0.35) px(Math.round(Math.cos(a) * 5), Math.round(Math.sin(a) * 5)); px(4, -1, 3, 1, '#ffffff'); break;
    case 'snare': px(-5, -5); px(-4, -4); px(-3, -3); px(3, -3); px(4, -4); px(5, -5); px(-5, 3, 11, 1); px(-3, -2, 1, 5); px(0, -4, 1, 7); px(3, -2, 1, 5); break;
    case 'rain': for (let i = 0; i < 4; i++) { px(-6 + i * 4, -6 + (i % 2) * 3, 1, 5); px(-7 + i * 4, -2 + (i % 2) * 3, 3, 1); } break;
    case 'gale': px(-7, 0, 14, 1); px(4, -2, 1, 5); px(5, -1, 1, 3); px(-7, -3, 4, 1, '#ffffff'); px(-7, 3, 4, 1, '#ffffff'); break;
    case 'dodge': px(-5, -1, 8, 2); px(1, -4, 2, 2); px(3, -2, 2, 2); px(1, 2, 2, 2); px(3, 1, 1, 1); break;
    case 'talk': px(-5, -4, 10, 6); px(-3, 2, 2, 2); px(-3, -2, 1, 1, '#140f17'); px(0, -2, 1, 1, '#140f17'); px(3, -2, 1, 1, '#140f17'); break;
    default: px(-2, -2, 5, 5);
  }
}

// ------------------------------------------------------------------ controls
const BTN = { fill: 'rgba(28,20,30,0.82)', fillHeld: 'rgba(70,50,40,0.92)', hi: 'rgba(255,255,255,0.14)', lo: 'rgba(0,0,0,0.35)' };

/** Draw one round button; grows and brightens while pressed. Returns the centre & radius used. */
function roundButton(ctx, S, key, b, edge, opt = {}) {
  const held = S.held[key];
  const anim = (S.pressAnim && S.pressAnim[key]) || 0;
  const grow = held ? 3 : Math.round(3 * Math.min(1, anim / 0.15));
  const r = b.r + grow;
  blitDisc(ctx, b.x, b.y, r, opt.fill || (held ? BTN.fillHeld : BTN.fill), held ? '#ffe0a0' : edge, BTN.hi, BTN.lo);
  return r;
}

export function drawControls(S, ctx) {
  const Lo = layout();
  const p = S.player, hero = p.hero, hs = S.hs;
  const touch = touchUI();
  const B = touch ? null : binds();
  // keyboard mode: a small key name under each button instead of the joystick
  const tag = (b, action, r) => {
    if (touch) return;
    const k = B[action].find(Boolean);
    if (!k) return;
    const t = keyName(k);
    const w = measure(t) + 4, x = Math.round(b.x - w / 2), y = Math.round(b.y + r - 4);
    ctx.fillStyle = '#140f17'; ctx.fillRect(x, y, w, 9);
    ctx.fillStyle = '#5a4a3c'; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + 8, w, 1); ctx.fillRect(x, y, 1, 9); ctx.fillRect(x + w - 1, y, 1, 9);
    drawText(ctx, t, b.x, y + 1, { align: 'center', color: '#e8dcc0' });
  };
  if (touch) drawJoystick(S, ctx, Lo);
  else if (S.time > 2.8 && S.time < 14 && !S.dialogue) { // after the zone-name banner fades
    const m = ['up', 'left', 'down', 'right'].map((a) => keyName(B[a][0])).join('');
    drawText(ctx, `${m.length === 4 ? m : 'Arrows'}: move   Hold mouse: attack   Right-click: roll`, G.W / 2, 36, { align: 'center', color: COL.faint, outline: '#000', alpha: Math.min(1, (14 - S.time) / 2, (S.time - 2.8) * 2) });
  }

  // attack
  const A = Lo.attack;
  const ar = roundButton(ctx, S, 'attack', A, '#b8874a');
  const icon = ART.icons[hero.weapon];
  if (icon) drawSprite(ctx, icon, A.x, A.y + 6 + (S.held.attack ? 1 : 0), { scale: S.held.attack ? 2 : 2 });
  tag(A, 'attack', ar);

  // skills
  for (let i = 0; i < 3; i++) {
    const key = 's' + i, b = Lo[key];
    const sk = hero.skills[i];
    const unlocked = p.skillUnlocked(i);
    const cdMax = skillPower(sk, hs.ranks[i] || 1).cd * p.stats.cdrMult;
    const r = roundButton(ctx, S, key, b, unlocked ? hero.color : '#3a3240', unlocked ? {} : { fill: 'rgba(15,12,18,0.7)' });
    if (unlocked) {
      glyph(ctx, sk.id, b.x, b.y, p.skillCd[i] > 0 ? '#6a6070' : hero.color);
      discRows(ctx, b.x, b.y, r, p.skillCd[i] / cdMax, 'rgba(8,6,10,0.68)', false);
      if (p.skillCd[i] > 0) drawText(ctx, Math.ceil(p.skillCd[i]), b.x, b.y - 3, { align: 'center', color: '#ece4d8', outline: '#000' });
      tag(b, key, r);
    } else {
      drawSprite(ctx, ART.icons.lock, b.x, b.y + 4);
      drawText(ctx, 'Lv' + sk.unlock, b.x, b.y + b.r - 3, { align: 'center', color: COL.dim, outline: '#000' });
    }
  }
  // ultimate
  const U = Lo.ult;
  const full = p.ember >= 100;
  const pulse = full ? Math.floor(G.time * 6) % 2 : 0;
  const ur = roundButton(ctx, S, 'ult', U, full ? (pulse ? '#ffe08a' : '#ffb347') : '#6b4e2c', full ? { fill: pulse ? 'rgba(150,70,24,0.92)' : 'rgba(120,55,20,0.92)' } : {});
  if (!full) discRows(ctx, U.x, U.y, ur, p.ember / 100, 'rgba(255,138,42,0.4)', true);
  glyph(ctx, hero.ult.id, U.x, U.y, full ? '#ffe08a' : '#7a6a5a');
  if (full && touch) drawText(ctx, 'ULT', U.x, U.y + ur - 2, { align: 'center', color: '#ffe08a', outline: '#000' });
  tag(U, 'ult', ur);

  // dodge
  const D = Lo.dodge;
  const dr = roundButton(ctx, S, 'dodge', D, '#8a7a6a');
  glyph(ctx, 'dodge', D.x, D.y, p.dashCd > 0 ? '#5a5060' : '#d6d0cc');
  discRows(ctx, D.x, D.y, dr, p.dashCd / hero.dodgeCd, 'rgba(8,6,10,0.68)', false);
  tag(D, 'dodge', dr);

  // potion
  const P = Lo.potion;
  const pr = roundButton(ctx, S, 'potion', P, hs.potions > 0 ? '#d8343a' : '#3a3240');
  drawSprite(ctx, ART.icons.potion, P.x, P.y + 6, { alpha: hs.potions > 0 ? 1 : 0.4 });
  discRows(ctx, P.x, P.y, pr, p.potionCd / p.potionCdMax, 'rgba(8,6,10,0.68)', false);
  drawText(ctx, hs.potions, P.x + 9, P.y + 3, { color: '#ece4d8', outline: '#000' });
  tag(P, 'potion', pr);

  // pause
  const Pa = Lo.pause;
  roundButton(ctx, S, 'pause', Pa, '#6b5a4a');
  drawSprite(ctx, ART.icons.pause, Pa.x, Pa.y + 6);

  // context action (talk / read / travel)
  if (S.interactable) {
    const I = Lo.interact;
    const ir = roundButton(ctx, S, 'interact', I, '#ffd24a', { fill: 'rgba(60,44,20,0.9)' });
    glyph(ctx, 'talk', I.x, I.y, '#ffe0a0');
    drawText(ctx, S.interactable.label, I.x, I.y - ir - 11, { align: 'center', color: '#ffe0a0', outline: '#000' });
  }
}

function drawJoystick(S, ctx, Lo) {
  // joystick: base stays where it is (fixed) or where you first touched (floating)
  const j = S.joy;
  const jx = j.active ? j.bx : Lo.joyHome.x, jy = j.active ? j.by : Lo.joyHome.y;
  ctx.globalAlpha = j.active ? 0.85 : 0.5;
  blitDisc(ctx, jx, jy, Lo.joyR + 6, 'rgba(18,13,22,0.45)', '#8a7a6a', 'rgba(255,255,255,0.08)', 'rgba(0,0,0,0.3)');
  // direction ticks
  ctx.fillStyle = 'rgba(201,184,168,0.5)';
  ctx.fillRect(Math.round(jx) - 1, Math.round(jy - Lo.joyR - 2), 3, 2);
  ctx.fillRect(Math.round(jx) - 1, Math.round(jy + Lo.joyR + 1), 3, 2);
  ctx.fillRect(Math.round(jx - Lo.joyR - 2), Math.round(jy) - 1, 2, 3);
  ctx.fillRect(Math.round(jx + Lo.joyR + 1), Math.round(jy) - 1, 2, 3);
  ctx.globalAlpha = j.active ? 1 : 0.6;
  blitDisc(ctx, jx + (j.active ? j.kx : 0), jy + (j.active ? j.ky : 0), j.active ? 11 : 10, j.active ? '#4a3c48' : '#3a3040', '#c9b8a8', 'rgba(255,255,255,0.22)', 'rgba(0,0,0,0.35)');
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ HUD
export function drawHud(S, ctx) {
  const p = S.player, hs = S.hs, L = G.safeL + 4, R = G.W - G.safeR;
  // portrait
  panel(ctx, L, 4, 26, 26, { fill: '#1c1621', edge: p.hero.color });
  ctx.save(); ctx.beginPath(); ctx.rect(L + 1, 5, 24, 24); ctx.clip();
  drawSprite(ctx, p.art.idle[0], L + 13, 38, { scale: 1 });
  ctx.restore();
  drawText(ctx, hs.level, L + 23, 23, { align: 'right', color: '#ffd24a', outline: '#000' });
  // bars (HP numbers sit inside the bar so nothing can overlap them)
  const bx = L + 30;
  bar(ctx, bx, 5, 104, 9, p.hp / p.stats.maxHp, COL.hp, COL.hpD);
  drawText(ctx, `${Math.max(0, Math.ceil(p.hp))}/${p.stats.maxHp}`, bx + 52, 6, { align: 'center', color: '#fff3e8', outline: '#2a0a0c' });
  bar(ctx, bx, 17, 104, 3, p.ember / 100, p.ember >= 100 ? '#ffd166' : COL.ember, '#2a1a10');
  bar(ctx, bx, 23, 104, 1, hs.xp / xpToNext(hs.level), COL.xp, '#14202a');
  // gold
  drawSprite(ctx, ART.icons.coin, R - 46, 20);
  drawText(ctx, hs.gold, R - 38, 10, { color: COL.gold, outline: '#000' });
  // stage + area: bottom centre, between the joystick and the skill buttons
  const st = S.stage;
  const n = S.map.arenas.length;
  const done = S.map.arenas.filter((a) => a.state === 'clear').length;
  const area = n > 1 ? `Area ${Math.min(n, done + 1)}/${n}` : '';
  const left = G.safeL + 86, right = R - 156;
  let label = `${st.id} ${st.name}${S.nm ? ' (Nightmare)' : ''}${area ? '  -  ' + area : ''}`;
  if (measure(label) > right - left) label = `${st.id}${area ? '  ' + area : ''}`;
  if (S.state === 'play' && !S.dialogue) drawText(ctx, label, (left + right) / 2, G.H - 12, { align: 'center', color: S.nm ? '#e0453a' : COL.dim, outline: '#000' });
  // boss bar, kept clear of the HP bar on narrow screens
  const b = S.bossEnemy;
  if (b && !b.dead) {
    const x0 = L + 142, x1 = R - 58;
    const w = Math.min(220, x1 - x0);
    const x = Math.round(Math.max(x0, Math.min(x1 - w, G.W / 2 - w / 2)));
    drawText(ctx, b.def.name, x + w / 2, 3, { align: 'center', color: '#ffb347', outline: '#000' });
    bar(ctx, x, 14, w, 5, b.hp / b.maxHp, b.phase === 2 ? '#ff5a2a' : '#d8343a', '#2a0a0c');
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x + Math.round(w / 2), 14, 1, 5);
  }
}
