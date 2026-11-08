// In-stage HUD and on-screen touch controls.
import { G } from '../core/G.js';
import { TAU } from '../core/util.js';
import { drawText } from '../core/font.js';
import { bar, COL, panel } from '../core/ui.js';
import { drawSprite } from '../core/sprite.js';
import { ART } from '../data/art.js';
import { skillPower, xpToNext } from '../data/heroes.js';

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
    joyHome: { x: L + 48, y: H - 46 },
    joyR: 22,
  };
}

/** Which control a new touch at (x,y) belongs to. */
export function claimControl(p) {
  const Lo = layout();
  const hit = (b, pad = 7) => Math.hypot(p.x - b.x, p.y - b.y) <= b.r + pad;
  for (const k of ['attack', 's0', 's1', 's2', 'ult', 'dodge', 'potion', 'pause']) if (hit(Lo[k], k === 'attack' ? 10 : 6)) return k;
  if (p.x < G.W * 0.48 && p.y > 34) return 'joy';
  return null;
}

// ------------------------------------------------------------------ skill glyphs
function glyph(ctx, id, x, y, col) {
  x = Math.round(x); y = Math.round(y);
  const px = (dx, dy, w = 1, h = 1, c = col) => { ctx.fillStyle = c; ctx.fillRect(x + dx, y + dy, w, h); };
  switch (id) {
    case 'feather': px(-6, 0, 9, 1); px(1, -3, 1, 1); px(2, -2, 1, 1); px(3, -1, 1, 3); px(2, 2, 1, 1); px(1, 3, 1, 1); px(-6, -3, 3, 1, '#ffffff'); px(-6, 3, 3, 1, '#ffffff'); break;
    case 'fan': for (let i = -2; i <= 2; i++) { const a = -Math.PI / 2 + i * 0.35; for (let r = 2; r < 8; r++) px(Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r) + 3); } break;
    case 'talon': for (let i = 0; i < 9; i++) { px(-5 + i, -5 + i); px(-4 + i, -5 + i, 1, 1, '#ffffff'); } px(3, 3, 3, 3, '#ffd24a'); px(-6, 2, 3, 1); px(-6, 4, 2, 1); break;
    case 'whirl': for (let a = 0; a < 5.5; a += 0.3) px(Math.round(Math.cos(a) * (2 + a)), Math.round(Math.sin(a) * (2 + a))); break;
    case 'hundred': px(-6, -6, 1, 1); for (let i = 0; i < 12; i++) { px(-6 + i, -6 + i); px(6 - i, -6 + i, 1, 1, '#ffffff'); } break;
    case 'oathbreaker': px(-1, -7, 3, 7); px(-3, -7, 7, 3); px(-6, 3, 13, 1); px(-4, 1, 1, 2); px(4, 1, 1, 2); break;
    case 'bulwark': px(-4, -6, 9, 2); px(-5, -4, 11, 5); px(-4, 1, 9, 2); px(-2, 3, 5, 2); px(0, 5, 1, 1); px(0, -4, 1, 6, '#140f17'); px(-2, -2, 5, 1, '#140f17'); break;
    case 'chain': for (let i = 0; i < 5; i++) { px(-6 + i * 3, -1 + (i % 2), 2, 2); } px(7, -3, 1, 6); break;
    case 'fall': for (const r of [3, 6]) for (let a = 0; a < TAU; a += 0.4) px(Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r * 0.8)); px(0, 0); break;
    case 'nova': for (let a = 0; a < TAU; a += TAU / 8) for (let r = 2; r < 7; r++) px(Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r)); break;
    case 'pyre': for (let i = 0; i < 5; i++) { px(-6 + i * 3, 2 - (i % 2) * 2, 2, 4); px(-6 + i * 3, 0 - (i % 2) * 2, 1, 2, '#ffe08a'); } break;
    case 'orbs': for (let i = 0; i < 3; i++) { const a = i * TAU / 3 - Math.PI / 2; px(Math.round(Math.cos(a) * 5) - 1, Math.round(Math.sin(a) * 5) - 1, 3, 3); } break;
    case 'star': px(-1, -1, 4, 4); px(-1, -1, 2, 2, '#ffffff'); for (let i = 1; i < 6; i++) px(2 + i, -2 - i, 2, 1); break;
    case 'tumble': for (let a = 0.5; a < 5.5; a += 0.35) px(Math.round(Math.cos(a) * 5), Math.round(Math.sin(a) * 5)); px(4, -1, 3, 1, '#ffffff'); break;
    case 'snare': px(-5, -5); px(-4, -4); px(-3, -3); px(3, -3); px(4, -4); px(5, -5); px(-5, 3, 11, 1); px(-3, -2, 1, 5); px(0, -4, 1, 7); px(3, -2, 1, 5); break;
    case 'rain': for (let i = 0; i < 4; i++) { px(-6 + i * 4, -6 + (i % 2) * 3, 1, 5); px(-7 + i * 4, -2 + (i % 2) * 3, 3, 1); } break;
    case 'gale': px(-7, 0, 14, 1); px(4, -2, 1, 5); px(5, -1, 1, 3); px(-7, -3, 4, 1, '#ffffff'); px(-7, 3, 4, 1, '#ffffff'); break;
    case 'dodge': px(-5, -1, 8, 2); px(1, -4, 2, 2); px(3, -2, 2, 2); px(1, 2, 2, 2); px(3, 1, 1, 1); break;
    default: px(-2, -2, 5, 5);
  }
}

function circle(ctx, x, y, r, fill, edge) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = fill; ctx.fill();
  if (edge) { ctx.lineWidth = 1; ctx.strokeStyle = edge; ctx.stroke(); }
}

function cooldownPie(ctx, x, y, r, frac) {
  if (frac <= 0) return;
  ctx.beginPath(); ctx.moveTo(x, y);
  ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
  ctx.closePath();
  ctx.fillStyle = 'rgba(8,6,10,0.72)'; ctx.fill();
}

export function drawControls(S, ctx) {
  const Lo = layout();
  const p = S.player, hero = p.hero, hs = S.hs;
  const held = S.held;
  // joystick
  const j = S.joy;
  const jx = j.active ? j.bx : Lo.joyHome.x, jy = j.active ? j.by : Lo.joyHome.y;
  ctx.globalAlpha = j.active ? 0.55 : 0.28;
  circle(ctx, jx, jy, Lo.joyR + 4, 'rgba(20,15,24,0.5)', '#8a7a6a');
  ctx.globalAlpha = j.active ? 0.9 : 0.4;
  circle(ctx, jx + (j.active ? j.kx : 0), jy + (j.active ? j.ky : 0), 10, '#3a3040', '#c9b8a8');
  ctx.globalAlpha = 1;

  // attack
  const A = Lo.attack;
  circle(ctx, A.x, A.y + (held.attack ? 1 : 0), A.r, held.attack ? 'rgba(90,60,40,0.75)' : 'rgba(40,28,22,0.6)', '#b8874a');
  const icon = ART.icons[hero.weapon];
  if (icon) drawSprite(ctx, icon, A.x, A.y + 6 + (held.attack ? 1 : 0), { scale: 1 });

  // skills
  for (let i = 0; i < 3; i++) {
    const b = Lo['s' + i];
    const sk = hero.skills[i];
    const unlocked = p.skillUnlocked(i);
    const cdMax = skillPower(sk, hs.ranks[i] || 1).cd * p.stats.cdrMult;
    circle(ctx, b.x, b.y + (held['s' + i] ? 1 : 0), b.r, unlocked ? 'rgba(30,24,36,0.75)' : 'rgba(15,12,18,0.6)', unlocked ? hero.color : '#3a3240');
    if (unlocked) {
      glyph(ctx, sk.id, b.x, b.y, p.skillCd[i] > 0 ? '#6a6070' : hero.color);
      cooldownPie(ctx, b.x, b.y, b.r - 1, p.skillCd[i] / cdMax);
      if (p.skillCd[i] > 0) drawText(ctx, Math.ceil(p.skillCd[i]), b.x, b.y - 3, { align: 'center', color: '#ece4d8', outline: '#000' });
    } else {
      drawSprite(ctx, ART.icons.lock, b.x, b.y + 4);
      drawText(ctx, 'Lv' + sk.unlock, b.x, b.y + b.r - 3, { align: 'center', color: COL.dim, outline: '#000' });
    }
  }
  // ultimate
  const U = Lo.ult;
  const full = p.ember >= 100;
  const pulse = full ? 0.5 + 0.5 * Math.sin(G.time * 8) : 0;
  circle(ctx, U.x, U.y, U.r, full ? `rgba(${120 + pulse * 80},60,20,0.85)` : 'rgba(30,24,36,0.75)', full ? '#ffd166' : '#6b4e2c');
  if (!full) {
    ctx.save(); ctx.beginPath(); ctx.arc(U.x, U.y, U.r - 1, 0, TAU); ctx.clip();
    const h = (U.r * 2 - 2) * (p.ember / 100);
    ctx.fillStyle = 'rgba(255,138,42,0.35)';
    ctx.fillRect(U.x - U.r, U.y + U.r - 1 - h, U.r * 2, h);
    ctx.restore();
  }
  glyph(ctx, hero.ult.id, U.x, U.y, full ? '#ffe08a' : '#7a6a5a');
  if (full) drawText(ctx, 'ULT', U.x, U.y + U.r - 2, { align: 'center', color: '#ffe08a', outline: '#000' });

  // dodge
  const D = Lo.dodge;
  circle(ctx, D.x, D.y, D.r, 'rgba(30,24,36,0.7)', '#8a7a6a');
  glyph(ctx, 'dodge', D.x, D.y, p.dashCd > 0 ? '#5a5060' : '#d6d0cc');
  cooldownPie(ctx, D.x, D.y, D.r - 1, p.dashCd / hero.dodgeCd);

  // potion
  const P = Lo.potion;
  circle(ctx, P.x, P.y, P.r, 'rgba(30,24,36,0.7)', hs.potions > 0 ? '#d8343a' : '#3a3240');
  drawSprite(ctx, ART.icons.potion, P.x, P.y + 6, { alpha: hs.potions > 0 ? 1 : 0.4 });
  cooldownPie(ctx, P.x, P.y, P.r - 1, p.potionCd / 4);
  drawText(ctx, hs.potions, P.x + 8, P.y + 3, { color: '#ece4d8', outline: '#000' });

  // pause
  const Pa = Lo.pause;
  circle(ctx, Pa.x, Pa.y, Pa.r, 'rgba(30,24,36,0.7)', '#6b5a4a');
  drawSprite(ctx, ART.icons.pause, Pa.x, Pa.y + 6);
}

export function drawHud(S, ctx) {
  const p = S.player, hs = S.hs, L = G.safeL + 4;
  // portrait
  panel(ctx, L, 4, 26, 26, { fill: '#1c1621', edge: p.hero.color });
  ctx.save(); ctx.beginPath(); ctx.rect(L + 1, 5, 24, 24); ctx.clip();
  drawSprite(ctx, p.art.idle[0], L + 13, 38, { scale: 1 });
  ctx.restore();
  drawText(ctx, hs.level, L + 23, 23, { align: 'right', color: '#ffd24a', outline: '#000' });
  // bars
  const bx = L + 30;
  bar(ctx, bx, 6, 100, 6, p.hp / p.stats.maxHp, COL.hp, COL.hpD);
  drawText(ctx, `${Math.max(0, Math.ceil(p.hp))}/${p.stats.maxHp}`, bx + 102, 5, { color: '#ece4d8', outline: '#000' });
  bar(ctx, bx, 15, 100, 3, p.ember / 100, p.ember >= 100 ? '#ffd166' : COL.ember, '#2a1a10');
  bar(ctx, bx, 21, 100, 1, hs.xp / xpToNext(hs.level), COL.xp, '#14202a');
  // gold
  const R = G.W - G.safeR;
  drawSprite(ctx, ART.icons.coin, R - 46, 20);
  drawText(ctx, hs.gold, R - 38, 10, { color: COL.gold, outline: '#000' });
  // stage / area
  const st = S.stage;
  const ai = Math.max(0, S.arenaIdx) + 1;
  if (!S.bossEnemy) drawText(ctx, `${st.id}  ${st.name}${S.nm ? '  (Nightmare)' : ''}`, G.W / 2, 4, { align: 'center', color: S.nm ? '#e0453a' : COL.dim, outline: '#000' });
  if (!S.bossEnemy && S.map.arenas.length > 1) drawText(ctx, `Area ${Math.min(ai, S.map.arenas.length)}/${S.map.arenas.length}`, G.W / 2, 14, { align: 'center', color: COL.faint, outline: '#000' });
  // boss bar
  const b = S.bossEnemy;
  if (b && !b.dead) {
    const w = Math.min(220, G.W - 200);
    const x = Math.round(G.W / 2 - w / 2);
    drawText(ctx, b.def.name, G.W / 2, 3, { align: 'center', color: '#ffb347', outline: '#000' });
    bar(ctx, x, 14, w, 5, b.hp / b.maxHp, b.phase === 2 ? '#ff5a2a' : '#d8343a', '#2a0a0c');
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x + Math.round(w / 2), 14, 1, 5);
  }
}
