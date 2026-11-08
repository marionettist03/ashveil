// Loads the editable game data in /data/*.json (stats, stages, story, items).
// If a file has a typo, the page says which file and where instead of going blank.
export async function loadJSON(name) {
  const url = new URL('../../data/' + name, import.meta.url);
  let text = '';
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    text = await res.text();
  } catch (e) {
    bootError(`Could not load data/${name} (${e.message}).`);
    throw e;
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    const m = /position (\d+)/.exec(e.message);
    const where = m ? ` on line ${text.slice(0, +m[1]).split('\n').length}` : '';
    bootError(`data/${name} has a mistake${where}: ${e.message}`);
    throw e;
  }
}

function bootError(msg) {
  const show = () => {
    const d = document.createElement('pre');
    d.style.cssText = 'position:fixed;inset:0;margin:0;padding:16px;background:#0d0a10;color:#ffd24a;font:14px/1.4 monospace;white-space:pre-wrap;z-index:99';
    d.textContent = 'Ashveil could not start.\n\n' + msg + '\n\nTip: run  node tools/check-data.mjs  to find the problem.';
    document.body.appendChild(d);
  };
  if (document.body) show(); else window.addEventListener('DOMContentLoaded', show);
}
