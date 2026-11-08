// Repeatable bounties posted at Greyhollow Hearth: reasons to walk old roads again.
import { pick, chance, uid } from '../core/util.js';
import { STAGES } from './stages.js';
import { ENEMIES } from './enemies.js';
import { xpToNext } from './heroes.js';

const KILL_COUNT = { ashling: 30, hollowed: 20, hound: 15, wickling: 12, ashguard: 8, belltoller: 4 };

function reachable(hs) {
  return STAGES.filter((s, i) => i === 0 || hs.cleared[STAGES[i - 1].id]);
}

export function makeBounty(hs) {
  const open = reachable(hs);
  const tier = open.length - 1;
  const types = new Set();
  for (const s of open) for (const a of s.arenas) for (const w of a.waves) for (const [t] of w) types.add(t);
  const opts = ['kill', 'kill', 'kill', 'elite'];
  if (hs.cleared['1-2']) opts.push('boss');
  if (Object.keys(hs.cleared).length) opts.push('clean');
  const kind = pick(opts);
  let b;
  if (kind === 'kill') {
    const t = pick([...types]);
    const need = Math.round(KILL_COUNT[t] * (1 + tier * 0.15));
    b = { kind, target: t, need, text: `Slay ${need} ${ENEMIES[t].name}${need > 1 && !t.endsWith('s') ? 's' : ''}` };
  } else if (kind === 'elite') {
    const need = 2 + tier;
    b = { kind, need, text: `Hunt ${need} elite enemies` };
  } else if (kind === 'boss') {
    const t = hs.cleared['1-4'] && chance(0.5) ? 'warden' : 'stag';
    b = { kind, target: t, need: 1, text: `Defeat ${ENEMIES[t].name} again` };
  } else {
    const s = pick(STAGES.filter((x) => hs.cleared[x.id]));
    b = { kind, target: s.id, need: 1, text: `Clear ${s.id} ${s.name} without falling` };
  }
  b.id = uid() + '-' + Date.now().toString(36);
  b.have = 0;
  b.tier = tier;
  b.reward = {
    gold: Math.round(50 * (tier + 1) * (kind === 'boss' ? 2 : 1)),
    shards: 3 * (tier + 1),
    xp: Math.round(xpToNext(hs.level) * (kind === 'boss' ? 0.35 : 0.2)),
    item: true,
  };
  return b;
}

export function ensureBounties(hs) {
  if (!hs.bounties) hs.bounties = [];
  while (hs.bounties.length < 3) hs.bounties.push(makeBounty(hs));
}

/** ev: { kind: 'kill', enemy, elite, boss } | { kind: 'clear', zone, deaths } */
export function trackBounty(hs, ev) {
  if (!hs.bounties) return null;
  let done = null;
  for (const b of hs.bounties) {
    if (b.have >= b.need) continue;
    let hit = false;
    if (ev.kind === 'kill') {
      if (b.kind === 'kill' && ev.enemy === b.target) hit = true;
      if (b.kind === 'elite' && ev.elite) hit = true;
      if (b.kind === 'boss' && ev.enemy === b.target) hit = true;
    } else if (ev.kind === 'clear' && b.kind === 'clean' && ev.zone === b.target && ev.deaths === 0) hit = true;
    if (hit) { b.have++; if (b.have >= b.need) done = b; }
  }
  return done;
}
