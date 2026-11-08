// Save data in the browser's localStorage (this device only).
const KEY = 'ashveil.save.v1';
let memory = null; // fallback when storage is blocked

export const SLOTS = ['weapon', 'helm', 'armor', 'boots', 'charm'];

export function newHeroState(id) {
  return {
    id,
    level: 1,
    xp: 0,
    gold: 0,
    shards: 0,
    potions: 3,
    inv: [],
    eq: { weapon: null, helm: null, armor: null, boots: null, charm: null },
    sp: 0,
    ranks: [1, 0, 0, 1],
    cleared: {}, // stageId -> { stars, nm }
    seen: {}, // story scene ids already shown
    nightmare: false,
    chapterDone: false,
    kills: 0,
    playTime: 0,
  };
}

export function loadSave() {
  let data = null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) data = JSON.parse(raw);
  } catch (e) {
    data = memory;
  }
  if (!data || data.v !== 1) data = { v: 1, settings: { music: true, sfx: true }, last: null, heroes: {} };
  return data;
}

/** onWrite: called after every save (cloud sync hooks in here). */
export const saveHooks = { onWrite: null };

export function writeSave(data, silent = false) {
  memory = data;
  if (!silent && saveHooks.onWrite) saveHooks.onWrite();
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function wipeHero(data, id) {
  delete data.heroes[id];
  writeSave(data);
}
