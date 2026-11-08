// Gear generation. Names, affixes, legendaries and drop rates live in data/items.json.
import { rand, pick, weighted, uid } from '../core/util.js';
import { RARITY } from '../core/ui.js';
import { loadJSON } from '../core/data.js';

const D = await loadJSON('items.json');
export const SLOT_NAMES = D.slotNames;
const BASES = D.bases;

// affix data -> label + roll functions. A roll is either base + perLevel * item level, or random min..max.
export const AFFIXES = {};
for (const [id, a] of Object.entries(D.affixes)) {
  AFFIXES[id] = {
    prefix: a.prefix,
    label: (v) => a.label.replace('{v}', v),
    roll: a.min !== undefined ? () => rand(a.min, a.max) : (l) => (a.base || 0) + (a.perLevel || 0) * l,
  };
}
const AFFIX_IDS = Object.keys(AFFIXES);
const SUFFIXES = D.suffixes;
export const LEGENDARIES = D.legendaries;
const RARITY_MULT = D.rarityStatMult;
const AFFIX_COUNT = D.affixCount;
const SLOT_WEIGHTS = Object.entries(D.slotWeights);

function mainStats(slot, ilvl, rm) {
  switch (slot) {
    case 'weapon': return [{ id: 'atk', v: Math.round((4 + ilvl * 1.7) * rm * rand(0.9, 1.1)) }];
    case 'helm': return [{ id: 'hp', v: Math.round((10 + ilvl * 5) * rm * rand(0.9, 1.1)) }];
    case 'armor': return [{ id: 'def', v: Math.round((2 + ilvl * 0.9) * rm * rand(0.9, 1.1)) }, { id: 'hp', v: Math.round((5 + ilvl * 2) * rm) }];
    case 'boots': return [{ id: 'def', v: Math.round((1 + ilvl * 0.4) * rm * rand(0.9, 1.1)) }, { id: 'mspd', v: 4 }];
    case 'charm': return [{ id: 'crit', v: Math.round(3 * rm) }];
  }
  return [];
}

function rollAffix(id, ilvl) {
  const a = AFFIXES[id];
  return { id, v: Math.max(1, Math.round(a.roll(ilvl))) };
}

/**
 * Roll a rarity index (0 Common .. 4 Legendary).
 * tier: 0..3 for stages 1-1..1-4 (+2 on Nightmare). Normal enemies never drop Legendary;
 * Epic starts appearing from the second stage. Elites and bosses roll better.
 */
export function rollRarity({ tier = 0, elite = false, boss = false, nm = false } = {}) {
  const t = tier + (nm ? 2 : 0);
  const r = D.dropRates[boss ? 'boss' : elite ? 'elite' : 'normal'];
  const w = r.base.map((b, i) => (t >= r.minTier[i] ? b + r.perTier[i] * t + (nm ? r.nightmare[i] : 0) : 0));
  return weighted(w.map((x, i) => [i, Math.max(0, x)]));
}

export function makeItem({ heroId, ilvl, rarity, slot }) {
  slot = slot || weighted(SLOT_WEIGHTS);
  ilvl = Math.max(1, Math.round(ilvl));
  const tier = Math.min(3, Math.floor((ilvl - 1) / 5));
  const rm = RARITY_MULT[rarity];
  const item = { uid: uid() + '-' + Date.now().toString(36), slot, rarity, ilvl, enh: 0, aff: [], leg: null, legText: null };
  item.main = mainStats(slot, ilvl, rm);
  if (rarity === 4) {
    const pool = [...LEGENDARIES.any];
    if (heroId && LEGENDARIES[heroId]) pool.push(LEGENDARIES[heroId], LEGENDARIES[heroId]);
    let L = pick(pool);
    if (slot && L.slot !== slot) L = pool.find((x) => x.slot === slot) || L;
    item.slot = L.slot;
    item.main = mainStats(L.slot, ilvl, rm);
    item.name = L.name;
    item.leg = L.leg;
    item.legText = L.text;
  }
  const n = AFFIX_COUNT[rarity];
  const ids = AFFIX_IDS.slice().sort(() => Math.random() - 0.5).slice(0, n);
  item.aff = ids.map((id) => rollAffix(id, ilvl));
  if (!item.name) {
    const baseList = item.slot === 'weapon' ? BASES.weapon[heroId] : BASES[item.slot];
    const base = baseList[tier];
    if (rarity === 0) item.name = base;
    else if (rarity === 1) item.name = `${AFFIXES[item.aff[0].id].prefix} ${base}`;
    else item.name = `${AFFIXES[item.aff[0].id].prefix} ${base} ${pick(SUFFIXES)}`;
  }
  return item;
}

export function enhMult(item) { return 1 + 0.1 * (item.enh || 0); }

export function itemLines(item) {
  const lines = [];
  const m = enhMult(item);
  for (const s of item.main) {
    const v = s.id === 'mspd' || s.id === 'crit' ? s.v : Math.round(s.v * m);
    lines.push({ text: AFFIXES[s.id].label(v), col: '#ece4d8' });
  }
  for (const a of item.aff) lines.push({ text: AFFIXES[a.id].label(a.v), col: '#8ec6ff' });
  if (item.legText) lines.push({ text: item.legText, col: RARITY[4].col });
  return lines;
}

export function salvageValue(item) {
  const r = item.rarity;
  return {
    gold: Math.round((4 + item.ilvl * 2) * [1, 2, 4, 8, 15][r]),
    shards: [1, 2, 4, 8, 16][r] + Math.floor(item.ilvl / 6),
  };
}

export function enhanceCost(item) {
  const n = item.enh || 0;
  return {
    gold: Math.round(30 * (n + 1) * (n + 1) * (1 + item.ilvl / 10)),
    shards: 2 + n * 2,
  };
}

export const MAX_ENH = 10;

/** Rough single-number strength of an item, for sorting/compare. */
export function itemScore(item) {
  const w = { atk: 3, atkP: 4, crit: 5, critDmg: 1.5, hp: 0.4, def: 2.5, aspd: 4, mspd: 2, cdr: 4, leech: 8, ember: 1.5, gold: 0.5 };
  let s = 0;
  const m = enhMult(item);
  for (const x of item.main) s += (w[x.id] || 1) * x.v * (x.id === 'mspd' || x.id === 'crit' ? 1 : m);
  for (const x of item.aff) s += (w[x.id] || 1) * x.v;
  if (item.leg) s += 40;
  return Math.round(s);
}
