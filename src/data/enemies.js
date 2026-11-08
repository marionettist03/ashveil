// Enemy roster for Chapter I (original creatures). Stats live in data/enemies.json.
// shield: blocks most damage from the front while its guard is up (flank it, stun it, or use area attacks)
import { loadJSON } from '../core/data.js';

const D = await loadJSON('enemies.json');
export const ENEMIES = D.enemies;
export const ELITE_MODS = D.eliteMods;
const SC = D.scaling;

export function scaleEnemy(def, level) {
  const L = Math.max(1, level);
  return {
    hp: Math.round(def.hp * (1 + SC.hpPerLevel * (L - 1))),
    atk: def.atk * (1 + SC.atkPerLevel * (L - 1)),
    def: def.def + SC.defPerLevel * (L - 1),
  };
}
