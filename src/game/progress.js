// Experience gained outside a stage (bounty rewards). Returns the levels reached.
import { HEROES, xpToNext, MAX_LEVEL } from '../data/heroes.js';

export function addXp(hs, n) {
  const ups = [];
  if (hs.level >= MAX_LEVEL) return ups;
  hs.xp += n;
  while (hs.level < MAX_LEVEL && hs.xp >= xpToNext(hs.level)) {
    hs.xp -= xpToNext(hs.level);
    hs.level++;
    hs.sp++;
    HEROES[hs.id].skills.forEach((sk, i) => { if (hs.level >= sk.unlock && hs.ranks[i] === 0) hs.ranks[i] = 1; });
    ups.push(hs.level);
  }
  if (hs.level >= MAX_LEVEL) hs.xp = 0;
  return ups;
}
