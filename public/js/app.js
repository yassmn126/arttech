// Router + header. Screens: archive (3D disc shelf), day (3D player + memory card), new day (compose).
import { renderArchive } from './archive-xmb.js';
import { renderDayPlayer } from './day-player.js';
import { renderCompose } from './compose.js';
import { esc, api } from './util.js';

const view = document.getElementById('view');
let cleanup = () => {}, nav = 0;

async function route() {
  const token = ++nav;
  cleanup(); cleanup = () => {};
  const [path, query = ''] = decodeURIComponent(location.hash.slice(1) || '/').split('?');
  const screen = path === '/new' ? 'new' : path.startsWith('/day/') ? 'day' : 'archive';
  document.body.dataset.route = screen;
  document.querySelectorAll('[data-nav]').forEach((a) => a.toggleAttribute('aria-current', a.dataset.nav === screen));
  try {
    let c;
    if (screen === 'new') c = await renderCompose(view);
    else if (screen === 'day') c = await renderDayPlayer(view, path.slice(5), { autoplay: query.split('&').includes('play') });
    else c = await renderArchive(view);
    if (token !== nav) { c?.(); return; } // a newer navigation won the race
    cleanup = c || (() => {});
  } catch (e) {
    if (token !== nav) return;
    view.innerHTML = `<div class="desk"><section class="win" style="max-width:520px"><div class="titlebar"><span class="tt">Что-то пошло не так</span></div>
      <div class="wbody"><p class="status">${esc(e.message)}</p><a class="pill" href="#/">В архив</a></div></section></div>`;
    console.error(e);
  }
  window.scrollTo(0, 0);
  refreshCount();
}

async function refreshCount() {
  try { document.querySelector('.nav-count').textContent = (await api('/api/days')).length || ''; } catch { /* offline */ }
}

window.addEventListener('hashchange', route);
route();
