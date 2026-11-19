// Day view: a cute 3D CD player with the day's disc inside (left) and the live memory card (right).
// The "why" explanation lives in a slide-in drawer so the player and the artwork take centre stage.
import { MemoryRenderer } from './renderer.js';
import { Player, speak, voiceFor } from './player.js';
import { icon } from './icons.js';
import { esc, api, fmtDate } from './util.js';
import { TECHNIQUES } from './style-engine.js';
import { glowOf } from './archive-xmb.js';

const fmt = (s) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00');
const key = (act, ico, label, cls = 'round') => `<button class="key ${cls}" data-act="${act}" title="${label}" aria-label="${label}">${ico}</button>`;

export async function renderDayPlayer(view, id, { autoplay = false } = {}) {
  const [day, all] = await Promise.all([api(`/api/days/${encodeURIComponent(id)}`), api('/api/days')]);
  const asc = [...all].reverse(), idx = asc.findIndex((d) => d.id === day.id);
  const older = asc[idx - 1], newer = asc[idx + 1], st = day.style, T = TECHNIQUES[st.technique], bpm = st.rhythm.bpm;
  const song = { ...day.song, clipUrl: day.clipUrl };
  const songLine = [[song.artist, song.title].filter(Boolean).join(' — '), song.year].filter(Boolean).join(' · ') || 'песня дня';
  const source = song.previewUrl ? 'официальный 30-секундный фрагмент iTunes (не сохраняется)' : song.clipFile ? 'фрагмент ≤30 с вашего файла' : 'ссылка на музыкальный сервис';

  view.innerHTML = `
  <div class="day" style="--tint:${glowOf(st.palette)}">
    <section class="left">
      <div class="player3d"><canvas aria-label="3D-проигрыватель: диск дня"></canvas></div>
      <div class="info">
        <div class="date">${fmtDate(day.date)} · день № ${idx + 1}</div>
        <h1>${esc(day.title)}</h1>
        <div class="song">♪ ${esc(songLine)}</div>
        <div class="tags"><span class="swatches">${st.palette.map((c) => `<i style="background:${c}"></i>`).join('')}</span>
          <span class="chip">${esc(T.label)}</span><span class="chip">${esc(st.moodLabel)}</span><span class="chip">${bpm} BPM</span></div>
      </div>
      <div class="transport">
        ${key('shuffle', icon.shuffle, 'Случайный день')}${key('prev', icon.prev, 'Предыдущий день (PgUp)')}
        ${key('play', icon.play, 'Играть (пробел)', 'big primary')}
        ${key('next', icon.next, 'Следующий день (PgDn)')}${key('restart', icon.repeat, 'Сначала')}
      </div>
      <div class="progress"><span class="cur">0:00</span><input class="seek" type="range" min="0" max="1000" value="0" aria-label="Позиция"><span class="dur">0:00</span></div>
      <div class="subrow">
        <span class="vol">${key('vol-', icon.minus, 'Тише (↓)')}<meter min="0" max="1" value="1" aria-label="Громкость"></meter>${key('vol+', icon.plus, 'Громче (↑)')}</span>
        <button class="key" data-act="voice" aria-pressed="false">${icon.voice}<span>Озвучить</span></button>
        <button class="key soft" data-act="why" aria-expanded="false" aria-controls="why-drawer">${icon.sparkle}<span>Почему такой стиль?</span></button>
      </div>
      <div class="embed"></div>
    </section>
    <section class="right"><div class="memory"><canvas aria-label="Воспоминание дня"></canvas><button class="enter" hidden><span>▶ войти в день</span></button></div></section>
  </div>
  <div class="scrim"></div>
  <aside class="drawer" id="why-drawer" aria-hidden="true" aria-label="Почему такой стиль">
    <header><h2>Почему такой стиль?</h2>${key('closewhy', icon.close, 'Закрыть')}</header>
    <div class="dbody">
      <div class="tech-card"><b>${esc(T.label)}</b><div class="hint">${esc(T.ref)}</div><p style="margin:.4em 0 0">${esc(T.why)}.</p></div>
      <ul class="why">${st.reasons.map((x) => `<li><b>${esc(x.k)}</b><span>${esc(x.v)}</span></li>`).join('')}<li><b>Голос</b><span>${esc(voiceFor(st).label)}</span></li></ul>
      <div><div class="label">Запись дня</div><div class="entry-text">${esc(day.text)}</div></div>
      <div class="hint">♪ ${esc(source)}</div>
      <div class="folder">Папка: archive/${esc(day.id)}/</div>
      <div><button class="key" data-act="restyle">${icon.repeat}<span>Перерисовать по текущим правилам</span></button>
        <div class="hint" style="margin-top:6px">Обновит палитру, технику и постер по нынешним правилам. Текст, фото, песня и название останутся прежними.</div></div>
    </div>
  </aside>`;

  // Work only with this view's own nodes: if the user navigates away mid-load we must not touch the next view.
  const nodes = [...view.children], root = nodes[0], $ = (s) => view.querySelector(s), $$ = (s) => [...view.querySelectorAll(s)];
  const playBtn = $('[data-act=play]'), seek = $('.seek'), enter = $('.enter'), drawer = $('.drawer'), scrim = $('.scrim'), whyBtn = $('[data-act=why]');
  const go = (d, play) => { if (d) location.hash = `#/day/${encodeURIComponent(d.id)}${play ? '?play' : ''}`; };
  $('[data-act=prev]').disabled = !older; $('[data-act=next]').disabled = !newer; $('[data-act=shuffle]').disabled = all.length < 2;

  const player = new Player(song, null);
  player.mount($('.embed'));
  $('.embed').hidden = !$('.embed').innerHTML;
  const startMusic = autoplay && player.hasAudio ? player.play().then(() => true, () => false) : Promise.resolve(false); // music first

  let actions = {};
  const r = new MemoryRenderer($('.memory canvas'), { ...day, photos: day.photoUrls, song, dayNumber: idx + 1 });
  const [, p3d] = await Promise.all([
    r.load(),
    import('./player3d.js')
      .then(({ createPlayer3D }) => createPlayer3D($('.player3d canvas'), { posterUrl: day.posterUrl, palette: st.palette, bpm, onKey: (act) => actions[act]?.() }))
      .catch((err) => { console.warn('3D player unavailable, using a flat disc:', err); return null; }),
  ]);
  if (!root.isConnected) { p3d?.dispose(); player.destroy(); return () => {}; }
  let flatDisc = null;
  if (!p3d) {
    const box = $('.player3d'); box.classList.add('flat');
    box.innerHTML = `<div class="flat-player"><div class="flat-disc" style="background-image:url('${day.posterUrl}');--spin:${(240 / bpm).toFixed(3)}s"></div></div>`;
    flatDisc = box.querySelector('.flat-disc');
  }
  player.attach(r);
  r.start();
  if (player.hasAudio && !(await startMusic)) enter.hidden = false;

  const isPlaying = () => (player.hasAudio ? player.playing : !r.paused);
  const sync = () => {
    const on = isPlaying();
    p3d?.setPlaying(on); flatDisc?.classList.toggle('on', on);
    playBtn.innerHTML = on ? icon.pause : icon.play;
    playBtn.setAttribute('aria-label', on ? 'Пауза (пробел)' : 'Играть (пробел)');
    $('.vol meter').value = player.volume; p3d?.setVolume(player.volume);
  };
  const toggle = async () => {
    if (isPlaying()) { player.pause(); r.pause(); }
    else { r.resume(); if (player.hasAudio) await player.play().catch(() => { enter.hidden = false; }); }
    if (isPlaying()) enter.hidden = true;
    sync();
  };
  const nudge = (sec) => {
    if (player.hasAudio) player.audio.currentTime = Math.max(0, Math.min((player.audio.duration || 30) - 0.2, player.audio.currentTime + sec));
    else r.seek(r.time + Math.sign(sec) * st.rhythm.photoSeconds);
  };
  const setDrawer = (open) => {
    drawer.classList.toggle('open', open); scrim.classList.toggle('open', open);
    drawer.setAttribute('aria-hidden', String(!open)); whyBtn.setAttribute('aria-expanded', String(open));
    (open ? drawer.querySelector('[data-act=closewhy]') : whyBtn).focus({ preventScroll: true });
  };
  actions = {
    play: toggle,
    shuffle: () => { const others = all.filter((d) => d.id !== day.id); go(others[Math.floor(Math.random() * others.length)], isPlaying()); },
    restart: () => { r.restart(); if (player.audio) player.audio.currentTime = 0; },
    prev: () => go(older, isPlaying()), next: () => go(newer, isPlaying()),
    'vol+': () => { player.setVolume(player.volume + 0.1); sync(); }, 'vol-': () => { player.setVolume(player.volume - 0.1); sync(); },
    voice: () => {
      const b = $('[data-act=voice]');
      if (speechSynthesis.speaking) { speechSynthesis.cancel(); b.setAttribute('aria-pressed', 'false'); return; }
      const u = speak(day.text, st, player); b.setAttribute('aria-pressed', 'true');
      u.addEventListener('end', () => b.setAttribute('aria-pressed', 'false'));
    },
    why: () => setDrawer(!drawer.classList.contains('open')), closewhy: () => setDrawer(false),
    restyle: async () => {
      const b = $('[data-act=restyle]'); b.disabled = true; b.querySelector('span').textContent = 'Перерисовываю…';
      try {
        const { restyleDay } = await import('./restyle.js');
        await restyleDay(day.id, idx + 1);
        window.dispatchEvent(new HashChangeEvent('hashchange')); // re-open this day with its new style
      } catch (err) { b.disabled = false; b.querySelector('span').textContent = `Не вышло: ${err.message}`; }
    },
  };
  const onClick = (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    if (['play', 'prev', 'next'].includes(b.dataset.act)) p3d?.press(b.dataset.act); // the 3D key moves with the HTML one
    actions[b.dataset.act]?.();
  };
  nodes.forEach((n) => n.addEventListener('click', onClick));
  scrim.addEventListener('click', () => setDrawer(false));
  enter.onclick = toggle;
  player.audio?.addEventListener('play', sync); player.audio?.addEventListener('pause', sync);

  let dragging = false;
  seek.addEventListener('input', () => {
    dragging = true;
    const k = seek.value / 1000;
    if (player.hasAudio && player.audio.duration) player.audio.currentTime = k * player.audio.duration; else r.seek(k * r.cycle);
  });
  seek.addEventListener('change', () => { dragging = false; });

  let raf = 0, lcdAt = 0;
  const tick = (now) => {
    const audio = player.hasAudio && player.audio.duration ? player.audio : null;
    const d = audio ? audio.duration : r.cycle, t = audio ? audio.currentTime : r.time % d;
    if (!dragging) seek.value = d ? Math.round((t / d) * 1000) : 0;
    seek.style.setProperty('--p', `${seek.value / 10}%`);
    $('.cur').textContent = fmt(t); $('.dur').textContent = fmt(d);
    if (p3d && now - lcdAt > 200) {
      lcdAt = now;
      const level = player.level() ?? (r.paused ? 0 : (r.lastFrame?.pulse || 0) * 0.85);
      p3d.display({ line1: `${isPlaying() ? '▶' : '❚❚'} ${fmt(t)}`, line2: `${bpm} BPM · ${T.label}`, level: Math.min(1, level) });
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  const onKey = (e) => {
    if (e.target.closest?.('input, textarea, select') || e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key, open = drawer.classList.contains('open');
    if (k === 'Escape') { if (open) setDrawer(false); else location.hash = '#/'; }
    else if (open) return;
    else if (k === ' ') { p3d?.press('play'); toggle(); }
    else if (k === 'ArrowLeft') nudge(-5); else if (k === 'ArrowRight') nudge(5);
    else if (k === 'ArrowUp') actions['vol+'](); else if (k === 'ArrowDown') actions['vol-']();
    else if (k === 'PageUp') actions.prev(); else if (k === 'PageDown') actions.next();
    else return;
    e.preventDefault();
  };
  window.addEventListener('keydown', onKey);
  sync();

  return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); r.stop(); p3d?.dispose(); player.destroy(); };
}
