// Checks the editable game data in data/*.json for typos and broken links between files.
// Run after editing:  node tools/check-data.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const problems = [];
const bad = (file, msg) => problems.push(`data/${file}: ${msg}`);

function load(name) {
  const text = readFileSync(join(root, 'data', name), 'utf8');
  try { return JSON.parse(text); } catch (e) {
    const m = /position (\d+)/.exec(e.message);
    const line = m ? ` (line ${text.slice(0, +m[1]).split('\n').length})` : '';
    bad(name, `not valid JSON${line}: ${e.message}`);
    return null;
  }
}

const heroes = load('heroes.json'), enemies = load('enemies.json'), stages = load('stages.json');
const story = load('story.json'), lore = load('lore.json'), items = load('items.json');
for (const f of readdirSync(join(root, 'data'))) if (f.endsWith('.json') && !['heroes.json', 'enemies.json', 'stages.json', 'story.json', 'lore.json', 'items.json'].includes(f)) bad(f, 'unknown file (the game does not read it)');

const num = (v) => typeof v === 'number' && Number.isFinite(v);
// skills and ultimates the game knows how to perform (src/game/player.js)
const player = readFileSync(join(root, 'src/game/player.js'), 'utf8');
const knownSkills = new Set([...player.matchAll(/case '([a-z]+)'/g)].map((m) => m[1]));
const knownUlts = new Set([...player.matchAll(/id === '([a-z]+)'/g)].map((m) => m[1]));

if (heroes) {
  for (const id of heroes.order) if (!heroes.heroes[id]) bad('heroes.json', `order lists "${id}" but there is no hero with that id`);
  for (const [id, h] of Object.entries(heroes.heroes)) {
    if (h.id !== id) bad('heroes.json', `hero "${id}" has id "${h.id}" (they must match)`);
    for (const k of ['hp', 'hpL', 'atk', 'atkL', 'def', 'defL', 'crit', 'critDmg', 'speed', 'atkRate']) if (!num(h.base[k])) bad('heroes.json', `${id}.base.${k} must be a number`);
    if (!Array.isArray(h.skills) || h.skills.length !== 3) bad('heroes.json', `${id} needs exactly 3 skills`);
    for (const s of h.skills || []) {
      if (!knownSkills.has(s.id)) bad('heroes.json', `${id} skill "${s.id}" is not a skill the game knows (${[...knownSkills].join(', ')})`);
      if (!num(s.cd) || !num(s.dmg) || !num(s.unlock)) bad('heroes.json', `${id} skill "${s.id}" needs numbers for cd, dmg and unlock`);
    }
    if (!knownUlts.has(h.ult.id)) bad('heroes.json', `${id} ultimate "${h.ult.id}" is not one the game knows`);
  }
}
if (enemies) {
  for (const [id, e] of Object.entries(enemies.enemies)) for (const k of ['hp', 'atk', 'def', 'speed', 'r', 'xp', 'mass']) if (!num(e[k])) bad('enemies.json', `${id}.${k} must be a number`);
}
if (stages && enemies) {
  for (const st of stages.stages) {
    if (!stages.themes[st.theme]) bad('stages.json', `${st.id} uses theme "${st.theme}" which does not exist`);
    st.arenas.forEach((a, i) => {
      if (a.boss && !(enemies.enemies[a.boss] && enemies.enemies[a.boss].boss)) bad('stages.json', `${st.id} arena ${i + 1}: boss "${a.boss}" is not a boss in enemies.json`);
      for (const wave of a.waves) for (const [type, count, flag] of wave) {
        if (!enemies.enemies[type]) bad('stages.json', `${st.id} arena ${i + 1}: unknown enemy "${type}"`);
        if (!num(count) || count < 1) bad('stages.json', `${st.id} arena ${i + 1}: "${type}" needs a count of 1 or more`);
        if (flag && flag !== 'elite') bad('stages.json', `${st.id} arena ${i + 1}: unknown flag "${flag}" (only "elite")`);
      }
    });
  }
}
if (story && stages && heroes) {
  const keys = new Set();
  for (const st of stages.stages) { if (st.end) keys.add(st.end); for (const a of st.arenas) if (a.story) keys.add(a.story); }
  ['intro', 'c1', 'c2', 'c3'].forEach((k) => keys.add(k));
  for (const id of heroes.order) {
    const sc = story.scenes[id];
    if (!sc) { bad('story.json', `no scenes for hero "${id}"`); continue; }
    for (const k of keys) if (!sc[k]) bad('story.json', `${id} is missing scene "${k}" (used by stages.json or the hearth)`);
  }
  const lines = [...Object.values(story.scenes).flatMap((s) => Object.values(s).flat()), ...story.prologue, ...story.campFirst, ...story.chapterEnd];
  for (const l of lines) {
    if (l === '@prologue') continue;
    if (!Array.isArray(l) || l.length !== 2 || typeof l[1] !== 'string') { bad('story.json', `a line must look like ["speaker", "text"]: ${JSON.stringify(l)}`); continue; }
    if (!story.speakers[l[0]]) bad('story.json', `unknown speaker "${l[0]}" in: ${l[1].slice(0, 50)}`);
  }
}
if (lore && stages) for (const p of lore.pages) if (!stages.stages.some((s) => s.id === p.zone)) bad('lore.json', `page "${p.id}" is in zone "${p.zone}" which does not exist`);
if (items) {
  for (const [id, a] of Object.entries(items.affixes)) {
    if (!a.label.includes('{v}')) bad('items.json', `affix "${id}" label needs {v} where the number goes`);
    if (!(num(a.min) && num(a.max)) && !num(a.base)) bad('items.json', `affix "${id}" needs either min+max or base(+perLevel)`);
  }
  for (const [k, r] of Object.entries(items.dropRates)) for (const f of ['base', 'perTier', 'minTier', 'nightmare']) if (!Array.isArray(r[f]) || r[f].length !== 5) bad('items.json', `dropRates.${k}.${f} needs 5 numbers (Common, Magic, Rare, Epic, Legendary)`);
  if (heroes) for (const id of heroes.order) if (!items.bases.weapon[id]) bad('items.json', `bases.weapon has no weapon names for "${id}"`);
}

if (problems.length) {
  console.log(`Found ${problems.length} problem(s):\n` + problems.map((p) => ' - ' + p).join('\n'));
  process.exit(1);
}
console.log('data OK: heroes, enemies, stages, story, lore, items');
