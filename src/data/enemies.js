// Enemy roster for Chapter I (original creatures).
// shield: blocks most damage from the front while its guard is up (flank it, stun it, or use area attacks)
export const ENEMIES = {
  ashling: { name: 'Ashling', hp: 20, atk: 5, def: 0, speed: 72, r: 5, xp: 4, gold: [1, 2], mass: 0.6 },
  hollowed: { name: 'Hollowed', hp: 50, atk: 10, def: 2, speed: 36, r: 6, xp: 8, gold: [1, 4], mass: 1 },
  hound: { name: 'Cinder Hound', hp: 38, atk: 10, def: 1, speed: 62, r: 6, xp: 9, gold: [1, 3], mass: 0.9 },
  wickling: { name: 'Wickling', hp: 32, atk: 9, def: 1, speed: 42, r: 5, xp: 10, gold: [2, 4], mass: 0.8 },
  ashguard: { name: 'Ashguard', hp: 70, atk: 11, def: 4, speed: 30, r: 7, xp: 15, gold: [2, 5], mass: 2.2, shield: true },
  belltoller: { name: 'Belltoller', hp: 150, atk: 17, def: 8, speed: 28, r: 9, xp: 26, gold: [4, 9], mass: 3 },
  stag: { name: 'Old Crown', title: 'The Charcoal Stag', hp: 1300, atk: 17, def: 4, speed: 52, r: 13, xp: 240, gold: [60, 90], mass: 40, boss: true },
  warden: { name: 'The Bellwarden', title: 'Ser Aldren Vey', hp: 3000, atk: 23, def: 8, speed: 36, r: 14, xp: 650, gold: [150, 220], mass: 60, boss: true },
};

export const ELITE_MODS = [
  { id: 'swift', name: 'Swift', col: '#8ec6ff' },
  { id: 'burning', name: 'Burning', col: '#ff8a2a' },
  { id: 'hulking', name: 'Hulking', col: '#c06bff' },
  { id: 'vengeful', name: 'Vengeful', col: '#e0453a' },
];

export function scaleEnemy(def, level) {
  const L = Math.max(1, level);
  return {
    hp: Math.round(def.hp * (1 + 0.34 * (L - 1))),
    atk: def.atk * (1 + 0.26 * (L - 1)),
    def: def.def + 0.7 * (L - 1),
  };
}
