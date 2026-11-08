// Settings overlay shared by the title screen, the hearth and the pause menu:
// controls, keyboard keys, sound, cloud save and save-file backup.
import { G } from '../core/G.js';
import { drawText, wrap } from '../core/font.js';
import { button, panel, COL, title, shade } from '../core/ui.js';
import { writeSave } from '../core/save.js';
import { ACTIONS, binds, setBind, resetBinds, keyName } from '../core/keys.js';
import { Cloud, openSignIn, signInOpen, describeSave, ago } from '../core/cloud.js';

const CONTROL_MODES = ['auto', 'touch', 'keys'];
const CONTROL_LABEL = { auto: 'Auto', touch: 'Touch', keys: 'Keyboard + mouse' };
const CONTROL_HELP = {
  auto: 'Touch buttons appear when you touch the screen and hide when you use keys or a mouse.',
  touch: 'Always show the touch joystick and buttons.',
  keys: 'Never show the joystick. Mouse: hold left to attack, right-click to roll.',
};

export class SettingsPanel {
  /** onClose() runs when the player backs out. inStage: hides the options that only make sense outside a fight. */
  constructor(onClose, opt = {}) {
    this.onClose = onClose;
    this.page = 'main';
    this.listen = null; // { action, slot } while waiting for a key
    this.note = '';
    this.inStage = !!opt.inStage;
    this.t = 0;
  }

  close() { writeSave(G.save); if (this.onClose) this.onClose(); }

  /** Draw and handle input. Call every frame while open. */
  draw(ctx) {
    this.t += G.dt;
    shade(ctx, 0.72);
    if (signInOpen()) return;
    if (this.page === 'keys') this.drawKeys(ctx);
    else if (this.page === 'cloud') this.drawCloud(ctx);
    else this.drawMain(ctx);
  }

  frame(ctx, w, h, label) {
    w = Math.min(w, G.W - G.safeL - G.safeR - 8);
    h = Math.min(h, G.H - 8);
    const x = Math.round(G.W / 2 - w / 2), y = Math.round(G.H / 2 - h / 2);
    panel(ctx, x, y, w, h, { edge: COL.bronzeD });
    title(ctx, label, G.W / 2, y + 7);
    return { x, y, w, h };
  }

  drawMain(ctx) {
    const s = G.save.settings;
    const f = this.frame(ctx, 300, 196, 'Settings');
    const x = f.x + 10, bw = f.w - 20, half = Math.floor(bw / 2) - 2;
    let y = f.y + 26;
    const mode = s.controls || 'auto';
    if (button(ctx, x, y, bw, 17, `Controls: ${CONTROL_LABEL[mode]}`)) {
      s.controls = CONTROL_MODES[(CONTROL_MODES.indexOf(mode) + 1) % CONTROL_MODES.length];
      writeSave(G.save);
    }
    y += 19;
    const help = wrap(CONTROL_HELP[mode], bw);
    help.forEach((l, i) => drawText(ctx, l, G.W / 2, y + i * 9, { align: 'center', color: COL.faint }));
    y += 4 + help.length * 9;
    if (button(ctx, x, y, half, 17, 'Keyboard keys...')) { this.page = 'keys'; this.note = ''; }
    if (button(ctx, x + half + 4, y, half, 17, `Joystick: ${(s.joy || 'fixed') === 'fixed' ? 'Fixed' : 'Floating'}`)) {
      s.joy = (s.joy || 'fixed') === 'fixed' ? 'floating' : 'fixed'; writeSave(G.save);
    }
    y += 21;
    if (button(ctx, x, y, half, 17, `Music: ${s.music ? 'On' : 'Off'}`)) { s.music = !s.music; G.audio.setMusic(s.music); writeSave(G.save); }
    if (button(ctx, x + half + 4, y, half, 17, `Sound: ${s.sfx ? 'On' : 'Off'}`)) { s.sfx = !s.sfx; G.audio.sfxOn = s.sfx; writeSave(G.save); }
    y += 23;
    // cloud save
    if (Cloud.available) {
      const label = Cloud.signedIn ? `Cloud save: ${Cloud.cred.name}` : 'Cloud save: sign in...';
      if (button(ctx, x, y, bw, 17, label, { color: Cloud.state === 'conflict' ? COL.red : '#ffe0a0' })) this.page = 'cloud';
      y += 19;
      drawText(ctx, Cloud.statusText(), G.W / 2, y, { align: 'center', color: Cloud.state === 'conflict' ? COL.red : COL.faint });
    } else {
      drawText(ctx, 'Cloud save: only when the game is opened from', G.W / 2, y, { align: 'center', color: COL.faint });
      drawText(ctx, 'an Ashveil server (see README). Use backups here.', G.W / 2, y + 9, { align: 'center', color: COL.faint });
      y += 7;
    }
    y += 12;
    if (!this.inStage) {
      if (button(ctx, x, y, half, 17, 'Back up save (file)')) this.exportSave();
      if (button(ctx, x + half + 4, y, half, 17, 'Restore from file')) this.importSave();
    }
    if (this.note) drawText(ctx, this.note, G.W / 2, f.y + f.h - 31, { align: 'center', color: COL.gold });
    if (button(ctx, f.x + f.w / 2 - 40, f.y + f.h - 21, 80, 16, 'Done', { color: '#ffe0a0', sound: 'uiBack' }) || G.input.keyPressed('Escape')) this.close();
  }

  // ------------------------------------------------------------ key bindings
  drawKeys(ctx) {
    const f = this.frame(ctx, 340, 196, 'Keyboard keys');
    const B = binds();
    const col = Math.floor((f.w - 24) / 2);
    const rows = Math.ceil(ACTIONS.length / 2);
    const slotW = Math.max(34, Math.min(42, col - 96));
    ACTIONS.forEach(([a, label], i) => {
      const cx = f.x + 10 + (i >= rows ? col + 4 : 0);
      const y = f.y + 24 + (i % rows) * 17;
      drawText(ctx, label, cx, y + 4, { color: COL.dim });
      for (let k = 0; k < 2; k++) {
        const sx = cx + col - (2 - k) * (slotW + 2);
        const on = this.listen && this.listen.action === a && this.listen.slot === k;
        const txt = on ? (Math.floor(this.t * 3) % 2 ? '...' : '') : keyName(B[a][k]);
        if (button(ctx, sx, y, slotW, 15, txt, { selected: on, color: B[a][k] ? COL.text : COL.faint })) {
          this.listen = { action: a, slot: k }; this.note = '';
        }
      }
    });
    const by = f.y + f.h - 21;
    if (this.listen) {
      const name = ACTIONS.find((x) => x[0] === this.listen.action)[1];
      drawText(ctx, `Press a key for "${name}".  Esc: cancel   Backspace: clear`, G.W / 2, by - 11, { align: 'center', color: COL.gold });
      const pressed = [...G.input.pressed].filter((c) => !/^(Shift|Control|Alt|Meta)(Left|Right)$/.test(c));
      if (pressed.length) {
        const code = pressed.includes('Escape') ? 'Escape' : pressed.find((c) => /^(Shift|Control|Alt|Meta)$/.test(c)) || pressed[0];
        if (code === 'Escape') this.listen = null;
        else {
          const value = code === 'Backspace' || code === 'Delete' ? null : code;
          const moved = setBind(this.listen.action, this.listen.slot, value);
          this.note = moved ? `${keyName(value)} was taken off "${ACTIONS.find((x) => x[0] === moved)[1]}"` : '';
          this.listen = null;
          writeSave(G.save);
        }
        G.input.pressed.clear();
      }
      return;
    }
    drawText(ctx, this.note || 'Tap a box, then press the new key. Esc always pauses too.', G.W / 2, by - 11, { align: 'center', color: this.note ? COL.gold : COL.faint });
    if (button(ctx, f.x + 10, by, 92, 16, 'Reset defaults')) { resetBinds(); writeSave(G.save); this.note = 'Keys reset to the defaults'; }
    if (button(ctx, f.x + f.w - 70, by, 60, 16, 'Back', { color: '#ffe0a0', sound: 'uiBack' }) || G.input.keyPressed('Escape')) { this.page = 'main'; this.note = ''; }
  }

  // ------------------------------------------------------------ cloud save
  drawCloud(ctx) {
    const f = this.frame(ctx, 300, 176, 'Cloud save');
    const x = f.x + 12, bw = f.w - 24;
    let y = f.y + 26;
    const line = (t, col = COL.dim) => { drawText(ctx, t, G.W / 2, y, { align: 'center', color: col }); y += 11; };
    if (!Cloud.signedIn) {
      line('Sign in to keep your progress on this server');
      line('and carry on from another phone or computer.');
      line(Cloud.msg || '', COL.gold);
      y += 6;
      if (button(ctx, x + bw / 2 - 70, y, 140, 18, 'Sign in / Create account', { color: '#ffe0a0' })) openSignIn(() => {});
    } else if (Cloud.state === 'conflict' && Cloud.conflict) {
      const c = Cloud.conflict;
      line(Cloud.msg, COL.red);
      line(`Server: ${describeSave(c.save)}  (${ago(c.updatedAt)})`, COL.text);
      line(`This device: ${describeSave(G.save)}`, COL.text);
      line('Which one do you want to keep?', COL.dim);
      y += 4;
      const half = Math.floor(bw / 2) - 2;
      if (button(ctx, x, y, half, 18, 'Use server save', { color: '#ffe0a0' })) {
        if (this.inStage) this.note = 'Return to Greyhollow first';
        else Cloud.resolve(true);
      }
      if (button(ctx, x + half + 4, y, half, 18, 'Keep this device')) Cloud.resolve(false);
      y += 22;
      drawText(ctx, 'The other copy is replaced.', G.W / 2, y, { align: 'center', color: COL.faint });
    } else {
      line(`Signed in as ${Cloud.cred.name}`, COL.text);
      line(Cloud.statusText(), Cloud.state === 'offline' || Cloud.state === 'error' ? COL.red : COL.dim);
      line('Your progress uploads a few seconds after each save.', COL.faint);
      y += 6;
      const half = Math.floor(bw / 2) - 2;
      if (button(ctx, x, y, half, 18, 'Sync now')) Cloud.check();
      if (button(ctx, x + half + 4, y, half, 18, 'Sign out')) Cloud.signOut();
    }
    if (this.note) drawText(ctx, this.note, G.W / 2, f.y + f.h - 31, { align: 'center', color: COL.gold });
    if (button(ctx, f.x + f.w / 2 - 30, f.y + f.h - 21, 60, 16, 'Back', { color: '#ffe0a0', sound: 'uiBack' }) || G.input.keyPressed('Escape')) { this.page = 'main'; this.note = ''; }
  }

  // ------------------------------------------------------------ save file backup (works anywhere, no server needed)
  exportSave() {
    try {
      const blob = new Blob([JSON.stringify(G.save, null, 1)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `ashveil-save-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      this.note = 'Save file downloaded';
    } catch (e) { this.note = 'Could not create the file'; }
  }

  importSave() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = () => {
      const file = inp.files && inp.files[0];
      if (!file) return;
      file.text().then((txt) => {
        let data = null;
        try { data = JSON.parse(txt); } catch (e) { data = null; }
        if (!data || data.v !== 1 || typeof data.heroes !== 'object') { this.note = 'That is not an Ashveil save file'; return; }
        if (!window.confirm(`Replace this device's progress (${describeSave(G.save)}) with the file (${describeSave(data)})?`)) return;
        data.settings = Object.assign({ music: true, sfx: true, joy: 'fixed', controls: 'auto' }, data.settings || {});
        G.save = data;
        writeSave(G.save);
        this.note = 'Save restored';
        if (G.onSaveReplaced) G.onSaveReplaced();
      });
    };
    inp.click();
  }
}
