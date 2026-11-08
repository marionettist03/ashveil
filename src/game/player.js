// The hero: movement, basic attacks, the four hero kits, dodge and potions.
import { G } from '../core/G.js';
import { TAU, rand, angleTo, dist, clamp } from '../core/util.js';
import { drawSprite } from '../core/sprite.js';
import { ART } from '../data/art.js';
import { HEROES, skillPower } from '../data/heroes.js';
import { computeStats } from './stats.js';
import { hitEnemy, inArc, inLine } from './combat.js';

function drawRot(ctx, spr, x, y, ang, pivotY = spr.h) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate(ang);
  ctx.drawImage(spr.c, -Math.floor(spr.w / 2), -pivotY);
  ctx.restore();
}

export class Player {
  constructor(S, hs) {
    this.S = S;
    this.hs = hs;
    this.hero = HEROES[hs.id];
    this.art = ART.heroes[hs.id];
    this.refreshStats(true);
    this.x = 0; this.y = 0; this.r = 5; this.h = 28;
    this.face = 1; this.aim = 0;
    this.kbx = 0; this.kby = 0;
    this.atkCd = 0; this.combo = 0; this.comboT = 0; this.lock = 0; this.atkAnim = 0;
    this.dash = null; this.dashCd = 0; this.iframes = 0;
    this.skillCd = [0, 0, 0];
    this.ember = 0;
    this.potionCd = 0; this.potionCdMax = 8; this.healT = 0; this.healRate = 0;
    this.hurtT = 0; this.dead = false;
    this.walkT = 0; this.moving = false;
    this.bulwark = 0; this.whirl = 0; this.whirlTick = 0; this.whirlMult = 0;
    this.orbs = null; this.leap = null; this.ultSeq = null; this.shots = 0;
    this.swing = null; this.pending = [];
    this.trailT = 0;
  }

  refreshStats(full) {
    const prevMax = this.stats ? this.stats.maxHp : 0;
    this.stats = computeStats(this.hs);
    if (full) this.hp = this.stats.maxHp;
    else if (this.stats.maxHp > prevMax) this.hp += this.stats.maxHp - prevMax;
    this.hp = Math.min(this.hp, this.stats.maxHp);
  }

  get handX() { return this.x + this.face * this.art.hand[0]; }
  get handY() { return this.y + this.art.hand[1]; }

  later(t, fn) { this.pending.push({ t, fn }); }

  skillReady(i) {
    const sk = this.hero.skills[i];
    return this.hs.level >= sk.unlock && this.hs.ranks[i] > 0 && this.skillCd[i] <= 0;
  }
  skillUnlocked(i) { return this.hs.level >= this.hero.skills[i].unlock && this.hs.ranks[i] > 0; }

  // ------------------------------------------------------------------ update
  update(dt, ctl) {
    const S = this.S;
    for (const k of ['atkCd', 'dashCd', 'iframes', 'potionCd', 'hurtT', 'lock', 'atkAnim', 'bulwark']) this[k] = Math.max(0, this[k] - dt);
    for (let i = 0; i < 3; i++) this.skillCd[i] = Math.max(0, this.skillCd[i] - dt);
    this.comboT -= dt;
    if (this.comboT <= 0) this.combo = 0;
    if (this.healT > 0) {
      const h = Math.min(this.healT, dt);
      this.hp = Math.min(this.stats.maxHp, this.hp + this.healRate * h);
      this.healT -= dt;
    }
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i];
      p.t -= dt;
      if (p.t <= 0) { this.pending.splice(i, 1); p.fn(); }
    }
    if (this.swing) { this.swing.t += dt; if (this.swing.t >= this.swing.dur) this.swing = null; }
    if (this.dead) return;

    if (this.ultSeq) { this.updateUltSeq(dt); return; }
    if (this.leap) { this.updateLeap(dt); return; }

    const mx = ctl.mx, my = ctl.my;
    const mag = Math.hypot(mx, my);
    this.moving = mag > 0.15;

    // aim at the nearest enemy, else where we're walking
    const tgt = S.findTarget(this.x, this.y, this.hero.ranged ? 210 : 90, this.hero.ranged);
    this.target = tgt;
    if (tgt) this.aim = angleTo(this.x, this.y, tgt.x, tgt.y - 4);
    else if (this.moving) this.aim = Math.atan2(my, mx);
    if (tgt || this.moving) this.face = Math.cos(this.aim) >= 0 ? 1 : -1;
    if (this.moving && !tgt) this.face = mx >= 0 ? 1 : -1;

    // dodge
    if (ctl.dodge && this.dashCd <= 0 && !this.dash) {
      const a = this.moving ? Math.atan2(my, mx) : this.aim;
      this.startDash(a, 300, 0.2, null);
      this.dashCd = this.hero.dodgeCd;
      this.iframes = Math.max(this.iframes, 0.28);
      S.audio.play('dash');
    }
    if (this.dash) { this.updateDash(dt); return; }

    for (let i = 0; i < 3; i++) if (ctl.skill[i]) this.castSkill(i);
    if (ctl.ult) this.castUlt();
    if (ctl.potion) this.drinkPotion();

    if (this.whirl > 0) this.updateWhirl(dt);
    else if (ctl.attack && this.atkCd <= 0 && this.lock <= 0) this.basicAttack(tgt);

    if (this.orbs) this.updateOrbs(dt);

    // movement
    let sp = this.stats.speed;
    if (this.atkAnim > 0) sp *= this.hero.ranged ? 0.6 : 0.35;
    if (this.whirl > 0) sp *= 1.1;
    if (this.lock > 0) sp = 0;
    const k = mag > 1 ? 1 / mag : 1;
    this.x += (mx * k * sp + this.kbx) * dt;
    this.y += (my * k * sp + this.kby) * dt;
    this.kbx *= Math.max(0, 1 - 10 * dt); this.kby *= Math.max(0, 1 - 10 * dt);
    S.map.collide(this);
    S.collideBreakables(this);
    if (this.moving && this.lock <= 0) {
      this.walkT += dt * (sp / 70) * 8;
      if (Math.floor(this.walkT) % 2 === 0 && Math.floor(this.walkT) !== this._lastStep) { this._lastStep = Math.floor(this.walkT); S.audio.play('step', { gap: 0.2 }); }
    }
  }

  startDash(a, speed, dur, hitMult, after) {
    this.dash = { vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, t: dur, hit: hitMult ? new Set() : null, mult: hitMult, after, trail: 0 };
    this.face = Math.cos(a) >= 0 ? this.face : this.face;
  }

  updateDash(dt) {
    const S = this.S, d = this.dash;
    this.x += d.vx * dt; this.y += d.vy * dt;
    S.map.collide(this);
    d.trail -= dt;
    if (d.trail <= 0) {
      d.trail = 0.03;
      S.fx.burst(this.x, this.y - 6, 2, { col: [this.hero.color, '#ffffff'], smin: 5, smax: 20, lmax: 0.3, g: 0 });
      S.afterimages.push({ x: this.x, y: this.y, face: this.face, t: 0, spr: this.art.atk[0] });
      if (d.mult === null && this.stats.legs.has('ashTrail')) S.addZone({ kind: 'burn', x: this.x, y: this.y, r: 12, dur: 2, tick: 0.35, mult: 0.25 });
    }
    if (d.hit) {
      for (const e of S.enemies) {
        if (e.dead || d.hit.has(e) || e.spawnT > 0) continue;
        if (dist(e.x, e.y, this.x, this.y) < 18 + e.r) { d.hit.add(e); hitEnemy(S, e, d.mult, { kb: 4 }); }
      }
      S.hitBreakables(this.x, this.y, 16);
    }
    d.t -= dt;
    if (d.t <= 0) {
      this.dash = null;
      if (d.after) d.after();
    }
  }

  // ------------------------------------------------------------------ basic attacks
  basicAttack(tgt) {
    const S = this.S, st = this.stats, id = this.hero.id;
    const step = this.combo % 3;
    this.combo++; this.comboT = 0.7;
    this.atkAnim = 0.14;
    const aim = this.aim;
    if (id === 'kes') {
      if (tgt) { const d = dist(this.x, this.y, tgt.x, tgt.y); if (d < 46 && d > 14) { const m = Math.min(8, d - 14); this.x += Math.cos(aim) * m; this.y += Math.sin(aim) * m; S.map.collide(this); } }
      const slash = (mult, flip) => {
        const dir = (this.combo + flip) % 2 ? 1 : -1;
        S.fx.add({ kind: 'slash', x: this.x, y: this.y - 7, r: 21, a0: aim - 1.2 * dir, a1: aim + 1.2 * dir, col: '#35b8a8', col2: '#ffffff', dur: 0.16 });
        this.meleeHit(26, 2.6, mult, { kb: 3, basic: true });
        S.audio.play('swing', { gap: 0.02 });
      };
      if (step < 2) { slash(1, 0); this.atkCd = st.atkRate; }
      else { slash(0.85, 0); this.later(0.07, () => slash(0.85, 1)); this.atkCd = st.atkRate * 1.7; }
      this.lock = 0.05;
    } else if (id === 'brannoc') {
      if (step < 2) {
        const dir = step === 0 ? 1 : -1;
        this.swing = { t: 0, dur: 0.16, a0: -1.9 * this.face * dir, a1: 1.7 * this.face * dir };
        S.fx.add({ kind: 'slash', x: this.x, y: this.y - 8, r: 28, a0: aim - 1.5 * dir, a1: aim + 1.5 * dir, col: '#ffa13d', col2: '#e8eef4', dur: 0.2 });
        this.meleeHit(33, 3.0, 1.2, { kb: 7 });
        S.audio.play('heavy');
        this.atkCd = st.atkRate; this.lock = 0.14;
      } else {
        this.swing = { t: 0, dur: 0.22, a0: -2.6 * this.face, a1: 1.5 * this.face };
        this.lock = 0.3; this.atkCd = st.atkRate * 1.5;
        this.later(0.12, () => {
          const px = this.x + Math.cos(aim) * 20, py = this.y + Math.sin(aim) * 20;
          for (const e of S.enemies) if (!e.dead && dist(e.x, e.y, px, py) < 30 + e.r) hitEnemy(S, e, 2.0, { kb: 10, stun: 0.6, area: true });
          S.hitBreakables(px, py, 30);
          S.fx.add({ kind: 'ring', x: px, y: py, r0: 6, r1: 32, col: '#ffa13d', col2: '#ffe08a', dur: 0.3 });
          S.fx.burst(px, py, 14, { col: ['#6e6460', '#9a8f88', '#ffa13d'], smin: 40, smax: 110, up: 30 });
          S.fx.shake(4);
          S.audio.play('boom', { vol: 0.6 });
        });
      }
    } else if (id === 'odalys') {
      const bolt = (a) => S.addProj({ x: this.handX, y: this.handY - 8, ang: a, speed: 230, r: 3, owner: 'p', mult: 1, life: 0.95, kind: 'bolt' });
      if (step < 2) bolt(aim);
      else { bolt(aim - 0.2); bolt(aim); bolt(aim + 0.2); }
      S.audio.play('shoot');
      this.atkCd = st.atkRate * (step === 2 ? 1.3 : 1);
    } else if (id === 'hale') {
      this.shots++;
      const power = this.shots % 4 === 0;
      const arrow = (a) => S.addProj({ x: this.x + Math.cos(a) * 6, y: this.y - 9 + Math.sin(a) * 6, ang: a, speed: 340, r: 2, owner: 'p', mult: power ? 1.3 : 1, pierce: power ? 99 : 0, life: 0.75, kind: 'arrow', power });
      if (power && st.legs.has('splitArrow')) { arrow(aim - 0.18); arrow(aim); arrow(aim + 0.18); }
      else arrow(aim);
      S.audio.play('shoot');
      this.atkCd = st.atkRate;
    }
  }

  meleeHit(range, arc, mult, o) {
    const S = this.S;
    for (const e of S.enemies) {
      if (e.dead || e.spawnT > 0) continue;
      if (inArc(e.x, e.y - 4, e.r, this.x, this.y - 4, range, this.aim, arc)) hitEnemy(S, e, mult, o);
    }
    S.hitBreakables(this.x + Math.cos(this.aim) * range * 0.6, this.y + Math.sin(this.aim) * range * 0.6, range * 0.7);
  }

  // ------------------------------------------------------------------ skills
  castSkill(i) {
    const S = this.S;
    const sk = this.hero.skills[i];
    if (!this.skillUnlocked(i) || this.skillCd[i] > 0 || this.lock > 0.1) return;
    const pw = skillPower(sk, this.hs.ranks[i]);
    this.skillCd[i] = pw.cd * this.stats.cdrMult;
    const aim = this.aim, m = pw.dmg;
    const moveAng = this.lastMoveAng();
    switch (sk.id) {
      // ---- Kes
      case 'feather': {
        const a = this.moving ? moveAng : aim;
        this.iframes = Math.max(this.iframes, 0.25);
        this.startDash(a, 520, 0.16, m, () => {
          if (this.stats.legs.has('featherKnives')) for (let k = 0; k < 8; k++) S.addProj({ x: this.x, y: this.y - 6, ang: (k / 8) * TAU, speed: 220, r: 2, owner: 'p', mult: 0.6, life: 0.4, kind: 'knife', pierce: 1 });
        });
        S.audio.play('dash'); S.audio.play('swing');
        break;
      }
      case 'talon': {
        const t = S.findTarget(this.x, this.y, 120, false);
        const strike = () => {
          const a = this.aim;
          let hit = false;
          for (const e of S.enemies) {
            if (e.dead || e.spawnT > 0) continue;
            if (inArc(e.x, e.y - 4, e.r, this.x, this.y - 4, 30, a, 1.6)) { hitEnemy(S, e, m, { forceCrit: true, kb: 6 }); hit = true; break; }
          }
          S.fx.add({ kind: 'slash', x: this.x, y: this.y - 7, r: 22, a0: a - 1.3, a1: a + 1.3, col: '#35b8a8', col2: '#ffffff', dur: 0.2 });
          S.fx.add({ kind: 'slash', x: this.x, y: this.y - 7, r: 18, a0: a + 1.3, a1: a - 1.3, col: '#ffd24a', col2: '#ffffff', dur: 0.22 });
          if (hit) { S.hitstop = Math.max(S.hitstop, 0.09); S.fx.shake(3); }
          S.audio.play('crit');
        };
        this.iframes = Math.max(this.iframes, 0.2);
        if (t) {
          const d = dist(this.x, this.y, t.x, t.y) - t.r - 8;
          this.aim = angleTo(this.x, this.y, t.x, t.y);
          if (d > 4) this.startDash(this.aim, 620, d / 620, null, strike);
          else strike();
        } else this.startDash(aim, 520, 0.08, null, strike);
        this.atkAnim = 0.2;
        S.audio.play('dash');
        break;
      }
      case 'whirl':
        this.whirl = 1.4; this.whirlTick = 0; this.whirlMult = m;
        S.fx.add({ kind: 'spin', x: this.x, y: this.y, r: 24, col: '#35b8a8', dur: 1.4, follow: this });
        break;
      // ---- Brannoc
      case 'oathbreaker': {
        const t = S.findTarget(this.x, this.y, 110, false);
        let tx, ty;
        if (t) { const a = angleTo(t.x, t.y, this.x, this.y); tx = t.x + Math.cos(a) * (t.r + 6); ty = t.y + Math.sin(a) * (t.r + 6); }
        else { tx = this.x + Math.cos(aim) * 60; ty = this.y + Math.sin(aim) * 60; }
        this.leap = { t: 0, dur: 0.36, sx: this.x, sy: this.y, tx, ty, mult: m };
        this.iframes = Math.max(this.iframes, 0.42);
        this.swing = { t: 0, dur: 0.36, a0: -2.8 * this.face, a1: 1.5 * this.face };
        S.audio.play('dash');
        break;
      }
      case 'bulwark':
        this.bulwark = 4;
        this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.maxHp * 0.08);
        S.fx.add({ kind: 'shield', x: this.x, y: this.y, dur: 4, follow: this });
        S.fx.float(this.x, this.y - 26, 'BULWARK', '#9ad4ff');
        S.audio.play('smith');
        break;
      case 'chain': {
        const len = 130;
        S.fx.add({ kind: 'chain', x: this.x, y: this.y - 8, ang: aim, len, dur: 0.35 });
        for (const e of S.enemies) {
          if (e.dead || e.spawnT > 0) continue;
          if (inLine(e.x, e.y - 4, e.r, this.x, this.y - 6, aim, len, 18)) {
            hitEnemy(S, e, m, { stun: 0.5 });
            if (!e.boss) e.pull = { tx: this.x + Math.cos(aim) * 18, ty: this.y + Math.sin(aim) * 18, t: 0.18 };
          }
        }
        this.lock = 0.2; this.atkAnim = 0.2;
        S.audio.play('swing'); S.audio.play('heavy');
        break;
      }
      // ---- Odalys
      case 'nova':
        for (const e of S.enemies) if (!e.dead && dist(e.x, e.y, this.x, this.y) < 52 + e.r) hitEnemy(S, e, m, { kb: 14, area: true });
        S.hitBreakables(this.x, this.y, 52);
        S.fx.add({ kind: 'ring', x: this.x, y: this.y - 4, r0: 6, r1: 54, col: '#ff8a2a', col2: '#ffe08a', thick: 3, dur: 0.35 });
        S.fx.add({ kind: 'disc', x: this.x, y: this.y - 4, r: 50, col: '#ff8a2a', alpha: 0.35, grow: true, dur: 0.3 });
        S.fx.burst(this.x, this.y - 6, 24, { col: ['#ff8a2a', '#ffd166', '#ff5a2a'], smin: 60, smax: 160, glow: true, g: 0 });
        S.flashLight(this.x, this.y, 110, 0.3);
        S.fx.shake(3); S.audio.play('fire'); S.audio.play('boom', { vol: 0.4 });
        this.atkAnim = 0.2;
        break;
      case 'pyre':
        S.addZone({ kind: 'fireLine', x: this.x, y: this.y, ang: aim, len: 120, w: 16, dur: 3, tick: 0.3, mult: m });
        this.atkAnim = 0.2; S.audio.play('fire');
        break;
      case 'orbs':
        this.orbs = { t: 6, n: this.stats.legs.has('moreOrbs') ? 5 : 3, ang: 0, mult: m, cds: new Map() };
        S.audio.play('fire');
        break;
      // ---- Hale
      case 'tumble': {
        const back = aim + Math.PI;
        this.iframes = Math.max(this.iframes, 0.25);
        this.startDash(back, 300, 0.18, null, () => {
          for (let k = -1; k <= 1; k++) S.addProj({ x: this.x, y: this.y - 9, ang: this.aim + k * 0.15, speed: 360, r: 2, owner: 'p', mult: m, life: 0.7, kind: 'arrow' });
          S.audio.play('shoot');
        });
        S.audio.play('dash');
        break;
      }
      case 'snare': {
        const t = S.findTarget(this.x, this.y, 150, true);
        const px = t ? t.x : this.x + Math.cos(aim) * 50, py = t ? t.y : this.y + Math.sin(aim) * 50;
        S.addZone({ kind: 'snare', x: px, y: py, r: 38, dur: 3, tick: 0.5, mult: m });
        S.audio.play('swing');
        break;
      }
      case 'rain': {
        const c = S.findCluster(this.x, this.y, 200) || { x: this.x + Math.cos(aim) * 80, y: this.y + Math.sin(aim) * 80 };
        S.addZone({ kind: 'rain', x: c.x, y: c.y, r: 46, dur: 1.2, tick: 0.09, mult: m });
        this.atkAnim = 0.2; S.audio.play('shoot');
        break;
      }
    }
  }

  lastMoveAng() {
    const c = this.S.ctl;
    return Math.atan2(c.my, c.mx);
  }

  castUlt() {
    const S = this.S;
    if (this.ember < 100 || this.lock > 0.1) return;
    const u = this.hero.ult;
    const m = u.dmg;
    const id = u.id;
    if (id === 'hundred') {
      const list = S.enemies.filter((e) => !e.dead && e.spawnT <= 0 && dist(e.x, e.y, this.x, this.y) < 170)
        .sort((a, b) => dist(a.x, a.y, this.x, this.y) - dist(b.x, b.y, this.x, this.y)).slice(0, 8);
      if (!list.length) { S.fx.float(this.x, this.y - 26, 'No targets', '#958a9c'); return; }
      this.ultSeq = { list, i: 0, n: 8, t: 0, mult: m };
      S.freeze = true;
    } else if (id === 'fall') {
      for (let k = 0; k < 3; k++) {
        this.later(k * 0.35, () => {
          S.addZone({ kind: 'shock', x: this.x, y: this.y, r: 4, rmax: 100, speed: 240, mult: m, ult: true });
          S.fx.shake(6); S.audio.play('boom');
          S.fx.burst(this.x, this.y, 16, { col: ['#ffa13d', '#9a8f88'], smin: 60, smax: 140 });
        });
      }
      this.swing = { t: 0, dur: 0.3, a0: -2.8 * this.face, a1: 1.5 * this.face };
      this.lock = 0.8;
    } else if (id === 'star') {
      const c = S.findCluster(this.x, this.y, 230) || { x: this.x + Math.cos(this.aim) * 90, y: this.y + Math.sin(this.aim) * 90 };
      S.addTelegraph({ shape: 'circle', x: c.x, y: c.y, r: 72, dur: 0.65, col: 'gold' });
      S.fx.add({ kind: 'meteor', x: c.x, y: c.y, dur: 0.65 });
      this.later(0.65, () => {
        for (const e of S.enemies) if (!e.dead && dist(e.x, e.y, c.x, c.y) < 72 + e.r) hitEnemy(S, e, m, { kb: 12, ult: true });
        S.hitBreakables(c.x, c.y, 72);
        S.addZone({ kind: 'burn', x: c.x, y: c.y, r: 50, dur: 3, tick: 0.4, mult: 0.3 });
        S.fx.add({ kind: 'ring', x: c.x, y: c.y, r0: 10, r1: 80, col: '#ff8a2a', col2: '#ffe08a', thick: 3, dur: 0.5 });
        S.fx.add({ kind: 'disc', x: c.x, y: c.y, r: 72, col: '#ffd166', alpha: 0.6, dur: 0.35 });
        S.fx.burst(c.x, c.y, 40, { col: ['#ff8a2a', '#ffd166', '#ff5a2a'], smin: 60, smax: 220, glow: true, up: 40 });
        S.flashLight(c.x, c.y, 180, 0.6);
        S.fx.shake(9); S.fx.screenFlash(0.35, '#ffb347'); S.audio.play('boom');
      });
      this.atkAnim = 0.4; this.lock = 0.2;
    } else if (id === 'gale') {
      const a = this.aim, len = 250;
      for (const e of S.enemies) if (!e.dead && e.spawnT <= 0 && inLine(e.x, e.y - 4, e.r, this.x, this.y - 8, a, len, 26)) hitEnemy(S, e, m, { kb: 16, kbAng: a, ult: true });
      S.fx.add({ kind: 'beam', x: this.x, y: this.y - 8, ang: a, len, w: 22, col: 'rgba(170,220,140,0.85)', col2: '#ffffff', dur: 0.45 });
      S.fx.burst(this.x + Math.cos(a) * 30, this.y - 8 + Math.sin(a) * 30, 30, { angle: a, spread: 0.3, col: ['#d8f0c0', '#ffffff', '#8a9a5e'], smin: 120, smax: 300, g: 0 });
      S.fx.shake(7); this.atkAnim = 0.3; this.lock = 0.25;
      this.kbx -= Math.cos(a) * 60; this.kby -= Math.sin(a) * 60;
    }
    this.ember = 0;
    this.iframes = Math.max(this.iframes, 0.5);
    S.fx.screenFlash(0.25, '#ffd166');
    S.audio.play('ult');
    S.ultBanner(u.name);
  }

  updateUltSeq(dt) {
    const S = this.S, q = this.ultSeq;
    this.iframes = 0.3;
    q.t -= dt;
    if (q.t > 0) return;
    const alive = q.list.filter((x) => !x.dead);
    if (q.i >= q.n || !alive.length) {
      this.ultSeq = null; S.freeze = false;
      S.fx.add({ kind: 'ring', x: this.x, y: this.y - 6, r0: 4, r1: 40, col: '#35b8a8', col2: '#ffffff', dur: 0.3 });
      return;
    }
    const e = alive[q.i % alive.length];
    q.i++;
    q.t = 0.09;
    const a = rand(0, TAU);
    S.afterimages.push({ x: this.x, y: this.y, face: this.face, t: 0, spr: this.art.atk[0] });
    this.x = e.x + Math.cos(a) * (e.r + 8); this.y = e.y + Math.sin(a) * (e.r + 8);
    S.map.collide(this);
    this.aim = angleTo(this.x, this.y, e.x, e.y); this.face = Math.cos(this.aim) >= 0 ? 1 : -1;
    for (let k = 0; k < 3; k++) {
      if (!e.dead) hitEnemy(S, e, q.mult, { ult: true, quiet: k > 0 });
      S.fx.add({ kind: 'slash', x: e.x, y: e.y - 6, r: 14 + k * 3, a0: a + k * 2, a1: a + k * 2 + 2.4, col: '#35b8a8', col2: '#ffffff', dur: 0.18 });
    }
    S.audio.play('swing');
  }

  updateLeap(dt) {
    const S = this.S, L = this.leap;
    L.t += dt;
    const k = Math.min(1, L.t / L.dur);
    this.x = L.sx + (L.tx - L.sx) * k;
    this.y = L.sy + (L.ty - L.sy) * k;
    this.z = Math.sin(k * Math.PI) * 26;
    if (k >= 1) {
      this.leap = null; this.z = 0;
      S.map.collide(this);
      const slam = (mult) => {
        for (const e of S.enemies) if (!e.dead && dist(e.x, e.y, this.x, this.y) < 46 + e.r) hitEnemy(S, e, mult, { kb: 8, stun: 0.7, area: true });
        S.hitBreakables(this.x, this.y, 46);
        S.fx.add({ kind: 'ring', x: this.x, y: this.y, r0: 6, r1: 50, col: '#ffa13d', col2: '#ffe08a', thick: 2, dur: 0.35 });
        S.fx.burst(this.x, this.y, 22, { col: ['#6e6460', '#9a8f88', '#ffa13d'], smin: 50, smax: 140, up: 40 });
        S.fx.shake(6); S.audio.play('boom');
      };
      slam(L.mult);
      if (this.stats.legs.has('doubleSlam')) this.later(0.3, () => { this.swing = { t: 0, dur: 0.2, a0: -2.6 * this.face, a1: 1.5 * this.face }; slam(L.mult * 0.6); });
      this.lock = 0.2;
    }
  }

  updateWhirl(dt) {
    const S = this.S;
    this.whirl -= dt;
    this.whirlTick -= dt;
    if (this.whirlTick <= 0) {
      this.whirlTick = 0.14;
      for (const e of S.enemies) if (!e.dead && dist(e.x, e.y, this.x, this.y) < 30 + e.r) hitEnemy(S, e, this.whirlMult, { kb: 2, quiet: true, area: true });
      S.hitBreakables(this.x, this.y, 30);
      S.audio.play('swing', { gap: 0.1 });
    }
  }

  updateOrbs(dt) {
    const S = this.S, o = this.orbs;
    o.t -= dt; o.ang += dt * 4.2;
    if (o.t <= 0) { this.orbs = null; return; }
    for (const [e, cd] of o.cds) { if (cd - dt <= 0) o.cds.delete(e); else o.cds.set(e, cd - dt); }
    for (let i = 0; i < o.n; i++) {
      const a = o.ang + (i / o.n) * TAU;
      const ox = this.x + Math.cos(a) * 30, oy = this.y - 6 + Math.sin(a) * 22;
      for (const e of S.enemies) {
        if (e.dead || e.spawnT > 0) continue;
        const key = e.id * 10 + i;
        if (o.cds.has(key)) continue;
        if (dist(e.x, e.y - 4, ox, oy) < 8 + e.r) { o.cds.set(key, 0.5); hitEnemy(S, e, o.mult, { kb: 3, quiet: true, area: true, fromX: ox, fromY: oy }); S.audio.play('fire', { gap: 0.15, vol: 0.4 }); }
      }
    }
  }

  drinkPotion() {
    const S = this.S;
    if (this.potionCd > 0) return;
    if (this.hs.potions <= 0) { S.fx.float(this.x, this.y - 26, 'No potions', '#958a9c'); S.audio.play('deny'); this.potionCd = 0.5; return; }
    if (this.hp >= this.stats.maxHp) { S.fx.float(this.x, this.y - 26, 'Full health', '#958a9c'); this.potionCd = 0.5; return; }
    this.hs.potions--;
    const amt = this.stats.maxHp * 0.35 * (this.stats.legs.has('hearth') ? 1.5 : 1);
    this.healT = 1; this.healRate = amt / 1;
    this.potionCd = this.potionCdMax;
    S.fx.burst(this.x, this.y - 8, 14, { col: ['#6ad46a', '#b8f0b0'], smin: 10, smax: 40, up: 30, g: -20 });
    S.fx.float(this.x, this.y - 26, '+' + Math.round(amt), '#6ad46a');
    S.audio.play('potion');
    S.stats.potions++;
  }

  // ------------------------------------------------------------------ draw
  draw(ctx) {
    const S = this.S;
    const z = this.z || 0;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(Math.round(this.x - 8), Math.round(this.y - 1), 16, 3);
    ctx.fillRect(Math.round(this.x - 5), Math.round(this.y - 2), 10, 5);
    if (this.dead) {
      const spr = this.art.idle[0];
      ctx.save();
      ctx.translate(Math.round(this.x), Math.round(this.y - 3));
      ctx.rotate(this.face * Math.PI / 2);
      ctx.globalAlpha = 0.8;
      ctx.drawImage(spr.c, -spr.w / 2, -spr.h / 2);
      ctx.restore();
      return;
    }
    let spr;
    if (this.dash || this.atkAnim > 0 || this.leap) spr = this.art.atk[0];
    else if (this.moving) spr = this.art.walk[Math.floor(this.walkT) % 4];
    else spr = this.art.idle[Math.floor(G.time * 2) % 2];
    const blink = this.iframes > 0 && !this.dash && !this.leap && !this.ultSeq && Math.floor(G.time * 20) % 2 === 0;
    const flip = this.face < 0;
    const y = this.y - z;
    // weapon behind
    this.drawWeapon(ctx, y, true);
    drawSprite(ctx, spr, this.x, y, { flip, tint: this.hurtT > 0.17 ? '#ffffff' : null, alpha: blink ? 0.5 : 1 });
    this.drawWeapon(ctx, y, false);
    // orbs
    if (this.orbs) {
      const o = this.orbs;
      for (let i = 0; i < o.n; i++) {
        const a = o.ang + (i / o.n) * TAU;
        const ox = Math.round(this.x + Math.cos(a) * 30), oy = Math.round(this.y - 6 + Math.sin(a) * 22);
        ctx.fillStyle = '#ff8a2a'; ctx.fillRect(ox - 2, oy - 2, 5, 5);
        ctx.fillStyle = '#ffe08a'; ctx.fillRect(ox - 1, oy - 1, 3, 3);
      }
    }
    if (this.healT > 0) {
      ctx.fillStyle = '#6ad46a';
      ctx.fillRect(Math.round(this.x + rand(-6, 6)), Math.round(y - rand(4, 20)), 1, 2);
    }
  }

  drawWeapon(ctx, y, behind) {
    const id = this.hero.id;
    const f = this.face;
    const hx = this.x + f * this.art.hand[0], hy = y + this.art.hand[1];
    if (id === 'brannoc') {
      let a;
      if (this.swing) {
        const k = Math.min(1, this.swing.t / this.swing.dur);
        const e = 1 - Math.pow(1 - k, 3);
        a = this.swing.a0 + (this.swing.a1 - this.swing.a0) * e;
      } else a = -0.55 * f;
      const isBehind = !this.swing && true;
      if (behind !== isBehind) return;
      drawRot(ctx, ART.weapons.maul, hx, hy + 2, a, 17);
    } else if (id === 'odalys') {
      if (!behind) return;
      const a = this.atkAnim > 0 ? Math.cos(this.aim) * 0.5 : 0.15 * f;
      drawRot(ctx, ART.weapons.staff, hx, hy + 6, a, 22);
      const tx = hx + Math.sin(a) * 19, ty = hy + 6 - Math.cos(a) * 19;
      this.S.lightAt(tx, ty, 26);
    } else if (id === 'hale') {
      if (behind) return;
      const spr = ART.weapons.bow;
      if (this.atkAnim > 0 || this.target) drawRot(ctx, spr, hx - f * 2 + Math.cos(this.aim) * 3, hy - 1 + Math.sin(this.aim) * 3 + spr.h / 2, this.aim, spr.h / 2);
      else drawSprite(ctx, spr, hx + f * 1, hy + 9, { flip: f < 0 });
    } else if (id === 'kes') {
      if (behind || this.atkAnim > 0 || this.whirl > 0 || this.dash) return;
      drawRot(ctx, ART.weapons.dagger, hx + f, hy + 5, 0.5 * f, 7);
    }
  }
}

export { drawRot, clamp };
