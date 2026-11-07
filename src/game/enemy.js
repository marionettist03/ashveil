// Enemy creation, AI and drawing.
import { G } from '../core/G.js';
import { rand, TAU, angleTo, dist, pick, chance, uid } from '../core/util.js';
import { drawSprite } from '../core/sprite.js';
import { drawText } from '../core/font.js';
import { ART } from '../data/art.js';
import { ENEMIES, ELITE_MODS, scaleEnemy } from '../data/enemies.js';
import { hurtPlayer, inArc, inLine } from './combat.js';
import { drawRot } from './player.js';

export function createEnemy(type, x, y, level, elite = false) {
  const def = ENEMIES[type];
  const sc = scaleEnemy(def, level);
  const art = ART.enemies[type];
  const e = {
    id: uid(), type, def, art, x, y, level,
    r: def.r, h: art.h, mass: def.mass, boss: !!def.boss,
    hp: sc.hp, maxHp: sc.hp, atk: sc.atk, armor: sc.def, speed: def.speed * rand(0.92, 1.08),
    state: 'chase', t: 0, cd: rand(0.5, 1.5), face: 1, aim: 0,
    kbx: 0, kby: 0, flash: 0, stun: 0, root: 0, vulnerable: 0, spawnT: 0.6,
    dead: false, deathT: 0, walkT: rand(0, 4), xp: def.xp, elite: null, pull: null,
    phase: 1, pattern: null, patIdx: 0, summoned70: false, summoned40: false,
  };
  if (elite) {
    const mod = pick(ELITE_MODS);
    e.elite = mod;
    e.hp = e.maxHp = Math.round(sc.hp * (mod.id === 'hulking' ? 5 : 3));
    e.xp *= 4;
    if (mod.id === 'swift') e.speed *= 1.5;
    if (mod.id === 'vengeful') e.atk *= 1.5;
  }
  if (e.boss) { e.spawnT = 0; e.state = 'idle'; e.t = 1.2; e.cd = 0; }
  return e;
}

// ---------------------------------------------------------------- movement helpers
function stepToward(S, e, tx, ty, sp, dt) {
  if (e.root > 0) return;
  let a = angleTo(e.x, e.y, tx, ty);
  // simple obstacle avoidance: if we bumped into something, slide sideways for a moment
  if (e.detourT > 0) { e.detourT -= dt; a += e.detour; }
  else if (e.blocked) { e.detour = (Math.random() < 0.5 ? 1 : -1) * 1.35; e.detourT = 0.45; a += e.detour; }
  e.x += Math.cos(a) * sp * dt;
  e.y += Math.sin(a) * sp * dt;
  e.face = Math.cos(a) >= 0 ? 1 : -1;
  e.walkT += dt * sp / 10;
}

function wallAhead(S, e) {
  const d = e.r + 3;
  return S.map.solidAt(e.x + Math.cos(e.aim) * d, e.y + Math.sin(e.aim) * d);
}

function windup(S, e, dur, telegraph) {
  e.state = 'windup';
  e.t = dur * (e.phase === 2 ? 0.8 : 1);
  if (telegraph) S.addTelegraph({ ...telegraph, dur: e.t, owner: e });
}

// ---------------------------------------------------------------- per-type AI
const AI = {
  ashling(S, e, dt, p, d) {
    if (e.state === 'chase') {
      stepToward(S, e, p.x, p.y, e.speed, dt);
      if (d < 16 + e.r && e.cd <= 0) { windup(S, e, 0.3); e.aim = angleTo(e.x, e.y, p.x, p.y); }
    } else if (e.state === 'windup') {
      if (e.t <= 0) {
        e.x += Math.cos(e.aim) * 8; e.y += Math.sin(e.aim) * 8;
        if (dist(e.x, e.y, p.x, p.y) < 13 + p.r) hurtPlayer(S, e.atk, e);
        e.state = 'recover'; e.t = 0.5; e.cd = rand(0.8, 1.2);
      }
    } else if (e.state === 'recover' && e.t <= 0) e.state = 'chase';
  },

  hollowed(S, e, dt, p, d) {
    if (e.state === 'chase') {
      stepToward(S, e, p.x, p.y, e.speed, dt);
      if (d < 24 + e.r && e.cd <= 0) {
        e.aim = angleTo(e.x, e.y, p.x, p.y);
        windup(S, e, 0.55, { shape: 'arc', x: e.x, y: e.y, r: 28, ang: e.aim, arc: 2.2 });
      }
    } else if (e.state === 'windup') {
      if (e.t <= 0) {
        if (inArc(p.x, p.y, p.r, e.x, e.y, 28, e.aim, 2.2)) hurtPlayer(S, e.atk, e, { kb: 4 });
        S.fx.add({ kind: 'slash', x: e.x, y: e.y - 6, r: 18, a0: e.aim - 1, a1: e.aim + 1, col: '#9a948c', col2: '#d8d0c4', dur: 0.15 });
        S.audio.play('swing', { vol: 0.5 });
        e.state = 'recover'; e.t = 0.7; e.cd = rand(1, 1.6);
      }
    } else if (e.state === 'recover' && e.t <= 0) e.state = 'chase';
  },

  hound(S, e, dt, p, d) {
    if (e.state === 'chase') {
      stepToward(S, e, p.x, p.y, e.speed * (d > 90 ? 1.4 : 1), dt);
      if (d < 95 && d > 25 && e.cd <= 0 && S.map.los(e.x, e.y, p.x, p.y)) {
        e.aim = angleTo(e.x, e.y, p.x, p.y);
        windup(S, e, 0.45, { shape: 'line', x: e.x, y: e.y, ang: e.aim, len: 90, w: 14 });
      } else if (d <= 25 && e.cd <= 0) {
        e.aim = angleTo(e.x, e.y, p.x, p.y);
        windup(S, e, 0.35, { shape: 'arc', x: e.x, y: e.y, r: 22, ang: e.aim, arc: 1.8 });
        e.bite = true;
      }
    } else if (e.state === 'windup') {
      if (e.t <= 0) {
        if (e.bite) {
          e.bite = false;
          if (inArc(p.x, p.y, p.r, e.x, e.y, 22, e.aim, 1.8)) hurtPlayer(S, e.atk, e);
          e.state = 'recover'; e.t = 0.5; e.cd = 1;
        } else {
          e.state = 'lunge'; e.t = 0.3; e.hitDone = false;
          S.audio.play('dash', { vol: 0.5 });
        }
      }
    } else if (e.state === 'lunge') {
      e.x += Math.cos(e.aim) * 300 * dt; e.y += Math.sin(e.aim) * 300 * dt;
      if (!e.hitDone && dist(e.x, e.y, p.x, p.y) < e.r + p.r + 4) { e.hitDone = true; hurtPlayer(S, e.atk * 1.2, e, { kb: 5 }); }
      S.fx.burst(e.x, e.y - 3, 1, { col: ['#ff8a2a', '#e0581f'], smin: 5, smax: 20, glow: true, g: 0 });
      if (e.t <= 0 || wallAhead(S, e)) { e.state = 'recover'; e.t = 0.6; e.cd = rand(1.4, 2.2); }
    } else if (e.state === 'recover' && e.t <= 0) e.state = 'chase';
  },

  wickling(S, e, dt, p, d) {
    if (e.state === 'chase') {
      const want = 95;
      if (d > want + 20 || !S.map.los(e.x, e.y, p.x, p.y)) stepToward(S, e, p.x, p.y, e.speed, dt);
      else if (d < want - 25) stepToward(S, e, e.x * 2 - p.x, e.y * 2 - p.y, e.speed * 0.9, dt);
      else {
        const a = angleTo(p.x, p.y, e.x, e.y) + (e.id % 2 ? 1.2 : -1.2) * dt;
        stepToward(S, e, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, e.speed * 0.6, dt);
      }
      e.face = p.x >= e.x ? 1 : -1;
      if (d < 170 && e.cd <= 0 && S.map.los(e.x, e.y, p.x, p.y)) windup(S, e, 0.6);
    } else if (e.state === 'windup') {
      if (e.t <= 0) {
        const a = angleTo(e.x, e.y - 18, p.x, p.y - 6);
        const shots = e.elite ? [-0.25, 0, 0.25] : [0];
        for (const o of shots) S.addProj({ x: e.x, y: e.y - 18, ang: a + o, speed: 115, r: 3, owner: 'e', dmg: e.atk, life: 2.2, kind: 'wax', src: e });
        S.audio.play('fire', { vol: 0.4 });
        e.state = 'recover'; e.t = 0.6; e.cd = rand(1.8, 2.6);
      }
    } else if (e.state === 'recover' && e.t <= 0) e.state = 'chase';
  },

  belltoller(S, e, dt, p, d) {
    if (e.state === 'chase') {
      stepToward(S, e, p.x, p.y, e.speed, dt);
      if (d < 42 + e.r && e.cd <= 0) {
        e.aim = angleTo(e.x, e.y, p.x, p.y);
        e.slamX = e.x + Math.cos(e.aim) * 14; e.slamY = e.y + Math.sin(e.aim) * 14;
        windup(S, e, 0.9, { shape: 'circle', x: e.slamX, y: e.slamY, r: 36 });
        S.audio.play('bell', { vol: 0.25, gap: 0.5 });
      }
    } else if (e.state === 'windup') {
      if (e.t <= 0) {
        if (dist(p.x, p.y, e.slamX, e.slamY) < 36 + p.r) hurtPlayer(S, e.atk * 1.3, e, { kb: 8, shake: 5 });
        S.fx.add({ kind: 'ring', x: e.slamX, y: e.slamY, r0: 6, r1: 38, col: '#c08a3a', col2: '#e8b862', dur: 0.35 });
        S.fx.burst(e.slamX, e.slamY, 14, { col: ['#6e6460', '#9a8f88'], smin: 40, smax: 120, up: 30 });
        S.fx.shake(4); S.audio.play('boom', { vol: 0.5 });
        e.state = 'recover'; e.t = 1.0; e.cd = rand(1.5, 2.2);
      }
    } else if (e.state === 'recover' && e.t <= 0) e.state = 'chase';
  },

  // ------------------------------------------------------------ boss: Old Crown, the Charcoal Stag
  stag(S, e, dt, p, d) {
    if (e.phase === 1 && e.hp < e.maxHp * 0.5) {
      e.phase = 2; e.state = 'idle'; e.t = 0.8;
      S.fx.float(e.x, e.y - 40, 'ENRAGED', '#ff5a2a', true);
      S.audio.play('roar');
      S.fx.shake(6);
    }
    if (e.state === 'idle' || e.state === 'chase') {
      if (d > 50) stepToward(S, e, p.x, p.y, e.speed * (e.phase === 2 ? 1.3 : 1), dt);
      else e.face = p.x >= e.x ? 1 : -1;
      if (e.t > 0) return;
      const opts = [];
      if (d < 60) opts.push('sweep', 'sweep');
      if (d > 50) opts.push('charge', 'charge');
      opts.push('stomp');
      if (e.phase === 2) opts.push('embers', 'charge');
      const pat = pick(opts);
      e.aim = angleTo(e.x, e.y, p.x, p.y);
      if (pat === 'charge') {
        e.pattern = 'charge';
        windup(S, e, 0.95, { shape: 'line', x: e.x, y: e.y, ang: e.aim, len: 240, w: 26 });
        S.audio.play('roar', { vol: 0.5 });
      } else if (pat === 'sweep') {
        e.pattern = 'sweep';
        windup(S, e, 0.65, { shape: 'arc', x: e.x, y: e.y, r: 54, ang: e.aim, arc: 3.6 });
      } else if (pat === 'stomp') {
        e.pattern = 'stomp';
        windup(S, e, 0.75, { shape: 'circle', x: e.x, y: e.y, r: 62 });
      } else {
        e.pattern = 'embers';
        e.state = 'embers'; e.t = 1.6; e.n = 0;
      }
    } else if (e.state === 'windup') {
      if (e.t > 0) return;
      if (e.pattern === 'charge') { e.state = 'charging'; e.t = 0.85; e.hitDone = false; S.audio.play('dash'); }
      else if (e.pattern === 'sweep') {
        if (inArc(p.x, p.y, p.r, e.x, e.y, 54, e.aim, 3.6)) hurtPlayer(S, e.atk * 1.3, e, { kb: 9, shake: 5 });
        S.fx.add({ kind: 'slash', x: e.x, y: e.y - 10, r: 42, a0: e.aim - 1.8, a1: e.aim + 1.8, col: '#ff8a2a', col2: '#ffe08a', dur: 0.25 });
        S.audio.play('heavy');
        e.state = 'idle'; e.t = rand(0.6, 1.0);
      } else if (e.pattern === 'stomp') {
        if (dist(p.x, p.y, e.x, e.y) < 62 + p.r) hurtPlayer(S, e.atk * 1.2, e, { kb: 10, shake: 6 });
        S.fx.add({ kind: 'ring', x: e.x, y: e.y, r0: 8, r1: 66, col: '#ff8a2a', col2: '#ffe08a', thick: 3, dur: 0.4 });
        S.fx.burst(e.x, e.y, 24, { col: ['#6e6460', '#ff8a2a', '#9a8f88'], smin: 50, smax: 150, up: 40 });
        S.fx.shake(7); S.audio.play('boom');
        if (S.enemies.filter((x) => !x.dead && !x.boss).length < 5) for (let i = 0; i < 3; i++) S.spawnEnemy('ashling', e.x + rand(-50, 50), e.y + rand(-30, 30), e.level - 1);
        e.state = 'idle'; e.t = rand(0.8, 1.2);
      }
    } else if (e.state === 'charging') {
      const sp = e.phase === 2 ? 330 : 280;
      e.x += Math.cos(e.aim) * sp * dt; e.y += Math.sin(e.aim) * sp * dt;
      if (Math.random() < 0.6) S.fx.burst(e.x, e.y, 2, { col: ['#ff8a2a', '#6e6460'], smin: 10, smax: 40, up: 20 });
      if (!e.hitDone && dist(e.x, e.y, p.x, p.y) < e.r + p.r + 6) { e.hitDone = true; hurtPlayer(S, e.atk * 1.6, e, { kb: 14, shake: 7 }); }
      if (wallAhead(S, e)) {
        e.state = 'dazed'; e.t = 1.6; e.vulnerable = 1.6;
        S.fx.shake(8); S.audio.play('boom');
        S.fx.float(e.x, e.y - 34, 'DAZED', '#ffd24a', true);
        S.fx.burst(e.x, e.y - 10, 20, { col: ['#9a8f88', '#ff8a2a'], smin: 40, smax: 120 });
      } else if (e.t <= 0) { e.state = 'idle'; e.t = rand(0.5, 0.9); }
    } else if (e.state === 'dazed') {
      if (e.t <= 0) { e.state = 'idle'; e.t = 0.4; }
    } else if (e.state === 'embers') {
      e.n -= dt;
      if (e.n <= 0) {
        e.n = 0.25;
        const tx = p.x + rand(-40, 40), ty = p.y + rand(-30, 30);
        S.addTelegraph({ shape: 'circle', x: tx, y: ty, r: 16, dur: 0.8 });
        S.later(0.8, () => {
          if (dist(p.x, p.y, tx, ty) < 16 + p.r) hurtPlayer(S, e.atk * 0.9, null);
          S.fx.burst(tx, ty, 10, { col: ['#ff8a2a', '#ffd166'], smin: 30, smax: 90, glow: true, up: 30 });
          S.flashLight(tx, ty, 40, 0.2);
          S.audio.play('fire', { vol: 0.4, gap: 0.1 });
        });
      }
      if (e.t <= 0) { e.state = 'idle'; e.t = rand(0.6, 1); }
    }
  },

  // ------------------------------------------------------------ boss: The Bellwarden
  warden(S, e, dt, p, d) {
    if (e.phase === 1 && e.hp < e.maxHp * 0.5) {
      e.phase = 2; e.state = 'idle'; e.t = 1.2;
      S.bossPhase(e);
      return;
    }
    if (!e.summoned70 && e.hp < e.maxHp * 0.72 && e.state !== 'windup') { e.summoned70 = true; e.state = 'summon'; e.t = 1.0; S.audio.play('bell'); return; }
    if (!e.summoned40 && e.hp < e.maxHp * 0.38 && e.state !== 'windup') { e.summoned40 = true; e.state = 'summon'; e.t = 1.0; S.audio.play('bell'); return; }
    const enr = e.phase === 2 ? 1.25 : 1;
    if (e.state === 'idle' || e.state === 'chase') {
      if (d > 46) stepToward(S, e, p.x, p.y, e.speed * enr, dt);
      else e.face = p.x >= e.x ? 1 : -1;
      if (e.t > 0) return;
      const opts = ['toll'];
      if (d < 70) opts.push('sweep', 'sweep');
      else opts.push('thrust', 'thrust');
      if (e.phase === 2) opts.push('pillars', 'toll');
      const pat = pick(opts);
      e.pattern = pat;
      e.aim = angleTo(e.x, e.y, p.x, p.y);
      if (pat === 'toll') {
        windup(S, e, 0.9);
        e.glow = 0.9;
      } else if (pat === 'sweep') {
        windup(S, e, 0.7, { shape: 'arc', x: e.x, y: e.y, r: 62, ang: e.aim, arc: 3.5 });
        e.swingA = -2.2 * e.face;
      } else if (pat === 'thrust') {
        windup(S, e, 0.85, { shape: 'line', x: e.x, y: e.y, ang: e.aim, len: 170, w: 22 });
      } else if (pat === 'pillars') {
        e.state = 'pillars'; e.t = 1.4; e.n = 0;
      }
    } else if (e.state === 'windup') {
      if (e.t > 0) return;
      if (e.pattern === 'toll') {
        S.audio.play('bell');
        const rings = e.phase === 2 ? 2 : 1;
        for (let i = 0; i < rings; i++) {
          S.later(i * 0.55, () => {
            S.addZone({ kind: 'toll', x: e.x, y: e.y - 4, r: 10, rmax: 230, speed: 140, enemy: true, dmg: e.atk * 1.1, src: e });
            S.fx.shake(4);
          });
        }
        e.state = 'idle'; e.t = rand(1.3, 1.8);
      } else if (e.pattern === 'sweep') {
        if (inArc(p.x, p.y, p.r, e.x, e.y, 62, e.aim, 3.5)) hurtPlayer(S, e.atk * 1.5, e, { kb: 10, shake: 6 });
        S.fx.add({ kind: 'slash', x: e.x, y: e.y - 14, r: 48, a0: e.aim - 1.75, a1: e.aim + 1.75, col: '#c3cbd3', col2: '#ffffff', dur: 0.25 });
        e.swingT = 0.25;
        S.audio.play('heavy');
        e.state = 'idle'; e.t = rand(0.7, 1.1);
      } else if (e.pattern === 'thrust') {
        e.state = 'charging'; e.t = 0.55; e.hitDone = false; S.audio.play('dash');
      }
    } else if (e.state === 'charging') {
      e.x += Math.cos(e.aim) * 300 * dt; e.y += Math.sin(e.aim) * 300 * dt;
      if (!e.hitDone && inLine(p.x, p.y, p.r, e.x, e.y, e.aim, 30, 24)) { e.hitDone = true; hurtPlayer(S, e.atk * 1.6, e, { kb: 14, shake: 7 }); }
      const wall = wallAhead(S, e);
      if (e.t <= 0 || wall) { e.state = 'idle'; e.t = rand(0.6, 0.9); if (wall) { S.fx.shake(5); S.audio.play('boom', { vol: 0.5 }); } }
    } else if (e.state === 'summon') {
      if (e.t <= 0) {
        const types = e.phase === 2 ? ['belltoller', 'hollowed', 'ashling', 'ashling'] : ['hollowed', 'hollowed', 'ashling', 'ashling'];
        for (const t of types) { const sp = S.map.randomSpot(S.activeArena, p.x, p.y, 60); S.spawnEnemy(t, sp.x, sp.y, e.level - 2); }
        e.state = 'idle'; e.t = 1.0;
      }
    } else if (e.state === 'pillars') {
      e.n -= dt;
      if (e.n <= 0) {
        e.n = 0.28;
        const tx = p.x + rand(-34, 34), ty = p.y + rand(-26, 26);
        S.addTelegraph({ shape: 'circle', x: tx, y: ty, r: 18, dur: 0.9 });
        S.later(0.9, () => {
          if (dist(p.x, p.y, tx, ty) < 18 + p.r) hurtPlayer(S, e.atk * 1.1, null);
          S.fx.burst(tx, ty, 16, { col: ['#9a8f88', '#d6d0cc', '#ff8a2a'], smin: 40, smax: 120, up: 60 });
          S.pillars.push({ x: tx, y: ty, t: 0 });
          S.audio.play('boom', { vol: 0.3, gap: 0.1 });
        });
      }
      if (e.t <= 0) { e.state = 'idle'; e.t = rand(0.5, 0.9); }
    }
  },
};

// ---------------------------------------------------------------- update & draw
export function updateEnemy(S, e, dt) {
  e.flash = Math.max(0, e.flash - dt);
  e.vulnerable = Math.max(0, e.vulnerable - dt);
  e.glow = Math.max(0, (e.glow || 0) - dt);
  e.swingT = Math.max(0, (e.swingT || 0) - dt);
  if (e.dead) { e.deathT += dt; return; }
  if (e.spawnT > 0) { e.spawnT -= dt; return; }
  e.blocked = e.hitWall;
  e.hitWall = false;
  e.root = Math.max(0, e.root - dt);
  // knockback & pulls
  e.x += e.kbx * dt; e.y += e.kby * dt;
  e.kbx *= Math.max(0, 1 - 9 * dt); e.kby *= Math.max(0, 1 - 9 * dt);
  if (e.pull) {
    const k = Math.min(1, dt / e.pull.t);
    e.x += (e.pull.tx - e.x) * k; e.y += (e.pull.ty - e.y) * k;
    e.pull.t -= dt;
    if (e.pull.t <= 0) e.pull = null;
  }
  if (S.freeze) { S.map.collide(e); return; }
  if (e.stun > 0) {
    e.stun -= dt;
    if (e.state === 'windup' || e.state === 'charging' || e.state === 'lunge') { e.state = e.boss ? 'idle' : 'recover'; e.t = 0.2; S.clearTelegraphs(e); }
    S.map.collide(e);
    return;
  }
  e.t -= dt; e.cd -= dt;
  const p = S.player;
  const d = dist(e.x, e.y, p.x, p.y);
  if (p.dead) { e.state = e.boss ? 'idle' : 'chase'; e.t = 1; }
  else AI[e.type](S, e, dt, p, d);
  S.map.collide(e);
}

export function drawEnemy(S, ctx, e) {
  const art = e.art;
  const x = e.x, y = e.y;
  // shadow
  const sw = Math.max(8, art.w * 0.6);
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.fillRect(Math.round(x - sw / 2), Math.round(y - 1), Math.round(sw), 3);
  if (e.spawnT > 0) {
    const k = 1 - e.spawnT / 0.6;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - art.w, y - art.h * k, art.w * 2, art.h * k + 2);
    ctx.clip();
    drawSprite(ctx, art.idle[0], x, y, { tint: '#2a2430' });
    ctx.restore();
    return;
  }
  if (e.dead) {
    const k = e.deathT / 0.5;
    if (k >= 1) return;
    drawSprite(ctx, art.idle[0], x, y, { flip: e.face < 0, tint: k < 0.3 ? '#ffffff' : '#3a3440', alpha: 1 - k });
    return;
  }
  let spr;
  if (e.state === 'windup' || e.state === 'charging' || e.state === 'lunge') spr = art.atk[0];
  else if (e.state === 'dazed') spr = art.idle[0];
  else spr = art.walk[Math.floor(e.walkT) % 4];
  const shake = e.state === 'windup' && e.t < 0.25 ? (Math.floor(G.time * 40) % 2) : 0;
  const tint = e.flash > 0 ? '#ffffff' : null;
  const warn = e.state === 'windup' && Math.floor(G.time * 12) % 2 === 0;
  // boss weapon (behind)
  if (e.type === 'warden') {
    let a = e.swingT > 0 ? (e.face * (1.8 - e.swingT * 10)) : e.state === 'windup' && e.pattern === 'sweep' ? -2.2 * e.face : e.state === 'charging' || (e.state === 'windup' && e.pattern === 'thrust') ? e.aim + Math.PI / 2 : 0.25 * e.face;
    drawRot(ctx, ART.weapons.halberd, x + e.face * 14, y - 12, a, 18);
  }
  drawSprite(ctx, spr, x + shake, y, { flip: e.face < 0, tint, outline: warn ? '#ff3a2a' : e.elite ? e.elite.col : e.vulnerable > 0 ? '#ffd24a' : null });
  if (e.type === 'wickling') S.map.flame(ctx, x + (e.face < 0 ? 0 : 0), y - art.h - 1 + (e.state === 'windup' ? -1 : 0), G.time, e.state === 'windup' ? 1 : 0.6);
  if (e.type === 'warden' && e.glow > 0) {
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(G.time * 30);
    drawSprite(ctx, spr, x, y, { flip: e.face < 0, tint: '#ffd166', alpha: 0.35 });
    ctx.globalAlpha = 1;
  }
  if (e.root > 0) {
    ctx.fillStyle = '#62703d';
    for (let i = 0; i < 4; i++) ctx.fillRect(Math.round(x - 6 + i * 4), Math.round(y - 4 - (i % 2) * 2), 1, 4 + (i % 2) * 2);
  }
  if (e.stun > 0.05 && !e.boss) {
    const a = G.time * 8;
    ctx.fillStyle = '#ffd24a';
    ctx.fillRect(Math.round(x + Math.cos(a) * 5), Math.round(y - art.h - 3 + Math.sin(a) * 2), 1, 1);
    ctx.fillRect(Math.round(x - Math.cos(a) * 5), Math.round(y - art.h - 3 - Math.sin(a) * 2), 1, 1);
  }
}

/** Overhead bars / names (drawn after lighting so they stay readable). */
export function drawEnemyOverlay(S, ctx, e) {
  if (e.dead || e.spawnT > 0 || e.boss) return;
  const show = e.elite || e.hp < e.maxHp;
  if (!show) return;
  const w = e.elite ? 26 : 14;
  const x = Math.round(e.x - w / 2), y = Math.round(e.y - e.h - 5);
  ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, w + 2, 4);
  ctx.fillStyle = '#3a0e10'; ctx.fillRect(x, y, w, 2);
  ctx.fillStyle = e.elite ? e.elite.col : '#d8343a'; ctx.fillRect(x, y, Math.max(0, Math.round(w * e.hp / e.maxHp)), 2);
  if (e.elite) drawText(ctx, `${e.elite.name} ${e.def.name}`, e.x, y - 10, { align: 'center', color: e.elite.col, outline: '#140f17' });
}
