// Enemy roster for Chapter I (original creatures).
export const ENEMIES = {
  ashling: { name: 'Ashling', hp: 16, atk: 4, def: 0, speed: 70, r: 5, xp: 4, gold: [1, 2], mass: 0.6 },
  hollowed: { name: 'Hollowed', hp: 40, atk: 7, def: 2, speed: 34, r: 6, xp: 8, gold: [1, 4], mass: 1 },
  hound: { name: 'Cinder Hound', hp: 30, atk: 8, def: 1, speed: 60, r: 6, xp: 9, gold: [1, 3], mass: 0.9 },
  wickling: { name: 'Wickling', hp: 26, atk: 7, def: 1, speed: 40, r: 5, xp: 10, gold: [2, 4], mass: 0.8 },
  belltoller: { name: 'Belltoller', hp: 120, atk: 13, def: 6, speed: 28, r: 9, xp: 26, gold: [4, 9], mass: 3 },
  stag: { name: 'Old Crown', title: 'The Charcoal Stag', hp: 1000, atk: 14, def: 4, speed: 50, r: 13, xp: 240, gold: [60, 90], mass: 40, boss: true },
  warden: { name: 'The Bellwarden', title: 'Ser Aldren Vey', hp: 2100, atk: 15, def: 8, speed: 34, r: 14, xp: 650, gold: [150, 220], mass: 60, boss: true },
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
    hp: Math.round(def.hp * (1 + 0.32 * (L - 1))),
    atk: def.atk * (1 + 0.18 * (L - 1)),
    def: def.def + 0.6 * (L - 1),
  };
}
