// Ashveil: boot, resize to a crisp pixel resolution, main loop.
import { G } from './core/G.js';
import { Input } from './core/input.js';
import { Audio } from './core/audio.js';
import { loadSave, writeSave, newHeroState, saveHooks } from './core/save.js';
import { Cloud } from './core/cloud.js';
import { drawText } from './core/font.js';
import { buildArt } from './data/art.js';
import { TitleScene } from './scenes/title.js';
import { CampScene, makeZone } from './scenes/camp.js';
import { xpToNext } from './data/heroes.js';
import { makeItem, itemScore } from './data/items.js';

const canvas = document.getElementById('game');
G.canvas = canvas;
G.ctx = canvas.getContext('2d', { alpha: false });

const safeProbe = document.createElement('div');
safeProbe.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right);';
document.body.appendChild(safeProbe);

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const cssW = window.innerWidth, cssH = window.innerHeight;
  const devW = Math.round(cssW * dpr), devH = Math.round(cssH * dpr);
  G.portrait = cssH > cssW * 1.05;
  const shortSide = Math.min(devW, devH);
  // integer upscale so every game pixel is the same size on screen (~225 px tall)
  const scale = Math.max(1, Math.round(shortSide / 225));
  G.scale = scale;
  G.dpr = dpr;
  G.W = Math.floor(devW / scale);
  G.H = Math.floor(devH / scale);
  canvas.width = G.W;
  canvas.height = G.H;
  canvas.style.width = (G.W * scale) / dpr + 'px';
  canvas.style.height = (G.H * scale) / dpr + 'px';
  canvas.style.left = Math.floor((cssW - (G.W * scale) / dpr) / 2) + 'px';
  canvas.style.top = Math.floor((cssH - (G.H * scale) / dpr) / 2) + 'px';
  const cs = getComputedStyle(safeProbe);
  const toInternal = (v) => Math.ceil(((parseFloat(v) || 0) * dpr) / scale);
  G.safeL = Math.min(40, toInternal(cs.paddingLeft));
  G.safeR = Math.min(40, toInternal(cs.paddingRight));
  G.ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();

// ---------------------------------------------------------------- systems
G.save = loadSave();
G.save.settings.joy = G.save.settings.joy || 'fixed';
G.save.settings.controls = G.save.settings.controls || 'auto';
G.audio = new Audio();
G.audio.sfxOn = G.save.settings.sfx;
G.audio.musicOn = G.save.settings.music;
G.input = new Input(canvas);
buildArt();

const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
// start with touch controls on phones/tablets, keyboard hints on computers; it then follows what you use
G.inputMode = coarse || navigator.maxTouchPoints > 0 && !window.matchMedia('(pointer: fine)').matches ? 'touch' : 'keys';
let triedFs = false;
G.requestFullscreen = () => {
  if (!coarse) return;
  const standalone = window.matchMedia('(display-mode: fullscreen)').matches || window.matchMedia('(display-mode: standalone)').matches;
  const lock = () => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* unsupported */ } };
  if (standalone || document.fullscreenElement) { lock(); return; }
  const el = document.documentElement;
  if (el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).then(lock).catch(() => {});
};
G.input.onFirstGesture = () => {
  G.audio.unlock();
  if (!triedFs) { triedFs = true; G.requestFullscreen(); }
};

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (G.scene && G.scene.pause) G.scene.pause();
    if (G.audio.ctx) G.audio.ctx.suspend();
    writeSave(G.save);
  } else if (G.audio.ctx) G.audio.ctx.resume();
});
window.addEventListener('pagehide', () => writeSave(G.save));

// ---------------------------------------------------------------- test / debug entry points
const params = new URLSearchParams(location.search);
G.debug = params.has('debug');
G.autoplay = params.has('autoplay') ? (params.get('autoplay') || true) : false;
window.__G = G;
if (G.debug) window.__dbg = { itemScore, makeItem };

function bootScene() {
  const heroId = params.get('hero');
  if (G.debug && heroId) {
    if (!G.save.heroes[heroId] || params.has('fresh')) G.save.heroes[heroId] = newHeroState(heroId);
    const hs = G.save.heroes[heroId];
    if (params.has('lvl')) {
      hs.level = +params.get('lvl'); hs.xp = 0;
      hs.ranks = hs.ranks.map((r, i) => (i === 3 ? Math.max(1, r) : Math.max(r, [1, 3, 5][i] <= hs.level ? 1 : 0)));
    }
    hs.seen.camp = true;
    if (params.has('loot')) for (let i = 0; i < 14; i++) hs.inv.push(makeItem({ heroId, ilvl: hs.level, rarity: i % 5 }));
    if (params.has('gear')) {
      const r = +params.get('gear') || 2;
      for (const slot of ['weapon', 'helm', 'armor', 'boots', 'charm']) hs.eq[slot] = makeItem({ heroId: heroId, ilvl: hs.level, rarity: r, slot });
    }
    if (params.has('seen')) { G.save.lore = { almanac: 1, waymarker: 1, rite: 1, watchlog: 1 }; for (const k of ['c1', 'c2', 'c3']) hs.seen[k] = true; }
    if (params.has('cleared')) for (let i = 0; i < +params.get('cleared'); i++) hs.cleared[['1-1', '1-2', '1-3', '1-4'][i]] = { stars: 1 };
    if (params.has('seen')) for (const k of ['intro', 's1_start', 's1_mid', 's1_end', 's2_start', 's2_boss', 's2_end', 's3_start', 's3_mid', 's3_end', 's4_start', 's4_boss', 's4_phase', 's4_end']) hs.seen[k] = true;
    G.save.last = heroId;
    if (params.has('stage')) {
      const st = makeZone(hs, +params.get('stage'), params.has('nm'), params.get('entry') || 'west');
      if (params.has('god')) st.godMode = true;
      if (params.has('ember')) st.player.ember = 100;
      return st;
    }
    return new CampScene(hs, {});
  }
  return new TitleScene();
}
G.setScene(bootScene());

// cloud save (only when served by an Ashveil server, see server.py)
saveHooks.onWrite = () => Cloud.noteWrite();
G.onSaveReplaced = () => G.setScene(new TitleScene());
if (!G.autoplay) Cloud.init();

// ---------------------------------------------------------------- loop
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05;
  if (dt < 0) dt = 0;
  const steps = G.speed || 1; // test hook: run the simulation faster
  const ctx = G.ctx;
  ctx.imageSmoothingEnabled = false;
  if (G.portrait) {
    ctx.fillStyle = '#0d0a10';
    ctx.fillRect(0, 0, G.W, G.H);
    drawText(ctx, 'Please turn your phone', G.W / 2, G.H / 2 - 14, { align: 'center', color: '#c89458' });
    drawText(ctx, 'sideways (landscape)', G.W / 2, G.H / 2, { align: 'center', color: '#c89458' });
    G.input.endFrame();
    return;
  }
  try {
    for (let i = 0; i < steps; i++) {
      G.dt = dt;
      G.time += dt;
      G.frame++;
      G.scene.update(dt);
    }
    G.scene.draw(ctx);
  } catch (err) {
    console.error(err);
    G.lastError = String(err && err.stack || err);
  }
  G.input.endFrame();
}
requestAnimationFrame(frame);

// offline support when served over https (e.g. GitHub Pages)
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

export { xpToNext };
