// Router + header. Screens: home (jewel-case list + 3D CD player; /day/<id> deep-links into it) and new day (compose).
import { renderHome } from './home.js';
import { renderCompose } from './compose.js';
import { renderStats } from './stats.js';
import { esc, api } from './util.js';

const view = document.getElementById('view');
let cleanup = () => {}, nav = 0;

async function route() {
  const token = ++nav;
  cleanup(); cleanup = () => {};
  const [path, query = ''] = decodeURIComponent(location.hash.slice(1) || '/').split('?');
  const screen = path === '/new' ? 'new' : path === '/stats' ? 'stats' : 'home';
  document.body.dataset.route = screen;
  document.querySelectorAll('[data-nav]').forEach((a) => a.toggleAttribute('aria-current', a.dataset.nav === screen));
  try {
    const c = screen === 'new' ? await renderCompose(view)
      : screen === 'stats' ? await renderStats(view)
      : await renderHome(view, { id: path.startsWith('/day/') ? path.slice(5) : null, autoplay: query.split('&').includes('play') });
    if (token !== nav) { c?.(); return; } // a newer navigation won the race
    cleanup = c || (() => {});
  } catch (e) {
    if (token !== nav) return;
    view.innerHTML = `<div class="desk"><section class="win" style="max-width:520px"><div class="titlebar"><span class="tt">Что-то пошло не так</span></div>
      <div class="wbody"><p class="status">${esc(e.message)}</p><a class="pill" href="#/">На главную</a></div></section></div>`;
    console.error(e);
  }
  window.scrollTo(0, 0);
  refreshCount();
}

async function refreshCount() {
  try { document.querySelector('.nav-count').textContent = (await api('/api/days')).length || ''; } catch { /* offline */ }
}

// "Капсула времени": on the home screen the list glides to a random day; elsewhere we jump there with ?play.
document.addEventListener('click', async (e) => {
  if (!e.target.closest('[data-capsule]')) return;
  if (document.body.dataset.route === 'home') { window.dispatchEvent(new Event('genesis:capsule')); return; }
  const days = await api('/api/days').catch(() => []);
  if (!days.length) { location.hash = '#/new'; return; }
  const d = days[Math.floor(Math.random() * days.length)];
  location.hash = `#/day/${encodeURIComponent(d.id)}?play`;
});

window.addEventListener('hashchange', route);
route();
