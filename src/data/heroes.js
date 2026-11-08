// The four playable heroes of Ashveil (original characters).
// Their stats, skills and text live in data/heroes.json; the formulas stay here.
import { loadJSON } from '../core/data.js';

const D = await loadJSON('heroes.json');
export const HERO_ORDER = D.order;
export const HEROES = D.heroes;
export const MAX_LEVEL = D.maxLevel;

/** Damage multiplier and cooldown for a skill at a given rank (1-5). */
export function skillPower(skill, rank) {
  const r = Math.max(1, rank);
  return { dmg: skill.dmg * (1 + 0.15 * (r - 1)), cd: (skill.cd || 0) * (1 - 0.06 * (r - 1)) };
}

export function xpToNext(level) {
  return Math.round(36 * Math.pow(level, 1.78));
}

