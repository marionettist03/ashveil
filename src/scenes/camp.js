// Greyhollow hearth: the hub between stages (gear, skills, smith, stage select).
import { G } from '../core/G.js';
import { rand, fmt } from '../core/util.js';
import { drawText, wrap, measure } from '../core/font.js';
import { drawSprite } from '../core/sprite.js';
import { button, panel, bar, COL, RARITY, iconFrame, shade, title, rect } from '../core/ui.js';
import { writeSave, SLOTS } from '../core/save.js';
import { ART } from '../data/art.js';
import { HEROES, skillPower, xpToNext } from '../data/heroes.js';
import { STAGES, THEMES } from '../data/stages.js';
import { STORY, CAMP_FIRST, CHAPTER_END, ANSEL_TALK } from '../data/story.js';
import { LORE } from '../data/lore.js';
import { ensureBounties, makeBounty } from '../data/bounties.js';
import { addXp } from '../game/progress.js';
import { pick } from '../core/util.js';
import { SLOT_NAMES, itemLines, itemScore, salvageValue, enhanceCost, MAX_ENH, makeItem } from '../data/items.js';
import { computeStats } from '../game/stats.js';
import { StageScene } from '../game/stage.js';
import { Dialogue } from './dialogue.js';
import { Backdrop, HeroSelectScene } from './title.js';
import { SettingsPanel } from './settings.js';
import { Cloud } from '../core/cloud.js';

/** Start walking a zone. entry: 'west' (from Greyhollow side) or 'east'. */
export function makeZone(hs, idx, nm, entry = 'west') {
  return new StageScene(hs, idx, nm, (res) => onZoneExit(hs, res), entry);
}

export function onZoneExit(hs, res) {
  writeSave(G.save);
  if (res.to === 'east' && res.stageIdx + 1 < STAGES.length) { G.setScene(makeZone(hs, res.stageIdx + 1, res.nm, 'west')); return; }
  if (res.to === 'west' && res.stageIdx > 0) { G.setScene(makeZone(hs, res.stageIdx - 1, res.nm, 'east')); return; }
  const camp = new CampScene(hs, { chapterDone: res.chapterDone, returned: true });
  camp.nmSel = !!res.nm && hs.nightmare;
  camp.stageSel = Math.min(STAGES.length - 1, camp.firstOpen(camp.nmSel));
  G.setScene(camp);
}

export class CampScene {
  constructor(hs, opt = {}) {
    this.hs = hs;
    this.hero = HEROES[hs.id];
    this.bg = new Backdrop();
    this.t = 0;
    this.tab = null; // 'road' | 'gear' | 'skills' | 'smith'
    this.sel = null; // { from: 'inv'|'eq', key }
    this.stageSel = this.firstOpenStage();
    this.nmSel = false;
    this.dialogue = null;
    this.toast = null;
    this.queue = [];
    if (opt.fresh) this.queue.push(STORY[hs.id].intro);
    if (!hs.seen.camp) { hs.seen.camp = true; this.queue.push(CAMP_FIRST); }
    // a talk at the hearth after first clearing each of the first three zones
    for (let n = 1; n <= 3; n++) {
      const key = 'c' + n;
      if (hs.cleared[STAGES[n - 1].id] && !hs.seen[key] && STORY[hs.id][key]) { hs.seen[key] = true; this.queue.push(STORY[hs.id][key]); }
    }
    if (opt.chapterDone) this.queue.push(CHAPTER_END);
    ensureBounties(hs);
    writeSave(G.save);
    if (G.note) { this.say('Collected on the way: ' + G.note, COL.gold); this.toast.t = -2; G.note = null; }
    this.nextDialogue();
    if (!this.dialogue && opt.returned) this.tab = null;
  }

  enter() { G.audio.music('calm'); }

  nextDialogue() {
    const lines = this.queue.shift();
    if (lines) this.dialogue = new Dialogue(lines, () => { this.dialogue = null; this.nextDialogue(); });
  }

  firstOpenStage() {
    for (let i = 0; i < STAGES.length; i++) if (!this.hs.cleared[STAGES[i].id]) return i;
    return STAGES.length - 1;
  }
  stageOpen(i, nm) {
    if (nm && !this.hs.nightmare) return false;
    if (i === 0) return true;
    return !!this.hs.cleared[STAGES[i - 1].id + (nm ? 'nm' : '')];
  }

  say(text, col = COL.text) { this.toast = { text, col, t: 0 }; }

  update(dt) {
    this.bg.update(dt);
    this.t += dt;
    if (this.dialogue) this.dialogue.update(dt);
    if (this.toast) { this.toast.t += dt; if (this.toast.t > 2.2) this.toast = null; }
  }

  draw(ctx) {
    this.drawScene(ctx);
    if (this.dialogue) { this.dialogue.draw(ctx); return; }
    this.drawTopBar(ctx);
    if (!this.tab) this.drawMenu(ctx);
    else {
      shade(ctx, 0.55);
      if (this.tab === 'road') this.drawRoad(ctx);
      else if (this.tab === 'gear') this.drawGear(ctx);
      else if (this.tab === 'skills') this.drawSkills(ctx);
      else if (this.tab === 'smith') this.drawSmith(ctx);
      else if (this.tab === 'board') this.drawBoard(ctx);
      else if (this.tab === 'journal') this.drawJournal(ctx);
      else if (this.tab === 'settings') { this.settingsPanel.draw(ctx); return; }
      if (G.input.keyPressed('Escape')) this.tab = null;
    }
    if (this.toast) {
      const a = this.toast.t > 1.8 ? (2.2 - this.toast.t) / 0.4 : 1;
      drawText(ctx, this.toast.text, G.W / 2, G.H - 16, { align: 'center', color: this.toast.col, outline: '#000', alpha: a });
    }
  }

  // ------------------------------------------------------------ scene art
  drawScene(ctx) {
    const W = G.W, H = G.H;
    this.bg.draw(ctx, { hillX: W * 0.8 });
    const gy = Math.round(H * 0.86);
    // palisade behind camp
    ctx.fillStyle = '#120c0c';
    for (let x = 0; x < W * 0.62; x += 5) ctx.fillRect(x, gy - 30 - (x % 3), 4, 40);
    // hearth glow
    const fx = Math.round(W * 0.3), fy = gy + 2;
    const fl = 0.85 + Math.sin(this.t * 9) * 0.05 + Math.sin(this.t * 23) * 0.04;
    for (const [r, a] of [[90, 0.05], [60, 0.07], [36, 0.1]]) {
      ctx.fillStyle = `rgba(255,130,50,${a})`;
      ctx.beginPath(); ctx.ellipse(fx, fy - 6, r * fl, r * 0.6 * fl, 0, 0, Math.PI * 2); ctx.fill();
    }
    // logs + fire
    ctx.fillStyle = '#3a2418'; ctx.fillRect(fx - 9, fy - 3, 18, 3);
    ctx.fillStyle = '#2a1a12'; ctx.fillRect(fx - 7, fy - 5, 14, 2);
    for (let i = 0; i < 7; i++) {
      const h = 6 + Math.abs(Math.sin(this.t * 7 + i * 1.3)) * 8;
      ctx.fillStyle = i % 2 ? '#ff8a2a' : '#ffb347';
      ctx.fillRect(fx - 7 + i * 2, Math.round(fy - 5 - h), 2, Math.round(h));
    }
    ctx.fillStyle = '#ffe08a'; ctx.fillRect(fx - 2, fy - 9, 4, 4);
    if (Math.random() < 0.4) {
      this.sparks = this.sparks || [];
      this.sparks.push({ x: fx + rand(-5, 5), y: fy - 12, vy: rand(-30, -14), vx: rand(-6, 6), t: 0 });
    }
    for (const s of this.sparks || []) { s.t += G.dt; s.x += s.vx * G.dt; s.y += s.vy * G.dt; ctx.fillStyle = s.t < 0.6 ? '#ffb347' : '#8a3010'; ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1); }
    if (this.sparks) this.sparks = this.sparks.filter((s) => s.t < 1.2);
    // hero and Maud
    const art = ART.heroes[this.hs.id];
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(fx - 58, gy + 1, 28, 3);
    drawSprite(ctx, art.idle[Math.floor(this.t * 2) % 2], fx - 44, gy + 2, { scale: 2 });
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(fx - 114, gy + 1, 28, 3);
    drawSprite(ctx, ART.ansel.idle[Math.floor(this.t * 1.2) % 2], fx - 100, gy + 2, { scale: 2 });
    const mx = fx + 48;
    // anvil
    ctx.fillStyle = '#2a2830'; ctx.fillRect(mx + 22, gy - 12, 18, 5); ctx.fillRect(mx + 27, gy - 7, 8, 8); ctx.fillRect(mx + 24, gy + 1, 14, 2);
    ctx.fillStyle = '#4a4852'; ctx.fillRect(mx + 22, gy - 12, 18, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(mx - 14, gy + 1, 28, 3);
    drawSprite(ctx, ART.maud.idle[Math.floor(this.t * 1.5) % 2], mx, gy + 2, { scale: 2, flip: true });
  }

  drawTopBar(ctx) {
    const hs = this.hs, L = G.safeL + 6, R = G.W - G.safeR - 6;
    panel(ctx, L, 4, R - L, 22, { fill: '#120e15', alpha: 0.92 });
    drawText(ctx, `${this.hero.name}`, L + 6, 8, { color: this.hero.color });
    const nx = L + 10 + measure(this.hero.name);
    drawText(ctx, `Lv ${hs.level}`, nx, 8, { color: '#ffd24a' });
    bar(ctx, nx + 32, 11, 60, 2, hs.xp / xpToNext(hs.level), COL.xp, '#14202a');
    let x = R - 6;
    const stat = (icon, v, col) => {
      const t = String(v);
      x -= measure(t);
      drawText(ctx, t, x, 9, { color: col });
      x -= 14;
      drawSprite(ctx, ART.icons[icon], x + 6, 21);
      x -= 6;
    };
    stat('coin', fmt(hs.gold), COL.gold);
    stat('shard', hs.shards, '#ff9a3c');
    stat('potion', hs.potions, '#ff8a8a');
  }

  drawMenu(ctx) {
    const R = G.W - G.safeR - 6;
    const bw = 108, bx = R - bw, y0 = 31;
    const hs = this.hs;
    const ready = (hs.bounties || []).filter((b) => b.have >= b.need).length;
    const pages = LORE.filter((l) => (G.save.lore || {})[l.id]).length;
    const items = [
      ['road', 'Travel the Road', '#ffe0a0'],
      ['gear', `Gear${hs.inv.length >= 28 ? ' (full!)' : ''}`],
      ['skills', `Skills${hs.sp > 0 ? `  +${hs.sp}` : ''}`, hs.sp > 0 ? '#ffd24a' : null],
      ['smith', 'Maud the Smith'],
      ['board', `Bounties${ready ? `  (${ready} done)` : ''}`, ready ? '#ffd24a' : null],
      ['journal', `Journal  ${pages}/${LORE.length}`],
      ['talk', 'Sit with Ansel'],
      ['settings', 'Settings', Cloud.state === 'conflict' ? COL.red : COL.dim],
      ['heroes', 'Change hero', COL.dim],
    ];
    const gap = Math.min(22, Math.floor((G.H - y0 - 4) / items.length));
    items.forEach(([id, label, col], i) => {
      if (button(ctx, bx, y0 + i * gap, bw, gap - 3, label, { color: col || COL.text })) {
        if (id === 'heroes') { writeSave(G.save); G.setScene(new HeroSelectScene()); }
        else if (id === 'talk') this.talk();
        else if (id === 'settings') { this.tab = 'settings'; this.settingsPanel = new SettingsPanel(() => { this.tab = null; }); }
        else { this.tab = id; this.sel = null; }
      }
    });
    const st = computeStats(hs);
    drawText(ctx, `Power ${st.power}`, G.safeL + 10, 32, { color: COL.bronze, outline: '#000' });
    drawText(ctx, 'Greyhollow Hearth', G.safeL + 10, 43, { color: COL.dim, outline: '#000' });
    if (Cloud.signedIn) drawText(ctx, Cloud.state === 'conflict' ? 'Cloud save: choose a copy in Settings' : 'Cloud: ' + Cloud.statusText(), G.safeL + 10, 54, { color: Cloud.state === 'conflict' ? COL.red : COL.faint, outline: '#000' });
    if (G.input.keyPressed('Enter')) this.tab = 'road';
  }

  talk() {
    const hs = this.hs;
    const lines = [['ansel', pick(ANSEL_TALK)]];
    if ((hs.bounties || []).some((b) => b.have >= b.need)) lines.push(['ansel', 'And the board by the door has coin waiting for you. Claim it.']);
    this.dialogue = new Dialogue(lines, () => { this.dialogue = null; });
  }

  closeBtn(ctx, x, y) {
    if (button(ctx, x, y, 18, 16, 'X', { sound: 'uiBack' })) { this.tab = null; return true; }
    return false;
  }

  frame(ctx, name) {
    const L = G.safeL + 6, R = G.W - G.safeR - 6;
    const x = L, y = 30, w = R - L, h = G.H - 34;
    panel(ctx, x, y, w, h, { fill: '#141017', edge: COL.bronzeD });
    drawText(ctx, name, x + 8, y + 6, { color: COL.bronze });
    this.closeBtn(ctx, x + w - 22, y + 3);
    return { x, y, w, h };
  }

  // ------------------------------------------------------------ stage select
  drawRoad(ctx) {
    const f = this.frame(ctx, 'The Ember Road');
    const hs = this.hs;
    const n = STAGES.length, gap = 6;
    const cw = Math.floor((f.w - 16 - gap * (n - 1)) / n), ch = 100;
    // the road that joins every zone
    ctx.fillStyle = '#5a4630';
    ctx.fillRect(f.x + 4, f.y + 22 + 46, f.w - 8, 3);
    ctx.fillStyle = '#3a2d20';
    for (let rx = f.x + 6; rx < f.x + f.w - 6; rx += 6) ctx.fillRect(rx, f.y + 22 + 47, 3, 1);
    STAGES.forEach((s, i) => {
      const x = f.x + 8 + i * (cw + gap), y = f.y + 22;
      const open = this.stageOpen(i, this.nmSel);
      const sel = this.stageSel === i;
      const th = THEMES[s.theme];
      panel(ctx, x, y, cw, ch, { fill: open ? th.floor[0] : '#0e0b10', edge: sel ? '#ffd24a' : '#3a3040' });
      // little scene preview
      if (open) {
        rect(ctx, x + 2, y + 2, cw - 4, 22, th.wallTop);
        const prop = { outskirts: 'grave', ashwood: 'tree', crypt: 'coffin', nave: 'bell' }[s.theme];
        drawSprite(ctx, ART.props[prop], x + cw / 2, y + 46);
        if (s.arenas.some((a) => a.boss)) {
          // boss thumbnail, kept inside the card's picture strip
          const bs = ART.enemies[s.arenas.find((a) => a.boss).boss].idle[0];
          ctx.save(); ctx.beginPath(); ctx.rect(x + 2, y + 2, cw - 4, 49); ctx.clip();
          drawSprite(ctx, bs, x + cw - 4 - bs.w / 2, y + 50);
          ctx.restore();
        }
      } else drawSprite(ctx, ART.icons.lock, x + cw / 2, y + 40);
      panel(ctx, x + 1, y + 52, cw - 2, ch - 53, { fill: '#120e15', edge: '#120e15', hi: false });
      drawText(ctx, s.id, x + 5, y + 55, { color: open ? COL.bronze : COL.faint });
      const nm = wrap(s.name, cw - 10);
      nm.slice(0, 2).forEach((ln, k) => drawText(ctx, ln, x + 5, y + 66 + k * 10, { color: open ? COL.text : COL.faint }));
      const rec = s.lvl + (this.nmSel ? 12 : 0);
      drawText(ctx, `Lv ${rec}+`, x + cw - 5, y + 55, { align: 'right', color: hs.level >= rec ? COL.dim : '#e0453a' });
      const c = hs.cleared[s.id + (this.nmSel ? 'nm' : '')];
      for (let k = 0; k < 3; k++) drawSprite(ctx, c && k < c.stars ? ART.icons.star : ART.icons.starOff, x + 12 + k * 13, y + ch - 2);
      if (G.input.tapIn(x, y, cw, ch)) { if (open) { this.stageSel = i; G.audio.play('ui'); } else { G.audio.play('deny'); this.say('Clear the previous stage first.', COL.dim); } }
    });
    const by = f.y + f.h - 24;
    if (hs.nightmare) {
      if (button(ctx, f.x + 8, by, 74, 18, 'Normal', { selected: !this.nmSel })) { this.nmSel = false; this.stageSel = Math.min(this.stageSel, this.firstOpen(false)); }
      if (button(ctx, f.x + 86, by, 84, 18, 'Nightmare', { selected: this.nmSel, color: '#e0453a' })) { this.nmSel = true; this.stageSel = Math.min(this.stageSel, this.firstOpen(true)); }
    } else drawText(ctx, 'Zones connect: walk east and west between them.', f.x + 10, by + 5, { color: COL.faint });
    const s = STAGES[this.stageSel];
    const canGo = this.stageOpen(this.stageSel, this.nmSel);
    if (button(ctx, f.x + f.w - 110, by, 102, 18, `Enter ${s.id}`, { color: '#ffe0a0', disabled: !canGo }) || (G.input.keyPressed('Enter') && canGo)) this.enterStage(this.stageSel, this.nmSel);
  }

  firstOpen(nm) {
    let last = 0;
    for (let i = 0; i < STAGES.length; i++) if (this.stageOpen(i, nm)) last = i;
    return last;
  }

  enterStage(i, nm) {
    writeSave(G.save);
    G.setScene(makeZone(this.hs, i, nm, 'west'));
  }

  // ------------------------------------------------------------ gear
  selItem() {
    if (!this.sel) return null;
    if (this.sel.from === 'eq') return this.hs.eq[this.sel.key];
    return this.hs.inv[this.sel.key] || null;
  }

  drawGear(ctx) {
    const f = this.frame(ctx, 'Gear');
    const hs = this.hs;
    const st = computeStats(hs);
    // equipped row
    const ax = f.x + 8, ay = f.y + 20;
    drawText(ctx, 'Equipped', ax, ay - 1, { color: COL.dim });
    SLOTS.forEach((slot, i) => {
      const it = hs.eq[slot];
      const x = ax + i * 24, y = ay + 10;
      const sel = this.sel && this.sel.from === 'eq' && this.sel.key === slot;
      iconFrame(ctx, x, y, 22, it ? it.rarity : -1, { selected: sel });
      const icon = ART.icons[slot === 'weapon' ? this.hero.weapon : slot];
      drawSprite(ctx, icon, x + 11, y + 17, { alpha: it ? 1 : 0.25 });
      if (it && it.enh) drawText(ctx, '+' + it.enh, x + 21, y + 1, { align: 'right', color: '#ffd24a', outline: '#000' });
      if (G.input.tapIn(x, y, 22, 22)) { this.sel = it ? { from: 'eq', key: slot } : null; G.audio.play('ui'); }
    });
    // stats
    const lines = [
      ['Power', st.power, COL.bronze],
      ['Attack', Math.round(st.atk)],
      ['Max HP', st.maxHp],
      ['Defense', Math.round(st.def)],
      ['Crit', Math.round(st.crit * 100) + '%'],
      ['Crit dmg', Math.round(st.critDmg * 100) + '%'],
      ['Atk speed', Math.round((this.hero.base.atkRate / st.atkRate) * 100) + '%'],
      ['Move', Math.round((st.speed / this.hero.base.speed) * 100) + '%'],
      ['Cooldowns', '-' + Math.round((1 - st.cdrMult) * 100) + '%'],
      ['Life steal', Math.round(st.leech * 100) + '%'],
    ];
    lines.forEach(([k, v, c], i) => {
      drawText(ctx, k, ax, ay + 38 + i * 10, { color: COL.dim });
      drawText(ctx, String(v), ax + 118, ay + 38 + i * 10, { align: 'right', color: c || COL.text });
    });
    // bag
    const bx = ax + 128, by = ay;
    drawText(ctx, `Bag ${hs.inv.length}/30`, bx, by - 1, { color: hs.inv.length >= 28 ? '#e0453a' : COL.dim });
    const cs = 21;
    for (let i = 0; i < 30; i++) {
      const x = bx + (i % 6) * cs, y = by + 10 + Math.floor(i / 6) * cs;
      const it = hs.inv[i];
      const sel = this.sel && this.sel.from === 'inv' && this.sel.key === i;
      iconFrame(ctx, x, y, cs - 1, it ? it.rarity : -1, { selected: sel, fill: '#0e0b10' });
      if (it) {
        drawSprite(ctx, ART.icons[it.slot === 'weapon' ? this.hero.weapon : it.slot], x + 10, y + 16);
        const eq = hs.eq[it.slot];
        if (!eq || itemScore(it) > itemScore(eq)) { ctx.fillStyle = '#6ad46a'; ctx.fillRect(x + cs - 5, y + 2, 2, 3); ctx.fillRect(x + cs - 6, y + 3, 4, 1); }
        if (G.input.tapIn(x, y, cs - 1, cs - 1)) { this.sel = { from: 'inv', key: i }; G.audio.play('ui'); }
      }
    }
    const gy = by + 10 + 5 * cs + 3;
    if (button(ctx, bx, gy, 62, 15, 'Sort')) {
      hs.inv.sort((a, b) => b.rarity - a.rarity || itemScore(b) - itemScore(a));
      this.sel = null;
    }
    if (button(ctx, bx + 64, gy, 62, 15, 'Salvage', { color: '#ff9a3c' })) this.salvageJunk();
    drawText(ctx, 'Salvage = all Common & Magic', bx, gy + 18, { color: COL.faint });
    // details
    const dx = bx + 6 * cs + 8, dw = f.x + f.w - dx - 8;
    this.drawDetails(ctx, dx, f.y + 22, dw, f.h - 28);
  }

  drawDetails(ctx, x, y, w, h) {
    const it = this.selItem();
    panel(ctx, x, y, w, h, { fill: '#100c12' });
    if (!it) {
      wrap('Tap an item to see it. A green mark means it is stronger than what you wear.', w - 12).forEach((ln, i) => drawText(ctx, ln, x + 6, y + 8 + i * 10, { color: COL.faint }));
      return;
    }
    const r = RARITY[it.rarity];
    let ly = y + 6;
    wrap(it.name + (it.enh ? ` +${it.enh}` : ''), w - 12).forEach((ln) => { drawText(ctx, ln, x + 6, ly, { color: r.col }); ly += 10; });
    drawText(ctx, `${r.name} ${SLOT_NAMES[it.slot]}  ilvl ${it.ilvl}`, x + 6, ly, { color: COL.dim }); ly += 13;
    for (const l of itemLines(it)) {
      for (const ln of wrap(l.text, w - 12)) { drawText(ctx, ln, x + 6, ly, { color: l.col }); ly += 10; }
    }
    const hs = this.hs;
    const fromInv = this.sel.from === 'inv';
    if (fromInv) {
      const eq = hs.eq[it.slot];
      const d = itemScore(it) - (eq ? itemScore(eq) : 0);
      ly += 2;
      drawText(ctx, eq ? `vs worn: ${d >= 0 ? '+' : ''}${d} score` : 'Slot is empty', x + 6, ly, { color: d >= 0 ? COL.green : COL.red });
    }
    const by = y + h - 20;
    const half = Math.floor((w - 16) / 2);
    if (fromInv) {
      if (button(ctx, x + 6, by, half, 16, 'Equip', { color: '#ffe0a0' })) this.equip(this.sel.key);
      const sv = salvageValue(it);
      if (button(ctx, x + 10 + half, by, half, 16, `Salvage`, { color: '#ff9a3c' })) {
        hs.inv.splice(this.sel.key, 1);
        hs.gold += sv.gold; hs.shards += sv.shards;
        this.say(`+${sv.gold} gold, +${sv.shards} shards`, COL.gold);
        G.audio.play('smith');
        this.sel = null;
        writeSave(G.save);
      }
    } else if (button(ctx, x + 6, by, w - 12, 16, 'Unequip', { disabled: hs.inv.length >= 30 })) {
      hs.inv.push(it); hs.eq[it.slot] = null; this.sel = null; writeSave(G.save);
    }
  }

  equip(i) {
    const hs = this.hs;
    const it = hs.inv[i];
    const old = hs.eq[it.slot];
    hs.eq[it.slot] = it;
    if (old) hs.inv[i] = old; else hs.inv.splice(i, 1);
    this.sel = { from: 'eq', key: it.slot };
    G.audio.play('smith');
    writeSave(G.save);
  }

  salvageJunk() {
    const hs = this.hs;
    let g = 0, s = 0, n = 0;
    hs.inv = hs.inv.filter((it) => {
      if (it.rarity > 1) return true;
      const v = salvageValue(it); g += v.gold; s += v.shards; n++;
      return false;
    });
    hs.gold += g; hs.shards += s;
    this.sel = null;
    if (n) { this.say(`Salvaged ${n}: +${g} gold, +${s} shards`, COL.gold); G.audio.play('smith'); }
    else this.say('Nothing Common or Magic to salvage.', COL.dim);
    writeSave(G.save);
  }

  // ------------------------------------------------------------ skills
  drawSkills(ctx) {
    const f = this.frame(ctx, `Skills   (${this.hs.sp} point${this.hs.sp === 1 ? '' : 's'} to spend)`);
    const hs = this.hs, hero = this.hero;
    const rows = [...hero.skills.map((s, i) => ({ s, i })), { s: hero.ult, i: 3 }];
    const rh = Math.floor((f.h - (hero.passive ? 36 : 26)) / 4);
    if (hero.passive) drawText(ctx, `Passive: ${hero.passive.name}. ${hero.passive.desc}`, f.x + 10, f.y + f.h - 12, { color: hero.color });
    rows.forEach(({ s, i }, k) => {
      const y = f.y + 20 + k * rh;
      const x = f.x + 8, w = f.w - 16;
      const unlocked = i === 3 || hs.level >= s.unlock;
      const rank = hs.ranks[i];
      panel(ctx, x, y, w, rh - 3, { fill: unlocked ? '#1a1520' : '#110e13' });
      drawText(ctx, s.name, x + 6, y + 4, { color: unlocked ? hero.color : COL.faint });
      if (i === 3) drawText(ctx, 'ULTIMATE (fills with Ember)', x + 10 + measure(s.name), y + 4, { color: '#ff9a3c' });
      let descW = w - 110;
      if (unlocked) {
        for (let r = 0; r < 5; r++) { ctx.fillStyle = r < rank ? '#ffd24a' : '#3a3040'; ctx.fillRect(x + w - 70 + r * 8, y + 5, 6, 4); }
        const pw = i === 3 ? { dmg: s.dmg * (1 + 0.15 * (rank - 1)), cd: 0 } : skillPower(s, rank);
        const info = (pw.dmg ? `${Math.round(pw.dmg * 100)}% dmg` : '') + (pw.cd ? `  ${pw.cd.toFixed(1)}s cooldown` : '');
        drawText(ctx, info, x + w - 74, y + 15, { align: 'right', color: COL.dim });
        descW = w - 74 - measure(info) - 18;
        if (rank < 5 && button(ctx, x + w - 26, y + 13, 20, 14, '+', { disabled: hs.sp <= 0, color: '#6ad46a' })) {
          hs.sp--; hs.ranks[i]++; G.audio.play('level'); writeSave(G.save);
        }
      } else drawText(ctx, `Unlocks at level ${s.unlock}`, x + w - 6, y + 4, { align: 'right', color: COL.faint });
      wrap(s.desc, descW).slice(0, 2).forEach((ln, j) => drawText(ctx, ln, x + 6, y + 14 + j * 10, { color: unlocked ? COL.text : COL.faint }));
    });
  }

  // ------------------------------------------------------------ smith
  drawSmith(ctx) {
    const f = this.frame(ctx, 'Maud the Smith');
    const hs = this.hs;
    drawText(ctx, 'Enhance worn gear (+10% main stats per level)', f.x + 8, f.y + 20, { color: COL.dim });
    const rh = 22;
    SLOTS.forEach((slot, i) => {
      const it = hs.eq[slot];
      const y = f.y + 32 + i * rh;
      const x = f.x + 8;
      iconFrame(ctx, x, y, 20, it ? it.rarity : -1);
      drawSprite(ctx, ART.icons[slot === 'weapon' ? this.hero.weapon : slot], x + 10, y + 16, { alpha: it ? 1 : 0.25 });
      if (!it) { drawText(ctx, `No ${SLOT_NAMES[slot].toLowerCase()} worn`, x + 26, y + 6, { color: COL.faint }); return; }
      const name = it.name.length > 24 ? it.name.slice(0, 23) + '.' : it.name;
      drawText(ctx, `${name} +${it.enh || 0}`, x + 26, y + 6, { color: RARITY[it.rarity].col });
      if ((it.enh || 0) >= MAX_ENH) { drawText(ctx, 'MAX', f.x + f.w - 12, y + 6, { align: 'right', color: '#ffd24a' }); return; }
      const c = enhanceCost(it);
      const can = hs.gold >= c.gold && hs.shards >= c.shards;
      const bw = 112;
      drawText(ctx, `${c.gold}g  ${c.shards} shards`, f.x + f.w - bw - 14, y + 6, { align: 'right', color: can ? COL.text : COL.faint });
      if (button(ctx, f.x + f.w - bw - 8, y + 2, bw, 16, 'Enhance', { disabled: !can, color: '#ffe0a0' })) {
        hs.gold -= c.gold; hs.shards -= c.shards; it.enh = (it.enh || 0) + 1;
        this.say(`${it.name} is now +${it.enh}`, '#ffd24a');
        G.audio.play('smith'); writeSave(G.save);
      }
    });
    const y = f.y + 32 + 5 * rh + 6;
    const price = 30 + hs.level * 4;
    drawText(ctx, `Healing potions: ${hs.potions}/5`, f.x + 8, y + 5, { color: '#ff8a8a' });
    if (button(ctx, f.x + 150, y, 120, 16, `Buy potion (${price}g)`, { disabled: hs.gold < price || hs.potions >= 5 })) {
      hs.gold -= price; hs.potions++; G.audio.play('potion'); writeSave(G.save);
    }
    drawText(ctx, 'Shards come from salvaging gear in your bag.', f.x + 8, y + 22, { color: COL.faint });
  }

  // ------------------------------------------------------------ bounties
  drawBoard(ctx) {
    const f = this.frame(ctx, 'Bounty Board');
    const hs = this.hs;
    ensureBounties(hs);
    const rh = Math.floor((f.h - 34) / 3);
    hs.bounties.forEach((b, i) => {
      const x = f.x + 8, y = f.y + 20 + i * rh, w = f.w - 16;
      const done = b.have >= b.need;
      panel(ctx, x, y, w, rh - 4, { fill: done ? '#22201a' : '#1a1520', edge: done ? '#ffd24a' : '#3a3040' });
      drawText(ctx, b.text, x + 6, y + 5, { color: done ? '#ffd24a' : COL.text });
      bar(ctx, x + 6, y + 18, 90, 3, b.have / b.need, done ? '#ffd24a' : COL.ember, '#2a1a10');
      drawText(ctx, `${Math.min(b.have, b.need)}/${b.need}`, x + 102, y + 15, { color: COL.dim });
      const rw = b.reward;
      drawText(ctx, `Reward: ${rw.gold}g, ${rw.shards} shards, ${rw.xp} XP, a Rare+ item`, x + 6, y + 26, { color: COL.dim });
      if (done) {
        if (button(ctx, x + w - 66, y + 8, 60, 18, 'Claim', { color: '#ffe0a0' })) this.claimBounty(i);
      } else if (button(ctx, x + w - 66, y + 8, 60, 18, 'Swap 10g', { disabled: hs.gold < 10, color: COL.dim })) {
        hs.gold -= 10; hs.bounties[i] = makeBounty(hs); writeSave(G.save);
      }
    });
    drawText(ctx, 'Bounties count anywhere on the road. Enemies return every time you enter a zone.', f.x + 10, f.y + f.h - 12, { color: COL.faint });
  }

  claimBounty(i) {
    const hs = this.hs, b = hs.bounties[i], rw = b.reward;
    hs.gold += rw.gold; hs.shards += rw.shards;
    const ups = addXp(hs, rw.xp);
    let msg = `+${rw.gold}g  +${rw.shards} shards  +${rw.xp} XP`;
    if (rw.item) {
      const ilvl = STAGES[Math.min(STAGES.length - 1, b.tier)].lvl + 1;
      const it = makeItem({ heroId: hs.id, ilvl, rarity: Math.random() < 0.25 ? 3 : 2 });
      if (hs.inv.length < 30) { hs.inv.push(it); msg += `  +${it.name}`; } else { hs.gold += 60; msg += '  (bag full: +60g)'; }
    }
    if (ups.length) msg += `  LEVEL ${hs.level}!`;
    hs.bounties[i] = makeBounty(hs);
    this.say(msg, '#ffd24a');
    G.audio.play(ups.length ? 'level' : 'loot');
    writeSave(G.save);
  }

  // ------------------------------------------------------------ journal
  drawJournal(ctx) {
    const f = this.frame(ctx, 'Journal: lore pages found on the road');
    const found = G.save.lore || {};
    const rh = Math.floor((f.h - 26) / LORE.length);
    LORE.forEach((l, i) => {
      const x = f.x + 8, y = f.y + 20 + i * rh, w = f.w - 16;
      const has = !!found[l.id];
      panel(ctx, x, y, w, rh - 4, { fill: has ? '#1e1a16' : '#110e13' });
      drawSprite(ctx, ART.icons.page, x + 12, y + rh / 2 + 4, { alpha: has ? 1 : 0.25 });
      drawText(ctx, has ? l.title : `??? (hidden somewhere in ${l.zone})`, x + 26, y + 6, { color: has ? '#e8dcc0' : COL.faint });
      if (has) {
        drawText(ctx, l.lines[0].length > 70 ? l.lines[0].slice(0, 68) + '...' : l.lines[0], x + 26, y + 17, { color: COL.dim });
        if (G.input.tapIn(x, y, w, rh - 4)) {
          G.audio.play('ui');
          this.dialogue = new Dialogue([['narr', l.title.toUpperCase()], ...l.lines.map((t) => ['narr', t])], () => { this.dialogue = null; });
        }
      }
    });
  }

}
