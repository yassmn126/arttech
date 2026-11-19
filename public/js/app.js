// Router + archive feed + day view.
import { MemoryRenderer } from './renderer.js';
import { Player, speak, voiceFor } from './player.js';
import { renderCompose } from './compose.js';
import { esc, api, fmtDate } from './util.js';

const view = document.getElementById('view');
let cleanup = () => {};

async function route() {
  cleanup(); cleanup = () => {};
  const h = decodeURIComponent(location.hash.slice(1) || '/');
  const cur = h === '/new' ? 'new' : h === '/' ? 'archive' : '';
  document.querySelectorAll('[data-nav]').forEach((a) => a.toggleAttribute('aria-current', a.dataset.nav === cur));
  try {
    if (h === '/new') cleanup = (await renderCompose(view)) || cleanup;
    else if (h.startsWith('/day/')) cleanup = await renderDay(h.slice(5));
    else await renderArchive();
  } catch (e) {
    view.innerHTML = `<p class="status">Ошибка: ${esc(e.message)}</p>`;
    console.error(e);
  }
  window.scrollTo(0, 0);
}

async function renderArchive() {
  const days = await api('/api/days');
  view.innerHTML = `
    <h1>Архив дней</h1>
    <p class="lede">Каждый день — отдельная папка и одна страница дневника. Общая сетка и шрифт делают их серией; палитра, фактура, ритм и техника приходят из текста, фото и песни.</p>
    ${days.length ? `<div class="feed">${days.map((d) => `
      <a class="card" href="#/day/${encodeURIComponent(d.id)}">
        <img src="${d.posterUrl}" alt="" loading="lazy">
        <h3>${esc(d.title)}</h3>
        <div class="meta"><span>${fmtDate(d.date)}</span><span class="chips">${(d.palette || []).map((c) => `<i style="background:${c}"></i>`).join('')}</span></div>
        <div class="meta"><span>${esc(d.moodLabel || '')}</span></div>
      </a>`).join('')}</div>`
    : `<div class="empty">Пока пусто. <a href="#/new">Запишите первый день →</a></div>`}`;
}

async function renderDay(id) {
  const [day, all] = await Promise.all([api(`/api/days/${encodeURIComponent(id)}`), api('/api/days')]);
  const asc = [...all].reverse(), pos = asc.findIndex((d) => d.id === day.id);
  const prev = asc[pos - 1], next = asc[pos + 1], st = day.style;
  const song = { ...day.song, clipUrl: day.clipUrl };
  view.innerHTML = `
    <div class="day">
      <div class="frame"><canvas></canvas><button class="enter">▶ войти в день</button></div>
      <aside class="side">
        <div><div class="label">${fmtDate(day.date)} · день № ${pos + 1}</div><h1>${esc(day.title)}</h1>
          <div class="folder">📁 archive/${esc(day.id)}/</div></div>
        <div><div class="label">${esc(st.moodLabel)} · ${esc(st.techniqueLabel)}</div>
          <div class="swatches">${[st.paper, ...st.palette].map((c) => `<i style="background:${c}"></i>`).join('')}</div></div>
        <div class="controls">
          <button class="play" ${song.clipUrl || song.previewUrl ? '' : 'hidden'}>▶ музыка</button>
          <button class="ghost voice">🔊 озвучить</button>
          <button class="ghost again">↻ сначала</button>
        </div>
        <div class="player"></div>
        <div class="hint">♪ ${esc([song.artist, song.title].filter(Boolean).join(' — '))}${song.year ? ` · ${song.year}` : ''}${song.previewUrl ? ' · официальный 30-сек. фрагмент' : song.clipFile ? ' · фрагмент ≤30 с вашего файла' : ''}</div>
        <div class="entry-text">${esc(day.text)}</div>
        <div><div class="label">Почему этот день выглядит так</div>
          <ul class="why">${st.reasons.map((r) => `<li><b>${esc(r.k)}</b><span>${esc(r.v)}</span></li>`).join('')}
            <li><b>Голос</b><span>${esc(voiceFor(st).label)}</span></li></ul></div>
        <div class="pager">${prev ? `<a href="#/day/${encodeURIComponent(prev.id)}">← ${esc(prev.title)}</a>` : '<span></span>'}
          ${next ? `<a href="#/day/${encodeURIComponent(next.id)}">${esc(next.title)} →</a>` : ''}</div>
      </aside>
    </div>`;

  const cv = view.querySelector('canvas');
  const r = await new MemoryRenderer(cv, { ...day, photos: day.photoUrls, song, dayNumber: pos + 1 }).load();
  r.start();
  const player = new Player(song, r);
  player.mount(view.querySelector('.player'));
  const playBtn = view.querySelector('.play');
  const sync = () => { playBtn.textContent = player.playing ? '❚❚ пауза' : '▶ музыка'; };
  playBtn.onclick = async () => { player.playing ? player.pause() : await player.play(); sync(); };
  view.querySelector('.enter').onclick = async (e) => {
    e.currentTarget.remove(); r.restart();
    if (player.hasAudio) { await player.play().catch(console.warn); sync(); }
  };
  view.querySelector('.again').onclick = () => { r.restart(); if (player.audio) player.audio.currentTime = 0; };
  view.querySelector('.voice').onclick = () => speak(day.text, st, player);
  return () => { r.stop(); player.destroy(); };
}

window.addEventListener('hashchange', route);
route();
