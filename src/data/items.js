// Gear: bases, affixes, legendaries and random generation.
import { rand, pick, weighted, uid } from '../core/util.js';
import { RARITY } from '../core/ui.js';

export const SLOT_NAMES = { weapon: 'Weapon', helm: 'Helm', armor: 'Armor', boots: 'Boots', charm: 'Charm' };

const BASES = {
  weapon: {
    kes: ['Rusted Shivs', 'Twin Fangs', 'Kestrel Talons', 'Ashsteel Pair'],
    brannoc: ['Iron Maul', 'Oathhammer', 'Watchman\'s Maul', 'Ashforged Maul'],
    odalys: ['Ashwood Staff', 'Censer Rod', 'Ember Scepter', 'Starglass Staff'],
    hale: ['Hunting Bow', 'Yew Longbow', 'Thornstring Bow', 'Greatwood Bow'],
  },
  helm: ['Leather Cap', 'Iron Coif', 'Ashen Helm', 'Warden\'s Visor'],
  armor: ['Padded Jerkin', 'Chain Shirt', 'Ashplate', 'Oathbound Mail'],
  boots: ['Worn Boots', 'Hunter\'s Boots', 'Iron Greaves', 'Ashwalkers'],
  charm: ['Copper Ring', 'Bone Charm', 'Ember Signet', 'Starglass Pendant'],
};

export const AFFIXES = {
  atk: { label: (v) => `+${v} Attack`, roll: (l) => 2 + l * 0.8, int: true, prefix: 'Brutal' },
  atkP: { label: (v) => `+${v}% Attack`, roll: () => rand(4, 10), prefix: 'Fierce' },
  crit: { label: (v) => `+${v}% Crit chance`, roll: () => rand(2, 6), prefix: 'Keen' },
  critDmg: { label: (v) => `+${v}% Crit damage`, roll: () => rand(10, 30), prefix: 'Cruel' },
  hp: { label: (v) => `+${v} Max HP`, roll: (l) => 8 + l * 4, int: true, prefix: 'Stout' },
  def: { label: (v) => `+${v} Defense`, roll: (l) => 1 + l * 0.6, int: true, prefix: 'Warded' },
  aspd: { label: (v) => `+${v}% Attack speed`, roll: () => rand(4, 10), prefix: 'Swift' },
  mspd: { label: (v) => `+${v}% Move speed`, roll: () => rand(3, 8), prefix: 'Fleet' },
  cdr: { label: (v) => `-${v}% Cooldowns`, roll: () => rand(3, 8), prefix: 'Tireless' },
  leech: { label: (v) => `${v}% Life steal`, roll: () => rand(1, 3), prefix: 'Thirsting' },
  ember: { label: (v) => `+${v}% Ember gain`, roll: () => rand(8, 20), prefix: 'Smoldering' },
  gold: { label: (v) => `+${v}% Gold found`, roll: () => rand(10, 30), prefix: 'Gilded' },
};
const AFFIX_IDS = Object.keys(AFFIXES);
const SUFFIXES = ['of the Owl', 'of Embers', 'of the Vigil', 'of Greyhollow', 'of the Hearth', 'of Ash', 'of the Stag', 'of Dusk', 'of the Road'];

export const LEGENDARIES = {
  kes: { slot: 'weapon', name: 'Wrenfeather Blades', leg: 'featherKnives', text: 'Feather Step leaves a ring of knives behind you.' },
  brannoc: { slot: 'weapon', name: 'Aldren\'s Oath', leg: 'doubleSlam', text: 'Oathbreaker strikes the ground twice.' },
  odalys: { slot: 'weapon', name: 'The Unlit Censer', leg: 'moreOrbs', text: 'Ashen Orbs summons two extra orbs.' },
  hale: { slot: 'weapon', name: 'Old Crown\'s Antler', leg: 'splitArrow', text: 'Every 4th arrow splits into three.' },
  any: [
    { slot: 'charm', name: 'Heart of the Cinder Star', leg: 'starHeart', text: 'Critical hits build double Ember.' },
    { slot: 'boots', name: 'Ashwalker Treads', leg: 'ashTrail', text: 'Dodging leaves a trail of burning ash.' },
    { slot: 'helm', name: 'Crown of Embers', leg: 'emberCrown', text: 'Your Ultimate deals 35% more damage.' },
    { slot: 'armor', name: 'Hearthmail of Greyhollow', leg: 'hearth', text: 'Potions heal 50% more.' },
  ],
};

const RARITY_MULT = [1, 1.15, 1.32, 1.52, 1.8];
const AFFIX_COUNT = [0, 1, 2, 3, 3];

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
  let v = a.roll(ilvl);
  v = a.int ? Math.max(1, Math.round(v)) : Math.max(1, Math.round(v));
  return { id, v };
}

/**
 * Roll a rarity index (0 Common .. 4 Legendary).
 * tier: 0..3 for stages 1-1..1-4 (+2 on Nightmare). Normal enemies never drop Legendary;
 * Epic starts appearing from the second stage. Elites and bosses roll better.
 */
export function rollRarity({ tier = 0, elite = false, boss = false, nm = false } = {}) {
  const t = tier + (nm ? 2 : 0);
  let w;
  if (boss) w = [0, 0, 72 - t * 4, 25 + t * 3, 2.5 + t * 1.5];
  else if (elite) w = [15, 55, 24 + t * 2, t >= 1 ? 4 + t * 2 : 0, nm ? 1 : 0];
  else w = [64, 29, 6 + t * 1.5, t >= 1 ? 0.6 + t * 0.6 : 0, nm ? 0.15 : 0];
  return weighted(w.map((x, i) => [i, Math.max(0, x)]));
}

export function makeItem({ heroId, ilvl, rarity, slot }) {
  slot = slot || weighted([['weapon', 26], ['helm', 18], ['armor', 20], ['boots', 18], ['charm', 18]]);
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
