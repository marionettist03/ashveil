// A playable stage: arenas, waves, bosses, loot, story beats, results.
import { G } from '../core/G.js';
import { TAU, rand, randi, dist, angleTo, chance, makeCanvas, clamp, pick } from '../core/util.js';
import { drawText } from '../core/font.js';
import { drawSprite } from '../core/sprite.js';
import { button, panel, shade, COL, RARITY, title } from '../core/ui.js';
import { writeSave } from '../core/save.js';
import { ART } from '../data/art.js';
import { STAGES, THEMES, NIGHTMARE_BONUS } from '../data/stages.js';
import { STORY } from '../data/story.js';
import { xpToNext, MAX_LEVEL } from '../data/heroes.js';
import { makeItem, rollRarity } from '../data/items.js';
import { LORE } from '../data/lore.js';
import { trackBounty } from '../data/bounties.js';
import { GameMap, T } from './map.js';
import { Player } from './player.js';
import { createEnemy, updateEnemy, drawEnemy, drawEnemyOverlay } from './enemy.js';
import { FX } from './fx.js';
import { hitEnemy, hurtPlayer, inLine } from './combat.js';
import { layout, claimControl, drawControls, drawHud } from './hud.js';
import { Dialogue } from '../scenes/dialogue.js';

export class StageScene {
  constructor(hs, stageIdx, nightmare, onExit, entry = 'west') {
    this.hs = hs;
    this.stageIdx = stageIdx;
    this.stage = STAGES[stageIdx];
    this.nm = !!nightmare;
    this.onExit = onExit;
    this.entry = entry;
    this.theme = THEMES[this.stage.theme];
    this.map = new GameMap(this.stage, this.theme, (Date.now() & 0xffff) + stageIdx * 7919);
    this.audio = G.audio;
    this.fx = new FX();
    this.player = new Player(this, hs);
    const spot = entry === 'east' ? this.map.exit : this.map.start;
    this.player.x = spot.x; this.player.y = spot.y;
    this.player.face = entry === 'east' ? -1 : 1;
    this.enemies = []; this.projs = []; this.zones = []; this.teles = []; this.pickups = [];
    this.afterimages = []; this.pillars = []; this.timers = []; this.dynLights = []; this.flashes = []; this.banners = [];
    this.flakes = [];
    this.cam = { x: this.player.x - G.W / 2, y: this.player.y - G.H / 2 };
    this.time = 0; this.hitstop = 0; this.freeze = false; this.slowmo = 0;
    this.activeArena = null; this.waveDelay = 0;
    this.bossEnemy = null;
    this.key = this.stage.id + (this.nm ? 'nm' : '');
    this.roam = !!hs.cleared[this.key]; // already cleared: gates stay open, enemies still roam
    this.exitOpen = this.roam;
    this.lastZone = stageIdx === STAGES.length - 1;
    this.tier = stageIdx;
    this.aggro = (this.stage.aggro || 1) * (this.nm ? 1.15 : 1);
    this.levelBase = this.stage.lvl + (this.nm ? NIGHTMARE_BONUS : 0);
    this.stats = { kills: 0, gold: 0, items: 0, xp: 0, deaths: 0, damageTaken: 0, potions: 0, time: 0, best: -1 };
    this.state = 'play';
    this.dialogue = null;
    this.ctl = { mx: 0, my: 0, attack: false, skill: [false, false, false], ult: false, dodge: false, potion: false };
    this.joy = { active: false, id: null, bx: 0, by: 0, kx: 0, ky: 0 };
    this.held = {};
    this.press = {};
    this.pressAnim = {};
    this.light = makeCanvas(G.W, G.H);
    this.godMode = false;
    this.bagWarnT = 0;
    this.results = null;
    // the road east out of the last zone is not open yet (Chapter II)
    if (this.lastZone) { const g = this.map.arenas[this.map.arenas.length - 1].gateOut; g.closed = true; g.permanent = true; }
    this.placeLorePage();
  }

  enter() {
    G.audio.music('stage');
    this.banner(`${this.stage.id}  ${this.stage.name}`, this.nm ? 'Nightmare' : this.roam ? 'Cleared - enemies return each visit' : 'Chapter I', 2.6, true);
  }

  placeLorePage() {
    const page = LORE.find((l) => l.zone === this.stage.id);
    G.save.lore = G.save.lore || {};
    if (!page || G.save.lore[page.id] || G.autoplay) return;
    const arenas = this.map.arenas.filter((a) => !a.def.boss);
    const a = arenas[Math.min(arenas.length - 1, 1 + Math.floor(Math.random() * (arenas.length - 1)))];
    const spot = this.map.randomSpot(a, -999, -999, 0);
    this.pickups.push({ kind: 'page', page, x: spot.x, y: spot.y, vx: 0, vy: 0, z: 0, vz: 0, t: 1 });
  }

  // ------------------------------------------------------------ input claiming
  claimPointer(p) {
    if (this.state !== 'play' || this.dialogue) return null;
    const role = claimControl(p, this);
    if (!role) return null;
    if (role === 'joy') {
      if (this.joy.active) return null;
      const Lo = layout();
      // fixed: the stick never moves; floating: it appears where you touch and stays there
      const fixed = (G.save.settings.joy || 'fixed') === 'fixed';
      this.joy = { active: true, id: p.id, bx: fixed ? Lo.joyHome.x : p.x, by: fixed ? Lo.joyHome.y : p.y, kx: 0, ky: 0 };
      return 'joy';
    }
    this.press[role] = true;
    this.pressAnim[role] = 0.15;
    return role;
  }
  releasePointer(p) {
    if (p.role === 'joy' && this.joy.id === p.id) this.joy.active = false;
  }

  readControls() {
    const inp = G.input, c = this.ctl, Lo = layout();
    this.held = {};
    let mx = 0, my = 0;
    for (const p of inp.pointers.values()) {
      if (!p.role) continue;
      if (p.role === 'joy' && this.joy.id === p.id) {
        const dx = p.x - this.joy.bx, dy = p.y - this.joy.by;
        const d = Math.hypot(dx, dy);
        const k = d > Lo.joyR ? Lo.joyR / d : 1;
        this.joy.kx = dx * k; this.joy.ky = dy * k;
        if (d > 3) { const m = Math.min(1, d / Lo.joyR); mx = (dx / d) * m; my = (dy / d) * m; }
      } else this.held[p.role] = true;
    }
    if (!this.joy.active) { this.joy.kx = 0; this.joy.ky = 0; }
    // keyboard
    if (inp.key('KeyA', 'ArrowLeft')) mx -= 1;
    if (inp.key('KeyD', 'ArrowRight')) mx += 1;
    if (inp.key('KeyW', 'ArrowUp')) my -= 1;
    if (inp.key('KeyS', 'ArrowDown')) my += 1;
    const m = Math.hypot(mx, my);
    if (m > 1) { mx /= m; my /= m; }
    c.mx = mx; c.my = my;
    c.attack = !!this.held.attack || inp.key('KeyJ');
    c.skill = [!!this.press.s0 || inp.keyPressed('KeyK'), !!this.press.s1 || inp.keyPressed('KeyL'), !!this.press.s2 || inp.keyPressed('KeyI')];
    c.ult = !!this.press.ult || inp.keyPressed('KeyU');
    c.dodge = !!this.press.dodge || inp.keyPressed('Space');
    c.potion = !!this.press.potion || inp.keyPressed('KeyH');
    if (this.press.pause || inp.keyPressed('Escape', 'KeyP')) this.pause();
    this.press = {};
    if (G.autoplay) this.autoplay(c);
  }

  /** Simple bot used by automated tests (?autoplay). */
  autoplay(c) {
    const p = this.player;
    const t = this.findTarget(p.x, p.y, 400, false);
    let tx, ty;
    const pending = this.map.arenas.find((a) => a.state !== 'clear');
    const page = this.pickups.find((k) => k.kind === 'page');
    if (t) { tx = t.x; ty = t.y; }
    else if (page && G.autoplay !== 'smart') { tx = page.x; ty = page.y; }
    else if (pending && !this.roam) { tx = (pending.x + pending.w / 2) * T; ty = (pending.y + pending.h / 2) * T; }
    else { tx = this.map.tw * T + 40; ty = this.map.exit.y; }
    if (!t) {
      const wp = this.botPath(p.x, p.y, Math.min(tx, this.map.tw * T - 8), ty);
      if (wp) { tx = wp.x; ty = wp.y; }
    }
    const d = dist(p.x, p.y, tx, ty);
    const want = p.hero.ranged && t ? 80 : t ? 16 : 4;
    const bot = this.bot || (this.bot = { lx: p.x, ly: p.y, t: 0, detT: 0, det: 0 });
    bot.t += G.dt;
    if (bot.t > 0.8) { if (dist(bot.lx, bot.ly, p.x, p.y) < 6 && d > want) { bot.detT = 0.7; bot.det = chance(0.5) ? 1.4 : -1.4; } bot.t = 0; bot.lx = p.x; bot.ly = p.y; }
    if (bot.detT > 0) { bot.detT -= G.dt; const a = Math.atan2(ty - p.y, tx - p.x) + bot.det; c.mx = Math.cos(a); c.my = Math.sin(a); }
    else if (d > want || (p.hero.ranged && t && !this.map.los(p.x, p.y - 6, t.x, t.y - 6))) { c.mx = (tx - p.x) / d; c.my = (ty - p.y) / d; }
    else if (p.hero.ranged && t && d < 50) { c.mx = -(tx - p.x) / d; c.my = -(ty - p.y) / d; }
    c.attack = !!t && d < (p.hero.ranged ? 200 : 40);
    c.skill = [chance(0.05), chance(0.03), chance(0.03)];
    c.ult = p.ember >= 100;
    c.potion = p.hp < p.stats.maxHp * 0.35;
    c.dodge = chance(0.01);
    // dodge out of danger like a player would
    if (G.autoplay === 'smart') {
      let threat = null;
      for (const tl of this.teles) {
        if (tl.col === 'gold' || tl.t < tl.dur - 0.35) continue;
        const inside = tl.shape === 'line' ? inLine(p.x, p.y, p.r, tl.x, tl.y, tl.ang, tl.len, tl.w) : dist(p.x, p.y, tl.x, tl.y) < tl.r + p.r;
        if (inside) { threat = tl; break; }
      }
      for (const z of this.zones) if (z.kind === 'toll' && Math.abs(dist(p.x, p.y, z.x, z.y) - z.r) < 18) threat = z;
      if (threat) {
        const a = threat.shape === 'line' ? threat.ang + Math.PI / 2 : Math.atan2(p.y - threat.y, p.x - threat.x);
        c.mx = Math.cos(a); c.my = Math.sin(a); c.dodge = true; c.attack = false;
      }
    }
  }

  /** Next waypoint on a tile path toward (tx,ty), recomputed a few times a second (test bot only). */
  botPath(x, y, tx, ty) {
    const m = this.map, W = m.tw, H = m.th;
    const sx = Math.floor(x / T), sy = Math.floor(y / T), gx = Math.max(0, Math.min(W - 1, Math.floor(tx / T))), gy = Math.max(0, Math.min(H - 1, Math.floor(ty / T)));
    const c = this.botCache;
    if (c && c.gx === gx && c.gy === gy && this.time - c.t < 0.4) return c.wp;
    const prev = new Int32Array(W * H).fill(-1);
    const q = [sy * W + sx]; prev[sy * W + sx] = sy * W + sx;
    let found = -1;
    for (let qi = 0; qi < q.length; qi++) {
      const cur = q[qi], cx = cur % W, cy = (cur - cx) / W;
      if (cx === gx && cy === gy) { found = cur; break; }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = ny * W + nx;
        if (prev[ni] !== -1 || m.solidTile(nx, ny)) continue;
        prev[ni] = cur; q.push(ni);
      }
    }
    let wp = null;
    if (found >= 0) {
      const path = [];
      for (let n = found; n !== prev[n]; n = prev[n]) path.push(n);
      path.reverse();
      const n = path[Math.min(path.length - 1, 2)];
      if (n !== undefined) wp = { x: (n % W) * T + T / 2, y: Math.floor(n / W) * T + T / 2 };
    }
    this.botCache = { gx, gy, t: this.time, wp };
    return wp;
  }

  // ------------------------------------------------------------ helpers used by other modules
  addProj(o) {
    o.vx = Math.cos(o.ang) * o.speed; o.vy = Math.sin(o.ang) * o.speed;
    o.hit = new Set(); o.pierce = o.pierce || 0; o.t = 0;
    this.projs.push(o);
  }
  addZone(z) { z.t = 0; z.tickT = 0; z.hit = new Set(); this.zones.push(z); }
  addTelegraph(t) { t.t = 0; this.teles.push(t); }
  clearTelegraphs(owner) { this.teles = this.teles.filter((t) => t.owner !== owner); }
  later(t, fn) { this.timers.push({ t, fn }); }
  lightAt(x, y, r) { this.dynLights.push({ x, y, r }); }
  flashLight(x, y, r, dur) { this.flashes.push({ x, y, r, t: 0, dur }); }
  banner(text, sub, dur = 2, big = false, col = COL.bronze) { this.banners.push({ text, sub, t: 0, dur, big, col }); }
  ultBanner(name) { this.banners.push({ text: name, t: 0, dur: 1.1, ult: true, col: '#ffd166' }); }

  findTarget(x, y, range, needLos) {
    let best = null, bd = range;
    for (const e of this.enemies) {
      if (e.dead || e.spawnT > 0) continue;
      const d = dist(x, y, e.x, e.y) - e.r;
      if (d < bd && (!needLos || this.map.los(x, y - 6, e.x, e.y - 6))) { bd = d; best = e; }
    }
    return best;
  }

  findCluster(x, y, range) {
    let best = null, bestN = 0;
    for (const e of this.enemies) {
      if (e.dead || e.spawnT > 0 || dist(x, y, e.x, e.y) > range) continue;
      let n = 0;
      for (const o of this.enemies) if (!o.dead && dist(o.x, o.y, e.x, e.y) < 60) n++;
      if (n > bestN) { bestN = n; best = e; }
    }
    return best ? { x: best.x, y: best.y } : null;
  }

  spawnEnemy(type, x, y, level, elite = false) {
    const e = createEnemy(type, x, y, Math.max(1, level), elite);
    e.guardAng = angleTo(x, y, this.player.x, this.player.y);
    this.enemies.push(e);
    if (!e.boss) {
      this.fx.burst(x, y - 4, 10, { col: ['#3a3440', '#5a525a', '#ff8a2a'], smin: 10, smax: 40, up: 30, g: -10 });
      this.audio.play('spawn', { gap: 0.1, vol: 0.6 });
    }
    return e;
  }

  collideBreakables(ent) {
    for (const b of this.map.breakables) {
      const d = dist(ent.x, ent.y, b.x, b.y);
      const m = ent.r + b.r;
      if (d < m && d > 0.01) { ent.x = b.x + ((ent.x - b.x) / d) * m; ent.y = b.y + ((ent.y - b.y) / d) * m; }
    }
  }

  hitBreakables(x, y, r) {
    const list = this.map.breakables;
    for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i];
      if (dist(x, y, b.x, b.y - 4) > r + b.r) continue;
      list.splice(i, 1);
      this.audio.play('break');
      this.fx.burst(b.x, b.y - 5, 14, { col: b.type === 'barrel' ? ['#7a5434', '#553a22', '#6d6670'] : ['#8a6a5a', '#5a4238', '#c9a045'], smin: 30, smax: 110, up: 40 });
      if (chance(0.65)) this.dropGold(b.x, b.y, Math.round(randi(2, 5) * (1 + this.levelBase * 0.25)));
      if (chance(0.07)) this.pickups.push(this.mkPickup('potion', b.x, b.y));
    }
  }

  mkPickup(kind, x, y, extra = {}) {
    const a = rand(0, TAU), s = rand(20, 60);
    return { kind, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.5, z: 2, vz: rand(50, 90), t: 0, ...extra };
  }

  dropGold(x, y, amount) {
    amount = Math.max(1, Math.round(amount * this.player.stats.goldFind));
    const n = Math.min(5, Math.max(1, Math.floor(amount / 4)));
    for (let i = 0; i < n; i++) this.pickups.push(this.mkPickup('gold', x, y, { v: Math.round(amount / n) }));
  }

  dropItem(x, y, src = {}, minRarity = 0) {
    const r = Math.max(minRarity, rollRarity({ tier: this.tier, elite: !!src.elite, boss: !!src.boss, nm: this.nm }));
    const ilvl = this.levelBase + this.arenaBonus() + randi(0, 1);
    const item = makeItem({ heroId: this.hs.id, ilvl, rarity: r });
    this.pickups.push(this.mkPickup('item', x, y, { item, vz: rand(80, 120) }));
    if (r >= 3) this.audio.play(r === 4 ? 'legend' : 'loot');
  }

  arenaBonus() {
    const i = this.activeArena ? this.map.arenas.indexOf(this.activeArena) : 0;
    return Math.floor(Math.max(0, i) * 0.5);
  }

  killEnemy(e) {
    if (e.dead) return;
    e.dead = true; e.deathT = 0;
    this.stats.kills++;
    this.hs.kills++;
    const p = this.player;
    p.ember = Math.min(100, p.ember + 5 * p.stats.emberGain);
    const xp = Math.round(e.xp * (1 + 0.18 * (e.level - 1)));
    this.gainXp(xp);
    const lvlMul = 1 + 0.15 * (e.level - 1);
    this.dropGold(e.x, e.y, randi(e.def.gold[0], e.def.gold[1]) * lvlMul * (e.elite ? 3 : 1));
    if (e.boss) {
      const n = e.type === 'warden' ? 3 : 2;
      for (let i = 0; i < n; i++) this.dropItem(e.x, e.y, { boss: true }, 2);
      this.bossDefeated(e);
    } else if (e.elite) {
      this.dropItem(e.x, e.y, { elite: true }, 1);
      this.hitstop = Math.max(this.hitstop, 0.12);
    } else if (chance(0.06)) this.dropItem(e.x, e.y);
    if (chance(0.02)) this.pickups.push(this.mkPickup('potion', e.x, e.y));
    if (e.elite && e.elite.id === 'burning') this.addZone({ kind: 'efire', x: e.x, y: e.y, r: 26, dur: 3, tick: 0.5, enemy: true, dmg: e.atk * 0.6 });
    const b = trackBounty(this.hs, { kind: 'kill', enemy: e.type, elite: !!e.elite, boss: !!e.boss });
    if (b) this.banner('Bounty complete!', `${b.text}. Claim it at the hearth.`, 2.4, false, '#ffd24a');
    this.audio.play('die', { gap: 0.05, vol: 0.7 });
    this.fx.burst(e.x, e.y - e.h / 2, 16, { col: ['#3a3440', '#5a525a', '#8a8288', '#ff8a2a'], smin: 30, smax: 110, up: 30 });
    this.fx.burst(e.x, e.y - e.h / 2, 6, { col: ['#ff8a2a', '#ffd166'], smin: 20, smax: 60, glow: true, up: 40, g: -30 });
  }

  gainXp(n) {
    const hs = this.hs;
    if (hs.level >= MAX_LEVEL) return;
    hs.xp += n;
    this.stats.xp += n;
    while (hs.level < MAX_LEVEL && hs.xp >= xpToNext(hs.level)) {
      hs.xp -= xpToNext(hs.level);
      hs.level++;
      hs.sp++;
      const hero = this.player.hero;
      hero.skills.forEach((sk, i) => {
        if (hs.level >= sk.unlock && hs.ranks[i] === 0) {
          hs.ranks[i] = 1;
          this.later(1.4, () => this.banner('New skill', sk.name, 2.2, false, hero.color));
        }
      });
      this.player.refreshStats(false);
      this.player.hp = this.player.stats.maxHp;
      this.banner('LEVEL UP', `Level ${hs.level}   +1 skill point`, 2, true, '#ffd24a');
      this.audio.play('level');
      this.fx.add({ kind: 'ring', x: this.player.x, y: this.player.y - 6, r0: 4, r1: 40, col: '#ffd24a', col2: '#fff3b0', dur: 0.5 });
      this.fx.burst(this.player.x, this.player.y - 8, 24, { col: ['#ffd24a', '#fff3b0'], smin: 30, smax: 90, glow: true, g: -40 });
    }
    if (hs.level >= MAX_LEVEL) hs.xp = 0;
  }

  playerDied() {
    const p = this.player;
    if (p.dead) return;
    p.dead = true; p.hp = 0;
    this.stats.deaths++;
    this.audio.play('die');
    this.fx.shake(6);
    this.later(1.2, () => { this.state = 'dead'; });
  }

  reviveCost() { return Math.round(this.hs.gold * 0.15); }

  revive() {
    const p = this.player;
    const cost = this.reviveCost();
    this.hs.gold -= cost;
    if (cost) this.fx.float(p.x, p.y - 30, `-${cost} gold`, COL.gold);
    p.dead = false; p.hp = p.stats.maxHp; p.iframes = 2.5; p.ember = Math.max(p.ember, 50);
    for (const e of this.enemies) if (!e.dead && dist(e.x, e.y, p.x, p.y) < 70) { e.kbx += (e.x - p.x) * 6; e.kby += (e.y - p.y) * 6; }
    this.fx.add({ kind: 'ring', x: p.x, y: p.y - 6, r0: 4, r1: 70, col: '#ffd166', col2: '#fff3b0', thick: 2, dur: 0.6 });
    this.teles = [];
    this.zones = this.zones.filter((z) => !z.enemy);
    this.projs = this.projs.filter((q) => q.owner === 'p');
    this.state = 'play';
    this.audio.play('level');
  }

  pause() {
    if (this.state !== 'play') return;
    this.state = 'paused';
    this.audio.play('ui');
  }

  // ------------------------------------------------------------ story
  story(id, then) {
    const key = id;
    const lines = STORY[this.hs.id][id];
    if (!lines || this.hs.seen[key]) { if (then) then(); return; }
    this.hs.seen[key] = true;
    this.dialogue = new Dialogue(lines, () => { this.dialogue = null; if (then) then(); });
  }

  // ------------------------------------------------------------ arena flow
  updateArenas(dt) {
    const p = this.player;
    // walking into any arena that hasn't been fought this visit starts it
    if (!this.activeArena || this.activeArena.state === 'clear') {
      for (const a of this.map.arenas) {
        if (a.state !== 'idle') continue;
        const m = 1.5 * T;
        if (p.x > a.x * T + m && p.x < (a.x + a.w) * T - m && p.y > a.y * T + 4 && p.y < (a.y + a.h) * T - 4) {
          this.activeArena = a;
          a.state = 'active';
          a.wave = -1;
          const lock = !this.roam || a.def.boss;
          if (lock) {
            if (a.gateIn) a.gateIn.closed = true;
            if (a.gateOut) a.gateOut.closed = true;
            this.audio.play('gate');
          }
          this.waveDelay = 0.6;
          if (a.def.story) this.story(a.def.story, () => this.onArenaStart(a));
          else this.onArenaStart(a);
          break;
        }
      }
    }
    for (const g of this.map.gates) g.t = clamp(g.t + (g.closed ? dt * 4 : -dt * 3), 0, 1);

    const a = this.activeArena;
    if (!a || a.state !== 'active' || a.def.boss) return;
    const alive = this.enemies.some((e) => !e.dead);
    if (alive) return;
    this.waveDelay -= dt;
    if (this.waveDelay > 0) return;
    a.wave++;
    const waves = a.def.waves;
    if (a.wave < waves.length) {
      this.spawnWave(a, waves[a.wave]);
      this.waveDelay = 0.8;
    } else this.clearArena(a);
  }

  onArenaStart(a) {
    if (a.def.boss) this.startBoss(a);
  }

  spawnWave(a, wave) {
    const p = this.player;
    const lvl = this.levelBase + this.arenaBonus();
    const mult = this.nm ? 1.3 : 1;
    const eliteChance = (this.nm ? 0.06 : 0.02) + this.tier * 0.012;
    for (const [type, count, flag] of wave) {
      const n = flag === 'elite' ? count : Math.round(count * mult);
      for (let i = 0; i < n; i++) {
        const s = this.map.randomSpot(a, p.x, p.y, 70);
        const elite = flag === 'elite' || chance(eliteChance);
        this.spawnEnemy(type, s.x, s.y, lvl + randi(0, 1), elite);
      }
    }
  }

  openGate(g) { if (g && !g.permanent) g.closed = false; }

  clearArena(a) {
    a.state = 'clear';
    const locked = (a.gateIn && a.gateIn.closed) || (a.gateOut && a.gateOut.closed && !a.gateOut.permanent);
    this.openGate(a.gateIn);
    this.openGate(a.gateOut);
    if (locked) this.audio.play('gate');
    if (this.map.arenas.every((x) => x.state === 'clear')) this.zoneCleared();
    else this.banner('Area clear', null, 1.4);
  }

  startBoss(a) {
    const type = a.def.boss;
    const cx = (a.x + a.w * 0.68) * T, cy = (a.y + a.h / 2) * T;
    const lvl = this.levelBase + (type === 'warden' ? 1 : 2);
    const e = this.spawnEnemy(type, cx, cy, lvl);
    e.face = -1;
    this.bossEnemy = e;
    G.audio.music('boss');
    this.audio.play('roar');
    this.fx.shake(6);
    this.banner(e.def.name, e.def.title, 2.6, true, '#ffb347');
  }

  bossPhase(e) {
    this.fx.shake(8);
    this.audio.play('bell');
    this.fx.float(e.x, e.y - 40, 'THE BELL CRACKS', '#ff5a2a', true);
    if (e.type === 'warden') this.story('s4_phase');
  }

  bossDefeated(e) {
    this.slowmo = 1.2;
    this.fx.shake(10);
    this.fx.screenFlash(0.6, '#ffe08a');
    this.audio.play('roar');
    this.later(0.3, () => this.audio.play('boom'));
    for (let i = 0; i < 4; i++) this.later(i * 0.15, () => {
      this.fx.burst(e.x + rand(-14, 14), e.y - rand(4, 30), 30, { col: ['#ff8a2a', '#ffd166', '#3a3440', '#8a8288'], smin: 40, smax: 180, glow: i % 2 === 0, up: 50 });
      this.flashLight(e.x, e.y, 150, 0.5);
    });
    for (const o of this.enemies) if (!o.dead && o !== e) this.killEnemy(o);
    this.teles = []; this.zones = this.zones.filter((z) => !z.enemy); this.projs = this.projs.filter((q) => q.owner === 'p');
    const a = this.activeArena;
    this.later(2.2, () => { if (a && a.state !== 'clear') this.clearArena(a); });
    G.audio.music('stage');
  }

  /** Every arena in the zone is clear. First time: story + results. Later: open the road. */
  zoneCleared() {
    if (this.zoneDone) return;
    this.zoneDone = true;
    const b = trackBounty(this.hs, { kind: 'clear', zone: this.stage.id, deaths: this.stats.deaths });
    if (b) this.banner('Bounty complete!', `${b.text}. Claim it at the hearth.`, 2.4, false, '#ffd24a');
    if (!this.hs.cleared[this.key]) this.story(this.stage.end, () => this.showResults());
    else {
      this.exitOpen = true;
      this.banner('Zone cleared', this.lastZone ? 'The road west leads home' : 'The road east is open', 2.4, false, '#ffb347');
      writeSave(G.save);
    }
  }

  showResults() {
    const s = this.stats, hs = this.hs;
    const par = this.stage.par;
    const stars = 1 + (s.deaths === 0 ? 1 : 0) + (s.time <= par ? 1 : 0);
    const prev = hs.cleared[this.key];
    hs.cleared[this.key] = { stars: Math.max(stars, prev ? prev.stars : 0) };
    if (this.lastZone && !this.nm && !hs.chapterDone) { hs.chapterDone = true; hs.nightmare = true; this.chapterJustDone = true; }
    hs.playTime += s.time;
    const bonus = Math.round(40 * (this.stageIdx + 1) * (this.nm ? 3 : 1));
    hs.gold += bonus;
    writeSave(G.save);
    this.results = { stars, firstClear: true, bonus };
    this.exitOpen = true;
    this.state = 'results';
  }

  /** to: 'west' | 'east' | 'camp' */
  leave(to = 'camp') {
    writeSave(G.save);
    if (this.onExit) this.onExit({ to, chapterDone: !!this.chapterJustDone, stageIdx: this.stageIdx, nm: this.nm });
  }

  // ------------------------------------------------------------ main update
  update(dt) {
    if (this.dialogue) { this.dialogue.update(dt); this.updateBanners(dt); return; }
    if (this.state !== 'play') { this.updateBanners(dt); return; }
    this.readControls();
    if (this.state !== 'play') return;
    this.stats.time += dt;
    if (this.slowmo > 0) { this.slowmo -= dt; dt *= 0.3; }
    if (this.hitstop > 0) { this.hitstop -= dt; this.fx.update(dt * 0.2); return; }
    this.time += dt;
    const p = this.player;

    for (let i = this.timers.length - 1; i >= 0; i--) {
      const t = this.timers[i];
      t.t -= dt;
      if (t.t <= 0) { this.timers.splice(i, 1); t.fn(); }
    }
    p.update(dt, this.ctl);
    this.updateArenas(dt);

    for (const e of this.enemies) updateEnemy(this, e, dt);
    this.separate();
    this.enemies = this.enemies.filter((e) => !e.dead || e.deathT < 0.6);

    this.updateProjs(dt);
    this.updateZones(dt);
    for (const t of this.teles) t.t += dt;
    this.teles = this.teles.filter((t) => t.t < t.dur && !(t.owner && (t.owner.dead || (t.owner.stun > 0 && !t.owner.boss))));
    this.updatePickups(dt);
    for (const a of this.afterimages) a.t += dt;
    this.afterimages = this.afterimages.filter((a) => a.t < 0.25);
    for (const pl of this.pillars) pl.t += dt;
    this.pillars = this.pillars.filter((pl) => pl.t < 2.5);
    for (const f of this.flashes) f.t += dt;
    this.flashes = this.flashes.filter((f) => f.t < f.dur);
    this.fx.update(dt);
    this.updateBanners(dt);
    this.bagWarnT -= dt;

    // roads: walk off the west edge to go back, off the east edge to go on
    for (const k in this.pressAnim) this.pressAnim[k] = Math.max(0, this.pressAnim[k] - dt);
    if (!p.dead && !this.leaving) {
      // only a deliberate walk off the edge changes zone (not a dodge roll or a knockback)
      const walking = !p.dash && !p.leap && this.time > 0.6;
      if (walking && p.x < T * 0.8 && this.ctl.mx < -0.3) { this.leaving = true; this.leave(this.stageIdx === 0 ? 'camp' : 'west'); return; }
      if (walking && p.x > (this.map.tw - 0.8) * T && this.ctl.mx > 0.3 && this.exitOpen && !this.lastZone) { this.leaving = true; this.leave('east'); return; }
    }
    this.updateCamera(dt);
    this.updateFlakes(dt);
  }

  updateBanners(dt) {
    for (const b of this.banners) b.t += dt;
    this.banners = this.banners.filter((b) => b.t < b.dur);
  }

  separate() {
    const list = this.enemies;
    const p = this.player;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.dead || a.spawnT > 0) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.dead || b.spawnT > 0) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const m = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= m * m || d2 === 0) continue;
        const d = Math.sqrt(d2), push = (m - d) / 2;
        const wa = b.mass / (a.mass + b.mass), wb = 1 - wa;
        a.x -= (dx / d) * push * wa * 2; a.y -= (dy / d) * push * wa * 2;
        b.x += (dx / d) * push * wb * 2; b.y += (dy / d) * push * wb * 2;
      }
      // keep off the player
      if (!p.dead && !p.dash && !p.leap && !p.ultSeq) {
        const dx = p.x - a.x, dy = p.y - a.y, m = a.r + p.r;
        const d2 = dx * dx + dy * dy;
        if (d2 < m * m && d2 > 0) {
          const d = Math.sqrt(d2), push = m - d;
          const wp = a.boss ? 1 : 0.3;
          p.x += (dx / d) * push * wp; p.y += (dy / d) * push * wp;
          a.x -= (dx / d) * push * (1 - wp); a.y -= (dy / d) * push * (1 - wp);
        }
      }
      this.collideBreakables(a);
    }
  }

  updateProjs(dt) {
    const p = this.player;
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const q = this.projs[i];
      q.t += dt;
      q.x += q.vx * dt; q.y += q.vy * dt;
      let dead = q.t >= q.life;
      if (!dead && this.map.solidAt(q.x, q.y + 6)) {
        dead = true;
        this.fx.burst(q.x, q.y, 4, { col: q.kind === 'bolt' || q.kind === 'wax' ? ['#ff8a2a', '#ffd166'] : ['#c9d2da', '#8a7a6a'], smin: 20, smax: 60 });
      }
      if (!dead && q.owner === 'p') {
        for (const e of this.enemies) {
          if (e.dead || e.spawnT > 0 || q.hit.has(e)) continue;
          if (dist(q.x, q.y, e.x, e.y - Math.min(10, e.h / 2)) < e.r + q.r + 4) {
            q.hit.add(e);
            hitEnemy(this, e, q.mult, { kb: q.kind === 'arrow' ? 4 : 3, kbAng: Math.atan2(q.vy, q.vx), fromX: q.x - q.vx * 0.2, fromY: q.y - q.vy * 0.2 });
            if (q.kind === 'bolt') this.fx.burst(q.x, q.y, 5, { col: ['#ff8a2a', '#ffd166'], smin: 20, smax: 70, glow: true });
            q.pierce--;
            if (q.pierce < 0) { dead = true; break; }
          }
        }
        if (!dead) {
          const before = this.map.breakables.length;
          this.hitBreakables(q.x, q.y + 6, q.r);
          if (this.map.breakables.length < before && q.pierce <= 0) dead = true;
        }
      } else if (!dead && q.owner === 'e' && !p.dead) {
        if (dist(q.x, q.y, p.x, p.y - 8) < p.r + q.r + 3) {
          hurtPlayer(this, q.dmg, q.src);
          dead = true;
          this.fx.burst(q.x, q.y, 6, { col: ['#ff8a2a', '#ffd166'], smin: 20, smax: 70, glow: true });
        }
      }
      if (q.kind === 'bolt' || q.kind === 'wax') this.lightAt(q.x, q.y, 22);
      if (dead) this.projs.splice(i, 1);
    }
  }

  updateZones(dt) {
    const p = this.player;
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.t += dt;
      if (z.kind === 'shock' || z.kind === 'toll') {
        z.r += z.speed * dt;
        if (z.kind === 'shock') {
          for (const e of this.enemies) {
            if (e.dead || z.hit.has(e)) continue;
            if (Math.abs(dist(e.x, e.y, z.x, z.y) - z.r) < 10 + e.r) { z.hit.add(e); hitEnemy(this, e, z.mult, { kb: 10, ult: z.ult, area: true }); }
          }
          this.hitBreakables(z.x, z.y, z.r);
        } else if (!z.hit.has(p) && !p.dead && p.iframes <= 0) {
          if (Math.abs(dist(p.x, p.y, z.x, z.y) - z.r) < 7 + p.r) { z.hit.add(p); hurtPlayer(this, z.dmg, z.src, { kb: 6 }); }
        }
        if (z.r >= z.rmax) this.zones.splice(i, 1);
        continue;
      }
      z.tickT -= dt;
      if (z.tickT <= 0) {
        z.tickT = z.tick;
        if (z.kind === 'fireLine') {
          for (const e of this.enemies) if (!e.dead && inLine(e.x, e.y, e.r, z.x, z.y, z.ang, z.len, z.w)) hitEnemy(this, e, z.mult, { quiet: true, area: true });
        } else if (z.kind === 'burn') {
          for (const e of this.enemies) if (!e.dead && dist(e.x, e.y, z.x, z.y) < z.r + e.r) hitEnemy(this, e, z.mult, { quiet: true, noCrit: true, area: true });
        } else if (z.kind === 'snare') {
          for (const e of this.enemies) if (!e.dead && dist(e.x, e.y, z.x, z.y) < z.r + e.r) { if (!e.boss) e.root = 0.6; hitEnemy(this, e, z.mult, { quiet: true, area: true }); }
        } else if (z.kind === 'rain') {
          const a = rand(0, TAU), r = Math.sqrt(Math.random()) * z.r;
          const x = z.x + Math.cos(a) * r, y = z.y + Math.sin(a) * r;
          this.fx.add({ kind: 'line', x: x + 6, y: y - 30, x2: x, y2: y, col: '#e8e2d0', dur: 0.12 });
          for (const e of this.enemies) if (!e.dead && dist(e.x, e.y, x, y) < 13 + e.r) hitEnemy(this, e, z.mult, { quiet: true, area: true });
          this.fx.burst(x, y, 2, { col: ['#8a7a6a'], smin: 10, smax: 30 });
          this.audio.play('hit', { gap: 0.12, vol: 0.4 });
        } else if (z.kind === 'efire') {
          if (!p.dead && dist(p.x, p.y, z.x, z.y) < z.r + p.r) hurtPlayer(this, z.dmg, null, { iframes: 0.1, shake: 1 });
        }
      }
      if (z.kind === 'fireLine' || z.kind === 'burn' || z.kind === 'efire') {
        if (Math.random() < 0.5) {
          let fx, fy;
          if (z.kind === 'fireLine') { const k = Math.random() * z.len; fx = z.x + Math.cos(z.ang) * k; fy = z.y + Math.sin(z.ang) * k; }
          else { const a = rand(0, TAU), r = rand(0, z.r); fx = z.x + Math.cos(a) * r; fy = z.y + Math.sin(a) * r * 0.7; }
          this.fx.burst(fx, fy, 1, { col: ['#ff8a2a', '#ffd166', '#ff5a2a'], smin: 5, smax: 20, glow: true, g: -60, lmax: 0.5 });
        }
        if (z.kind === 'fireLine') { this.lightAt(z.x + Math.cos(z.ang) * z.len / 2, z.y + Math.sin(z.ang) * z.len / 2, 50); }
        else this.lightAt(z.x, z.y, z.r + 14);
      }
      if (z.t >= z.dur) this.zones.splice(i, 1);
    }
  }

  updatePickups(dt) {
    const p = this.player, hs = this.hs;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const k = this.pickups[i];
      k.t += dt;
      if (k.z > 0 || k.vz > 0) {
        k.vz -= 260 * dt; k.z += k.vz * dt;
        k.x += k.vx * dt; k.y += k.vy * dt;
        if (k.z <= 0) { k.z = 0; k.vz = 0; k.vx *= 0.3; k.vy *= 0.3; }
        if (this.map.solidAt(k.x, k.y)) { k.x -= k.vx * dt * 2; k.y -= k.vy * dt * 2; k.vx = -k.vx; k.vy = -k.vy; }
        continue;
      }
      if (p.dead || k.t < 0.35) continue;
      const d = dist(p.x, p.y, k.x, k.y);
      const magnet = k.kind === 'gold' ? 56 : 30;
      if (d < magnet) {
        const s = (1 - d / magnet) * 260 + 60;
        k.x += ((p.x - k.x) / d) * s * dt; k.y += ((p.y - k.y) / d) * s * dt;
      }
      if (d < 9) {
        if (k.kind === 'gold') {
          hs.gold += k.v; this.stats.gold += k.v;
          this.audio.play('coin', { gap: 0.05 });
          this.fx.float(p.x, p.y - 24, '+' + k.v, COL.gold, false, { life: 0.5, vy: -30 });
        } else if (k.kind === 'page') {
          G.save.lore[k.page.id] = true;
          this.audio.play('loot');
          writeSave(G.save);
          this.dialogue = new Dialogue([['narr', k.page.title.toUpperCase()], ...k.page.lines.map((l) => ['narr', l])], () => {
            this.dialogue = null;
            this.banner('Lore page found', 'Read it again in the Journal at the hearth', 2.4, false, '#e8dcc0');
          });
        } else if (k.kind === 'potion') {
          hs.potions = Math.min(5, hs.potions + 1);
          this.audio.play('potion', { vol: 0.5 });
          this.fx.float(p.x, p.y - 24, '+1 Potion', '#ff6a6a');
        } else if (k.kind === 'item') {
          if (hs.inv.length >= 30) {
            if (this.bagWarnT <= 0) { this.fx.float(p.x, p.y - 28, 'Bag full! Visit the smith', '#e0453a'); this.bagWarnT = 2; this.audio.play('deny'); }
            continue;
          }
          hs.inv.push(k.item);
          this.stats.items++;
          const r = RARITY[k.item.rarity];
          this.fx.float(p.x, p.y - 28, k.item.name, r.col, false, { life: 1.4, vy: -20 });
          this.audio.play(k.item.rarity >= 2 ? 'loot' : 'coin');
        }
        this.pickups.splice(i, 1);
      }
    }
  }

  updateCamera(dt) {
    const p = this.player;
    const tx = p.x - G.W / 2 + Math.cos(p.aim) * 12, ty = p.y - 10 - G.H / 2;
    const k = Math.min(1, dt * 6);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
    const mw = this.map.tw * T, mh = this.map.th * T;
    this.cam.x = mw <= G.W ? (mw - G.W) / 2 : clamp(this.cam.x, 0, mw - G.W);
    this.cam.y = mh <= G.H ? (mh - G.H) / 2 : clamp(this.cam.y, -8, mh - G.H);
  }

  updateFlakes(dt) {
    const target = Math.round(70 * this.theme.ash);
    const cx = this.cam.x, cy = this.cam.y;
    while (this.flakes.length < target) this.flakes.push({ x: cx + rand(0, G.W), y: cy + rand(0, G.H), vx: rand(-14, -5), vy: rand(8, 18), ember: this.stage.theme === 'ashwood' && chance(0.12), ph: rand(0, 6) });
    for (const f of this.flakes) {
      f.x += (f.vx + Math.sin(this.time * 1.5 + f.ph) * 4) * dt; f.y += f.vy * dt;
      if (f.x < cx - 4) f.x += G.W + 8;
      if (f.x > cx + G.W + 4) f.x -= G.W + 8;
      if (f.y < cy - 4) f.y += G.H + 8;
      if (f.y > cy + G.H + 4) f.y -= G.H + 8;
    }
  }

  // ------------------------------------------------------------ drawing
  draw(ctx) {
    const W = G.W, H = G.H;
    ctx.fillStyle = '#060408';
    ctx.fillRect(0, 0, W, H);
    const [sx, sy] = this.fx.shakeOffset();
    const cx = Math.round(this.cam.x) - sx, cy = Math.round(this.cam.y) - sy;
    ctx.save();
    ctx.translate(-cx, -cy);
    ctx.drawImage(this.map.canvas, 0, 0);
    this.drawGround(ctx);
    this.map.drawGates(ctx, this.time);
    // y-sorted world
    const list = [];
    for (const pr of this.map.props) if (pr.y > cy - 40 && pr.y < cy + H + 60 && pr.x > cx - 40 && pr.x < cx + W + 40) list.push({ y: pr.wall ? pr.y - 100 : pr.y, draw: () => this.map.drawProp(ctx, pr, this.time) });
    for (const b of this.map.breakables) list.push({ y: b.y, draw: () => drawSprite(ctx, ART.props[b.type], b.x, b.y + 2) });
    for (const e of this.enemies) list.push({ y: e.y, draw: () => drawEnemy(this, ctx, e) });
    for (const k of this.pickups) list.push({ y: k.y - 1, draw: () => this.drawPickup(ctx, k) });
    for (const a of this.afterimages) list.push({ y: a.y - 0.5, draw: () => drawSprite(ctx, a.spr, a.x, a.y, { flip: a.face < 0, tint: this.player.hero.color, alpha: 0.5 * (1 - a.t / 0.25) }) });
    for (const pl of this.pillars) list.push({ y: pl.y, draw: () => this.drawPillar(ctx, pl) });
    list.push({ y: this.player.y, draw: () => this.player.draw(ctx) });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) it.draw();
    this.drawRoads(ctx);
    this.drawProjs(ctx);
    this.fx.drawVfx(ctx);
    this.fx.drawParts(ctx, this.fx.parts);
    this.drawFlakes(ctx);
    ctx.restore();

    this.drawLighting(ctx, cx, cy);

    ctx.save();
    ctx.translate(-cx, -cy);
    ctx.globalCompositeOperation = 'lighter';
    this.fx.drawParts(ctx, this.fx.glow);
    ctx.globalCompositeOperation = 'source-over';
    for (const e of this.enemies) drawEnemyOverlay(this, ctx, e);
    for (const k of this.pickups) if (k.kind === 'item' && k.item.rarity >= 1 && k.z <= 0 && dist(k.x, k.y, this.player.x, this.player.y) < 90) drawText(ctx, k.item.name, k.x, k.y - 16, { align: 'center', color: RARITY[k.item.rarity].col, outline: '#140f17' });
    this.fx.drawFloaters(ctx);
    ctx.restore();

    if (this.fx.flash > 0) { ctx.globalAlpha = this.fx.flash * 0.5; ctx.fillStyle = this.fx.flashCol; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    // low HP vignette
    const p = this.player;
    if (!p.dead && p.hp < p.stats.maxHp * 0.3) {
      ctx.globalAlpha = 0.25 + 0.15 * Math.sin(G.time * 6);
      ctx.fillStyle = '#5a0a0a';
      ctx.fillRect(0, 0, W, 4); ctx.fillRect(0, H - 4, W, 4); ctx.fillRect(0, 0, 4, H); ctx.fillRect(W - 4, 0, 4, H);
      ctx.globalAlpha = 1;
    }

    drawHud(this, ctx);
    if (this.state === 'play' && !this.dialogue) drawControls(this, ctx);
    this.drawBanners(ctx);
    if (this.dialogue) this.dialogue.draw(ctx);
    else if (this.state === 'paused') this.drawPause(ctx);
    else if (this.state === 'dead') this.drawDead(ctx);
    else if (this.state === 'results') this.drawResults(ctx);
  }

  drawGround(ctx) {
    // map ground lights (ember patches)
    for (const l of this.map.lights) {
      if (!l.ground) continue;
      const f = Math.sin(this.time * 3 + l.flicker) > 0;
      ctx.fillStyle = f ? '#ff8a2a' : '#b0401a';
      ctx.fillRect(Math.round(l.x), Math.round(l.y), 2, 1);
      ctx.fillStyle = '#5a2010';
      ctx.fillRect(Math.round(l.x) - 1, Math.round(l.y) + 1, 4, 1);
    }
    // zones
    for (const z of this.zones) {
      const fade = Math.min(1, (z.dur ? (z.dur - z.t) : 1) * 3);
      if (z.kind === 'fireLine') {
        ctx.save(); ctx.translate(z.x, z.y); ctx.rotate(z.ang);
        ctx.globalAlpha = 0.45 * fade; ctx.fillStyle = '#ff5a2a'; ctx.fillRect(0, -z.w / 2, z.len, z.w);
        ctx.globalAlpha = 0.6 * fade; ctx.fillStyle = '#ffb347';
        for (let k = 0; k < z.len; k += 6) ctx.fillRect(k + ((this.time * 30 + k) % 4), -2 - ((k * 7) % 5), 2, 4);
        ctx.restore(); ctx.globalAlpha = 1;
      } else if (z.kind === 'burn' || z.kind === 'efire') {
        ctx.globalAlpha = 0.3 * fade; ctx.fillStyle = z.kind === 'efire' ? '#d8343a' : '#ff5a2a';
        ctx.beginPath(); ctx.ellipse(z.x, z.y, z.r, z.r * 0.7, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      } else if (z.kind === 'snare') {
        ctx.globalAlpha = 0.5 * fade;
        ctx.strokeStyle = '#8a9a5e'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(z.x, z.y, z.r, z.r * 0.7, 0, 0, TAU); ctx.stroke();
        ctx.fillStyle = '#62703d';
        for (let k = 0; k < 10; k++) { const a = k * 0.63 + 0.3; ctx.fillRect(Math.round(z.x + Math.cos(a) * z.r * 0.7), Math.round(z.y + Math.sin(a) * z.r * 0.5) - 3, 1, 4); }
        ctx.globalAlpha = 1;
      } else if (z.kind === 'rain') {
        ctx.globalAlpha = 0.25; ctx.strokeStyle = '#e8e2d0';
        ctx.beginPath(); ctx.ellipse(z.x, z.y, z.r, z.r * 0.7, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
      } else if (z.kind === 'shock') {
        ctx.globalAlpha = 1 - z.r / z.rmax;
        ctx.strokeStyle = '#ffa13d'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(z.x, z.y, z.r, z.r * 0.75, 0, 0, TAU); ctx.stroke();
        ctx.lineWidth = 1; ctx.globalAlpha = 1;
      } else if (z.kind === 'toll') {
        const a = 1 - z.r / z.rmax;
        ctx.globalAlpha = 0.9 * a + 0.1;
        ctx.strokeStyle = '#e8b862'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(z.x, z.y, z.r, z.r * 0.75, 0, 0, TAU); ctx.stroke();
        ctx.strokeStyle = '#fff3b0'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(z.x, z.y, z.r, z.r * 0.75, 0, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    // telegraphs
    for (const t of this.teles) {
      const k = Math.min(1, t.t / t.dur);
      const gold = t.col === 'gold';
      const base = gold ? 'rgba(255,209,102,' : 'rgba(224,48,40,';
      ctx.fillStyle = base + '0.16)';
      ctx.strokeStyle = base + '0.7)';
      ctx.lineWidth = 1;
      const shape = (scale) => {
        ctx.beginPath();
        if (t.shape === 'circle') ctx.ellipse(t.x, t.y, t.r * scale, t.r * 0.75 * scale, 0, 0, TAU);
        else if (t.shape === 'arc') { ctx.moveTo(t.x, t.y); ctx.arc(t.x, t.y, t.r * scale, t.ang - t.arc / 2, t.ang + t.arc / 2); ctx.closePath(); }
      };
      if (t.shape === 'line') {
        ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.ang);
        ctx.fillRect(0, -t.w / 2, t.len, t.w);
        ctx.strokeRect(0.5, -t.w / 2 + 0.5, t.len, t.w);
        ctx.fillStyle = base + '0.3)';
        ctx.fillRect(0, -t.w / 2, t.len * k, t.w);
        ctx.restore();
      } else {
        shape(1); ctx.fill(); ctx.stroke();
        ctx.fillStyle = base + '0.28)';
        shape(k); ctx.fill();
      }
    }
  }

  drawPickup(ctx, k) {
    const y = k.y - k.z;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(Math.round(k.x - 3), Math.round(k.y), 6, 2);
    if (k.kind === 'gold') {
      const f = Math.floor(G.time * 8 + k.x) % 4;
      ctx.fillStyle = '#b8861a'; ctx.fillRect(Math.round(k.x - 2), Math.round(y - 4), f === 2 ? 2 : 4, 4);
      ctx.fillStyle = '#ffd24a'; ctx.fillRect(Math.round(k.x - 1), Math.round(y - 4), f === 2 ? 1 : 2, 3);
    } else if (k.kind === 'page') {
      const bob = Math.round(Math.sin(G.time * 3) * 2);
      ctx.globalAlpha = 0.3 + 0.15 * Math.sin(G.time * 4);
      ctx.fillStyle = '#e8dcc0'; ctx.fillRect(Math.round(k.x - 1), Math.round(y - 40), 3, 36);
      ctx.globalAlpha = 1;
      drawSprite(ctx, ART.icons.page, k.x, y + bob, { outline: '#ffd166' });
      this.lightAt(k.x, y - 6, 24);
    } else if (k.kind === 'potion') {
      drawSprite(ctx, ART.icons.potion, k.x, y + 2);
    } else {
      const it = k.item, col = RARITY[it.rarity].col;
      if (it.rarity >= 2) {
        ctx.globalAlpha = 0.25 + 0.15 * Math.sin(G.time * 4 + k.x);
        ctx.fillStyle = col;
        ctx.fillRect(Math.round(k.x - 1), Math.round(y - 50), 3, 46);
        ctx.globalAlpha = 1;
        this.lightAt(k.x, y - 6, 18);
      }
      const icon = ART.icons[it.slot === 'weapon' ? this.player.hero.weapon : it.slot];
      drawSprite(ctx, icon, k.x, y + 1, { outline: col });
    }
  }

  drawPillar(ctx, pl) {
    const k = pl.t < 0.15 ? pl.t / 0.15 : pl.t > 2 ? 1 - (pl.t - 2) / 0.5 : 1;
    const h = Math.round(26 * k);
    ctx.fillStyle = '#4a4450'; ctx.fillRect(Math.round(pl.x - 5), Math.round(pl.y - h), 10, h);
    ctx.fillStyle = '#6e6876'; ctx.fillRect(Math.round(pl.x - 5), Math.round(pl.y - h), 3, h);
    ctx.fillStyle = '#ff8a2a'; ctx.fillRect(Math.round(pl.x), Math.round(pl.y - h + 4), 1, Math.max(0, h - 8));
  }

  drawRoads(ctx) {
    const W = this.map.tw * T;
    const west = this.stageIdx === 0 ? 'Greyhollow' : STAGES[this.stageIdx - 1].name;
    const east = this.lastZone ? 'Lumenhold (Chapter II)' : STAGES[this.stageIdx + 1].name;
    const sign = (x, y, text, dir, open) => {
      ctx.fillStyle = '#3a2a1a'; ctx.fillRect(Math.round(x), Math.round(y - 22), 2, 22);
      ctx.fillStyle = open ? '#6a4a2e' : '#3a3036'; ctx.fillRect(Math.round(x - 10), Math.round(y - 24), 22, 7);
      ctx.fillStyle = open ? '#ffd166' : '#6a5a5a';
      const ax = Math.round(x + (dir > 0 ? 8 : -8)), ay = Math.round(y - 21);
      ctx.fillRect(ax - (dir > 0 ? 2 : 0), ay, 3, 1);
      ctx.fillRect(ax + (dir > 0 ? 0 : 0), ay - 1, 1, 3);
      if (dist(this.player.x, this.player.y, x, y) < 90) drawText(ctx, (dir < 0 ? '< ' : '') + text + (dir > 0 ? ' >' : ''), x, y - 36, { align: 'center', color: open ? '#ffe0a0' : COL.faint, outline: '#140f17' });
    };
    sign(T * 3, this.map.start.y - 10, west, -1, true);
    sign(W - T * 3, this.map.exit.y - 10, east, 1, this.exitOpen && !this.lastZone);
    if (this.exitOpen && !this.lastZone) {
      const x = W - T, y = this.map.exit.y;
      if (Math.random() < 0.3) this.fx.burst(x + rand(-6, 6), y - rand(0, 20), 1, { col: ['#ffd166', '#ff8a2a'], smin: 5, smax: 15, glow: true, g: -40 });
      this.lightAt(x, y - 8, 50);
    }
  }

  drawProjs(ctx) {
    for (const q of this.projs) {
      const x = Math.round(q.x), y = Math.round(q.y);
      if (q.kind === 'bolt') {
        ctx.fillStyle = '#ff5a2a'; ctx.fillRect(x - 3, y - 2, 5, 5);
        ctx.fillStyle = '#ffd166'; ctx.fillRect(x - 2, y - 1, 3, 3);
        ctx.fillStyle = '#ff8a2a'; ctx.fillRect(Math.round(x - q.vx * 0.02) - 1, Math.round(y - q.vy * 0.02), 2, 2);
      } else if (q.kind === 'wax') {
        ctx.fillStyle = '#c9a045'; ctx.fillRect(x - 2, y - 2, 4, 4);
        ctx.fillStyle = '#fff3d0'; ctx.fillRect(x - 1, y - 1, 2, 2);
      } else {
        const len = q.kind === 'arrow' ? 8 : 5;
        const a = Math.atan2(q.vy, q.vx);
        ctx.strokeStyle = q.power ? '#d8f0c0' : q.kind === 'knife' ? '#dfe6ec' : '#c8b89a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 0.5, y + 0.5);
        ctx.lineTo(Math.round(x - Math.cos(a) * len) + 0.5, Math.round(y - Math.sin(a) * len) + 0.5);
        ctx.stroke();
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  drawFlakes(ctx) {
    for (const f of this.flakes) {
      ctx.fillStyle = f.ember ? (Math.sin(this.time * 6 + f.ph) > 0 ? '#ff8a2a' : '#b0401a') : 'rgba(210,205,200,0.55)';
      ctx.fillRect(Math.round(f.x), Math.round(f.y), 1, 1);
    }
  }

  drawLighting(ctx, cx, cy) {
    const W = G.W, H = G.H;
    if (this.light.width !== W || this.light.height !== H) { this.light.width = W; this.light.height = H; }
    const g = this.light.getContext('2d');
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, W, H);
    g.fillStyle = `rgba(4,2,8,${this.theme.dark})`;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r, s = 1) => {
      x -= cx; y -= cy;
      if (x < -r || y < -r || x > W + r || y > H + r) return;
      g.fillStyle = `rgba(0,0,0,${0.34 * s})`;
      for (const k of [1, 0.72, 0.46]) { g.beginPath(); g.arc(x, y, r * k, 0, TAU); g.fill(); }
    };
    const p = this.player;
    hole(p.x, p.y - 8, 96, 1.1);
    for (const l of this.map.lights) {
      const fl = 1 + Math.sin(this.time * 9 + l.flicker) * 0.04 + Math.sin(this.time * 23 + l.flicker * 3) * 0.03;
      hole(l.x, l.y, l.r * fl, 1);
    }
    for (const l of this.dynLights) hole(l.x, l.y, l.r, 0.8);
    for (const f of this.flashes) hole(f.x, f.y, f.r * (0.6 + 0.4 * (f.t / f.dur)), 2.5 * (1 - f.t / f.dur));
    for (const e of this.enemies) if (e.boss && !e.dead) hole(e.x, e.y - 14, 60, 0.6);
    for (const q of this.pickups) if (q.kind === 'item' && q.item.rarity >= 2) hole(q.x, q.y - 4, 20, 0.6);
    g.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.light, 0, 0);
    if (this.theme.tint) { ctx.fillStyle = this.theme.tint; ctx.fillRect(0, 0, W, H); }
    // warm additive glow from fires
    ctx.globalCompositeOperation = 'lighter';
    for (const l of this.map.lights) {
      if (l.col !== 'fire') continue;
      const x = l.x - cx, y = l.y - cy;
      if (x < -40 || y < -40 || x > W + 40 || y > H + 40) continue;
      ctx.fillStyle = 'rgba(255,120,40,0.05)';
      ctx.beginPath(); ctx.arc(x, y, l.r * 0.55, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    this.dynLights.length = 0;
  }

  drawBanners(ctx) {
    let y = 34;
    for (const b of this.banners) {
      const k = b.t / b.dur;
      const a = k < 0.12 ? k / 0.12 : k > 0.75 ? (1 - k) / 0.25 : 1;
      if (b.ult) {
        drawText(ctx, b.text, G.W / 2, G.H * 0.3, { align: 'center', color: b.col, scale: 2, outline: '#140f17', alpha: a });
        continue;
      }
      if (b.big) {
        drawText(ctx, b.text, G.W / 2, y, { align: 'center', color: b.col, scale: 2, outline: '#140f17', alpha: a });
        if (b.sub) drawText(ctx, b.sub, G.W / 2, y + 20, { align: 'center', color: COL.dim, outline: '#140f17', alpha: a });
        y += 36;
      } else {
        drawText(ctx, b.text, G.W / 2, y, { align: 'center', color: b.col, outline: '#140f17', alpha: a });
        if (b.sub) drawText(ctx, b.sub, G.W / 2, y + 11, { align: 'center', color: COL.dim, outline: '#140f17', alpha: a });
        y += b.sub ? 24 : 14;
      }
    }
  }

  // ------------------------------------------------------------ overlays
  drawPause(ctx) {
    shade(ctx, 0.7);
    const w = 176, h = 156, x = Math.round(G.W / 2 - w / 2), y = Math.round(G.H / 2 - h / 2);
    panel(ctx, x, y, w, h, { edge: COL.bronzeD });
    title(ctx, 'Paused', G.W / 2, y + 8);
    const s = G.save.settings;
    const bw = w - 24;
    if (button(ctx, x + 12, y + 30, bw, 18, 'Resume')) this.state = 'play';
    if (button(ctx, x + 12, y + 51, bw, 18, `Joystick: ${(s.joy || 'fixed') === 'fixed' ? 'Fixed' : 'Floating'}`)) { s.joy = (s.joy || 'fixed') === 'fixed' ? 'floating' : 'fixed'; writeSave(G.save); }
    if (button(ctx, x + 12, y + 72, bw / 2 - 2, 18, `Music ${s.music ? 'On' : 'Off'}`)) { s.music = !s.music; G.audio.setMusic(s.music); writeSave(G.save); }
    if (button(ctx, x + 14 + bw / 2, y + 72, bw / 2 - 2, 18, `Sound ${s.sfx ? 'On' : 'Off'}`)) { s.sfx = !s.sfx; G.audio.sfxOn = s.sfx; writeSave(G.save); }
    drawText(ctx, (s.joy || 'fixed') === 'fixed' ? 'Stick stays in the corner.' : 'Stick appears where you touch.', G.W / 2, y + 96, { align: 'center', color: COL.faint });
    if (button(ctx, x + 12, y + 110, bw, 18, 'Return to Greyhollow (keep loot)', { color: '#e0a090' })) this.leave('camp');
    drawText(ctx, 'Progress saves automatically.', G.W / 2, y + 136, { align: 'center', color: COL.faint });
    if (G.input.keyPressed('Escape', 'KeyP')) this.state = 'play';
  }

  drawDead(ctx) {
    shade(ctx, 0.65);
    const w = 200, h = 96, x = Math.round(G.W / 2 - w / 2), y = Math.round(G.H / 2 - h / 2);
    panel(ctx, x, y, w, h, { edge: '#6a1a1e' });
    title(ctx, 'You have fallen', G.W / 2, y + 8, '#e0453a');
    drawText(ctx, 'The ash has not claimed you yet.', G.W / 2, y + 30, { align: 'center', color: COL.dim });
    const cost = this.reviveCost();
    if (button(ctx, x + 12, y + 46, w - 24, 18, cost ? `Rise again (-${cost} gold)` : 'Rise again')) this.revive();
    if (button(ctx, x + 12, y + 70, w - 24, 16, 'Return to Greyhollow (keep loot)')) this.leave('camp');
  }

  drawResults(ctx) {
    shade(ctx, 0.72);
    const s = this.stats, r = this.results;
    const w = 228, h = 168, x = Math.round(G.W / 2 - w / 2), y = Math.round(G.H / 2 - h / 2);
    panel(ctx, x, y, w, h, { edge: COL.bronze });
    title(ctx, 'Zone Cleared', G.W / 2, y + 8, '#ffd24a');
    for (let i = 0; i < 3; i++) drawSprite(ctx, i < r.stars ? ART.icons.star : ART.icons.starOff, G.W / 2 - 18 + i * 18, y + 42, { scale: 1 });
    const rows = [
      ['Time', `${Math.floor(s.time / 60)}:${String(Math.floor(s.time % 60)).padStart(2, '0')}  (par ${Math.floor(this.stage.par / 60)}:${String(this.stage.par % 60).padStart(2, '0')})`],
      ['Enemies slain', s.kills],
      ['Gold', s.gold + (r.bonus ? `  +${r.bonus} first clear` : '')],
      ['Items found', s.items],
      ['Experience', s.xp],
      ['Falls', s.deaths],
    ];
    rows.forEach(([k, v], i) => {
      drawText(ctx, k, x + 14, y + 50 + i * 12, { color: COL.dim });
      drawText(ctx, String(v), x + w - 14, y + 50 + i * 12, { align: 'right', color: COL.text });
    });
    drawText(ctx, 'Stars: clear / no falls / beat par time', G.W / 2, y + h - 42, { align: 'center', color: COL.faint });
    const bw = (w - 32) / 2;
    if (this.lastZone) {
      if (button(ctx, x + 40, y + h - 26, w - 80, 18, 'Return to Greyhollow', { color: '#ffe0a0' })) this.leave('camp');
    } else {
      if (button(ctx, x + 12, y + h - 26, bw, 18, 'Continue east', { color: '#ffe0a0' })) this.state = 'play';
      if (button(ctx, x + 20 + bw, y + h - 26, bw, 18, 'Greyhollow')) this.leave('camp');
    }
  }

}
