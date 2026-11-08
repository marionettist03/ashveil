// Cloud save: keeps one save per account on a self-hosted Ashveil server (server.py).
// Only works when the game is opened from that server; on any other host it stays hidden.
import { G } from './G.js';
import { writeSave } from './save.js';

const CRED_KEY = 'ashveil.cloud.v1';

function readCred() {
  try { return JSON.parse(localStorage.getItem(CRED_KEY) || 'null'); } catch (e) { return null; }
}
function storeCred(c) {
  try { if (c) localStorage.setItem(CRED_KEY, JSON.stringify(c)); else localStorage.removeItem(CRED_KEY); } catch (e) { /* storage blocked */ }
}

async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch('api/' + path, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store', signal: ctl.signal });
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    return { status: res.status, data: data || {} };
  } catch (e) {
    return { status: 0, data: { error: 'offline' } };
  } finally { clearTimeout(timer); }
}

/** A short description of a save, e.g. "Kes Lv12, Brannoc Lv3". */
export function describeSave(save) {
  if (!save || !save.heroes) return 'empty';
  const names = { kes: 'Kes', brannoc: 'Brannoc', odalys: 'Odalys', hale: 'Hale' };
  const list = Object.values(save.heroes).filter(Boolean).sort((a, b) => b.level - a.level).map((h) => `${names[h.id] || h.id} Lv${h.level}`);
  return list.length ? list.join(', ') : 'empty';
}
export function ago(ms) {
  if (!ms) return '';
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 90) return 'just now';
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 129600) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}
/** Fingerprint of a save (FNV-1a), so re-saving identical data doesn't count as a change. */
function hashSave(save) {
  const str = JSON.stringify(save);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16);
}
const isEmpty = (save) => !save || !save.heroes || Object.keys(save.heroes).length === 0;

export const Cloud = {
  available: false, // this page was served by an Ashveil server with cloud saves
  cred: null, // { name, token, rev, dirty }
  state: 'idle', // idle | syncing | ok | offline | conflict | error
  msg: '',
  conflict: null, // { save, rev, updatedAt } waiting for the player to choose
  lastSync: 0,
  _timer: null,

  async init() {
    const r = await api('GET', 'ping');
    this.available = r.status === 200 && r.data.app === 'ashveil';
    if (!this.available) return;
    this.cred = readCred();
    if (this.cred) await this.check();
  },

  get signedIn() { return !!(this.cred && this.cred.token); },

  /** Compare with the server. On boot a newer server save loads by itself if this device has nothing unsynced. */
  async check() {
    if (!this.signedIn) return;
    this.state = 'syncing';
    const r = await api('GET', 'save', null, this.cred.token);
    if (r.status === 401) { this.signOutLocal('Signed out: please sign in again'); return; }
    if (r.status !== 200) { this.state = 'offline'; this.msg = 'Server not reachable'; return; }
    const d = r.data;
    if (this.cred.dirty && hashSave(G.save) === this.cred.h) { this.cred.dirty = false; storeCred(this.cred); }
    if (d.rev === this.cred.rev) { this.state = 'ok'; this.lastSync = Date.now(); if (this.cred.dirty) this.push(); return; }
    if (!d.save) { this.push(true); return; }
    // nothing unsynced here and we're still on the title screen: just take the newer copy
    if ((!this.cred.dirty || isEmpty(G.save)) && G.scene && G.scene.isMenu) { this.apply(d); return; }
    this.conflict = d; this.state = 'conflict';
    this.msg = 'The server has a newer save from another device';
  },

  /** Replace this device's save with the server copy and restart at the title screen. */
  apply(d) {
    G.save = d.save;
    G.save.settings = Object.assign({ music: true, sfx: true, joy: 'fixed', controls: 'auto' }, d.save.settings || {});
    writeSave(G.save, true);
    this.cred.rev = d.rev; this.cred.dirty = false; this.cred.h = hashSave(G.save); storeCred(this.cred);
    this.conflict = null; this.state = 'ok'; this.lastSync = Date.now();
    this.msg = 'Loaded your save from the server';
    if (G.onSaveReplaced) G.onSaveReplaced();
  },

  async signIn(name, password, create) {
    const r = await api('POST', create ? 'register' : 'login', { name, password });
    if (r.status !== 200) return { ok: false, error: r.data.error || (r.status === 0 ? 'Server not reachable' : 'Sign-in failed') };
    this.cred = { name: r.data.name, token: r.data.token, rev: -1, dirty: !isEmpty(G.save) };
    storeCred(this.cred);
    const s = await api('GET', 'save', null, this.cred.token);
    if (s.status === 200 && s.data.save) {
      if (isEmpty(G.save)) this.apply(s.data);
      else { this.conflict = s.data; this.state = 'conflict'; this.msg = 'This account already has a save'; }
    } else {
      this.cred.rev = s.status === 200 ? s.data.rev : 0;
      await this.push(true);
    }
    return { ok: true };
  },

  async signOut() {
    if (this.signedIn) await api('POST', 'logout', {}, this.cred.token);
    this.signOutLocal('Signed out');
  },
  signOutLocal(msg) {
    this.cred = null; storeCred(null); this.conflict = null; this.state = 'idle'; this.msg = msg || '';
  },

  /** Called after every local save: mark it unsynced and upload a few seconds later. */
  noteWrite() {
    if (!this.signedIn) return;
    if (!this.cred.dirty) {
      if (hashSave(G.save) === this.cred.h) return; // nothing actually changed
      this.cred.dirty = true; storeCred(this.cred);
    }
    if (this.state === 'conflict') return;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.push(), 4000);
  },

  noteWriteLater() { clearTimeout(this._timer); this._timer = setTimeout(() => this.push(), 4000); },

  /** Upload. force = overwrite the server copy even if another device saved since. */
  async push(force = false) {
    if (!this.signedIn || !this.available) return;
    clearTimeout(this._timer);
    this.state = 'syncing';
    const h = hashSave(G.save);
    const r = await api('PUT', 'save', { baseRev: this.cred.rev, force, save: G.save }, this.cred.token);
    if (r.status === 200) {
      this.cred.rev = r.data.rev; this.cred.h = h; this.cred.dirty = hashSave(G.save) !== h; storeCred(this.cred);
      if (this.cred.dirty) this.noteWriteLater();
      this.state = 'ok'; this.lastSync = Date.now(); this.msg = ''; this.conflict = null;
    } else if (r.status === 409) {
      const s = await api('GET', 'save', null, this.cred.token);
      this.conflict = s.status === 200 ? s.data : null;
      this.state = 'conflict'; this.msg = 'Another device saved to this account';
    } else if (r.status === 401) this.signOutLocal('Signed out: please sign in again');
    else { this.state = r.status === 0 ? 'offline' : 'error'; this.msg = r.data.error || 'Upload failed, will retry'; this._timer = setTimeout(() => this.push(), 30000); }
  },

  /** The player chose which copy wins. */
  resolve(useServer) {
    if (!this.conflict) return;
    if (useServer) this.apply(this.conflict);
    else { this.conflict = null; this.push(true); }
  },

  statusText() {
    if (!this.signedIn) return this.msg || 'Not signed in';
    if (this.state === 'syncing') return 'Saving to server...';
    if (this.state === 'conflict') return this.msg;
    if (this.state === 'offline') return 'Server not reachable (saved on this device)';
    if (this.state === 'error') return this.msg;
    if (this.cred.dirty) return 'Changes waiting to upload';
    return this.lastSync ? `Saved to server ${ago(this.lastSync)}` : 'Signed in';
  },
};

// ------------------------------------------------------------------ sign-in form (real HTML inputs, so phones show a keyboard)
let formEl = null;
export function openSignIn(onDone) {
  if (formEl) return;
  formEl = document.createElement('div');
  formEl.className = 'cloud-form';
  formEl.innerHTML = `
    <form autocomplete="on">
      <h2>Cloud save</h2>
      <p>Keep your progress on this server and continue on another device.</p>
      <label>Name<input name="name" maxlength="20" autocomplete="username" autocapitalize="off" spellcheck="false" required></label>
      <label>Password<input name="password" type="password" minlength="4" maxlength="64" autocomplete="current-password" required></label>
      <p class="hint">2-20 letters, numbers, - or _. Password: 4 or more characters. Don't reuse a password from another site.</p>
      <p class="err" aria-live="polite"></p>
      <div class="row">
        <button type="submit" name="login">Sign in</button>
        <button type="button" name="register">Create account</button>
        <button type="button" name="cancel" class="ghost">Cancel</button>
      </div>
    </form>`;
  document.body.appendChild(formEl);
  const f = formEl.querySelector('form');
  const el = (n) => f.querySelector(`[name="${n}"]`);
  const err = formEl.querySelector('.err');
  const close = (ok) => { formEl.remove(); formEl = null; G.input.keys.clear(); if (onDone) onDone(ok); };
  const go = async (create) => {
    const name = el('name').value.trim(), password = el('password').value;
    if (!/^[A-Za-z0-9_-]{2,20}$/.test(name)) { err.textContent = 'Name: 2-20 letters, numbers, - or _'; return; }
    if (password.length < 4) { err.textContent = 'Password needs at least 4 characters'; return; }
    err.textContent = create ? 'Creating account...' : 'Signing in...';
    for (const b of f.querySelectorAll('button')) b.disabled = true;
    const r = await Cloud.signIn(name, password, create);
    for (const b of f.querySelectorAll('button')) b.disabled = false;
    if (r.ok) close(true); else err.textContent = r.error;
  };
  f.addEventListener('submit', (e) => { e.preventDefault(); go(false); });
  el('register').addEventListener('click', () => go(true));
  el('cancel').addEventListener('click', () => close(false));
  formEl.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(false); });
  setTimeout(() => el('name').focus(), 50);
}
export function signInOpen() { return !!formEl; }
