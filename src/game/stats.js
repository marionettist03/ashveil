// Derive a hero's live stats from level + equipped gear.
import { HEROES } from '../data/heroes.js';
import { enhMult } from '../data/items.js';
import { SLOTS } from '../core/save.js';

export function computeStats(hs) {
  const hero = HEROES[hs.id];
  const b = hero.base;
  const L = hs.level;
  const add = { atk: 0, atkP: 0, crit: 0, critDmg: 0, hp: 0, def: 0, aspd: 0, mspd: 0, cdr: 0, leech: 0, ember: 0, gold: 0 };
  const legs = new Set();
  for (const slot of SLOTS) {
    const it = hs.eq[slot];
    if (!it) continue;
    const m = enhMult(it);
    for (const s of it.main) add[s.id] += s.id === 'mspd' || s.id === 'crit' ? s.v : s.v * m;
    for (const a of it.aff) add[a.id] += a.v;
    if (it.leg) legs.add(it.leg);
  }
  const maxHp = Math.round(b.hp + b.hpL * (L - 1) + add.hp);
  const atk = (b.atk + b.atkL * (L - 1) + add.atk) * (1 + add.atkP / 100);
  const def = b.def + b.defL * (L - 1) + add.def;
  return {
    maxHp,
    atk,
    def,
    crit: Math.min(0.75, b.crit + add.crit / 100),
    critDmg: b.critDmg + add.critDmg / 100,
    atkRate: b.atkRate / (1 + add.aspd / 100),
    speed: b.speed * (1 + Math.min(40, add.mspd) / 100),
    cdrMult: 1 - Math.min(0.4, add.cdr / 100),
    leech: add.leech / 100,
    emberGain: 1 + add.ember / 100,
    goldFind: 1 + add.gold / 100,
    legs,
    power: Math.round(atk * 3 + maxHp * 0.4 + def * 3 + add.crit * 4 + add.critDmg * 0.8 + add.aspd * 3 + add.cdr * 3),
  };
}

/** Damage reduction from defense (diminishing). */
export function mitigation(def) {
  return 100 / (100 + Math.max(0, def) * 3);
}
