// The four playable heroes of Ashveil (original characters).
export const HERO_ORDER = ['kes', 'brannoc', 'odalys', 'hale'];

export const HEROES = {
  kes: {
    id: 'kes',
    name: 'Kes Vane',
    title: 'The Ashen Kestrel',
    role: 'Twin blades',
    style: 'Fastest hero. Rapid combos, dashes through enemies.',
    blurb: 'A courier from Greyhollow, quick with a blade and quicker on his feet. His little sister walked into the ash at the last toll.',
    color: '#35b8a8',
    weapon: 'blades',
    ranged: false,
    difficulty: 2,
    base: { hp: 100, hpL: 12, atk: 10, atkL: 2.2, def: 2, defL: 0.5, crit: 0.1, critDmg: 1.6, speed: 82, atkRate: 0.22 },
    dodgeCd: 0.7,
    skills: [
      { id: 'feather', name: 'Feather Step', cd: 5, unlock: 1, dmg: 1.8, desc: 'Dash forward, cutting every enemy you pass through.' },
      { id: 'fan', name: 'Knife Fan', cd: 7, unlock: 3, dmg: 0.9, desc: 'Throw five knives in a wide fan.' },
      { id: 'whirl', name: 'Whirling Ash', cd: 10, unlock: 5, dmg: 0.55, desc: 'Spin for 1.4s, slicing all around you. You can move while spinning.' },
    ],
    ult: { id: 'hundred', name: 'Hundred Cuts', dmg: 1.3, desc: 'Blink between up to 8 nearby enemies, striking each three times. You cannot be hit.' },
  },
  brannoc: {
    id: 'brannoc',
    name: 'Brannoc',
    title: 'The Iron Oath',
    role: 'Greathammer',
    style: 'Toughest hero. Slow, huge swings that stun.',
    blurb: 'An old soldier of fallen Lumenhold who has walked the roads for seven years. He knows the voice of that bell. He left its keeper behind.',
    color: '#d8434a',
    weapon: 'maul',
    ranged: false,
    difficulty: 1,
    base: { hp: 160, hpL: 18, atk: 13, atkL: 2.6, def: 6, defL: 0.9, crit: 0.05, critDmg: 1.7, speed: 70, atkRate: 0.42 },
    dodgeCd: 1.1,
    skills: [
      { id: 'oathbreaker', name: 'Oathbreaker', cd: 6, unlock: 1, dmg: 2.2, desc: 'Leap to the nearest enemy and slam the ground, stunning everything nearby.' },
      { id: 'bulwark', name: 'Bulwark', cd: 12, unlock: 3, dmg: 0, desc: 'For 4s take half damage and reflect 40% of it. Heals 12% HP.' },
      { id: 'chain', name: 'Chain of Penance', cd: 8, unlock: 5, dmg: 1.5, desc: 'Hurl a chain that drags enemies in a line toward you.' },
    ],
    ult: { id: 'fall', name: 'Fall of Lumenhold', dmg: 2.5, desc: 'Three crushing shockwaves roll out from you.' },
  },
  odalys: {
    id: 'odalys',
    name: 'Odalys Fen',
    title: 'The Ash-Witch',
    role: 'Ember staff',
    style: 'Glass cannon. Fire magic from range, big area damage.',
    blurb: 'Once an acolyte of the hill chapel, cast out for listening to the ash. Now the ash is singing with the bell, and she alone can hear the words.',
    color: '#ff9a3c',
    weapon: 'staff',
    ranged: true,
    difficulty: 3,
    base: { hp: 85, hpL: 10, atk: 12, atkL: 2.5, def: 1, defL: 0.4, crit: 0.08, critDmg: 1.6, speed: 74, atkRate: 0.32 },
    dodgeCd: 0.9,
    skills: [
      { id: 'nova', name: 'Cinder Nova', cd: 6, unlock: 1, dmg: 1.7, desc: 'Burst of fire around you that hurls enemies back.' },
      { id: 'pyre', name: 'Pyre Line', cd: 8, unlock: 3, dmg: 0.4, desc: 'Draw a line of fire that burns for 3s.' },
      { id: 'orbs', name: 'Ashen Orbs', cd: 12, unlock: 5, dmg: 0.8, desc: 'Three burning orbs circle you for 6s.' },
    ],
    ult: { id: 'star', name: 'Falling Star', dmg: 6, desc: 'Call down a burning star on the largest group of enemies.' },
  },
  hale: {
    id: 'hale',
    name: 'Hale Morrow',
    title: 'Warden of the Ashwood',
    role: 'Longbow',
    style: 'Agile archer. Keeps her distance, traps and volleys.',
    blurb: 'The last hunter of the Ashwood. Last night she saw the forest\'s ancient stag walking toward the bell with fire in its eyes.',
    color: '#8a9a5e',
    weapon: 'bow',
    ranged: true,
    difficulty: 2,
    base: { hp: 95, hpL: 11, atk: 11, atkL: 2.4, def: 2, defL: 0.5, crit: 0.12, critDmg: 1.6, speed: 84, atkRate: 0.28 },
    dodgeCd: 0.8,
    skills: [
      { id: 'tumble', name: 'Tumble Shot', cd: 5, unlock: 1, dmg: 1.0, desc: 'Roll backwards and loose three arrows.' },
      { id: 'snare', name: 'Thorn Snare', cd: 9, unlock: 3, dmg: 0.3, desc: 'Plant a trap that roots enemies in place and pierces them.' },
      { id: 'rain', name: 'Rain of Thorns', cd: 10, unlock: 5, dmg: 0.75, desc: 'Arrows fall on the nearest group of enemies.' },
    ],
    ult: { id: 'gale', name: 'Heartwood Gale', dmg: 5, desc: 'A piercing gale-arrow that blasts through everything in a line.' },
  },
};

/** Damage multiplier and cooldown for a skill at a given rank (1-5). */
export function skillPower(skill, rank) {
  const r = Math.max(1, rank);
  return { dmg: skill.dmg * (1 + 0.15 * (r - 1)), cd: (skill.cd || 0) * (1 - 0.06 * (r - 1)) };
}

export function xpToNext(level) {
  return Math.round(30 * Math.pow(level, 1.6));
}

export const MAX_LEVEL = 40;
