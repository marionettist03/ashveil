// Damage resolution between the hero and enemies.
import { rand, angleTo, angDiff, dist } from '../core/util.js';
import { G } from '../core/G.js';
import { mitigation } from './stats.js';

/** Is point (px,py) with radius pr inside an arc centred at (x,y)? */
export function inArc(px, py, pr, x, y, r, ang, arc) {
  const d = dist(px, py, x, y);
  if (d > r + pr) return false;
  if (arc >= Math.PI * 2 - 0.01 || d < pr) return true;
  return Math.abs(angDiff(ang, angleTo(x, y, px, py))) <= arc / 2 + Math.atan2(pr, Math.max(1, d));
}

/** Is point inside a rotated rectangle starting at (x,y) going len along ang, width w? */
export function inLine(px, py, pr, x, y, ang, len, w) {
  const dx = px - x, dy = py - y;
  const c = Math.cos(ang), s = Math.sin(ang);
  const along = dx * c + dy * s;
  const across = -dx * s + dy * c;
  return along >= -pr && along <= len + pr && Math.abs(across) <= w / 2 + pr;
}

/**
 * Hero damages an enemy. Returns dealt damage (0 if not applicable).
 * o: { kb (knockback px), stun (s), noCrit, src (string), ult, flat, quiet }
 */
export function hitEnemy(S, e, mult, o = {}) {
  if (e.dead || e.spawnT > 0) return 0;
  const p = S.player, st = p.stats;
  const crit = o.forceCrit || (!o.noCrit && Math.random() < st.crit);
  let dmg = (o.flat ?? st.atk * mult) * rand(0.9, 1.1);
  if (crit) dmg *= st.critDmg;
  if (o.ult && st.legs.has('emberCrown')) dmg *= 1.35;
  if (e.vulnerable > 0) dmg *= 1.3;
  // shielded enemies block most damage from the front while their guard is up
  if (e.def.shield && e.guardUp && !o.area && !o.ult) {
    const sx = o.fromX ?? p.x, sy = o.fromY ?? p.y;
    if (Math.abs(angDiff(e.guardAng, angleTo(e.x, e.y, sx, sy))) < 1.15) {
      dmg *= 0.15;
      o = { ...o, kb: 0, stun: 0 };
      if (G.time - (e.lastBlockFx || 0) > 0.35) {
        e.lastBlockFx = G.time;
        S.fx.float(e.x, e.y - e.h - 2, 'BLOCK', '#9aa6b2');
        S.audio.play('smith', { gap: 0.1, vol: 0.6 });
        S.fx.burst(e.x + Math.cos(e.guardAng) * 6, e.y - 9, 4, { col: ['#ffd166', '#ffffff'], smin: 30, smax: 70, g: 0 });
      }
      e.blockedHit = true;
    }
  }
  dmg *= mitigation(e.armor) * 0.85 + 0.15;
  dmg = Math.max(1, Math.round(dmg));
  e.hp -= dmg;
  e.flash = 0.09;
  e.lastHit = S.time;
  // knockback / stun (bosses resist)
  if (o.kb) {
    const a = o.kbAng ?? angleTo(p.x, p.y, e.x, e.y);
    const res = e.boss ? 0.08 : 1 / Math.max(0.6, e.mass);
    e.kbx += Math.cos(a) * o.kb * 6 * res;
    e.kby += Math.sin(a) * o.kb * 6 * res;
  }
  if (o.stun) e.stun = Math.max(e.stun, e.boss ? Math.min(0.25, o.stun * 0.25) : o.stun);
  // feedback
  S.fx.float(e.x, e.y - e.h, crit ? dmg + '!' : String(dmg), crit ? '#ffd24a' : '#ffffff', crit);
  S.hitstop = Math.max(S.hitstop, crit ? 0.055 : 0.03);
  if (!o.quiet) S.audio.play(crit ? 'crit' : 'hit', { gap: 0.04 });
  S.fx.burst(e.x, e.y - e.h / 2, crit ? 6 : 3, { col: e.blood || ['#8a8288', '#5a525a', '#ff8a2a'], smin: 30, smax: 90, lmax: 0.4 });
  // ember + leech
  let gain = 2.2 * st.emberGain;
  if (crit && st.legs.has('starHeart')) gain *= 2;
  if (!o.ult) p.ember = Math.min(100, p.ember + gain);
  const leech = st.leech + (o.basic && p.hero.passive ? p.hero.passive.leech : 0);
  if (leech > 0) p.hp = Math.min(st.maxHp, p.hp + dmg * leech);
  if (e.hp <= 0) S.killEnemy(e);
  return dmg;
}

/** Enemy (or hazard) damages the hero. src: enemy object or null. */
export function hurtPlayer(S, raw, src, o = {}) {
  const p = S.player;
  if (p.dead || p.iframes > 0 || S.godMode) return 0;
  let dmg = raw * mitigation(p.stats.def);
  if (p.bulwark > 0) {
    dmg *= 0.65;
    if (src && !src.dead && src.hp !== undefined) {
      const refl = Math.round(raw * 0.3);
      if (refl > 0) hitEnemy(S, src, 0, { flat: refl, noCrit: true, quiet: true });
    }
  }
  dmg = Math.max(1, Math.round(dmg));
  p.hp -= dmg;
  p.hurtT = 0.25;
  p.iframes = Math.max(p.iframes, o.iframes ?? 0.35);
  S.fx.float(p.x, p.y - 22, '-' + dmg, '#ff5a4a', false);
  S.fx.shake(o.shake ?? 3);
  S.fx.screenFlash(0.18, '#ff2a2a');
  S.audio.play('hurt', { gap: 0.08 });
  S.fx.burst(p.x, p.y - 8, 5, { col: ['#d8343a', '#8d1c22'], smin: 30, smax: 80 });
  S.stats.damageTaken += dmg;
  if (o.kb && src) {
    const a = angleTo(src.x, src.y, p.x, p.y);
    p.kbx += Math.cos(a) * o.kb * 5;
    p.kby += Math.sin(a) * o.kb * 5;
  }
  if (p.hp <= 0) S.playerDied();
  return dmg;
}
